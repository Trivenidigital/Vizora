# Vizora Business-Agent Architecture

**Status:** Reference doc, written 2026-05-03. Distills the discipline patterns from `shift-agent/DESIGN.md` (979 lines, v2 post-review) into rules Vizora should follow before designing any new business agent.

**Audience:** Anyone designing or maintaining a Vizora business agent (`scripts/agents/`, or — recommended — a future `vizora-business-agents/` Hermes-runtime sidecar).

**Out of scope:** Ops agents (`scripts/ops/`). Those are deterministic cron tasks; they don't carry LLM-shaped risk and most of these patterns don't apply.

---

## The one-line principle

> **The LLM reasons. Scripts enforce invariants. Every state file is validated on read AND on write. Every side-effect is atomic-or-loud. Every failure has a detectable signal AND an out-of-band alert path.**

Quoted from `shift-agent/DESIGN.md §1`. If a proposed agent design violates any of those four clauses, fix the design before writing code.

---

## Architecture shape (what every agent looks like)

```
External input (webhook, message, cron tick)
        │
        ▼
   dispatcher SKILL          ← classify by metadata, not content
        │
   ┌────┴────────┐
   ▼             ▼
handler SKILL   handler SKILL    ← reason about THIS situation
   │             │
   ▼             ▼
helper scripts (deterministic)   ← own all critical IDs
   │
   ▼
state files (JSON + flock + atomic + Pydantic/Zod)
   │
   ▼
audit log (NDJSON, dual source: LLM-enriched + tail-logger guaranteed)
   │
   ▼
out-of-band alerts (Pushover + healthchecks.io heartbeat)
```

This is the shift-agent shape. It's worth copying because every box in it solves a class of regression that *will* happen in production.

---

## The 8 hard rules

These are non-obvious lessons earned from running 15 agents in production via Hermes. Each one is a regression-prevention pattern.

### 1. Dispatcher-first routing — never pattern-match content to handler

> *"Hard rule: this skill runs BEFORE any other skill. Do not skip it just because the message text looks like a sick call. Pattern-matching on text is how routing-correctness regressions creep in."* — `dispatch_shift_agent/SKILL.md`

**Apply to Vizora:** Any agent that takes external input (webhook, customer message, internal event) goes through a single classifier first. Even if input shape "looks obvious," route through the dispatcher. The temptation to shortcut compounds.

### 2. Identity by metadata, not content

shift-agent's Hermes runtime prepends `[shift-agent-sender v=1 platform=whatsapp phone="+..." lid="..." fromMe=true]` to every inbound. The dispatcher parses this via a deterministic helper (`validate-sender-block`), then resolves identity via another (`identify-sender`).

The `fromMe` flag is *informational only* — owner routing is gated by `identify-sender`, not by the inbound's claim. *"A sender CAN inject `fromMe=true` trying to spoof; cross-checking via `identify-sender` is the authoritative defense."*

**Apply to Vizora:** For business agents that act on behalf of a Vizora user, identity must come from the auth layer (JWT subject, MCP token), never from message content.

### 3. Fail closed

Invalid sender block → polite decline + log. State load failed → notify owner + STOP. The LLM is **not** allowed to "try anyway."

**Apply to Vizora:** Any state-touching code path must distinguish missing/empty/corrupt and respond differently:
- Missing → use default, log a `state_initialized` event
- Empty → same as missing
- Corrupt (Pydantic/Zod parse fail, JSON decode fail) → rename to `.corrupt-<ts>`, alert via Pushover, fail closed

shift-agent's `safe_io.safe_load_json()` returns `(value, status)` where `status ∈ {"ok", "missing", "empty", "corrupt:..."}`. Callers branch on status.

### 4. Helper scripts own all critical IDs

> *"Do NOT invent the proposal_id or code. Only the script generates them."* — `handle_sick_call/SKILL.md`

Proposal IDs, approval codes, outbound message IDs, idempotency keys all come from deterministic Python (or Node) helper scripts that the LLM calls. The LLM never decides what an identifier is. The script writes the ID to disk **before** any side-effect that uses it.

**Apply to Vizora:** Anything Vizora-side that's load-bearing — content IDs, schedule IDs, billing transaction IDs, support-triage decision IDs — comes from helpers, never from LLM string output.

