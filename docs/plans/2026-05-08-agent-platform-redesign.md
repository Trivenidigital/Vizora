# Vizora Agent Platform Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the structural causes of the May 2026 OpenRouter credit drain and bring Vizora's agent platform to **industry baseline standards** for cost governance, deterministic-first orchestration, observability, and gated rollout. (Note: "top 10" framing in the original brief was scoped down after Reviewer 1 — Bedrock Agents/Agentforce/Assistants have features this plan doesn't aim for, like managed conversational memory or multi-step plan-and-execute reasoning. This plan delivers production-grade hardening, not feature parity with hyperscaler agent platforms.)

**Architecture:** Layered governance over the existing Hermes runtime. The LLM is demoted from autonomous orchestrator to bounded classifier; deterministic TS code drives the workflow. Cost is bounded at four levels (provider cap → app cap → per-firing budget → tool-loop hard stop). Observability ships before any agent re-enable.

**Tech Stack:** Hermes Agent (Python runtime, OpenRouter), Vizora middleware (NestJS 11), Prisma 5 (PostgreSQL 16), Redis 7, Grafana, Prometheus, PM2.

---

## 1. Background — what triggered this redesign

OpenRouter credits drained ~May 6 2026 across two days of Hermes shadow agent firings. Server-side audit log analysis revealed:

| Agent | Successful tool calls | Wrong-tool calls | Outcome |
|---|---|---|---|
| `hermes-customer-lifecycle` | 699 | **363 FORBIDDEN** | Model called `list_open_support_requests` 273× — a tool not in its skill |
| `hermes-support-triage` | 1981 | **454 INVALID_INPUT + 163 FORBIDDEN** | Token-scope mismatch on `log_shadow_row` + cross-skill calls |

Each FORBIDDEN/INVALID_INPUT response triggered a full LLM retry (up to 16,384 output tokens, no hard stop). The cron continued firing for 2 days after credits hit zero before anyone noticed. Root causes:

1. **No cost governance** — no provider cap, no per-firing budget, no daily ceiling
2. **No tool authorization at the agent layer** — Hermes saw all 9 MCP tools per skill
3. **No circuit breaker** — HTTP 402s ran for 48h with no alert
4. **No structured observability** — runner logs were plain text, audit log lacked cost attribution
5. **LLM was orchestrator, not classifier** — single-source-of-failure for all decisions
6. **Token model contradiction** — support-triage needs both per-org and platform-scope behavior, can't be expressed in one token

This plan addresses all six.

---

## 1.5 Hermes-first analysis (CLAUDE.md §7b — mandatory)

Per Vizora's CLAUDE.md and the global Hermes-first rule, every plan must
explicitly check whether the Hermes ecosystem already covers each proposed
capability before introducing custom code. Verification ran on prod
2026-05-08 via direct CLI inspection of Hermes 0.12.x.

