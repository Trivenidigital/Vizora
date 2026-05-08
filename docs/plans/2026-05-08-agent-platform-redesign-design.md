# Vizora Agent Platform Redesign — Technical Design

**Companion to:** `docs/plans/2026-05-08-agent-platform-redesign.md` (the plan).

The plan defines WHAT to build and the task sequencing. This document defines HOW the components fit together — contracts, sequence flows, state machines, error taxonomy, concurrency model, test architecture, security boundaries.

**Scope:** P0 + P1 only. P2–P4 designs are deferred until those phases begin (per the plan's deferral pattern).

**Hermes-first / drift-check:** see plan §1.5 + §1.6. Not duplicated here.

---

## 1. Architectural decisions log (ADL)

Decisions that shape the rest of this design. Each decision lists the alternatives considered and why we chose what we chose.

### ADL-1: Cost governance is layered, not single-point

**Decision:** Four independent enforcement layers, in series. A failure of any one layer does not result in a credit drain.

| # | Layer | Owner | Failure mode it prevents |
|---|---|---|---|
| L1 | OpenRouter per-day cap ($2.00) | Provider, manual UI | All other layers compromised; bug in any custom code |
| L2 | Vizora pre-flight balance check | `run-hermes-skill.sh` (calls `/v1/credits` before invoking Hermes) | Provider cap not yet hit, but balance is approaching zero |
| L3 | Hermes `tool_loop_guardrails.hard_stop_enabled` + `max_tokens` | Hermes runtime config | Single firing loops forever or generates 16K-token output |
| L4 | Cross-firing Redis circuit breaker (P4) | Vizora middleware via existing `circuit-breaker.service.ts` | Repeated failures across firings (the May 6 scenario) |

**Alternatives rejected:**
- *Single-point: provider cap only.* Brittle; an OpenRouter UI change or human error removes the only defense.
- *Single-point: Vizora-side accounting only.* Cannot stop a firing once it's in flight; only prevents the next one.

**Implication for this design:** every layer is independently testable. P0 has a dedicated task (P0.0a) to verify L3 actually clamps the OpenRouter request param — Reviewer 2's phantom-lever finding.

### ADL-2: Runner records metadata; sidecar enriches cost

**Decision:** Two-stage write to `agent_runs`:

1. **Synchronous** (runner script, immediately on firing exit): `skillName`, `pid`, `startedAt`, `finishedAt`, `exitCode`, `outcome`, `preflightBalanceUsd`, `preflightTodaySpendUsd`. Best-effort POST to `/internal/agent-runs`.
2. **Asynchronous** (sidecar PM2 cron, every 5 min): `tokensIn`, `tokensOut`, `costMicrodollars`, `model`, refined `outcome` (downgrade `success`→`tool_error` if `mcp_audit_log` shows tool errors in the firing's window). PATCH `/internal/agent-runs/:id`.

**Alternatives rejected:**
- *Single-stage at runner exit.* Requires runner to parse Hermes output — fragile, adds latency to firing teardown, fails when Hermes itself is broken.
- *Single-stage in sidecar.* Loses budget_aborted / pre-Hermes-failure rows entirely (Hermes never invoked → no insights data → no record).

**Implication:** the `agent_runs` row is mutable for ≤ 5 min after firing exit, then frozen.

### ADL-3: Outcome classification — runner is signal-only, sidecar is truth

**Decision (revised after Reviewer A I2 + D10):** The runner emits ONLY the 4-value subset it can detect with high confidence: `success | api_error | timeout | budget_aborted`. The runner does NOT regex Hermes stdout for FORBIDDEN/INVALID_INPUT (those strings live in `mcp_audit_log`, not Hermes output — Reviewer 2 of the plan-review confirmed). The sidecar owns refinement to the full 8-value enum using audit-log data joined by `agentRunId` (§2.3).

**Mutually exclusive outcomes (Reviewer A D10):**

| Outcome | Source | Detection rule |
|---|---|---|
| `budget_aborted` | Runner (pre-flight) | Balance < MIN_BALANCE_USD OR today's spend ≥ DAILY_BUDGET_USD. Hermes never invoked. |
| `timeout` | Runner | Hermes `RC == 124` (timeout(1)) — wall-clock exceeded. |
| `api_error` | Runner | Hermes `RC != 0` (excluding 124), OR stdout contains `HTTP 402`/`429`/`5xx`. NOTE: **anchored** regex against known Hermes error-line prefixes, not bare match — reduces false positives. |
| `success` (initial) | Runner | Hermes `RC == 0`, no API error markers. PROVISIONAL — sidecar confirms or refines. |
| `success` (confirmed) | Sidecar | Initial=`success` AND `mcp_audit_log` shows zero failures for this `agentRunId`. |
| `tool_error` | Sidecar only | Initial=`success` AND `mcp_audit_log` shows ≥1 failure AND **zero successes** for this `agentRunId`. (All MCP calls failed.) |
| `partial` | Sidecar only | Initial=`success` AND `mcp_audit_log` shows ≥1 success AND ≥1 failure. (Mixed.) |
| `no_work` | Sidecar | Initial=`success`, all MCP calls succeeded, AND no shadow-log row was written (heuristic: zero candidates/tickets). |
| `runner_crash` | Sidecar (orphan sweep) | `tokensIn IS NULL` AND `createdAt < NOW() - 10 min`. |

**Precedence rule (no overlap):** `tool_error` ⊕ `partial` ⊕ `success` are determined by ratio: 0% success = `tool_error`, 100% success with rows written = `success`, 100% success with no rows = `no_work`, anything in between = `partial`.

**Implication for tests:** unit tests cover runner classifier on stdout fixtures (4-value subset only); sidecar classifier on `mcp_audit_log` row fixtures (full enum); integration test covers runner→sidecar handoff via the `agentRunId` propagation path.

### ADL-4: `agent_runs.id` is the join key, not session ID

**Decision:** The runner script returns the `agent_runs.id` (CUID) it created, and the sidecar enriches by ID — not by Hermes session ID.

**Why:** Hermes session ID emission in stdout is unverified (Reviewer 2 noted `/root/.hermes/sessions/cli/` doesn't exist with the structure originally assumed). Even if reliable, joining by time-range + skill name is cleaner and survives Hermes upgrades.

**Implication:** the runner POST returns `{ id }`; runner stores it in `LOG`'s firing-end marker so the sidecar can correlate.

### ADL-5: Tool authorization is enforced at TWO layers

**Decision:**
1. **Hermes layer** (P1.2): `hermes -z -t <toolsets>` filters which tools the LLM SEES. Prevents the model from even being aware of tools it shouldn't call.
2. **MCP server layer** (existing): scope-based auth on the actual tool handler. Prevents the model from CALLING a tool even if it discovers one outside its allowlist (e.g., via prompt injection from data).

The plan's P1.2 only addresses layer 1. Layer 2 already exists. Defense in depth: an LLM that ignores its tool allowlist still fails at the server scope check.

**Implication:** both layers must be tested. P1.2 acceptance test (paid-key smoke) validates layer 1; existing MCP scope tests validate layer 2.

### ADL-6: customer-lifecycle drops the LLM in P2.A; support-triage stays conditional

**Decision:** Customer-lifecycle becomes pure TS heuristic with no LLM dependency. Existing-data battery from May 5-6 shadow logs informs whether support-triage gets an LLM at all.

**Why:** Reviewer 1's C6 — Anthropic's *Building Effective Agents* (Dec 2024) recommends "find the simplest solution possible." A 5-element decision table on `daysSinceSignup` × `milestoneFlags` is the simplest solution; an LLM is added complexity without justification.

**Implication for this design:** P2.A doesn't appear in the design's contracts at all (it's pure TS code in `scripts/agents/customer-lifecycle.ts` which already exists). P2.B contracts are deferred until the existing-data battery runs.

### ADL-7: Cost is FROZEN at write — never recomputed

**Decision (added after Reviewer A D3):** When OpenRouter changes model rates, we do NOT recompute historical `costMicrodollars` values. Each `agent_runs` row captures the rate USED at the moment of write (`rateInUsdPerMt` and `rateOutUsdPerMt` columns). Historical analysis reads those columns directly. Forward analysis uses the current `MODEL_RATES` table.

**Why:** rate changes are rare; historical accuracy is high-value (cost-attribution audits, post-incident retrospectives). The alternative (recompute on demand by joining a `model_rates` table on `effectiveAt`) is more flexible but introduces a join on every cost query and a cross-table consistency obligation. Rejected for simplicity.

**Operational consequence:** when `MODEL_RATES` constants in code change, no migration is needed. New rows pick up the new rates via the sidecar's `EnrichRunInput`; old rows preserve their historical rates.

**Test consequence:** unit tests for cost computation use fixtures of (tokensIn, tokensOut, model, expectedCost). When rates change, fixtures change for new rows only — old fixtures remain frozen ground truth for historical-accuracy tests.

---

## 2. Data model

### 2.1 New: `agent_runs` (P0.1)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ agent_runs                                                                  │
├──────────────────────────┬─────────────────────────────────────────────────┤
│ id                       │ String       PK  CUID                            │
│ skillName                │ String        e.g. "vizora-customer-lifecycle"  │
│ organizationId           │ String?       For per-org skills; null for      │
│                          │               platform-scope (cost attribution) │
│ pid                      │ Int?          PM2 worker PID                     │
│ startedAt                │ DateTime      Pre-flight start (UTC)            │
│ finishedAt               │ DateTime?     Hermes exit OR pre-flight abort   │
│ durationMs               │ Int?          finishedAt - startedAt            │
│ exitCode                 │ Int?          Hermes process RC; null if        │
│                          │               budget-aborted                    │
│ tokensIn                 │ Int?          Filled by sidecar; null if Hermes │
│                          │               never ran                         │
│ tokensOut                │ Int?          Filled by sidecar                  │
│ costMicrodollars         │ Int?          FROZEN AT WRITE — never recompute │
│ rateInUsdPerMt           │ Decimal(8,4)? Rate USED at write time           │
│ rateOutUsdPerMt          │ Decimal(8,4)? Rate USED at write time           │
│ model                    │ String?       Versioned id, e.g.                │
│                          │               "openai/gpt-4o-mini-2024-07-18"   │
│ outcome                  │ String        See §1 ADL-3 + §5 (Zod-validated) │
│ errorExcerpt             │ String?       Max 1024 chars; runner-tail       │
│                          │               snippet on error                  │
│ preflightBalanceUsd      │ Decimal(12,8)? OpenRouter returns 8 fractional  │
│                          │               digits — match exactly            │
│ preflightTodaySpendUsd   │ Decimal(12,8)? Same precision                   │
│ createdAt                │ DateTime      Auto                               │
└──────────────────────────┴─────────────────────────────────────────────────┘

Indexes:
  - (skillName, startedAt)   for time-series dashboard queries
  - (outcome, startedAt)     for failure-rate alerting
  - (model, startedAt)       for per-model cost breakdowns
  - (createdAt)              for retention DELETE scan
  - (organizationId, startedAt) for per-tenant cost attribution

Retention: 90-day rolling window. Enforced by db-maintainer cron
(extends existing scripts/ops/db-maintainer.ts):

   DELETE FROM agent_runs WHERE createdAt < NOW() - INTERVAL '90 days';

At ~50 firings/hour = 1200/day, steady-state table size is ~108K rows.
The (createdAt) index makes the daily delete a fast index scan.

ADL-7: Cost is FROZEN at write — never backfilled
  When OpenRouter changes model rates, we do NOT recompute historical
  costMicrodollars values. Instead, we capture the rate USED at write
  time (rateInUsdPerMt / rateOutUsdPerMt columns). Historical analysis
  reads those columns directly — accurate at the moment of the firing.
  Forward analysis uses the current MODEL_RATES table.
  Alternative considered (model_rates table with effectiveAt): more
  flexible but introduces a join on every query and a cross-table
  consistency obligation. Rejected for simplicity.
```

**Schema migration safety:** Reviewer B verified no pending Prisma migrations on prod (`_prisma_migrations` last applied is `20260504120000_mcp_token_org_nullable`). The new `agent_runs` migration is purely additive. The `agentRunId` FK on `McpAuditLog` (see §2.3) is nullable — backward-compatible with existing rows.

**Lifecycle:**

```
   ┌─────────────────┐
   │ Runner pre-flight│
   │   balance check  │
   └────────┬─────────┘
            │
       ┌────┴─────┐
       │          │
       ▼          ▼
  abort below   proceed to
  threshold     Hermes invoke
       │              │
       ▼              ▼
   POST row     POST row (no cost yet)
   outcome=     outcome=success|api_error|timeout
   budget_      tokensIn/Out=null
   aborted      costMicrodollars=null
       │              │
       ▼              ▼
    [FROZEN]    Sidecar (≤5 min later)
                PATCH row:
                  - tokensIn/Out from `hermes insights`
                  - costMicrodollars computed
                  - model recorded
                  - outcome refined via mcp_audit_log
                      │
                      ▼
                   [FROZEN]
```

After 5 minutes from `finishedAt`, no further mutations. The sidecar logs and skips already-enriched rows.

### 2.2 Existing: `mcp_tokens` (no schema change, but enrichment)

P1.1 modifies the *behavior* of `log_shadow_row` against this table — not the schema. The token's `organizationId` becomes a tag on the appended row rather than a gate on the call.

Existing `mcp_tokens` rows on prod (verified):
| name | organizationId | scopes | role after P1.1 |
|---|---|---|---|
| `hermes-customer-lifecycle-shadow` | NULL | `customer:read, shadow:write` | unchanged — platform-scope correct |
| `hermes-support-triage-shadow` | `1dceeda9-...` | `displays:read, support:read, support:write, shadow:write` | unchanged token; previously broken `log_shadow_row` calls now succeed with org tagging |

### 2.3 Existing: `mcp_audit_log` (one new column)

**Reviewer B critical finding D6:** the original design said the sidecar would "cross-ref `mcp_audit_log` for `[startedAt, finishedAt]`" using time-range. This is unsafe for overlapping firings (PM2 restart edge cases, cron drift). Add a precise join key.

**New column:** `agentRunId String?` — FK to `agent_runs.id`. Nullable for backward compat with existing rows. Set by the MCP server when a request arrives that carries the runner-emitted ID in its request context.

**Wiring (P1.2 extension):** the runner script passes `agent_runs.id` as an environment variable to `hermes -z`; Hermes propagates it as a request header on MCP calls (e.g., `x-agent-run-id`); the MCP server reads it from the `McpRequestContext` and stores it on each audit row.

```prisma
model McpAuditLog {
  // ... existing fields ...
  agentRunId    String?    // NEW — FK to AgentRun.id
  agentRun      AgentRun?  @relation(fields: [agentRunId], references: [id], onDelete: SetNull)
  // ... existing indexes ...
  @@index([agentRunId])  // NEW — for sidecar's per-firing scan
}
```

**Sidecar refinement query (replaces time-range scan):**

```sql
SELECT status, errorCode, COUNT(*) AS n
FROM mcp_audit_log
WHERE agentRunId = $1
GROUP BY status, errorCode;
```

**Fallback for runs predating this change:** when `agentRunId` is NULL on existing audit rows or the runner doesn't emit the header (Hermes < 0.12.0 lacks request-header propagation, TBD), fall back to time-range + agentName join with an explicit `outcome='partial' OR 'tool_error'` confidence flag. Document this in the sidecar service.

---

## 3. Contracts

### 3.1 Zod schemas (matching the rest of MCP code)

Reviewer A's I9: the surrounding MCP code uses Zod (`tool-inputs.ts`, `tool-outputs.ts`). Use Zod here for consistency — the controller validates with Zod via a custom pipe; clients consume types via `z.infer`.

```typescript
// middleware/src/modules/agents/agent-runs.schemas.ts (NEW)
import { z } from 'zod';

// Outcome taxonomy. See §5 for detection rules. Mutual exclusivity (Reviewer A C/D10):
//   - success      = Hermes RC=0, all MCP calls succeeded
//   - partial      = Hermes RC=0, ≥1 MCP success AND ≥1 MCP failure (mixed)
//   - tool_error   = Hermes RC=0, ALL MCP calls failed (no successes)
//   - api_error    = Hermes RC≠0 OR HTTP 4xx/5xx in stdout (excluding timeout)
//   - timeout      = Hermes RC=124 (timeout(1) signal)
//   - budget_aborted = Pre-flight refused; Hermes never invoked
//   - no_work      = Hermes RC=0, MCP calls succeeded, but list_* tools returned 0 candidates
//   - runner_crash = Sidecar finds row with finishedAt=null AND createdAt > 10min ago
export const RUN_OUTCOMES = [
  'success',
  'no_work',
  'partial',
  'tool_error',
  'api_error',
  'timeout',
  'budget_aborted',
  'runner_crash',  // NEW — for orphan rows (Reviewer B I7)
] as const;
export const RunOutcome = z.enum(RUN_OUTCOMES);
export type RunOutcomeT = z.infer<typeof RunOutcome>;

// Used by POST /internal/agent-runs (synchronous runner write).
// Note: runner reports only the SUBSET of outcomes it can detect from
// Hermes-visible signals (Reviewer A I7). Sidecar may downgrade later.
export const RecordRunInput = z.object({
  skillName: z.string().min(1).max(128),
  organizationId: z.string().nullable().optional(),  // NEW — tenant attribution
  pid: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime(),    // ISO-8601 on the wire
  finishedAt: z.string().datetime(),
  exitCode: z.number().int(),
  outcome: z.enum([
    'success',         // initial best-effort; sidecar may refine
    'api_error',
    'timeout',
    'budget_aborted',
  ]),
  errorExcerpt: z.string().max(1024).optional(),
  preflightBalanceUsd: z.number().optional(),
  preflightTodaySpendUsd: z.number().optional(),
});
export type RecordRunInputT = z.infer<typeof RecordRunInput>;

// Used by PATCH /internal/agent-runs/:id (sidecar enrichment).
// rateInUsdPerMt / rateOutUsdPerMt are CAPTURED at enrichment time and
// frozen with the row (ADL-7). The sidecar reads MODEL_RATES at PATCH
// time and writes both the cost AND the rates into the row.
export const EnrichRunInput = z.object({
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  model: z.string().max(128).optional(),
  rateInUsdPerMt: z.number().nonnegative().optional(),
  rateOutUsdPerMt: z.number().nonnegative().optional(),
  outcomeRefinement: RunOutcome.optional(),  // partial | tool_error | no_work | runner_crash
});
export type EnrichRunInputT = z.infer<typeof EnrichRunInput>;

export interface ModelRate {
  inUsdPerMt: number;
  outUsdPerMt: number;
}
```

### 3.2 REST contracts

All endpoints require `x-internal-api-key` (existing Vizora convention) AND `x-internal-caller` (NEW per Reviewer A D9 — caller identification for audit attribution and selective rotation).

```
POST /api/v1/internal/agent-runs
  Auth:    InternalSecretGuard (x-internal-api-key)
  Headers: x-internal-caller: "runner" | "sidecar" | "ops"   (REQUIRED)
  Body:    RecordRunInput (Zod-validated)
  Returns: 201 { id: string }
  Errors:  400 if body schema invalid;
           401 if secret bad/missing OR x-internal-caller missing/unknown

PATCH /api/v1/internal/agent-runs/:id
  Auth:    InternalSecretGuard
  Headers: x-internal-caller: "sidecar" (typically; runner can also PATCH)
  Body:    EnrichRunInput (Zod-validated)
  Returns: 200 { id, enriched: true }
  Errors:  400 if body schema invalid;
           401 if secret bad/missing;
           404 if id not found;                           ← was 400 (Reviewer A+B critical)
           409 if row already frozen (server-time         ← was 400 (Reviewer A+B critical)
                finishedAt + 5min < server now()).
                Use server time only — NOT client time
                (Reviewer B I8 clock-skew fix).

GET /api/v1/internal/agent-runs/today-spend
  Auth:    InternalSecretGuard
  Headers: x-internal-caller (any)
  Returns: 200 { usd: number, cachedAt: string }
  Cache:   Redis SETEX agentruns:today-spend 30 ...        ← NEW (Reviewer A+B critical)
           Stampede mitigation: 2 firings within 1s both
           see same value. Cache key has no per-day rotation
           (the SQL `WHERE startedAt >= startOfUtcDay` does
           that naturally).
  Errors:  401
```

**Outcome enum on the wire vs. internal:** the runner submits a 4-value outcome subset (`success | api_error | timeout | budget_aborted`); the full 8-value enum is internal/database only. Sidecar refines via PATCH `outcomeRefinement`. This boundary mirrors ADL-3.

### 3.3 MCP tool contract change (P1.1)

**Reviewer A D2 changed the precedence rule** to close a cross-tenant write surface.

```
log_shadow_row
  Before P1.1:
    Token shape:    organizationId MUST be null (platform-scope)
    On per-org token: throw BadRequestException → INVALID_INPUT on wire

  After P1.1 (REVISED for Reviewer A D2):
    Token shape:    any token with shadow:write scope
    Behavior:
      1. If token.organizationId IS NULL (platform-scope):
         - Agent MAY supply any organization_id in fields (or none)
         - Server writes the row as-is
      2. If token.organizationId IS NOT NULL (per-org):
         - Server FORCES organization_id = token.organizationId in the row
         - If agent supplies a DIFFERENT organization_id:
             throw BadRequestException → INVALID_INPUT on wire
             ("organization_id mismatch with token scope")
         - If agent supplies NO organization_id: server injects token's value

  Why: the original "agent-supplied takes precedence" rule allowed a
  per-org token for org A to stamp organization_id=B in the JSONL.
  Audit trail (mcp_audit_log) preserved attribution but downstream
  readers were misled. The token's org becomes the cryptographic source
  of truth for per-org tokens.

  Scope (unchanged): shadow:write
```

**Backward-incompatibility callout (Reviewer A I1):** the wire-error
space changes — `INVALID_INPUT` for the platform-scope-only check
disappears, but a NEW `INVALID_INPUT` appears for the agent-supplied
mismatch case. CHANGELOG entry required:

```
fix(mcp): log_shadow_row no longer requires platform-scope token

BREAKING (wire-error semantics):
  - Removed: INVALID_INPUT "log_shadow_row requires a platform-scope token"
  - Added:   INVALID_INPUT "organization_id mismatch with token scope"

Verified: no current Hermes-skill caller depends on the removed rejection.
```

### 3.4 Hermes runner contract (P0.4 + P1.2)

```
run-hermes-skill.sh <skill-name> <prompt> [toolsets-csv]

  Pre-flight (returns early if either fails):
    1. Query OpenRouter /v1/credits, compute balance = total_credits - total_usage
    2. Abort if balance < MIN_BALANCE_USD ($0.50 default)
    3. Query middleware /internal/agent-runs/today-spend
    4. Abort if today_spend ≥ DAILY_BUDGET_USD ($1.00 default)

  Invocation:
    timeout 300 hermes --skills <skill-name> -z <prompt> [-t <toolsets-csv>]

  Post-flight:
    5. Classify outcome from RC + log content (runner-side rules — see ADL-3)
    6. POST /internal/agent-runs with metadata; capture returned id
    7. Append id to runner log for sidecar correlation
    8. Always exit 0 (PM2 cron_restart treats nonzero as crash)

  Environment vars:
    OPENROUTER_API_KEY        from /root/.hermes/.env
    INTERNAL_API_SECRET       from /opt/vizora/app/.env
    MIDDLEWARE_URL            default http://localhost:3000
    MIN_BALANCE_USD           default 0.50
    DAILY_BUDGET_USD          default 1.00
```

---

## 4. Sequence flows

### 4.1 Happy-path firing

```
PM2 cron tick → run-hermes-skill.sh (vizora-customer-lifecycle)

  ├─[1] curl OpenRouter /credits  ──→  balance: $1.85 (above 0.50)
  ├─[2] curl middleware /today-spend ──→ $0.04 (under 1.00)
  ├─[3] hermes -z --skills vizora-customer-lifecycle \
  │       -t mcp_vizora_list_onboarding_candidates,...
  │       └─[a] LLM call: list_onboarding_candidates  ──→ 12 orgs
  │       └─[b] LLM emits log_shadow_row × 12 (heuristic decision per org)
  │       └─[c] LLM exits silently
  ├─[4] RC=0; classify outcome = success
  ├─[5] POST /internal/agent-runs
  │       body: {skillName, startedAt, finishedAt, exitCode:0, outcome:success,
  │              preflightBalanceUsd:1.85, preflightTodaySpendUsd:0.04}
  │       returns: {id: "ckxx..."}
  ├─[6] Append "agent_run_id=ckxx..." to runner log
  └─[7] exit 0

T+5min: insights-poller PM2 cron tick

  ├─[1] hermes insights --days 1 --source cli
  │       (returns boxed table with token usage per session)
  ├─[2] Find rows in agent_runs where tokensIn IS NULL AND startedAt > now-1h
  ├─[3] Match each to insights row by time-range + skillName
  ├─[4] For each match: PATCH /internal/agent-runs/:id
  │       body: {tokensIn: 4200, tokensOut: 380, model: gpt-4o-mini-2024-07-18}
  ├─[5] Cross-ref mcp_audit_log for [startedAt, finishedAt]:
  │       no FORBIDDEN/INVALID_INPUT → outcome stays 'success'
  └─ done
```

### 4.2 Failure paths

**Pre-flight balance fail:**

```
Runner ──→ /credits (balance: $0.20)
       ──→ abort; POST agent_runs with outcome=budget_aborted
       ──→ exit 0 (Hermes never invoked, OpenRouter never queried beyond /credits)
```

**Hermes exits with API error:**

```
Runner ──→ pre-flight passes
       ──→ hermes -z (HTTP 402 in stdout, RC=0 due to script's exit-0 behavior)
       ──→ classifier: stdout contains "HTTP 402" → outcome=api_error
       ──→ POST agent_runs with outcome=api_error, errorExcerpt=<tail of log>
       ──→ exit 0
       ──→ [If 5 consecutive api_error rows → P4 circuit breaker trips]
```

**Hermes succeeds but model called wrong tool (post-P1.2 this should not happen):**

```
Runner ──→ Hermes succeeds RC=0
       ──→ POST outcome=success
T+5min ──→ Sidecar reads mcp_audit_log
       ──→ Finds 1 FORBIDDEN row for this agentName + time window
       ──→ PATCH outcome=tool_error
       ──→ Grafana alerts on outcome=tool_error rate
```

### 4.3 Concurrency: race between sidecar and runner

The sidecar polls every 5 min. A firing that started at T and finishes at T+25s is enriched at the next poll (T+30s to T+5min depending on poll alignment). Race scenarios analyzed:

1. **Sidecar runs while a firing is in-flight.** Runner hasn't POSTed yet, so sidecar finds nothing to enrich. Next tick picks it up. ✅ Safe.
2. **Runner POSTs after sidecar reads `agent_runs` snapshot.** Sidecar enriches older rows; runner's new row sits unenriched until next sidecar tick. ✅ Safe.
3. **Two sidecar instances run concurrently** (e.g., during deploy). Reviewer B critical D7 — original "naturally idempotent" claim was wrong under MVCC. Both transactions can see `tokensIn IS NULL`, both UPDATE, last-write-wins. If both compute the same cost it's harmless; if a parser bug produces different values, the buggy run can overwrite a corrected one.

   **Fix:** PATCH endpoint uses `UPDATE ... WHERE tokensIn IS NULL RETURNING id`. Zero-row return means another sidecar already enriched. Sidecar treats this as a no-op (`INFO log: "row already enriched by another sidecar instance"`). For correction-of-bug-corrected-data: provide a separate `POST /internal/agent-runs/:id/reenrich` endpoint that explicitly bypasses the NULL check (super-admin only, audit-logged).

   ```sql
   UPDATE agent_runs
      SET tokensIn = $1,
          tokensOut = $2,
          model = $3,
          rateInUsdPerMt = $4,
          rateOutUsdPerMt = $5,
          costMicrodollars = $6,
          outcome = COALESCE($7, outcome)
    WHERE id = $8
      AND tokensIn IS NULL                         -- idempotency guard
      AND finishedAt + INTERVAL '5 minutes' >= NOW()  -- server-time freeze
   RETURNING id;
   ```

4. **Two PM2 cron tickers fire the SAME skill within 60s** (clock skew during PM2 restart). Both runners pre-flight, both call /credits, both see balance OK, both invoke Hermes — double charge. Mitigation: pre-flight first acquires Redis lock `SETNX agentruns:lock:<skill> <pid> EX 60`; only the lock-holder proceeds. Failure to acquire = exit 0 immediately, no `agent_runs` row written, INFO log line. The "no row" is intentional: skipped firings are a non-event, not an outcome to track. If skipped-firing rate becomes a concern (e.g., from a Grafana log-based panel), elevate to a tracked outcome later.

5. **Today-spend stampede** (Reviewer A+B D12): N runners hit `GET /today-spend` simultaneously. Redis cache absorbs this — see §3.2.

**Orphan-row policy (Reviewer B I7):** if runner POSTs `RecordRunInput` and crashes before the row is finalized, `finishedAt` may be present (POST is post-runner-exit) BUT could be missing if the POST itself partially completed. The sidecar runs an additional pass:

```sql
-- Mark orphans
UPDATE agent_runs
   SET outcome = 'runner_crash',
       finishedAt = COALESCE(finishedAt, NOW()),
       errorExcerpt = 'orphan row — runner crashed before final write'
 WHERE outcome NOT IN ('runner_crash', 'budget_aborted')
   AND tokensIn IS NULL
   AND createdAt < NOW() - INTERVAL '10 minutes';
```

This runs at the end of every sidecar tick. After 10 min an unenriched row is presumed crashed.

**Frozen-row guarantee:** PATCH refuses if `server_now() > finishedAt + 5min`. Server time only (Reviewer B I8) — runner clock is irrelevant.

---

## 5. Error taxonomy

### 5.1 Runner script errors

| Error | Treatment | Visibility |
|---|---|---|
| `/credits` API timeout | Treat balance as unknown → proceed (don't fail-closed; Hermes will fail at API layer if no balance) | Logged; no alert (transient) |
| `/today-spend` middleware unreachable | Treat as $0 spent → proceed | Logged; alert if persistent |
| Hermes RC != 0 (non-timeout) | outcome=api_error; exit 0 | Per-firing visible in agent_runs; alerted in aggregate |
| Hermes timeout (RC=124) | outcome=timeout | Same |
| POST to `/internal/agent-runs` fails | Log warning; runner exits 0 anyway. Lost row is acceptable (alerting is on rate, not count). | Logged WARN |
| INTERNAL_API_SECRET not set | Refuse to POST; log ERROR | ERROR-level log; alerts via Grafana log-based rule |

### 5.2 MCP tool errors (P1.1 changes)

```
log_shadow_row error space:
  ForbiddenException     ──→ FORBIDDEN     (token lacks shadow:write)
  BadRequestException    ──→ INVALID_INPUT (Zod parse failure OR org_id/token mismatch)
  Internal exception     ──→ INTERNAL      (filesystem write failure)

Wire-error transitions (P1.1 — see CHANGELOG entry §3.3):
  Removed: INVALID_INPUT "log_shadow_row requires platform-scope token"
  Added:   INVALID_INPUT "organization_id mismatch with token scope"
```

### 5.3 Sidecar errors

| Error | Treatment |
|---|---|
| `hermes insights` returns "No sessions found" (verified live 2026-05-08) | Expected when no firings have happened; INFO log; no rows enriched (correctly). |
| `hermes insights` returns parseable boxed-table output | Normal path; parser extracts rows. |
| `hermes insights` returns unparseable output (format drift across Hermes versions) | Log ERROR with full output + Hermes version; trigger "Sidecar parser failure" alert (§8.3). Rows stay unenriched and can be backfilled manually after parser fix. |
| Middleware PATCH 404 (id not found) | Sidecar bug — log ERROR; should never happen in normal operation. |
| Middleware PATCH 409 (row frozen) | Expected for late polls (>5min after finishedAt); log INFO and continue. |
| Middleware PATCH 500 | Log ERROR; retry on next tick (PATCH is idempotent via `WHERE tokensIn IS NULL` guard). |
| `agentRunId` join finds zero audit rows for a `success` row | Acceptable — skill may have made no MCP calls (e.g., heuristic-only firing). Outcome stays `success`. |
| `agentRunId` is NULL on audit rows for a firing | Fall back to time-range + agentName join (§2.3 fallback path). Refinement quality drops; flag with `outcome_confidence='low'` (deferred to P3 if it becomes a problem). |

---

## 6. Security boundaries

### 6.1 Trust zones

```
┌──────────────────────────────────────────────────────────────┐
│ Internet (zero trust)                                         │
│   └─ no inbound traffic to /internal/* (firewall rule)       │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Vizora prod VPS — local trust zone                            │
│                                                                │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ run-hermes-skill.sh (root)                            │    │
│   │   - reads /root/.hermes/.env (OPENROUTER_API_KEY)   │    │
│   │   - reads /opt/vizora/app/.env (INTERNAL_API_SECRET) │    │
│   │   - POSTs to localhost:3000/internal/agent-runs      │    │
│   └─────────────────────────────────────────────────────┘    │
│              │                                                 │
│              │ x-internal-api-key                              │
│              ▼                                                 │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Vizora middleware (NestJS)                           │    │
│   │   - InternalSecretGuard validates header             │    │
│   │   - constant-time secret compare                     │    │
│   │   - writes agent_runs row                            │    │
│   └─────────────────────────────────────────────────────┘    │
│              │                                                 │
│              ▼                                                 │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Postgres (agent_runs, mcp_audit_log)                 │    │
│   └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Secrets

| Secret | Storage | Rotation cadence | Blast radius if compromised |
|---|---|---|---|
| `OPENROUTER_API_KEY` | `/root/.hermes/.env` (chmod 600) | Quarterly | Provider charges; revoke + reissue in OpenRouter UI |
| `INTERNAL_API_SECRET` | `/opt/vizora/app/.env` (chmod 600) | Quarterly | Internal endpoint flooded; rotate via env update + middleware reload |
| MCP bearer tokens | `mcp_tokens.tokenHash` (sha256) | Per token's `expiresAt` | Per-token scope only; revoke via `DELETE /admin/mcp-tokens/:id` |

### 6.3 PII / data handling

The plan's P1.1 introduces `organization_id` tagging in shadow log rows. This is consistent with existing CLAUDE.md guidance: "structural signals only, no PII." Org IDs are tenant identifiers, not PII. No new PII is introduced.

`agent_runs` records no per-tenant data — only skill name, timing, cost. No tenant identification.

---

## 7. Test architecture

### 7.1 Test pyramid

```
                    ┌────────────────┐
                    │  E2E (Playwright)│      0 tests added
                    │    none planned  │      (no UI changes in P0/P1)
                    └────────────────┘
                  ┌──────────────────────┐
                  │ Integration (Jest+SQL)│   ~6 tests
                  │  /internal/agent-runs  │
                  │  shadow-log.tools     │
                  └──────────────────────┘
              ┌─────────────────────────────┐
              │ Unit (Jest, mocked DB)        │   ~15 tests
              │  AgentRunsService             │
              │  InternalSecretGuard          │
              │  cost computation             │
              │  outcome classifier (sidecar) │
              │  insights table parser        │
              └─────────────────────────────┘
                                          │
              ┌─────────────────────────────┐
              │ Smoke (manual, prod)          │   3 checks
              │  P0.0a max_tokens clamp       │
              │  P1.2 hermes -t toolset filter│
              │  P1.3 end-to-end firing       │
              └─────────────────────────────┘
```

### 7.2 What gets tested where

**Unit (mocked database, in-memory):**
- `AgentRunsService.recordRun` — cost computation, null model handling, timeout outcome
- `AgentRunsService.getTodaySpendUsd` — sum aggregation, null sum
- `AgentRunsService.enrichRun` — frozen-row check, idempotency
- `InternalSecretGuard.canActivate` — happy path, missing header, mismatched header, env not set (constant-time correctness)
- `logShadowRowTool` — 9 tests (existing 6 + 3 new from P1.1 spec)
- Outcome classifier (sidecar service) — table-driven tests on (RC, log content, audit rows) → outcome
- `hermes insights` table parser — fixture-based tests on stable + version-shifted output

**Integration (real Postgres via `docker-compose.test.yml`):**
- `POST /internal/agent-runs` — full request → row written → 201
- `PATCH /internal/agent-runs/:id` — enrichment writes; frozen-row 400; concurrent-PATCH idempotency
- `GET /internal/agent-runs/today-spend` — UTC-day boundary correctness
- Migration applies cleanly on a fresh DB

**Smoke (manual, prod, after credit add):**
- P0.0a: fire one Hermes invocation; inspect OpenRouter request body for `max_tokens=4096`
- P1.2: fire with `-t mcp_vizora_log_shadow_row` only; verify model lists only that tool
- P1.3: end-to-end customer-lifecycle firing produces a `success` row in `agent_runs`

### 7.3 Coverage targets

- Unit: 90%+ on new service code (AgentRunsService, classifier, parser)
- Integration: every documented REST endpoint + every error response code
- Smoke: 100% pass on prod with paid key before declaring P0/P1 done

---

## 8. Operational design

### 8.1 Deploy ordering

**Phantom-lever decision (Reviewer A D11) committed before build:** the runner ALWAYS passes `--max-tokens 4096` as an explicit CLI flag, regardless of `model.max_tokens` in `~/.hermes/config.yaml`. Belt-and-braces. P0.0a verifies the clamp arrives at OpenRouter (via stdout debug or generation API). If `--max-tokens` isn't supported by the installed Hermes version, the runner fails closed (refuses to invoke) — do NOT silently fall through.

**Hermes version pin (Reviewer A+B D13):**
- Pinned: `HERMES_VERSION=0.12.0` in `/opt/vizora/app/.env` on prod
- Runner script first action: `hermes --version` and exit 0 with `outcome='version_skew'` log line if mismatched (no `agent_runs` row written; ops-watchdog detects skipped firings)
- Tracked in repo: `config-prod/.hermes-version` (one-line file with the pinned version)
- CI smoke test: `.github/workflows/hermes-version-check.yml` runs `hermes --version` against pinned value; fails build on drift

**Day 1:**
1. P0.0a smoke test (verify `--max-tokens 4096` clamps OpenRouter requests)
2. **No-op deploy verification:** P0.1 schema migration (additive only — safe under traffic). Migration creates `agent_runs` + adds `agentRunId` column to `mcp_audit_log` (nullable FK, backward-compat).
3. P0.2 + P0.3 service + controller + guard (deployed but no caller yet — intentional, verifies DI graph + routes resolve)
4. Deploy middleware (PM2 reload)
5. Verify endpoints respond via curl using the new `x-internal-caller` header

**Day 2:**
6. P0.4 + P0.5 runner script changes (pre-flight + sidecar-friendly POST)
7. P0.6 Grafana dashboard (auto-loaded on Grafana restart)
8. P0.7 OpenRouter UI cap (manual — Sri)
9. P1.1 MCP server change (`log_shadow_row` token semantics) → middleware redeploy
10. P1.2 Hermes `-t` flag + agentRunId env var in ecosystem.config.js → entries still deleted; flag is dormant until re-enable

**Day 3:**
11. Add credits to OpenRouter (Sri)
12. P1.3 re-enable customer-lifecycle (`pm2 start --only`)
13. Watch first 2 firings; verify zero FORBIDDEN in `mcp_audit_log`, `agentRunId` populated; if clean, re-enable support-triage
14. Watch 24h; if clean, declare P0+P1 done

**Documentation deliverable:** the deploy steps above are tracked in `docs/runbooks/agent-platform-redesign-deploy.md` (created during P0). Each step has explicit success criteria + rollback command.

### 8.2 Rollback runbook

| Failure | Rollback | RTO |
|---|---|---|
| Migration fails partway | `npx prisma migrate resolve --rolled-back <name>` ONLY edits `_prisma_migrations`; manually `DROP TABLE agent_runs CASCADE; ALTER TABLE mcp_audit_log DROP COLUMN agentRunId;` THEN revert code. **Not 1 command — multi-step procedure documented in `docs/runbooks/migrations.md`** (Reviewer B I6). | ~5 min |
| Middleware deploy breaks endpoints | Git revert + `pm2 reload vizora-middleware --update-env`. Previous git SHA captured in deploy log. | ~2 min |
| MCP server rejects valid traffic post-P1.1 | Revert `shadow-log.tools.ts`; redeploy. Tokens unchanged so no token-side rollback needed. The CHANGELOG-flagged backward-incompatibility (§3.3) means downstream callers don't depend on rejection — verified before P1.1 ships. | ~2 min |
| Runner script broken | `pm2 delete hermes-vizora-*` (already the default state from May 8 incident response). Existing TS PM2 cron `agent-customer-lifecycle` is safety net (no LLM, deterministic). | ~30 sec |
| Cost runaway despite L1+L2+L3 | OpenRouter L1 cap is hard backstop ($2/day). `pm2 delete hermes-vizora-*` halts firings within seconds. L4 circuit breaker (P4) trips automatically after 5 failures. | ~30 sec |
| `agentRunId` propagation fails (sidecar can't refine) | Sidecar falls back to time-range + agentName join (§2.3 fallback path). Outcome refinement quality drops but service stays online. | 0 sec (graceful degrade) |
| Hermes version drift detected | Runner refuses to invoke (§8.1 version-pin guard); ops-watchdog alerts on no firings. Operator runs `hermes update` to pinned version OR updates `HERMES_VERSION` env if upgrade is intentional. | ~5 min |

**RTO target:** under 5 minutes for any failure mode. Every step has a documented command. No rollback requires interpretive operator decisions.

### 8.3 Monitoring & alerting

**Grafana panels (P0.6):**
1. Cost per skill per hour (last 24h) — line chart
2. Outcome distribution (last 24h) — stacked bar
3. P50/P95 firing latency — line chart
4. Today's spend vs daily budget — single-stat with threshold

**Alerts (Grafana, routes to Slack via existing webhook):**

| Alert | Condition | Severity |
|---|---|---|
| Daily budget exceeded | `today_spend > 1.00` for 5 min | critical |
| Per-firing cost anomaly | any single row's `costMicrodollars > 50000` (= $0.05) | warning |
| **Cluster cost anomaly** (Reviewer B I3) | `sum(costMicrodollars) by skillName over 1h > 200000` (= $0.20) | warning |
| Error rate high | `(tool_error + api_error + timeout) / total > 5%` over 15 min | warning |
| No firings for skill | `now - max(startedAt) by skillName > 3 × cron_interval` | warning |
| **Output cap breach** (Reviewer B I5; reframed) | `tokensOut > 4096 OR cumulative_in_5min > 30K` per skill | critical |
| Hermes version drift | `version_skew` log lines from runner (no `agent_runs` row) | warning |
| Sidecar parser failure | `hermes insights` parser throws OR returns empty when rows expected | critical |
| Frozen-row PATCH attempted | 409 Conflict response rate > 0 over 1h (indicates sidecar latency or runner clock issue) | info |

---

## 9. Open questions — resolved during review

Items resolved by the two-reviewer pass:

1. **PATCH idempotency on retry with bug-corrected data?** — Resolved §4.3: added explicit `RETURNING id` + zero-row handling; separate super-admin `POST /:id/reenrich` endpoint for forced overwrites.
2. **5-minute frozen-row window?** — Kept at 5 min; matches sidecar cadence. PATCH 409 alert at info-level catches latency drift (§8.3).
3. **`outcome='no_work'` detected by runner?** — Resolved: sidecar-only (ADL-3 revised). Runner's classification surface is intentionally minimal.
4. **FK from `agent_runs` to `mcp_audit_log`?** — Resolved §2.3: added `agentRunId` FK from `mcp_audit_log` to `agent_runs` (reverse of original direction — single audit row → multiple firings is wrong; multiple audit rows per firing is right). Propagation via runner-emitted env var → Hermes header → MCP request context.
5. **Phantom-lever fallback (P0.0a Step 4b)** — Resolved §8.1: runner ALWAYS passes `--max-tokens 4096` as explicit CLI flag. Belt-and-braces. Fail closed if Hermes lacks the flag.
6. **`-t` flag failure mode on mistyped tool name?** — Resolved: P1.2 acceptance test runs against paid key (smoke). Additionally: unit test asserts each `hermes-vizora-*` ecosystem entry has a non-empty `args[3]` toolset string matching a known allowlist. Hermes' argparse rejects unknown tool names with non-zero exit, which the runner's outcome classifier picks up as `api_error`.
7. **Hermes native `subagent` instead of sidecar?** — Resolved: sidecar reads `mcp_audit_log` (Postgres), which is outside Hermes' world. A subagent would double round-trips. Sidecar pattern wins.

## 9.x Open questions — escalated to next phase

Items the design intentionally defers (will be re-asked at build):

A. **CHANGELOG location** — Vizora's repo has no top-level `CHANGELOG.md`. The CHANGELOG entry from §3.3 needs a home. Options: create top-level `CHANGELOG.md`, OR attach to PR description, OR create `docs/changelog/`. Decision deferred to PR creation.

B. **Runner Redis lock TTL (§4.3 race 4)** — 60s seems right for skills with 30-min cron, less obvious for the 5-min support-triage cron (15 min after revisions). May need per-skill TTL. Defer until P1.3 firing data shows the actual distribution.

C. **`x-internal-caller` enum** — design lists `runner | sidecar | ops`. As we add tools (e.g., `dashboard` for direct admin queries), the list grows. Defer to a registered-callers table when it exceeds 5 values; for now, hard-coded enum is fine.

---

## 10. Definition of design-done

This design document is "approved" when:

1. ✅ All 7 ADL decisions are reviewed and either accepted or replaced with documented alternatives (ADL-7 added post-review)
2. ✅ The data-model section reflects Prisma schema additions exactly (4 new columns on `agent_runs`, 1 new column + index on `mcp_audit_log`)
3. ✅ All REST contracts have a unit-test stub written before implementation begins (covered in §7.2)
4. ✅ All error-taxonomy rows have a corresponding test case planned
5. ✅ The sequence flows have been walked through against each open question in §9 (resolved or escalated)
6. ✅ Two parallel reviewers (different attack vectors) have signed off
7. ✅ Hermes-first analysis from the companion plan §1.5 still holds — no new custom code competes with a Hermes-native capability we discovered post-review
8. ✅ Drift-check from the companion plan §1.6 still holds — no new primitive proposed in this design exists in the tree

**Build-readiness gate:** at the start of P0 implementation, the developer (subagent or human) re-reads this design top-to-bottom and confirms every ADL decision still maps to current prod state. Discoveries during implementation are added back to the design before the corresponding code lands.

---

**Companion plan:** `docs/plans/2026-05-08-agent-platform-redesign.md`