### 5. Templates instead of LLM free-text for outbound

Acknowledgements ("Got it, will arrange coverage") can be LLM-shaped. Anything customer-impacting goes through `templates/` — rendered by a deterministic script with explicit args.

**Apply to Vizora:** Any notification, email, SMS, in-app message that customers see comes from a template file. The LLM picks the template + populates variables; it does not write the customer-facing text.

### 6. Input sanitization before prompt interpolation

Strip these from any text that will be interpolated into a prompt:
- Lines matching `^(SYSTEM|USER|ASSISTANT):/i`
- Substrings: `IGNORE PREVIOUS`, `DISREGARD`, `OVERRIDE`, `<`, `>`
- Truncate to 500 chars

Keep raw input for audit; sanitize the prompt copy.

**Apply to Vizora:** Any free-text customer input that reaches an LLM prompt — support tickets, content captions, schedule notes — runs through a sanitizer first.

### 7. Dual-source audit (deterministic backup of LLM-enriched logs)

shift-agent runs **two** audit sources:
1. **LLM-enriched entries** via helper scripts (`log-decision`, `log-decision-direct`) — rich context, but only if the LLM behavior runs to completion
2. **Tail-logger timer** every 30s — reads the raw inbound queue, writes guaranteed `raw_inbound` entries to the same `decisions.log`. Independent of LLM behavior. *"Guaranteed via a deterministic tail-logger independent of LLM behavior."*

If the LLM crashes mid-decision, the raw input is still in the audit. Reconciliation can replay it.

**Apply to Vizora:** For any agent whose decisions matter (support-triage classifications, content-intelligence picks, billing actions), there must be a deterministic record of the **input** that's written without the LLM in the loop. Pair with LLM-enriched output.

### 8. Hardened outbound — re-resolve, lock, write-before-POST