| Domain | Hermes capability found? | Decision |
|---|---|---|
| Per-firing tool-call cap | **YES** — `tool_loop_guardrails.hard_stop_enabled/hard_stop_after.*` | **Use Hermes.** Already enabled in P0 patch (May 8). |
| Per-firing token-output cap | **YES** — `model.max_tokens` config | **Use Hermes.** Already set to 4096 in P0 patch. |
| Per-skill tool allowlist | **YES** — `hermes -z -t <toolsets>` CLI flag (verified `hermes --help`: `-t TOOLSETS`) | **Use Hermes flag from runner script.** Do NOT invent a `skill_toolsets` config key. |
| Token usage + cost analysis | **YES** — `hermes insights --days N [--source S]` ("Analyze session history to show token usage, costs, tool patterns") | **Use Hermes insights as data source.** Sidecar process polls `hermes insights` JSON and ships to Vizora middleware for Grafana. Do NOT rebuild model-rate tables manually. |
| Structured per-session logs | **YES** — `hermes logs --component tools --since 1h --session ID` | **Use Hermes logs.** Do NOT text-parse `/var/log/hermes/runner/*.log`. |
| Built-in monitoring dashboard | **YES** — `hermes dashboard` (port 9119, web UI for config + sessions) | **Use both.** Hermes dashboard for engineer drilldown; Vizora Grafana for alerting + cross-system correlation. |
| Provider balance check (OpenRouter `/v1/credits`) | NO | **Custom.** Runner script queries OpenRouter API pre-flight. |
| Daily app-level spend cap | NO | **Custom.** Vizora middleware aggregates `hermes insights` data + enforces. |
| Cross-firing circuit breaker (5 consecutive 402/429 → halt + alert) | NO (Hermes' guardrails are intra-firing) | **Custom.** Runner script + Redis counter. |
| Model fallback on cost/error | **PARTIAL** — `hermes fallback` subcommand exists | **Investigate during P0 implementation.** May obviate custom logic. |
| Replay/audit dump | **YES** — `hermes dump`, `hermes backup`, `hermes import` | **Use Hermes for snapshot.** Vizora's `agent_runs` table provides the per-firing index/aggregation that `hermes insights` summarizes. |
| Subagent / delegation | **YES** — `hermes` supports subagents with `inherit_mcp_toolsets` | **Defer to P3.** Future agent-orchestrator can use Hermes' `delegate_task` rather than a custom loop. |
| LLM-as-classifier pattern (single-shot JSON output) | NOT a Hermes concern — workflow design | **Custom in TS orchestrator** (P2). |
| Idempotency on MCP writes | NOT a Hermes concern — server-side enforcement | **Custom in Vizora MCP server** (P4). |
| Promotion / staged rollout | NOT a Hermes concern | **Custom in Vizora middleware** (P3). |
| **Prompt / context caching** (50–80% input-token saver) | **YES** — OpenRouter supports cache_control markers for gpt-4o-mini; Hermes config has `compression` for context | **Use OpenRouter caching.** Mark stable SKILL.md content as cacheable. Configure in P0 alongside `max_tokens`. Likely amplifier of original drain — same skill text resent every 5 min. |
| **Structured outputs** (`response_format=json_schema`) | **YES** — OpenRouter supports for gpt-4o-mini; Hermes passes through provider-specific request fields | **Use in P2 classifier.** Eliminates JSON-parse failures and the "schema fidelity" issues documented in MEMORY.md `feedback_gpt4o_mini_schema_fidelity.md`. |
| **Model routing / fallback by cost-tier** | **YES** — `hermes fallback` subcommand + OpenRouter native `models` array | **Investigate in P0.** May replace some custom retry logic — gpt-4o-mini default with claude-haiku fallback on classifier ambiguity. |

**Note on Hermes insights output format:** `hermes insights --json` does NOT exist (verified: `unrecognized arguments: --json`). The command emits boxed unicode tables only. P0.5 sidecar must use a stable Python regex parser; the original §1.5 framing was misleadingly optimistic. Below tasks now commit to the text-table parser path.

**awesome-hermes-agent ecosystem check:** the curated skills hub at
`hermes-agent.nousresearch.com/docs/skills` plus `~/.hermes/skills/`
on prod (verified) lists 28 skill categories. None cover Vizora's
dollar-budget governance, MCP-write idempotency, or Vizora-specific
shadow-vs-heuristic comparison. Custom work in those areas is justified.

**Net effect on this plan:** P0 and P1 task sequences below are revised
to use Hermes-native capabilities (`-t` flag, `insights`, `logs`) where
they exist, with custom code restricted to Vizora-specific boundaries
(dollar accounting, daily-budget enforcement, cross-firing breaker,
promotion machinery, MCP idempotency).

---

## 1.6 Drift-check evidence (CLAUDE.md §7a — mandatory)

Searches run 2026-05-08 to verify proposed primitives don't already exist.

| Search | Result | Action |
|---|---|---|
| `AgentRun` / `agent_runs` Prisma model | Only matches in `scripts/ops/*.ts` — unrelated `OpsAgentRun` for the autonomous-ops domain (different concept). No LLM-agent run tracking exists. | **New work justified** (P0.1). |
| MCP idempotency table/service | Zero matches outside billing (Razorpay payment idempotency, different domain). | **New work justified** (P4). |
| OpenRouter `/credits` pre-flight | Zero matches. | **New work justified** (P0.4). |
| Per-skill Hermes tool config | Zero matches. But `hermes -z -t` CLI flag exists (Hermes-first hit above). | **Use Hermes flag**, not custom config (P1.2 revised). |
| `log_shadow_row` token-scope code | **`middleware/src/modules/mcp/tools/shadow-log.tools.ts:42-46`** — the explicit `if (context.organizationId != null) throw BadRequest("...platform-scope...")`. | **Modify existing file** (P1.1 — file path corrected from earlier draft). |
| Agent cost dashboard | Only `docker/grafana/dashboards/vizora-overview.json` exists. No agent dashboard. | **New work justified** (P0.6). |
| Shadow-vs-heuristic comparison reader | **PARTIAL DRIFT.** `tasks/feature-backlog.md` already specifies this with detailed constraints: must be tolerant to gpt-4o-mini's schema-fidelity issues, lives at `scripts/agents/hermes/compare-shadow.ts`, gated on `agreement_rate >= 85%` for 7 consecutive days. | **Align P3 with the existing spec.** Do not redesign. |
| `send_lifecycle_nudge_email` circuit breaker | **PARTIAL DRIFT.** `MAX_EMAILS_PER_RUN=50` server-side cap already exists per backlog notes + `LIFECYCLE_LIVE` dry-run gate. | **Reference existing in P4.** Idempotency layer extends, not replaces. |
| MCP empty-spec handlers (probe loop fix) | PR #59 shipped (`mcp_server_empty_spec_handlers.md` memory + git log `358abd3`). | **Done.** No work needed. |
| Hermes max-token + hard-stop config | Applied May 8 13:33 prod patch — but P0.0a still required because `model.max_tokens` may not actually clamp the OpenRouter request param (phantom-lever risk). | **Verify, then declare done.** |
| **Circuit breaker service** (Reviewer 2 found this — original drift-check MISSED it) | **`middleware/src/modules/common/services/circuit-breaker.service.ts` EXISTS.** | **REUSE in P4.** Do not rebuild. Wrap with Redis-backed state if its current implementation is in-memory only. |
| **`mcp_audit_log` recent data** for replay tests | **Last 2 days are empty** (verified via SQL — agents have produced 0 successful MCP calls since credits drained May 6). | **Note in P0.5:** "replay last 24h of mcp_audit_log" cannot run today; widen window to last 7d to include pre-drain data, OR defer that test step until P0.0a credits are added and one successful firing has happened. |
| `PrismaService` import path | Reviewer 2: codebase uses `DatabaseService extends PrismaClient` from `database/database.service.ts`. | **Renamed throughout plan.** |
| Inbound `InternalSecretGuard` | Reviewer 2: doesn't exist. Outbound pattern (`x-internal-api-key`) is in `displays.service.ts:54`, etc., but no inbound guard yet. | **Create in P0.3 Step 5** (now expanded with full implementation). |
| `mcp.service.ts` `handleToolCall` method | Reviewer 2: doesn't exist. Tools are standalone exports in `tools/*.tools.ts` invoked by SDK callbacks in `mcp.service.ts:buildServer()`. | **P1.1 rewritten** to test `logShadowRowTool(rawInput, context, shadowLog)` directly. |

**Net effect:** P3 (promotion machinery) must read and align with the
existing backlog entry rather than redesign from scratch. P1.1 modifies
an existing file at a specific line range, not the broader `mcp.service.ts`.
All other proposed primitives are confirmed missing and justified.

---

## 2. Reference architecture — target end state

```
                       ┌─ daily spend cap (OpenRouter dashboard)
   COST GOVERNANCE ────┼─ pre-flight balance check (runner script)
                       ├─ per-firing wall-clock + tool-call cap (Hermes config)
                       └─ anomaly alerting (Prometheus rule on agent_runs)

                       ┌─ tool allowlist per skill (Hermes platform_toolsets)
   AUTHORIZATION ──────┼─ token scope (already exists, with one fix)
                       └─ idempotency keys on writes (server-enforced)

   ORCHESTRATION ──────── deterministic TS code
                            │
                            ├─ enumerate work items     (no LLM)
                            ├─ idempotency check        (no LLM)
                            └─ classify difficulty
                                  ├─ easy → heuristic action  (no LLM)
                                  └─ hard → LLM CLASSIFIER ONLY (1 narrow call, JSON output)

   EXECUTION ─────────────── MCP tools (single, narrow call per item)

   OBSERVABILITY ──────── agent_runs table + Grafana dashboard
                            │
                            └─ shadow vs heuristic auto-comparison job

   ROLLOUT STAGES ──────── shadow → canary (5%) → live
                            │
                            └─ each stage promoted on metric thresholds
```

Reference systems with these properties: Anthropic *Building Effective Agents* (2024) workflow patterns, AWS Bedrock Agents Flows, Salesforce Agentforce Atlas reasoning engine.

---

## 3. File structure

```
docs/plans/
  2026-05-08-agent-platform-redesign.md      # THIS FILE — master plan
  2026-05-08-phase-2-customer-lifecycle.md   # written when P2 begins
  2026-05-08-phase-2-support-triage.md       # written when P2 begins

middleware/src/modules/agents/
  agent-runs.service.ts                       # NEW — record per-firing metrics
  agent-runs.controller.ts                    # NEW — POST /internal/agent-runs
  agent-runs.module.ts                        # NEW — wire into app
  __tests__/agent-runs.service.spec.ts        # NEW — unit tests

middleware/src/modules/mcp/
  mcp.service.ts                              # MODIFY — relax log_shadow_row token scope
  mcp.service.spec.ts                         # MODIFY — add token-scope test

packages/database/prisma/
  schema.prisma                               # MODIFY — add AgentRun model
  migrations/<timestamp>_agent_runs/          # NEW — migration

scripts/agents/hermes/
  run-hermes-skill.sh                         # MODIFY — pre/post-flight hooks
  lib/openrouter-balance.sh                   # NEW — balance check function
  lib/record-run.sh                           # NEW — POST run metrics to middleware
  lib/parse-hermes-output.sh                  # NEW — extract token counts from log

hermes-skills/vizora-customer-lifecycle/
  SKILL.md                                    # MODIFY (P2) — narrow tool list, classifier prompt
hermes-skills/vizora-support-triage/
  SKILL.md                                    # MODIFY (P2) — narrow tool list, classifier prompt

config-prod/.hermes/  (deployed to /root/.hermes/ on prod)
  config.yaml                                 # MODIFY — add platform_toolsets per skill
                                              # already done: max_tokens=4096, hard_stop=true

docker/grafana/dashboards/
  agents-cost.json                            # NEW — cost & error dashboard

docker/prometheus/rules/
  agents.yml                                  # NEW — anomaly alerts

ecosystem.config.js                           # MODIFY — already done: cron */5 → */15
                                              # P4: add ops-agent-runs-watchdog
```

---

## 4. Phase overview

| Phase | Deliverable | Effort | Re-enable agents after? |
|---|---|---|---|
| **P0** | Cost governance + observability + max_tokens-clamp verification | 2–3 days | No, but system is **safe** |
| **P1** | Tool authorization + token contradiction fix | 1 day | **Yes** — shadow mode |
| **P2.A** | `customer-lifecycle` as pure TS heuristic (no LLM) | 2–3 days | Heuristic-only PM2 cron; Hermes shadow retired |
| **P2.B** | `support-triage` LLM-augmentation (conditional on existing-data battery) | 2–3 weeks IF data justifies; 1 week if heuristic-alone passes | Canary then live |
| **P3** | Promotion machinery + comparison reader (per backlog spec) | 3–4 days | Full production |
| **P4** | Operational hardening (reuse `circuit-breaker.service.ts`, idempotency, JSON replay) | 2–3 days | Full production with SLA |

**Total: 4–6 weeks (was originally claimed at "~3 weeks" — Reviewer 1 was right, that was fiction).** P0 + P1 alone (~3–4 days) yields a system that cannot drain credits and cannot wander; P2.A is another 2–3 days for an entirely-heuristic customer-lifecycle. P2.B is the only phase where the timeline is genuinely uncertain — driven by what the existing-data battery shows about whether the LLM earns its place.

**Phase ordering — reviewer disagreement noted:** Reviewer 1 recommended P1-before-P0 ("tool authorization is the actual root cause; cost governance is hardening"). REJECTED with rationale: P0 protects against ANY future cost-drain root cause, not just the May 6 wandering. Tool authorization (P1) eliminates one specific failure mode; cost governance (P0) bounds the blast radius of all unknown future failure modes. Both ship in the same week; ordering is operationally indifferent. The CLAUDE.md global §10 rule applies: "discipline sections are heuristics, not checklists" — a reviewer recommendation does not become an obligation just because a reviewer made it.

---

## 5. Success criteria — production-grade benchmarks

This plan is "done" when ALL of these hold for 14 consecutive days:

- **Cost-bound:** No firing has cost > $0.05; no day has total agent cost > $1.00
- **Wander-bound:** Zero FORBIDDEN errors in `mcp_audit_log` from Hermes-issued tokens
- **Latency-bound:** P95 firing wall-clock ≤ 60s for support-triage, ≤ 120s for customer-lifecycle
- **Observability:** Grafana dashboard shows cost, error rate, latency per agent in real-time
- **Alerting:** Anomalies (cost > 3σ, error rate > 5%, no firings for 3× cron interval) trigger Slack within 5 min
- **Replay:** Every firing has a structured JSON record sufficient to reproduce it
- **Promotion:** Cutover from shadow → canary → live is automated and reversible in <60s
- **Positive-work criterion (anti-gaming):** at least 1 successful nudge sent per non-empty cohort per week (customer-lifecycle); at least 80% of open support requests reaching `outcome='success'` in their triage firing (support-triage). Reviewer 1 flagged that the criteria above can be satisfied by an agent doing nothing — this prevents that. **Threshold tuned during P3 with shadow-data baseline.**
- **Ground-truth alignment (not just heuristic agreement):** for at least 50 manually-labeled samples per agent, the LLM-augmented decision matches the human label ≥ 85% of the time. Reviewer 1 flagged that "Hermes vs heuristic agreement" can be two wrong systems agreeing — this prevents that. Sampling protocol defined in P3 sub-plan.

---

## Phase 0 — Cost Governance & Observability

**Goal:** Make it structurally impossible to drain credits silently. This phase ships before any agent is re-enabled.

**Architecture:**
- **Layer 1 (provider):** OpenRouter daily cap on the API key — manual UI setting, hard ceiling
- **Layer 2 (pre-flight):** Runner script queries OpenRouter `/v1/credits` before invoking Hermes; aborts if balance < threshold OR today's spend > app budget
- **Layer 3 (per-firing):** Hermes config (`max_tokens=4096`, `hard_stop_enabled=true`) + runner timeout
- **Layer 4 (post-flight):** Runner extracts token counts from Hermes output, POSTs to middleware which writes `agent_runs` row
- **Layer 5 (anomaly):** Prometheus rule on `agent_runs` table → Slack alert

**Success criteria:**
- All 5 layers wired and tested
- **Layer 3 (`max_tokens` clamp) verified at the OpenRouter request level, not just config** — see P0.0a
- Grafana dashboard live at `/grafana/d/agents-cost`
- Unit tests passing for `agent-runs.service.ts`
- E2E: a deliberate runaway test firing is bounded and alerts within 60s

---

### Task P0.0: Stop the bleed (already done 2026-05-08, document for reproducibility)

**Goal:** Prevent further wasted runner firings while P0 is in flight.

This task records the operations applied during the May 8 incident response, so a future operator hitting a similar drain has a documented playbook.

- [x] **Step 1: Delete the Hermes PM2 entries** (so `cron_restart` doesn't keep re-spawning).

```bash
ssh root@vizora.cloud 'pm2 delete hermes-vizora-support-triage hermes-vizora-customer-lifecycle && pm2 save'
```

Verify with `pm2 list` — the entries should be absent (NOT just "stopped"; cron_restart fires regardless of stopped state).

- [x] **Step 2: Patch `/root/.hermes/config.yaml`** (backup first):

```bash
ssh root@vizora.cloud 'cp /root/.hermes/config.yaml /root/.hermes/config.yaml.bak.$(date +%Y%m%d-%H%M%S)'
```

Add `max_tokens: 4096` under `model:` and flip `tool_loop_guardrails.hard_stop_enabled: false → true`.

- [x] **Step 3: Update `ecosystem.config.js`** locally — change `cron_restart: '*/5 * * * *'` to `cron_restart: '*/15 * * * *'` for `hermes-vizora-support-triage` (line 426).

(Already applied locally; not yet committed.)

---

### Task P0.0a: Verify `max_tokens` actually clamps OpenRouter requests (phantom-lever check)

**Why:** Reviewer 2 flagged this as a phantom lever. `hermes config show` confirms `max_tokens=4096` is set, but every runner log line BEFORE the May 8 patch shows `up to 16384 tokens` requested at OpenRouter. We have no firing AFTER the patch (because PM2 was deleted at the same time), so the clamp is **unverified**.

Per CLAUDE.md global §9: "Before any change whose effect depends on runtime state outside source code, query the runtime state for every assumption."

**Files:**
- No code changes — verification only.

- [ ] **Step 1: Add ~$0.50 of OpenRouter credits** (manual — Sri).

- [ ] **Step 2: Manually fire one Hermes invocation with verbose logging**

```bash
ssh root@vizora.cloud 'set -a; source /root/.hermes/.env; set +a; hermes -z --skills vizora-customer-lifecycle "list available tools and exit silently"' > .ssh_clamp_test.txt 2>&1
```

- [ ] **Step 3: Inspect the OpenRouter request envelope**

Hermes logs the actual API request body at DEBUG level. Run:

```bash
ssh root@vizora.cloud 'hermes logs --since 5m --level DEBUG --component agent | grep -iE "max_tokens|max-tokens" | head -10' > .ssh_clamp_log.txt 2>&1
```

Expected: `max_tokens: 4096` (or absent — meaning Hermes didn't override the OpenRouter default of 4096 for gpt-4o-mini).

- [ ] **Step 4a: If clamp confirmed (≤4096):** mark Layer 3 effective. Proceed with P0.1.

- [ ] **Step 4b: If clamp NOT effective (>4096):** the Hermes `model.max_tokens` setting is NOT being passed to OpenRouter as the per-request `max_tokens` param. Two possible mitigations:
1. **Per-call explicit override** — pass `--max-tokens 4096` at the `hermes -z` CLI (verify the flag exists with `hermes -z --help`).
2. **OpenRouter-side enforcement** — set the model-level cap in the OpenRouter dashboard (if supported) or use OpenRouter's "model variants" feature.

If neither works: file an upstream Hermes issue, AND remove the §1.5 / §2 claim that `max_tokens=4096` is Layer 3 protection. The defense becomes 4-layer, not 5-layer. The other layers still bound cost, but per-call output is uncapped.

- [ ] **Step 5: Document the verified state in `tasks/lessons.md`** with date, finding, and resolution.

---

### Task P0.1: Add `AgentRun` model to Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (after `McpAuditLog` at line 921)

- [ ] **Step 1: Add the model definition**

Insert after line 921 in `schema.prisma`:

```prisma
model AgentRun {
  id              String   @id @default(cuid())
  // Skill name from Hermes — e.g. "vizora-customer-lifecycle"
  skillName       String
  // PM2 process ID for cross-reference with PM2 logs
  pid             Int?
  // Wall-clock timing
  startedAt       DateTime
  finishedAt      DateTime?
  durationMs      Int?
  // Hermes exit code (0 = success at process level — does not imply task success)
  exitCode        Int?
  // Token usage extracted from Hermes runner output. Null if unparseable.
  tokensIn        Int?
  tokensOut       Int?
  // OpenRouter cost in USD * 1e6 (microdollars) for integer arithmetic.
  // Computed by middleware from token counts × per-model rate table.
  costMicrodollars Int?
  // Model used. Useful when we add fallback/override per skill.
  model           String?
  // Outcome classification — derived by runner from log + audit cross-ref.
  // 'success' | 'no_work' | 'partial' | 'tool_error' | 'api_error' | 'timeout' | 'budget_aborted'
  outcome         String
  // Free-form error excerpt for tool_error / api_error outcomes (max 1KB).
  errorExcerpt    String?  @db.VarChar(1024)
  // Pre-flight check: balance at start, today's prior spend at start.
  preflightBalanceUsd  Decimal? @db.Decimal(10, 4)
  preflightTodaySpendUsd Decimal? @db.Decimal(10, 4)
  createdAt       DateTime @default(now())

  @@index([skillName, startedAt])
  @@index([outcome, startedAt])
  @@map("agent_runs")
}
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
cd packages/database
export $(grep DATABASE_URL ../../.env | xargs)
npx prisma migrate dev --name agent_runs --create-only
```

Expected: a new migration directory `migrations/<timestamp>_agent_runs/` with `migration.sql` containing `CREATE TABLE "agent_runs"`.

- [ ] **Step 3: Inspect the SQL and verify indexes**

Run:
```bash
cat packages/database/prisma/migrations/*_agent_runs/migration.sql
```

Expected: SQL contains `CREATE TABLE "agent_runs"`, two `CREATE INDEX` statements, no destructive operations on existing tables.

- [ ] **Step 4: Apply migration locally**

Run:
```bash
cd packages/database
npx prisma migrate dev
```

Expected: `Database is now in sync with your schema`.

- [ ] **Step 5: Regenerate Prisma client**

Run:
```bash
pnpm --filter @vizora/database db:generate
```

Expected: `Generated Prisma Client (v5.x.x) to ./src/generated/prisma`.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(agents): add AgentRun model for per-firing observability"
```

---

### Task P0.2: Implement `AgentRunsService` with unit tests

**Files:**
- Create: `middleware/src/modules/agents/agent-runs.service.ts`
- Create: `middleware/src/modules/agents/__tests__/agent-runs.service.spec.ts`
- Create: `middleware/src/modules/agents/agent-runs.module.ts`

- [ ] **Step 1: Write the failing test for `recordRun`**

Create `middleware/src/modules/agents/__tests__/agent-runs.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunsService } from '../agent-runs.service';
import { DatabaseService } from '../database/database.service';

describe('AgentRunsService', () => {
  let service: AgentRunsService;
  let prisma: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const mockPrisma = {
      agentRun: {
        create: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRunsService,
        { provide: DatabaseService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(AgentRunsService);
    prisma = module.get(DatabaseService);
  });

  describe('recordRun', () => {
    it('persists a run with computed cost from token counts', async () => {
      (prisma.agentRun.create as jest.Mock).mockResolvedValue({ id: 'r1' });
      const result = await service.recordRun({
        skillName: 'vizora-customer-lifecycle',
        startedAt: new Date('2026-05-08T10:00:00Z'),
        finishedAt: new Date('2026-05-08T10:00:30Z'),
        exitCode: 0,
        tokensIn: 5000,
        tokensOut: 800,
        model: 'openai/gpt-4o-mini',
        outcome: 'success',
      });
      expect(result.id).toBe('r1');
      expect(prisma.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          durationMs: 30000,
          // gpt-4o-mini: $0.15/MT input + $0.60/MT output
          // = (5000 * 0.15 + 800 * 0.60) / 1e6 microdollars
          // = (750 + 480) microdollars = 1230 microdollars
          costMicrodollars: 1230,
        }),
      });
    });

    it('records run with null cost when model is unknown', async () => {
      (prisma.agentRun.create as jest.Mock).mockResolvedValue({ id: 'r2' });
      await service.recordRun({
        skillName: 'vizora-test',
        startedAt: new Date(),
        finishedAt: new Date(),
        exitCode: 0,
        tokensIn: 100,
        tokensOut: 50,
        model: 'unknown/model',
        outcome: 'success',
      });
      expect(prisma.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ costMicrodollars: null }),
      });
    });

    it('records timeout outcome with null token counts', async () => {
      (prisma.agentRun.create as jest.Mock).mockResolvedValue({ id: 'r3' });
      await service.recordRun({
        skillName: 'vizora-test',
        startedAt: new Date(),
        finishedAt: new Date(),
        exitCode: 124, // timeout(1) exit code
        outcome: 'timeout',
      });
      expect(prisma.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'timeout',
          tokensIn: null,
          tokensOut: null,
          costMicrodollars: null,
        }),
      });
    });
  });

  describe('getTodaySpendUsd', () => {
    it('sums costMicrodollars for the current UTC day', async () => {
      (prisma.agentRun.aggregate as jest.Mock).mockResolvedValue({
        _sum: { costMicrodollars: 2_500_000 }, // $2.50
      });
      const spend = await service.getTodaySpendUsd();
      expect(spend).toBe(2.5);
    });

    it('returns 0 when no runs today', async () => {
      (prisma.agentRun.aggregate as jest.Mock).mockResolvedValue({
        _sum: { costMicrodollars: null },
      });
      const spend = await service.getTodaySpendUsd();
      expect(spend).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @vizora/middleware test -- --testPathPattern=agent-runs.service.spec
```

Expected: FAIL with "Cannot find module '../agent-runs.service'".

- [ ] **Step 3: Implement `AgentRunsService`**

Create `middleware/src/modules/agents/agent-runs.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/prisma.service';

// Per-million-token rates in USD. Update when adding new models.
// Source: https://openrouter.ai/models — verified 2026-05-08.
const MODEL_RATES: Record<string, { inUsdPerMt: number; outUsdPerMt: number }> = {
  'openai/gpt-4o-mini': { inUsdPerMt: 0.15, outUsdPerMt: 0.60 },
  'openai/gpt-4o': { inUsdPerMt: 2.50, outUsdPerMt: 10.00 },
  'anthropic/claude-3.5-sonnet': { inUsdPerMt: 3.00, outUsdPerMt: 15.00 },
  'anthropic/claude-3.5-haiku': { inUsdPerMt: 0.80, outUsdPerMt: 4.00 },
};

export interface RecordRunInput {
  skillName: string;
  pid?: number;
  startedAt: Date;
  finishedAt: Date;
  exitCode: number;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  outcome: 'success' | 'no_work' | 'partial' | 'tool_error' | 'api_error' | 'timeout' | 'budget_aborted';
  errorExcerpt?: string;
  preflightBalanceUsd?: number;
  preflightTodaySpendUsd?: number;
}

@Injectable()
export class AgentRunsService {
  private readonly logger = new Logger(AgentRunsService.name);

  constructor(private readonly prisma: DatabaseService) {}

  async recordRun(input: RecordRunInput) {
    const durationMs = input.finishedAt.getTime() - input.startedAt.getTime();
    const costMicrodollars = this.computeCostMicrodollars(
      input.model,
      input.tokensIn,
      input.tokensOut,
    );
    return this.prisma.agentRun.create({
      data: {
        skillName: input.skillName,
        pid: input.pid,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        durationMs,
        exitCode: input.exitCode,
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
        costMicrodollars,
        model: input.model ?? null,
        outcome: input.outcome,
        errorExcerpt: input.errorExcerpt?.slice(0, 1024) ?? null,
        preflightBalanceUsd: input.preflightBalanceUsd ?? null,
        preflightTodaySpendUsd: input.preflightTodaySpendUsd ?? null,
      },
    });
  }

  async getTodaySpendUsd(): Promise<number> {
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    const result = await this.prisma.agentRun.aggregate({
      _sum: { costMicrodollars: true },
      where: { startedAt: { gte: startOfUtcDay } },
    });
    const micros = result._sum.costMicrodollars ?? 0;
    return micros / 1_000_000;
  }

  private computeCostMicrodollars(
    model: string | undefined,
    tokensIn: number | undefined,
    tokensOut: number | undefined,
  ): number | null {
    if (!model || tokensIn == null || tokensOut == null) return null;
    const rate = MODEL_RATES[model];
    if (!rate) {
      this.logger.warn(`No rate table entry for model ${model}; cost will be null`);
      return null;
    }
    // (tokens × USD/MT) gives USD; multiply by 1e6 to get microdollars; divide by 1e6 to undo MT.
    // Net: tokens × USD/MT = microdollars.
    const inMicros = tokensIn * rate.inUsdPerMt;
    const outMicros = tokensOut * rate.outUsdPerMt;
    return Math.round(inMicros + outMicros);
  }
}
```

- [ ] **Step 4: Create the module wiring**

Create `middleware/src/modules/agents/agent-runs.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AgentRunsService } from './agent-runs.service';
import { AgentRunsController } from './agent-runs.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AgentRunsService],
  controllers: [AgentRunsController],
  exports: [AgentRunsService],
})
export class AgentRunsModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
pnpm --filter @vizora/middleware test -- --testPathPattern=agent-runs.service.spec
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add middleware/src/modules/agents/agent-runs.{service,module}.ts middleware/src/modules/agents/__tests__/agent-runs.service.spec.ts
git commit -m "feat(agents): AgentRunsService with cost computation and daily spend aggregate"
```

---

### Task P0.3: Implement `AgentRunsController` (POST /internal/agent-runs)

**Files:**
- Create: `middleware/src/modules/agents/agent-runs.controller.ts`
- Create: `middleware/src/modules/agents/dto/record-run.dto.ts`
- Modify: `middleware/src/app.module.ts` (register AgentRunsModule)
- Test: `middleware/src/modules/agents/__tests__/agent-runs.controller.e2e-spec.ts`

- [ ] **Step 1: Write the E2E test (failing)**

Create `middleware/src/modules/agents/__tests__/agent-runs.controller.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('AgentRunsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /internal/agent-runs returns 401 without internal secret', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/internal/agent-runs')
      .send({ skillName: 'test' })
      .expect(401);
  });

  it('POST /internal/agent-runs persists a run with valid secret', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/internal/agent-runs')
      .set('x-internal-api-key', process.env.INTERNAL_API_SECRET!)
      .send({
        skillName: 'vizora-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        tokensIn: 1000,
        tokensOut: 200,
        model: 'openai/gpt-4o-mini',
        outcome: 'success',
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
  });

  it('POST /internal/agent-runs validates outcome enum', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/internal/agent-runs')
      .set('x-internal-api-key', process.env.INTERNAL_API_SECRET!)
      .send({
        skillName: 'vizora-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        outcome: 'INVALID_OUTCOME',
      })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @vizora/middleware test:e2e -- --testPathPattern=agent-runs.controller
```

Expected: FAIL — controller doesn't exist.

- [ ] **Step 3: Implement the DTO**

Create `middleware/src/modules/agents/dto/record-run.dto.ts`:

```typescript
import { IsString, IsOptional, IsInt, IsIn, IsISO8601, IsNumber, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export const RUN_OUTCOMES = [
  'success',
  'no_work',
  'partial',
  'tool_error',
  'api_error',
  'timeout',
  'budget_aborted',
] as const;
export type RunOutcome = typeof RUN_OUTCOMES[number];

export class RecordRunDto {
  @IsString()
  skillName!: string;

  @IsOptional() @IsInt()
  pid?: number;

  @IsISO8601()
  startedAt!: string;

  @IsISO8601()
  finishedAt!: string;

  @IsInt()
  exitCode!: number;

  @IsOptional() @IsInt() @Min(0)
  tokensIn?: number;

  @IsOptional() @IsInt() @Min(0)
  tokensOut?: number;

  @IsOptional() @IsString()
  model?: string;

  @IsIn(RUN_OUTCOMES)
  outcome!: RunOutcome;

  @IsOptional() @IsString() @MaxLength(1024)
  errorExcerpt?: string;

  @IsOptional() @IsNumber()
  preflightBalanceUsd?: number;

  @IsOptional() @IsNumber()
  preflightTodaySpendUsd?: number;
}
```

- [ ] **Step 4: Implement the controller**

Create `middleware/src/modules/agents/agent-runs.controller.ts`:

```typescript
import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { AgentRunsService } from './agent-runs.service';
import { RecordRunDto } from './dto/record-run.dto';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';

@Controller('internal/agent-runs')
@UseGuards(InternalSecretGuard)
export class AgentRunsController {
  constructor(private readonly service: AgentRunsService) {}

  @Post()
  @HttpCode(201)
  async record(@Body() dto: RecordRunDto) {
    const run = await this.service.recordRun({
      ...dto,
      startedAt: new Date(dto.startedAt),
      finishedAt: new Date(dto.finishedAt),
    });
    return { id: run.id };
  }
}
```

- [ ] **Step 5: Create `InternalSecretGuard` (verified missing 2026-05-08)**

Reviewer 2 confirmed: there is NO existing inbound `InternalSecretGuard` in this codebase. The `x-internal-api-key` header is currently used only for OUTBOUND calls (middleware → realtime). This task creates the inbound version.

**Files:**
- Create: `middleware/src/modules/common/guards/internal-secret.guard.ts`
- Test: `middleware/src/modules/common/guards/internal-secret.guard.spec.ts`

Implementation:

```typescript
// middleware/src/modules/common/guards/internal-secret.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guards routes that should only be callable by other Vizora services
 * (the runner script, ops agents). Matches the existing OUTBOUND
 * convention used by middleware → realtime: header `x-internal-api-key`,
 * value compared against `INTERNAL_API_SECRET` env via constant-time
 * compare.
 *
 * Returns 401 (not 403) on mismatch — these endpoints should not
 * acknowledge their existence to anyone without the secret.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly logger = new Logger(InternalSecretGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_API_SECRET');
    if (!expected) {
      // Misconfiguration — fail closed in prod, log loudly.
      this.logger.error('INTERNAL_API_SECRET not set — refusing all internal calls');
      throw new UnauthorizedException();
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-internal-api-key'];
    if (typeof provided !== 'string' || !this.constantTimeEquals(provided, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks on the secret.
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
```

Tests:

```typescript
// middleware/src/modules/common/guards/internal-secret.guard.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { InternalSecretGuard } from './internal-secret.guard';

describe('InternalSecretGuard', () => {
  let guard: InternalSecretGuard;

  function makeCtx(headerValue: string | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: headerValue !== undefined ? { 'x-internal-api-key': headerValue } : {} }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InternalSecretGuard,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test-secret-1234') } },
      ],
    }).compile();
    guard = module.get(InternalSecretGuard);
  });

  it('allows requests with matching header', () => {
    expect(guard.canActivate(makeCtx('test-secret-1234'))).toBe(true);
  });

  it('rejects with 401 when header missing', () => {
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(UnauthorizedException);
  });

  it('rejects with 401 when header mismatched', () => {
    expect(() => guard.canActivate(makeCtx('wrong-secret'))).toThrow(UnauthorizedException);
  });

  it('rejects with 401 when INTERNAL_API_SECRET env not set', async () => {
    const module = await Test.createTestingModule({
      providers: [
        InternalSecretGuard,
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
      ],
    }).compile();
    const g = module.get(InternalSecretGuard);
    expect(() => g.canActivate(makeCtx('any-value'))).toThrow(UnauthorizedException);
  });
});
```

Run the spec to verify it passes:

```bash
pnpm --filter @vizora/middleware test -- --testPathPattern=internal-secret.guard.spec
```

Expected: 4 tests passing.

The existing OUTBOUND callers (`displays.service.ts:54`, `fleet.service.ts:214`, `playlists.service.ts:33`, `notifications.service.ts:244`) that send `x-internal-api-key` are unchanged — this guard receives the same header at the inbound side.

- [ ] **Step 6: Register the module in app.module.ts**

Modify `middleware/src/app.module.ts` to add `AgentRunsModule` to imports.

- [ ] **Step 7: Run E2E tests to verify they pass**

Run:
```bash
pnpm --filter @vizora/middleware test:e2e -- --testPathPattern=agent-runs.controller
```

Expected: PASS — 3 tests passing.

- [ ] **Step 8: Commit**

```bash
git add middleware/src/modules/agents/ middleware/src/app.module.ts
git commit -m "feat(agents): POST /internal/agent-runs endpoint with auth + validation"
```

---

### Task P0.4: Pre-flight balance check in runner

**Files:**
- Create: `scripts/agents/hermes/lib/openrouter-balance.sh`
- Modify: `scripts/agents/hermes/run-hermes-skill.sh`

- [ ] **Step 1: Implement the balance-check helper**

Create `scripts/agents/hermes/lib/openrouter-balance.sh`:

```bash
#!/usr/bin/env bash
# Query OpenRouter for current credit balance. Echoes USD as a decimal string.
# Returns 1 if the API call fails (caller can decide whether to abort or proceed).
#
# Usage: source openrouter-balance.sh; balance=$(openrouter_balance_usd) || exit 1
#
# Reads OPENROUTER_API_KEY from environment.

openrouter_balance_usd() {
  local response
  response=$(curl -fsS \
    --max-time 5 \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    https://openrouter.ai/api/v1/credits 2>/dev/null) || return 1
  # Response shape: {"data":{"total_credits":N,"total_usage":M}} — balance = N - M.
  echo "$response" | python3 -c '
import json, sys
d = json.load(sys.stdin)["data"]
print(f"{d[\"total_credits\"] - d[\"total_usage\"]:.4f}")
'
}
```

- [ ] **Step 2: Test the balance helper manually on prod (read-only)**

```bash
ssh root@vizora.cloud 'source /opt/vizora/app/scripts/agents/hermes/lib/openrouter-balance.sh && set -a; source /root/.hermes/.env; set +a; openrouter_balance_usd' > .ssh_balance.txt 2>&1
cat .ssh_balance.txt
```

Expected: a decimal number (e.g. `0.0000` or `5.2341`).

- [ ] **Step 3: Modify `run-hermes-skill.sh` to abort below threshold**

Edit `scripts/agents/hermes/run-hermes-skill.sh`. After line 38 (`LOG=...`) and before line 40 (`START=...`), insert:

```bash
# ============================================================================
# Pre-flight: refuse to start if OpenRouter balance is below MIN_BALANCE_USD
# OR if today's app-level spend already exceeds DAILY_BUDGET_USD.
# Both gates are configurable via env (see ecosystem.config.js).
# ============================================================================

# shellcheck source=lib/openrouter-balance.sh
source "$(dirname "$0")/lib/openrouter-balance.sh"

MIN_BALANCE_USD="${MIN_BALANCE_USD:-0.50}"
DAILY_BUDGET_USD="${DAILY_BUDGET_USD:-1.00}"
MIDDLEWARE_URL="${MIDDLEWARE_URL:-http://localhost:3000}"
INTERNAL_SECRET="${INTERNAL_API_SECRET:-}"

PREFLIGHT_BALANCE=$(openrouter_balance_usd 2>/dev/null || echo "")
if [[ -n "$PREFLIGHT_BALANCE" ]]; then
  if (( $(echo "$PREFLIGHT_BALANCE < $MIN_BALANCE_USD" | bc -l) )); then
    {
      echo "─────────────────────────────────────────"
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ABORT skill=$SKILL reason=balance_too_low balance=$PREFLIGHT_BALANCE min=$MIN_BALANCE_USD"
    } >> "$LOG"
    # Record budget_aborted run (best-effort).
    NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    curl -fsS -X POST \
      -H "Content-Type: application/json" \
      -H "x-internal-api-key: $INTERNAL_SECRET" \
      -d "{\"skillName\":\"$SKILL\",\"startedAt\":\"$NOW\",\"finishedAt\":\"$NOW\",\"exitCode\":0,\"outcome\":\"budget_aborted\",\"preflightBalanceUsd\":$PREFLIGHT_BALANCE}" \
      "$MIDDLEWARE_URL/api/v1/internal/agent-runs" > /dev/null 2>&1 || true
    exit 0
  fi
fi

# Check today's app-level spend.
PREFLIGHT_TODAY_SPEND=$(curl -fsS --max-time 3 \
  -H "x-internal-api-key: $INTERNAL_SECRET" \
  "$MIDDLEWARE_URL/api/v1/internal/agent-runs/today-spend" 2>/dev/null \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("usd", 0))' 2>/dev/null \
  || echo "0")

if (( $(echo "$PREFLIGHT_TODAY_SPEND >= $DAILY_BUDGET_USD" | bc -l) )); then
  {
    echo "─────────────────────────────────────────"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ABORT skill=$SKILL reason=daily_budget_exceeded today_spend=$PREFLIGHT_TODAY_SPEND budget=$DAILY_BUDGET_USD"
  } >> "$LOG"
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -H "x-internal-api-key: $INTERNAL_SECRET" \
    -d "{\"skillName\":\"$SKILL\",\"startedAt\":\"$NOW\",\"finishedAt\":\"$NOW\",\"exitCode\":0,\"outcome\":\"budget_aborted\",\"preflightTodaySpendUsd\":$PREFLIGHT_TODAY_SPEND}" \
    "$MIDDLEWARE_URL/api/v1/internal/agent-runs" > /dev/null 2>&1 || true
  exit 0
fi
```

- [ ] **Step 4: Add the `today-spend` GET endpoint to the controller**

Modify `middleware/src/modules/agents/agent-runs.controller.ts` to add:

```typescript
@Get('today-spend')
async todaySpend() {
  const usd = await this.service.getTodaySpendUsd();
  return { usd };
}
```

Add `Get` to the imports.

Update `agent-runs.controller.e2e-spec.ts` to add a test for `GET /internal/agent-runs/today-spend` returning `{ usd: number }`.

- [ ] **Step 5: Run E2E tests**

Run:
```bash
pnpm --filter @vizora/middleware test:e2e -- --testPathPattern=agent-runs.controller
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add scripts/agents/hermes/ middleware/src/modules/agents/agent-runs.controller.ts middleware/src/modules/agents/__tests__/agent-runs.controller.e2e-spec.ts
git commit -m "feat(agents): pre-flight balance + daily-budget check in runner script"
```

---

### Task P0.5: Per-firing metrics — runner-recorded + Hermes-native cost source

**Hermes-first decision (§1.5), now committed to ONE path:**

The original draft carried both a `hermes insights` sidecar AND a regex fallback parser. Reviewer 1: pick one. **We commit to the sidecar.** No regex fallback. If `hermes insights` output format changes across versions, the parser is a versioned contract that fails loudly in CI (see Risk Register: Hermes version pinning).

- **Per-firing metadata** (skillName, pid, startedAt, finishedAt, exitCode, outcome) — recorded by the runner script (deterministic at the runner layer; no Hermes parsing).
- **Token usage + cost + model** — sourced EXCLUSIVELY from `hermes insights --days 1 --source cli`. A sidecar process polls every 5 min, parses the boxed-unicode-table output via stable Python regex, and back-fills `tokensIn`/`tokensOut`/`costMicrodollars`/`model` onto `agent_runs` rows by joining on session ID (if Hermes emits one in stdout) or time-range + skill name (fallback join key).
- **Tool-call outcome refinement** — sidecar also reads `mcp_audit_log` for the firing's window and updates `agent_runs.outcome` to `tool_error` if any FORBIDDEN/INVALID_INPUT rows exist for the same `agentName` + time window.

Clean separation: the runner writes the row immediately on firing completion (so `outcome='budget_aborted'` works even when Hermes was never invoked); the cost sidecar enriches it 5 min later.

**Files:**
- Create: `scripts/agents/hermes/lib/record-run.sh` (runner-side metadata recorder)
- Create: `scripts/agents/hermes/poll-insights.ts` (sidecar — runs as PM2 cron, polls `hermes insights`, posts cost deltas)
- Modify: `scripts/agents/hermes/run-hermes-skill.sh` (call `record-run.sh` post-flight)
- Modify: `middleware/src/modules/agents/agent-runs.controller.ts` (add `PATCH /:id` for cost enrichment)
- Modify: `ecosystem.config.js` (new `hermes-insights-poller` PM2 cron entry)

- [ ] **Step 1: Inspect `hermes insights` output format**

```bash
ssh root@vizora.cloud 'hermes insights --days 1 --source cli 2>&1 | head -60' > .ssh_insights_format.txt 2>&1
cat .ssh_insights_format.txt
```

Document the output format (JSON vs text vs table). If JSON: parse directly. If text/table: use a stable parser (Python regex) and fall back to `hermes logs --component agent --since N`.

- [ ] **Step 2: Investigate Hermes session-ID emission**

Each `hermes -z` invocation has a session id. Find where it's printed:

```bash
ssh root@vizora.cloud 'grep -iE "session.{0,3}(id|=)" /var/log/hermes/runner/vizora-customer-lifecycle.log | head -3' > .ssh_session_id.txt 2>&1
cat .ssh_session_id.txt
```

If Hermes prints `session_id=X` in its output, the runner can capture it and pass it as a join key to the sidecar. If not, the sidecar joins by time-range + skill name.

- [ ] **Step 1: Inspect actual Hermes output format on prod**

```bash
ssh root@vizora.cloud 'tail -200 /var/log/hermes/runner/vizora-customer-lifecycle.log | grep -iE "token|usage|generation" | head -20' > .ssh_hermes_format.txt 2>&1
cat .ssh_hermes_format.txt
```

Document the output format observed in a comment at the top of `parse-hermes-output.sh`. If Hermes does not emit token counts, skip Step 2 and use the OpenRouter generation-API approach instead.

- [ ] **Step 2: Implement the parser**

Create `scripts/agents/hermes/lib/parse-hermes-output.sh`:

```bash
#!/usr/bin/env bash
# Extract token counts and model from Hermes runner output for a single firing.
# Echoes JSON: {"tokensIn":N,"tokensOut":M,"model":"X"} or {} if unparseable.
#
# Hermes turn-end summary format (verified on prod 2026-05-08):
#   <ACTUAL FORMAT TO BE FILLED IN AFTER STEP 1>
#
# Usage: parse_hermes_run < hermes_output.log

parse_hermes_run() {
  python3 <<'PY'
import re, sys, json

text = sys.stdin.read()
# Adjust patterns based on Step 1 findings.
# Common Hermes formats include:
#   "tokens: in=N out=M model=X"
#   "[usage] prompt=N completion=M"
# Sum across all turns of a single firing.

tokens_in_pat = re.compile(r'(?:prompt|input)[\s_=:]+(\d+)', re.I)
tokens_out_pat = re.compile(r'(?:completion|output)[\s_=:]+(\d+)', re.I)
model_pat = re.compile(r'model[\s=:]+([\w\-/.]+)', re.I)

tokens_in = sum(int(m.group(1)) for m in tokens_in_pat.finditer(text))
tokens_out = sum(int(m.group(1)) for m in tokens_out_pat.finditer(text))
model_match = model_pat.search(text)

result = {}
if tokens_in: result['tokensIn'] = tokens_in
if tokens_out: result['tokensOut'] = tokens_out
if model_match: result['model'] = model_match.group(1)
print(json.dumps(result))
PY
}
```

- [ ] **Step 3: Implement the recorder**

Create `scripts/agents/hermes/lib/record-run.sh`:

```bash
#!/usr/bin/env bash
# POST a completed run's metrics to the middleware. Best-effort —
# never fails the runner.

record_run() {
  local skill="$1"
  local pid="$2"
  local started_at="$3"
  local finished_at="$4"
  local exit_code="$5"
  local outcome="$6"
  local preflight_balance="$7"
  local preflight_today_spend="$8"
  local hermes_log_path="$9"

  local middleware_url="${MIDDLEWARE_URL:-http://localhost:3000}"
  local secret="${INTERNAL_API_SECRET:-}"

  # Parse token counts from the firing's output (last invocation only — bracketed
  # by the most recent "[start ...]" marker).
  local parsed
  parsed=$(awk '/^\[.*start skill=/{buf=""} {buf=buf"\n"$0} END{print buf}' "$hermes_log_path" \
    | bash "$(dirname "$0")/parse-hermes-output.sh" 2>/dev/null \
    || echo "{}")
  # Compose JSON body. Use jq if available; fall back to python.
  local body
  body=$(python3 <<PY
import json
parsed = json.loads('$parsed' or '{}')
body = {
  "skillName": "$skill",
  "pid": int("$pid") if "$pid" else None,
  "startedAt": "$started_at",
  "finishedAt": "$finished_at",
  "exitCode": int("$exit_code"),
  "outcome": "$outcome",
}
for k in ("tokensIn", "tokensOut", "model"):
  if k in parsed: body[k] = parsed[k]
if "$preflight_balance": body["preflightBalanceUsd"] = float("$preflight_balance")
if "$preflight_today_spend": body["preflightTodaySpendUsd"] = float("$preflight_today_spend")
print(json.dumps({k: v for k, v in body.items() if v is not None}))
PY
)

  curl -fsS --max-time 3 -X POST \
    -H "Content-Type: application/json" \
    -H "x-internal-api-key: $secret" \
    -d "$body" \
    "$middleware_url/api/v1/internal/agent-runs" > /dev/null 2>&1 || true
}
```

- [ ] **Step 4: Wire post-flight into `run-hermes-skill.sh`**

After the `RC=$?` line in `run-hermes-skill.sh`, add:

```bash
# Classify outcome from exit code + log content + audit cross-reference.
#
# IMPORTANT (Reviewer 2): FORBIDDEN/INVALID_INPUT strings live in
# mcp_audit_log, NOT in Hermes stdout. The runner cannot detect tool_error
# from log text alone. Tool-error classification is therefore done LATER
# by the cost-sidecar process (P0.5 Step 7) when it joins the agent_runs
# row to mcp_audit_log entries for the same firing window. Initial
# outcome here is best-effort from Hermes-visible signals only.
OUTCOME="success"
if [[ $RC -eq 124 ]]; then
  OUTCOME="timeout"
elif [[ $RC -ne 0 ]]; then
  OUTCOME="api_error"
elif grep -q "HTTP 402\|HTTP 429\|HTTP 5[0-9][0-9]" "$LOG"; then
  OUTCOME="api_error"
fi
# Note: 'tool_error' and 'partial' classifications are added by the
# sidecar polling cron (P0.5 Step 7) which has access to mcp_audit_log.
# The runner intentionally does NOT grep for FORBIDDEN/INVALID_INPUT
# because those strings won't appear in Hermes stdout.

# shellcheck source=lib/record-run.sh
source "$(dirname "$0")/lib/record-run.sh"
record_run "$SKILL" "$$" "$START" "$END" "$RC" "$OUTCOME" "$PREFLIGHT_BALANCE" "$PREFLIGHT_TODAY_SPEND" "$LOG"
```

- [ ] **Step 5: Test locally on prod (with agents stopped)**

The agents are deleted from PM2, so this test runs the runner manually once to verify metrics flow:

```bash
ssh root@vizora.cloud 'set -a; source /root/.hermes/.env; set +a; cd /opt/vizora/app && bash scripts/agents/hermes/run-hermes-skill.sh vizora-customer-lifecycle "Run end-to-end now."' > .ssh_runner_test.txt 2>&1
cat .ssh_runner_test.txt
```

Then check the middleware:
```bash
ssh root@vizora.cloud 'docker exec -i vizora-postgres psql -U postgres -d vizora -c "SELECT \"skillName\", outcome, \"durationMs\", \"tokensIn\", \"tokensOut\", \"costMicrodollars\", \"errorExcerpt\" FROM agent_runs ORDER BY \"createdAt\" DESC LIMIT 1;"' > .ssh_run_record.txt 2>&1
cat .ssh_run_record.txt
```

Expected: a row exists with `outcome='budget_aborted'` (because credits are 0). The pre-flight check did its job.

- [ ] **Step 6: Commit**

```bash
git add scripts/agents/hermes/
git commit -m "feat(agents): post-flight metrics extraction and recording"
```

---

### Task P0.6: Grafana dashboard + Prometheus alert rules

**Files:**
- Create: `docker/grafana/dashboards/agents-cost.json`
- Create: `docker/prometheus/rules/agents.yml`
- Modify: `docker/prometheus/prometheus.yml` (include the new rule file)

- [ ] **Step 1: Define the queries**

The dashboard needs four panels driven from `agent_runs`:
1. Cost per agent per hour (last 24h) — `SUM(costMicrodollars) / 1e6 GROUP BY skillName, time(1h)`
2. Outcome distribution (last 24h) — `COUNT(*) GROUP BY outcome, skillName`
3. P50/P95 firing latency — `PERCENTILE(durationMs, 0.95) GROUP BY skillName, time(15m)`
4. Today's spend vs daily budget — single-stat panel with threshold at `DAILY_BUDGET_USD`

Choice: query Postgres directly via Grafana's PG datasource (already wired for ops dashboards). Avoid Prometheus exporters — `agent_runs` is low-cardinality append-only, perfect for SQL.

- [ ] **Step 2: Build the dashboard JSON**

Create `docker/grafana/dashboards/agents-cost.json`. Use the existing `vizora-overview.json` (referenced in CLAUDE.md autonomous-ops section) as a structural template. Four panels as above, datasource `vizora-postgres`.

(Plan-detail expansion: deferred until execution — copy + edit existing dashboard JSON in IDE, rather than hand-writing 600 lines of JSON in this plan.)

- [ ] **Step 3: Define Prometheus alerting rules**

Create `docker/prometheus/rules/agents.yml`:

```yaml
groups:
  - name: vizora-agents
    interval: 60s
    rules:
      - alert: AgentDailyBudgetExceeded
        expr: |
          sum(rate(vizora_agent_cost_microdollars[1d])) / 1e6 > 1.00
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Agent daily spend exceeded $1.00 USD"
          description: "Today's agent spend is {{ $value | printf \"%.2f\" }} USD."

      - alert: AgentNoFiringsForCron
        expr: |
          time() - max(vizora_agent_run_last_started_seconds) by (skill_name) > 3 * 900
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Agent {{ $labels.skill_name }} has not fired in 3× cron interval"

      - alert: AgentErrorRateHigh
        expr: |
          (
            sum(rate(vizora_agent_runs_total{outcome=~"tool_error|api_error|timeout"}[15m]))
            /
            sum(rate(vizora_agent_runs_total[15m]))
          ) > 0.05
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Agent error rate >5% over 15min"
```

This depends on a Postgres → Prometheus exporter (or equivalent metric emission from middleware). Two options:

**Option A (recommended):** middleware exposes Prometheus metrics on `/internal/metrics` (METRICS_TOKEN already exists per CLAUDE.md). Add a counter `vizora_agent_cost_microdollars_total` and gauge `vizora_agent_run_last_started_seconds` updated whenever `recordRun` is called.

**Option B (faster):** scrap Prometheus rules; use Grafana alerts directly on the Postgres datasource. Skip this file. Loses the `/metrics` standard but ships in 1 hour instead of 1 day.

**Decision (this plan):** Option B for now. Add the Prometheus exporter in P3 alongside the promotion machinery (which also benefits from metrics). Track in `tasks/feature-backlog.md` under "agent metrics exporter."

- [ ] **Step 4: Configure Grafana alerts**

In `agents-cost.json`, attach alert rules to:
- Daily-spend single-stat: alert when value > $1.00 for 5min, route to Slack via existing webhook.
- Outcome panel: alert when `tool_error + api_error + timeout` > 5% of total over 15min.

- [ ] **Step 5: Deploy dashboard**

Grafana auto-loads dashboards from the mounted directory. Restart Grafana container:
```bash
docker compose -f docker/docker-compose.yml restart grafana
```

Verify the dashboard appears at `http://localhost:3003/d/agents-cost`.

- [ ] **Step 6: Commit**

```bash
git add docker/grafana/dashboards/agents-cost.json docker/prometheus/rules/agents.yml
git commit -m "feat(agents): Grafana dashboard + alert rules for agent cost and errors"
```

---

### Task P0.7: Set OpenRouter daily cap (manual UI step)

This is operator action, not code. Document it in the runbook:

- [ ] **Step 1: Set daily cap via OpenRouter UI**

Sri (or whoever owns the OpenRouter account):
1. Open https://openrouter.ai/settings/keys
2. Locate the API key used by Vizora Hermes (matches the suffix in `/root/.hermes/.env`)
3. Set "Per-day spend limit" to **$2.00 USD**
4. Save.

This is the hard ceiling. Even if all four downstream layers fail, OpenRouter will return 429 once the cap is hit.

- [ ] **Step 2: Document the cap value in `CLAUDE.md`**

Add a one-line note under "Hermes Agent runtime (prod VPS)":

> OpenRouter API key has a hard $2.00/day spend cap. Increase via dashboard if intentional.

Commit:
```bash
git add CLAUDE.md
git commit -m "docs(hermes): document OpenRouter $2/day spend cap"
```

---

### P0 Acceptance Test

Before declaring P0 complete, all of these must hold:

- [ ] `agent_runs` table exists in prod DB
- [ ] `pnpm --filter @vizora/middleware test` passes (including new agent-runs tests)
- [ ] `pnpm --filter @vizora/middleware test:e2e -- --testPathPattern=agent-runs.controller` passes
- [ ] Manually invoking `run-hermes-skill.sh` on prod with credits=0 results in: outcome='budget_aborted' row in agent_runs, exit code 0, no Hermes invocation
- [ ] Grafana dashboard at `/d/agents-cost` displays the budget_aborted run
- [ ] Grafana alert fires (manual test: insert a synthetic high-cost row, verify Slack notification within 5 min)
- [ ] OpenRouter UI cap is set to $2/day

Once all green: **system is safe to add credits.** P1 is needed before re-enabling agents.

---

## Phase 1 — Tool Authorization & Token Contradiction Fix

**Goal:** Eliminate model-wandering loss vector. Each skill sees only its tools. Resolve the support-triage token-scope contradiction.

**Architecture:**
- Hermes `platform_toolsets` config restricts tools per skill at the LLM layer (model never sees forbidden tools)
- MCP server `log_shadow_row` accepts any valid token (per-org or platform), tags rows with token's org context
- E2E test verifies a wrong-tool call would fail at validation time, not runtime

**Success criteria:**
- Each skill's `agent_runs` row, when re-enabled, shows zero FORBIDDEN errors in the corresponding `mcp_audit_log` window
- `log_shadow_row` accepts both token types
- Hermes shadow agents fire end-to-end successfully on prod with credits added

---

### Task P1.1: Relax `log_shadow_row` to accept any valid token

**Files (verified to exist with these exact shapes 2026-05-08):**
- Modify: `middleware/src/modules/mcp/tools/shadow-log.tools.ts:42-46` (the `if (context.organizationId != null) throw new BadRequestException(...)` block)
- Modify: `middleware/src/modules/mcp/tools/shadow-log.tools.ts:28-30` (JSDoc says "platform-scope token required")
- Modify: `middleware/src/modules/mcp/tools/shadow-log.tools.ts:77` (tool description string says "Platform-scope token required")
- Modify: `middleware/src/modules/mcp/tools/shadow-log.tools.spec.ts:44-54` (existing test "REJECTS per-org tokens with BadRequest" asserts the OPPOSITE of the new behavior; flip it)
- Modify: `middleware/src/modules/mcp/audit/shadow-log.service.ts` (only if needed — tool layer can do enrichment, but service-side is preferred to keep tool layer thin)

**Function shape (verified):**
```ts
export async function logShadowRowTool(
  rawInput: unknown,
  context: McpRequestContext,           // { tokenId, organizationId, agentName, scopes }
  shadowLog: ShadowLogService,
): Promise<LogShadowRowResultT>
```

The existing spec uses helpers `ctx({ scopes, organizationId })` and `makeShadowLog({ appendRow? })` — reuse these patterns rather than introducing new mocks.

- [ ] **Step 1: Confirm the change site**

```bash
grep -n -B 1 -A 8 "organizationId != null" middleware/src/modules/mcp/tools/shadow-log.tools.ts
grep -n "REJECTS per-org" middleware/src/modules/mcp/tools/shadow-log.tools.spec.ts
```

Expected: lines 42-46 in the source; line 44 in the spec.

- [ ] **Step 2: Flip the existing rejection test + add three new behavior tests**

In `middleware/src/modules/mcp/tools/shadow-log.tools.spec.ts`, REPLACE the test at lines 44-54 (`it('REJECTS per-org tokens...'`) with this expanded behavior contract:

```typescript
it('ACCEPTS per-org tokens and tags the appended row with the org context', async () => {
  const svc = makeShadowLog({});
  const out = await logShadowRowTool(
    { log_name: 'vizora-customer-lifecycle-shadow', fields: { tier: 'pro' } },
    ctx({ scopes: ['shadow:write'], organizationId: 'org_abc' }),
    svc as never,
  );
  // Per-org tokens should now be valid; the row gets organization_id injected.
  expect(svc.appendRow).toHaveBeenCalledWith(
    'vizora-customer-lifecycle-shadow',
    expect.objectContaining({ tier: 'pro', organization_id: 'org_abc' }),
  );
  expect(out.written).toBe(true);
});

it('ACCEPTS platform-scope tokens and does NOT inject organization_id', async () => {
  const svc = makeShadowLog({});
  await logShadowRowTool(
    { log_name: 'vizora-customer-lifecycle-shadow', fields: { tier: 'pro' } },
    ctx({ scopes: ['shadow:write'], organizationId: null }),
    svc as never,
  );
  // Platform tokens still write but without the org tag.
  expect(svc.appendRow).toHaveBeenCalledWith(
    'vizora-customer-lifecycle-shadow',
    expect.not.objectContaining({ organization_id: expect.anything() }),
  );
});

it('does NOT overwrite an explicit organization_id field already in fields', async () => {
  // Agent might supply organization_id explicitly (e.g., a platform-scope agent
  // iterating over orgs). Don't clobber it with the token's null context.
  const svc = makeShadowLog({});
  await logShadowRowTool(
    { log_name: 'vizora-customer-lifecycle-shadow', fields: { organization_id: 'org_xyz' } },
    ctx({ scopes: ['shadow:write'], organizationId: 'org_abc' }),
    svc as never,
  );
  // Agent-supplied value wins over token's org context.
  expect(svc.appendRow).toHaveBeenCalledWith(
    'vizora-customer-lifecycle-shadow',
    expect.objectContaining({ organization_id: 'org_xyz' }),
  );
});
```

(The other tests in the file — scope-missing-throws, unknown log_name, path-traversal, oversize, passthrough — remain unchanged. They still pass after the platform-scope check is removed.)

- [ ] **Step 3: Run tests to verify failure**

```bash
pnpm --filter @vizora/middleware test -- --testPathPattern=shadow-log.tools.spec
```

Expected: FAIL — the new "ACCEPTS per-org" test fails because the source still throws BadRequest.

- [ ] **Step 4: Modify the source**

In `middleware/src/modules/mcp/tools/shadow-log.tools.ts`, REMOVE the platform-scope check (lines 42-46) and add org-context injection right before the service call:

```typescript
// BEFORE (lines 39-47):
//   if (!hasScope(context, 'shadow:write')) {
//     throw new ForbiddenException("Token lacks scope 'shadow:write'");
//   }
//   if (context.organizationId != null) {                                 ← REMOVE
//     throw new BadRequestException(                                      ← REMOVE
//       'log_shadow_row requires a platform-scope token (organizationId=null). Per-org tokens are rejected.',
//     );                                                                  ← REMOVE
//   }                                                                     ← REMOVE
//   const input = LogShadowRowInput.parse(rawInput) as LogShadowRowInputT;

// AFTER:
  if (!hasScope(context, 'shadow:write')) {
    throw new ForbiddenException("Token lacks scope 'shadow:write'");
  }
  const input = LogShadowRowInput.parse(rawInput) as LogShadowRowInputT;

  // Inject the token's org context into the row IFF the agent didn't already
  // supply organization_id (agent-supplied wins). Per-org tokens get tagged;
  // platform-scope tokens (organizationId=null) do not.
  const fieldsWithContext = {
    ...(context.organizationId != null ? { organization_id: context.organizationId } : {}),
    ...(input.fields as Record<string, unknown>),
  };
```

Then update the `shadowLog.appendRow` call to pass `fieldsWithContext` instead of `input.fields`.

- [ ] **Step 5: Update the JSDoc and tool description**

Replace lines 28-30 of the JSDoc:

```ts
// BEFORE: "Token shape: platform-scope token required. Per-org tokens are
//          rejected with INVALID_INPUT — shadow logs are agent-side audit
//          trails, not org-scoped data."
// AFTER:  "Token shape: any valid token with `shadow:write` scope. Per-org
//          tokens get tagged with `organization_id` in the appended row;
//          platform-scope tokens write without the tag. Agent-supplied
//          `organization_id` in fields takes precedence."
```

Replace the trailing sentence in the LOG_SHADOW_ROW_TOOL `description` field at line 77:

```ts
// BEFORE: "...max 4096 bytes serialized). Platform-scope token required."
// AFTER:  "...max 4096 bytes serialized). Requires `shadow:write` scope; per-org tokens are tagged with org context, platform-scope tokens are not."
```

- [ ] **Step 6: Run tests to verify pass**

```bash
pnpm --filter @vizora/middleware test -- --testPathPattern=shadow-log.tools.spec
```

Expected: PASS — all 9 tests in the file pass (the 3 new + 6 unchanged).

- [ ] **Step 7: Commit**

```bash
git add middleware/src/modules/mcp/tools/shadow-log.tools.ts middleware/src/modules/mcp/tools/shadow-log.tools.spec.ts
git commit -m "fix(mcp): log_shadow_row accepts per-org tokens, tags rows with org context

Removes the structural contradiction in support-triage's token shape: the
agent needs per-org access for support:* tools AND shadow:write for the
audit log. log_shadow_row now accepts any valid shadow:write token and
enriches the row with the calling token's org context (null for platform).

Eliminates the 454 INVALID_INPUT errors observed in mcp_audit_log on May 5-6."
```

---

### Task P1.2: Hermes per-skill tool allowlists (via `-t` CLI flag)

**Hermes-first decision (§1.5):** Hermes already supports per-invocation
tool allowlisting via `hermes -z -t <toolsets>`. We pass the allowlist
from the runner script per-skill rather than inventing a config-yaml
key. This is a one-line change to `run-hermes-skill.sh` plus per-skill
toolset constants in `ecosystem.config.js`.

**Files:**
- Modify: `scripts/agents/hermes/run-hermes-skill.sh` (add `-t` flag)
- Modify: `ecosystem.config.js:392-435` (the `hermes-vizora-*` entries — pass toolset as third arg)

- [ ] **Step 1: Verify the exact toolset names Hermes expects**

The MCP tool names registered by Vizora's MCP server are namespaced.
Hermes prefixes them as `mcp_<server-name>_<tool-name>`. Verify:

```bash
ssh root@vizora.cloud 'hermes -z --skills vizora-customer-lifecycle "list available MCP tools and exit"' > .ssh_tool_names.txt 2>&1
# Or read from a successful prior firing's runner log:
ssh root@vizora.cloud 'grep -oE "mcp_vizora_[a-z_]+" /var/log/hermes/runner/vizora-customer-lifecycle.log | sort -u' >> .ssh_tool_names.txt 2>&1
cat .ssh_tool_names.txt
```

Expected: actual tool identifiers. Use these verbatim in Step 2.

- [ ] **Step 2: Modify `run-hermes-skill.sh` to accept a toolset arg**

Edit `scripts/agents/hermes/run-hermes-skill.sh`. Change the signature from `<skill-name> <prompt>` to `<skill-name> <prompt> [toolsets-csv]` and pass through:

```bash
SKILL="${1:-}"
PROMPT="${2:-}"
TOOLSETS="${3:-}"  # NEW — comma-separated MCP tool names; empty = all tools

# ... existing pre-flight ...

# Build the hermes invocation. -t adds the toolset filter when provided.
HERMES_ARGS=(--skills "$SKILL" -z "$PROMPT")
if [[ -n "$TOOLSETS" ]]; then
  HERMES_ARGS+=(-t "$TOOLSETS")
fi
timeout 300 /usr/local/bin/hermes "${HERMES_ARGS[@]}" >> "$LOG" 2>&1
RC=$?
```

- [ ] **Step 3: Update `ecosystem.config.js` to pass per-skill toolsets**

Modify the two `hermes-vizora-*` entries' `args` arrays to add the toolset CSV as a third element. (Tool names verified in Step 1; placeholder shown — REPLACE with verified names.)

```js
{
  name: 'hermes-vizora-customer-lifecycle',
  // ...
  args: [
    '/opt/vizora/app/scripts/agents/hermes/run-hermes-skill.sh',
    'vizora-customer-lifecycle',
    'Run the vizora-customer-lifecycle skill end-to-end now. ...',
    'mcp_vizora_list_onboarding_candidates,mcp_vizora_log_shadow_row,mcp_vizora_mark_onboarding_nudge_sent,mcp_vizora_send_lifecycle_nudge_email,mcp_vizora_auto_complete_org_onboarding',
  ],
  // ...
},
{
  name: 'hermes-vizora-support-triage',
  // ...
  args: [
    '/opt/vizora/app/scripts/agents/hermes/run-hermes-skill.sh',
    'vizora-support-triage',
    'Run the vizora-support-triage skill end-to-end now. ...',
    'mcp_vizora_list_open_support_requests,mcp_vizora_log_shadow_row,mcp_vizora_update_support_request_priority,mcp_vizora_update_support_request_ai_category,mcp_vizora_create_support_message',
  ],
  // ...
},
```

- [ ] **Step 4: Smoke-test on prod manually**

```bash
ssh root@vizora.cloud 'set -a; source /root/.hermes/.env; set +a; cd /opt/vizora/app && bash scripts/agents/hermes/run-hermes-skill.sh vizora-customer-lifecycle "list available tools and exit" "mcp_vizora_list_onboarding_candidates,mcp_vizora_log_shadow_row"' > .ssh_p1_smoke.txt 2>&1
cat .ssh_p1_smoke.txt
```

Expected: Hermes lists only the two allowlisted tools. The other MCP tools should not appear in its visible toolset.

- [ ] **Step 5: Commit**

```bash
git add scripts/agents/hermes/run-hermes-skill.sh ecosystem.config.js
git commit -m "feat(hermes): per-skill tool allowlist via -t flag (eliminates model wandering)"
```

---

### Task P1.3: End-to-end re-enable test (with credits added)

**Pre-condition:** Sri has added at least $2 of credits to OpenRouter.

- [ ] **Step 1: Re-add Hermes PM2 entries**

```bash
ssh root@vizora.cloud 'cd /opt/vizora/app && git pull && pm2 start ecosystem.config.js --only hermes-vizora-customer-lifecycle && pm2 save' > .ssh_p1_start.txt 2>&1
cat .ssh_p1_start.txt
```

Re-add **only customer-lifecycle first.** Support-triage waits until customer-lifecycle has run cleanly twice.

- [ ] **Step 2: Watch first firing**

```bash
ssh root@vizora.cloud 'tail -F /var/log/hermes/runner/vizora-customer-lifecycle.log' > .ssh_p1_watch.txt 2>&1 &
# Wait ~60 seconds, then read
```

Expected within one cron interval (≤30 min):
- Pre-flight balance check passes
- `hermes -z` invokes
- Skill executes end-to-end
- `agent_runs` row inserted with `outcome='success'`
- `mcp_audit_log` shows zero FORBIDDEN, zero INVALID_INPUT for this firing's window

- [ ] **Step 3: Verify zero wandering**

```bash
ssh root@vizora.cloud 'docker exec -i vizora-postgres psql -U postgres -d vizora -c "SELECT tool, status, COUNT(*) FROM mcp_audit_log WHERE \"agentName\"='\''hermes-customer-lifecycle'\'' AND \"createdAt\" > NOW() - INTERVAL '\''1 hour'\'' GROUP BY tool, status ORDER BY tool;"' > .ssh_p1_audit.txt 2>&1
cat .ssh_p1_audit.txt
```

Expected: only `list_onboarding_candidates`, `log_shadow_row`, and (if any nudge fires) the customer-write tools. No FORBIDDEN rows.

- [ ] **Step 4: If clean for 2 firings, re-add support-triage**

```bash
ssh root@vizora.cloud 'pm2 start ecosystem.config.js --only hermes-vizora-support-triage && pm2 save' > .ssh_p1_start_st.txt 2>&1
```

Repeat Steps 2–3 for support-triage.

- [ ] **Step 5: Document outcome in `tasks/lessons.md`**

Add a section with the date, what was changed, and what the verification showed. Per CLAUDE.md global rule.

---

### P1 Acceptance Test

- [ ] Both Hermes shadow agents firing every cron tick without FORBIDDEN/INVALID_INPUT errors
- [ ] `agent_runs` table accumulating success rows
- [ ] Grafana dashboard shows expected cost (<$0.05/firing) and zero error rate
- [ ] OpenRouter balance not declining anomalously after 24h

Once all green: **agents are safely re-enabled in shadow mode.** P2–P4 are quality work.

---

## Phase 2 — Architecture Flip (TS Orchestrator; LLM only where it earns its place)

**Goal:** Demote the LLM. Deterministic TS code becomes the workflow driver. The LLM is called ONLY where the existing-data battery (CLAUDE.md global §11b) shows the heuristic is systematically wrong on a measurable bucket — never on a hunch.

**Per-agent effort (revised after Reviewer 1 feedback):**
- `customer-lifecycle`: **2–3 days** (heuristic-only — no LLM in v1)
- `support-triage`: **2–3 weeks** (LLM-augmented, only after existing-data battery proves it's needed)

**Total P2: 3–4 weeks, not "5–7 days per agent" as the previous draft claimed.** The original estimate didn't account for shadow harness, JSON-schema integration, idempotency, comparison reader, and 14d shadow soak. Reviewer 1 was right: it was fiction.

### P2.A — `customer-lifecycle` becomes pure TS heuristic (no LLM)

Reviewer 1 finding C6: customer-lifecycle template selection is a 5-element decision table on `daysSinceSignup` + `milestoneFlags`. An LLM is not justified for this workload. Anthropic's *Building Effective Agents* (Dec 2024) explicitly recommends "find the simplest solution possible, and only increase complexity when needed." A decision table beats any LLM here.

**Architecture:**

```typescript
// scripts/agents/customer-lifecycle.ts (already exists at 463 lines, runs as PM2 cron)
// becomes the SOLE driver. The Hermes shadow agent gets retired (or kept
// briefly for comparison data) once this is verified.

// Decision table (already encoded in the existing TS heuristic):
//   day 1, !welcomed                                → 'welcome'
//   day 3, !screenPaired                            → 'pair-screen'
//   day 7, !contentUploaded                         → 'upload-content'
//   day 14, !playlistCreated                        → 'create-playlist'
//   day 30, any milestone missing                   → 'auto-complete' (admin notify)
//   else                                            → 'none'
//
// Confidence: 1.0 always (deterministic). No LLM.
```

**Verification before committing to this:** run the existing-data battery on the May 5-6 shadow data:

1. Bootstrap CI on heuristic vs Hermes shadow agreement (the 627 successful Hermes shadow rows already in `vizora-customer-lifecycle-shadow.jsonl` — vs the heuristic's 1769 rows).
2. If agreement ≥ 95%: ship heuristic-only. LLM wasn't adding value.
3. If agreement is lower in a SPECIFIC subset (e.g. orgs with unusual milestone patterns): scope the LLM to ONLY that subset, with structured-outputs JSON schema. Don't introduce LLM for the whole agent.

**Detailed task breakdown deferred to:** `docs/plans/2026-05-08-phase-2a-customer-lifecycle.md` (written when P2 begins).

**Success criteria (P2.A):**
- `customer-lifecycle` runs as pure TS PM2 cron with NO Hermes/LLM dependency
- P95 cost per firing: $0 (no LLM)
- 14-day comparison vs prior Hermes shadow: ≥ 95% template-choice agreement on shared candidate set
- 50 manually-labeled cases reach ≥ 85% agreement with the heuristic (ground-truth alignment, §5)
- Backlog entry for "customer-lifecycle live cutover" closes — replaced by "Hermes shadow retirement"

### P2.B — `support-triage` LLM-augmentation (only if data justifies)

**Conditional on P2.A learnings.** support-triage has more degrees of freedom than customer-lifecycle (priority ∈ 4 buckets, category from 12+ V2 taxonomy slugs, free-text body that the heuristic only sees structurally).

**Verification BEFORE designing the LLM path:** run the existing-data battery on the 1880 successful `list_open_support_requests` calls from May 5-6:

1. Compute heuristic-only priority/category for each ticket.
2. Compute Hermes-suggested priority/category from the (147 lines of) `vizora-support-triage-shadow.jsonl`.
3. Sample 50 tickets, label by hand (ground truth).
4. Three-way comparison: heuristic vs Hermes vs ground truth.
5. **If heuristic alone hits ≥ 90% ground-truth agreement: skip the LLM here too.**
6. **If heuristic is < 80% on a measurable bucket (e.g. multi-paragraph body tickets): introduce LLM ONLY for that bucket, with structured-outputs JSON schema constrained to the V2 taxonomy enum.**

**Architecture (only if step 6 fires):**

```typescript
// scripts/agents/support-triage.ts (already exists at 306 lines)
// Wrap with: heuristic first, LLM only on low-confidence subset.

const heuristic = scoreHeuristic(ticket);
if (heuristic.confidence >= 0.85) {
  return heuristic; // ~80%+ of tickets
}
// LLM classifier — single call, JSON-schema-constrained output, prompt-cached prefix
const classification = await openrouterStructured({
  model: 'openai/gpt-4o-mini-2024-07-18', // PINNED version
  response_format: { type: 'json_schema', schema: ClassificationSchema },
  cache_control: [{ type: 'ephemeral' }], // skill text cached
  messages: [/*...*/],
});
return classification;
```

**Detailed task breakdown deferred to:** `docs/plans/2026-05-08-phase-2b-support-triage.md` (written when P2.A ships and the existing-data battery has run).

**Success criteria (P2.B — conditional):**
- LLM invoked on ≤ 20% of tickets (the low-confidence bucket only)
- Per-firing cost ≤ $0.005 P95
- Heuristic+LLM hit ≥ 90% ground-truth agreement on 50 manually-labeled cases (§5 alignment criterion)
- Zero JSON-parse failures (structured outputs guarantees this)
- 14-day shadow soak before any cutover

---

## Phase 3 — Promotion Machinery (Shadow → Canary → Live)

**Goal:** Replace ad-hoc cutover with automated, gated rollout. Reversible in <60s.

**Effort:** 2–3 days.

**Drift-check (§1.6) — partial drift confirmed:** `tasks/feature-backlog.md`
already contains a detailed spec for the shadow-vs-heuristic comparison
reader. Key constraints from that backlog entry that this phase MUST
inherit (do not redesign):

- **Tolerant reader, not strict-schema** — gpt-4o-mini doesn't reliably
  copy field names verbatim; the comparison reader must extract the
  decision from drifted output. Three SKILL prompt iterations proved
  this on 2026-05-05.
- **Location:** `scripts/agents/hermes/compare-shadow.ts`
- **Schedule:** daily PM2 cron
- **Output:** `logs/hermes-shadow-comparison/YYYY-MM-DD.{json,md}`
- **Slack alert thresholds:** `agreement_rate < 85%` OR
  `runs_with_no_extractable_decision > 10%`
- **Cutover-gate semantics:** promote only if `agreement_rate >= 85%`
  for 7 consecutive days AND `runs_with_no_extractable_decision <= 5%`
  for 7 consecutive days AND zero false-positive Hermes decisions

**Architecture sketch (this phase adds, on top of the backlog spec):**

- New table `agent_promotion_state`: per-skill row with `stage: 'shadow' | 'canary' | 'live'`, `canary_org_ids: string[]`, `promoted_at`, `promoted_by`, `rollback_reason`.
- Middleware exposes `GET /api/v1/agents/:skill/state` and `POST /api/v1/agents/:skill/promote` (super-admin only, requires explicit `to_stage` and metric-snapshot confirmation that quotes the comparison reader's last 7d output).
- Runner script reads the state at start of each firing; for canary it consults `canary_org_ids` and processes only those orgs in live-mode (rest stay shadow).
- Daily cron `agent-promotion-evaluator` reads `compare-shadow.ts`'s
  output + `agent_runs` metrics and SUGGESTS promotions in a Slack
  message — but never auto-promotes (humans pull the trigger).

**Detailed task breakdown deferred to:** `docs/plans/2026-05-08-phase-3-promotion.md` (written when P3 begins). That sub-plan must explicitly reference and align with the backlog entry.

---

## Phase 4 — Operational Hardening

**Goal:** Production-grade reliability features.

**Effort:** 2–3 days.

**Drift-check (§1.6) — existing protections to extend, not replace:**

- `send_lifecycle_nudge_email` already has a server-side `MAX_EMAILS_PER_RUN=50` cap, `LIFECYCLE_TEST_EMAILS` allowlist, and `LIFECYCLE_LIVE=false` dry-run default (per `tasks/feature-backlog.md`). Our idempotency layer extends this with per-(org, nudge_key, day) dedup keys; it does not remove any existing guard.
- `mark_onboarding_nudge_sent` already pre-checks `dayN_NudgeSentAt` for dedup (per CLAUDE.md tool description). Idempotency layer is redundant for this tool — confirm before adding.
- Existing `ops-watchdog` already detects stale ops agents (per CLAUDE.md). Extension to `agent_runs` is straightforward.
- **`circuit-breaker.service.ts` already exists** at `middleware/src/modules/common/services/circuit-breaker.service.ts` (Reviewer 2 finding — original drift-check missed it). P4 task 1 must reuse this service, not rebuild. Read its API first; if it's per-process (in-memory), our cross-firing breaker may need persistence across PM2 cron firings → wrap with Redis-backed state.

**Tasks (high-level):**
1. **Cross-firing circuit breaker:** REUSE `middleware/src/modules/common/services/circuit-breaker.service.ts`. If its state is in-memory, wrap with a Redis-backed counter so trips persist across PM2 cron firings. Track consecutive `outcome IN ('api_error','timeout','tool_error')` from `agent_runs`; halt + Slack-alert after 5. Hermes-first check: `tool_loop_guardrails` is intra-firing; this fills the cross-firing gap not covered by Hermes.
2. **Idempotency keys on remaining MCP write tools** that lack them today: `log_shadow_row` (no current dedup), `update_support_request_*`, `create_support_message`, `auto_complete_org_onboarding`. Server-enforced via a `mcp_idempotency_keys` table. SKIP for tools that already have natural dedup (see drift-check above).
3. **Structured JSON replay log:** replace the line-oriented runner log with one JSON document per firing in `/var/log/hermes/runs/<skill>/<run_id>.json`. Hermes-first check: `hermes dump` exists for snapshot-style export but is per-config not per-firing; `hermes logs --session ID` is structured but not per-firing-document. Custom `agent_runs/<id>.json` complements both. Includes pre-flight metadata, every tool call (referencing `mcp_audit_log` IDs), the LLM classifier call, and the final outcome.
4. **Watchdog escalation:** extend existing `ops-watchdog` PM2 cron (currently watches ops agents per CLAUDE.md) to also know about `agent_runs` — alert if no successful firing per skill in 3× cron interval.

**Detailed task breakdown deferred to:** `docs/plans/2026-05-08-phase-4-hardening.md` (written when P4 begins).

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `hermes insights` output format unstable across versions | Medium | Low | Pin Hermes version (`v0.12.0` — see "Pin Hermes version" task in §6); treat parser as a versioned contract; integration test on each Hermes upgrade |
| `hermes -t` flag interaction with `--skills` is undocumented | Medium | Medium (P1.2 design depends on this) | P1.2 Step 4 explicitly smoke-tests this combination on prod with a paid key (NOT just argparse-validation; actual LLM-visible tool filtering) |
| **Hermes `model.max_tokens=4096` is NOT enforced at OpenRouter request layer (phantom lever)** | **Medium (UNVERIFIED)** | **High (Layer 3 cost defense fails)** | P0.0a smoke-test verifies this BEFORE proceeding; if not honored, fall back to per-call `--max-tokens` flag or remove the layer claim |
| **OpenRouter outage / model-access revocation** | **Low (rare)** | **High (no fallback provider)** | Add `hermes fallback` to a secondary provider (Anthropic direct, OpenAI direct) in P0.6; document the manual switchover runbook in `docs/runbooks/` |
| **`gpt-4o-mini` silent revisions / drift** | **Medium (already happened twice in 2025)** | **Medium (classifier behavior shifts)** | Pin model version in OpenRouter request (`gpt-4o-mini-2024-07-18` style); add daily golden-set regression check that fails CI on disagreement |
| **Comparison reader self-deception** (Hermes vs heuristic agreement ≠ ground truth) | **Medium** | **High (we ship a worse system than the heuristic)** | §5 Ground-Truth Alignment criterion above; sample 50 human-labeled cases per agent before any cutover; revisit P3 promotion gate with this in mind |
| New `agent_runs` writes overload Postgres on prod | Low | Low (volume is ~50/hour) | No mitigation needed; existing infra handles 1000s/sec |
| Architecture flip (P2) disagrees with heuristic on real cases | Medium | Low (still in shadow) | This is exactly what shadow mode is for; promotion gates catch it |
| `$2/day` cap affects legitimate firings | Low | Medium | Cap is ~5× expected steady-state; revisit after 7d of P0 data; raise if false positives |
| Migration to TS orchestrator slows iteration speed | Medium | Low | TS code is faster to test than SKILL.md prompts; net velocity gain |
| `hermes insights` is per-host CLI, not HTTP — sidecar required | Low | Low | Standard PM2 cron pattern; same shape as existing ops agents |
| Backlog drift: someone ships shadow-comparison work outside this plan | Low | Medium (P3 redesigned) | P3 sub-plan reads backlog FIRST and aligns with whatever's there at start time |
| Hermes auto-update breaks all CLI assumptions (toolsets, insights, `-t`) | Low | High | Pin version in deploy script; CI test runs `hermes --version` and fails if drift; do not run `hermes update` without re-validating |

---

## Definition of done

This plan is complete when:

1. ✅ All P0 acceptance tests pass
2. ✅ All P1 acceptance tests pass
3. ✅ P2 plan written and at least one agent (customer-lifecycle) flipped to TS-orchestrator + LLM-classifier
4. ✅ P3 plan written and promotion machinery deployed
5. ✅ P4 plan written and hardening complete
6. ✅ 14 consecutive days satisfying all top-tier criteria from §5
7. ✅ `tasks/lessons.md` updated with the post-mortem of the original credit drain and what the new architecture prevents
8. ✅ `CLAUDE.md` updated to reference this plan from the "Agent Architecture (business agents)" section

---

## Execution

**Plan complete and saved to `docs/plans/2026-05-08-agent-platform-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended for P2–P4)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best when tasks are independent (e.g., parallel agent work).

**2. Inline Execution (recommended for P0–P1)** — Execute tasks in this session with checkpoints. Best when tasks have tight dependencies (P0 sets up infrastructure all subsequent phases use).

**My recommendation:** Inline for P0+P1 (the immediate ~3-day blocker), then subagent-driven for P2 and beyond.

**Which approach?**