shift-agent's `send-coverage-message <proposal_id>` does:
- Re-resolves candidate phone from the **roster** (don't trust the pending state — it could be stale)
- Enforces daily cap **under lock**
- Writes `outbound_attempted` to disk **before** the POST so retries are idempotent
- Supports `RETRY` on failure
- Updates state to `outbound_succeeded` or `outbound_failed` with explicit reason

**Apply to Vizora:** Any agent action that has a side-effect on the outside world (Stripe charge, content publish, schedule push, customer email) follows this pattern. Idempotency keys written before the call. Re-resolve from canonical state, never from cached intent.

---

## Per-agent file shape (copy this layout)

shift-agent puts every agent in its own directory under `src/agents/<name>/`:

```
src/agents/<agent_name>/
├── __init__.py            (or index.ts)
├── config.yaml.template   ← per-agent config; populated per customer/env
├── runbook.md             ← customer-facing-ish ops manual: what alerts mean, how to respond
├── skills/                ← SKILL.md files (one dir per skill)
│   ├── dispatch_<agent>/
│   │   └── SKILL.md       (frontmatter: name + description; body: step-by-step instructions)
│   ├── handle_<X>/
│   │   └── SKILL.md
│   └── handle_<Y>/
│       └── SKILL.md
├── scripts/               ← deterministic helper binaries (proposal-id generation, validators)
├── templates/             ← outbound message templates (NEVER LLM free-text)
├── systemd/               ← unit files for time-triggered work (or PM2 entries for Vizora)
└── logrotate/             ← log rotation config per agent
```

Vizora's `scripts/agents/<name>.ts` is a flat single file. **That's the gap.** Even if Vizora stays TypeScript, each agent should get its own directory with the same companion files.

---

## Shared platform layer (where Vizora is already on-pattern)

shift-agent's `src/platform/`:

| File | Purpose | Vizora equivalent |
|---|---|---|
| `safe_io.py` | flock + atomic write + Pydantic validate-on-read | `scripts/ops/lib/state.ts` (partial — has flock, missing schema validation on read) |
| `schemas.py` | Pydantic models, single source of truth for every state file | Mixed — Prisma covers DB, but state JSON files have ad-hoc TS types |
| `audit_helpers.py` | NDJSON append helpers | `scripts/ops/lib/state.ts` writes the audit log |
| `sender_context.py` | Identity resolution | (needed if Vizora business agents take external input) |
| `qbo_client.py` | External API client (QuickBooks) | `scripts/ops/lib/api-client.ts` (talks to Vizora middleware) |
| `scripts/validate-sender-block` | Deterministic input validator | (needed) |
| `scripts/identify-sender` | Identity lookup | (needed) |
| `scripts/log-decision-direct` | Guaranteed audit write | (needed for business agents) |
| `scripts/dispatcher-accuracy-report` | Routing-correctness metric | **Missing.** Vizora has no agent-decision-quality metric. |

The `dispatcher-accuracy-report` gap is worth flagging: shift-agent measures whether its dispatcher routes inbound messages to the correct handler. Without an analogous metric, Vizora business agents can quietly drift in quality without anyone noticing.

---

## State file invariants (the `safe_io` pattern, simplified)

Every state-touching code path follows this shape:

```python
# 1. Lock
with FileLock(state_dir / "pending.lock"):
    # 2. Load with explicit failure modes
    pending, status = safe_load_json(state_dir / "pending.json", default={})
    if status not in ("ok", "missing", "empty"):
        notify_owner(f"pending.json {status}")
        sys.exit(EXIT_STATE_CORRUPT)

    # 3. Validate
    pending = PendingStore.model_validate(pending)

    # 4. Mutate
    pending.proposals[proposal_id] = new_proposal

    # 5. Atomic write
    atomic_write_json(state_dir / "pending.json", pending.model_dump())

    # 6. Audit (under same lock)
    ndjson_append(decisions_log, json.dumps(audit_entry), lock=current_lock)
```

For Vizora (TypeScript), the equivalent is:
- `proper-lockfile` or `node-fcntl` for flock-equivalent
- Zod schema validation at every boundary
- `fs.writeFileSync` to a `.tmp-<pid>` then `fs.renameSync` (atomic on POSIX)
- `fsync` the file AND its directory
- NDJSON append under the same lock as the state mutation

**This pattern alone prevents an entire class of state-corruption bugs.**

---

## Required out-of-band alerts (don't ship without these)

Per shift-agent's §10 systemd units:

| Signal | Frequency | What it does |
|---|---|---|
| **Pushover dead-man** | every 5 min | If health-check fails, Pushover alert to owner's phone. Pushover delivery is the contract. |
| **healthchecks.io heartbeat** | every 5 min | External "we're alive" ping. If healthchecks.io stops receiving, IT alerts. Two-tier dead-man. |
| **Health-watchdog** | every 15 min | Detects if health-check timer itself stops firing (e.g., systemd issue). Alerts independently. |
| **Nightly backup** | 02:00 local | pubkey-GPG tarball of state + config + roster + last 7 days of logs. Pubkey-only mode = compromised VPS can't decrypt prior backups. |
| **fsck (cross-file invariants)** | 03:00 local | Validates that pending.json + send-counter.json + decisions.log are mutually consistent. Catches drift that any single-file validation misses. |
| **Boot reconcile** | oneshot at boot | Resets in-flight `reconciling` proposals to a safe terminal state. Detects crashes mid-side-effect. |

**Vizora today has:** ops-reporter every 30 min sends Slack/email aggregated alerts. That's the *reporting* layer, not the *dead-man* layer. The dead-man + watchdog + heartbeat triad is missing.

---

## Build order (the opinionated dependency chain)

shift-agent's §14 prescribes a 26-step build order. The principle: **infra-and-safety first, agent logic last.** No skill ships before its supporting scripts, schemas, and alert paths.

Vizora's order, applied to a new business agent:

1. Define schemas (Zod for state, Prisma for DB if persistent)
2. Build `safe_io`-equivalent for any new state file
3. Build `notify-owner`-equivalent (Pushover or Slack alert script) — **REQUIRED before anything else uses it**
4. Build `log-decision` audit helper
5. Build deterministic ID generators (`create-<thing>` scripts)
6. Build state mutators (`update-<thing>-status` scripts)
7. Build outbound action script (idempotent, hardened per Rule 8)
8. Build tail-logger timer for guaranteed audit
9. Build health-check + watchdog timers
10. Build backup + fsck timers
11. Build reconcile script (boot-time oneshot)
12. Build disable / enable scripts (kill-switch first, before code that needs it)
13. Build smoke-test script
14. Build deploy script
15. Write SKILL.md files (dispatcher first, then handlers)
16. Write systemd units / PM2 entries
17. Write logrotate config
18. Write templates
19. Write runbook.md
20. **Only then** write the per-agent code

If you find yourself writing code at step 1, you're going to ship regressions.

---

## Testing approach (the staged gate)

shift-agent's §15 stages:

| Stage | Goal | Pass criteria |
|---|---|---|
| **0 — schemas parse** | Pydantic / Zod schemas accept example data | All sample files load without error |
| **1 — unit** | Each helper script behaves correctly | Per-script tests pass |
| **2 — end-to-end dry-run** | Inputs flow through dispatcher → handlers → state → audit | fsck passes all invariants after a synthetic scenario |
| **3 — customer roster (real)** | Wire to real customer config + Pushover + healthchecks.io | Test alert reaches phone; missed-ping alert fires |
| **4 — failure modes** | Kill processes mid-flow; verify dead-man / reconciler / watchdog all fire | Each failure mode has a detected signal within its SLA |

Vizora's existing tests cover Stage 0/1 well. Stage 2/3/4 are the gap for business agents.

---

## Security posture (minimum bar)

From shift-agent §12, adapted:

- Agent process runs as a non-root user, owns its own directory tree, mode 750
- `.env` mode 600, never world-readable, loaded via systemd `EnvironmentFile=` or PM2 equivalent
- LLM provider account: spending cap set ON THE PROVIDER DASHBOARD (not just in code)
- Dedicated provider key per agent surface (don't share keys between business agents and ops)
- Monthly key rotation reminder (calendar event)
- Backup encryption: GPG pubkey-only mode (private key OFF the VPS)
- Prompt injection sanitizer (Rule 6)
- Audit log tamper-evidence: SHA-256 chain on a `decisions.log.sha256` sidecar
- Pushover / Slack creds in `.env`; accept that compromised VPS = attacker can spam your alert channel; rotate channel token on suspicion

---

## What this means for Vizora's existing agents

| Agent | Current state | Per shift-agent discipline |
|---|---|---|
| `agent-customer-lifecycle` | Live, single .ts file | Needs DESIGN.md, runbook, dispatcher SKILL pattern, audit |
| `agent-support-triage` | Live, taxonomy-v2, behind 2026-05-24 Hermes Path B gate | Closest to the discipline — extend it as the reference implementation |
| `agent-orchestrator` | Scaffold | 30-day ship-or-kill gate (see `tasks/feature-backlog.md`) |
| `agent-billing-revenue` | Scaffold | Same |
| `agent-content-intelligence` | Scaffold | Same |
| `agent-screen-health-customer` | Scaffold | Same |
| 6× `ops-*` | Live cron daemons | **Different shape — these are deterministic cron tasks, not LLM-driven agents.** Most of this doc doesn't apply. They DO benefit from `safe_io` patterns and the dead-man + watchdog + heartbeat triad. |
| 8× `.claude/agents/*.md` | Dev-time Claude Code subagents | Already in SKILL.md form. Match the pattern by accident. No change needed. |

---

## Where to go from here

1. **Read this doc** before designing any new agent.
2. **For the 4 scaffolds**, write a DESIGN.md (or kill them) by 2026-06-03 — see `tasks/feature-backlog.md`.
3. **For the 2 live business agents** (`customer-lifecycle`, `support-triage`), retrofit the directory shape (`scripts/agents/<name>/{handler.ts, runbook.md, templates/, config.yaml.template}`) opportunistically — don't block on a big-bang migration.
4. **Build the Vizora MCP server** (`docs/agents-mcp-server-design.md`) — gives any future business agent a stable read surface without per-agent integration code.
5. **Add the dead-man + watchdog + heartbeat triad** to `scripts/ops/`. ops-reporter is the reporting layer, not the dead-man layer.

---

## References

- `shift-agent/DESIGN.md` (979 lines, v2 post-review) — source material for everything in this doc
- `shift-agent/PLAN.md` — rollout discipline
- `shift-agent/src/platform/safe_io.py` — copy this pattern (or a TS equivalent)
- `shift-agent/src/agents/shift/skills/dispatch_shift_agent/SKILL.md` — exemplar dispatcher
- `shift-agent/src/agents/shift/skills/handle_sick_call/SKILL.md` — exemplar handler
