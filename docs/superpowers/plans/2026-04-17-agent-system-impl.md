# Agent System — Implementation Plan

**Date:** 2026-04-17
**Branch:** `feat/agent-system`
**Spec:** `docs/superpowers/specs/2026-04-17-agent-system-design.md`
**Tracker:** `tasks/agent-system-overnight.md`

## Build order (strict)

Each step is self-contained and leaves the repo in a compilable state. If
a step fails typecheck or tests, STOP and fix before proceeding.

### 1. Prisma schema + migration

**Files:**
- `packages/database/prisma/schema.prisma` (edit)

**Add three models:**
- `OrganizationOnboarding` — unique org FK, 5 milestone timestamps, 3 nudge timestamps, `completedAt`.
- `CustomerIncident` — per-org, agent-owned table with `status='open'|'resolved'|'escalated'`. Indexes: `(orgId,status)`, `(agent,type)`.
- `ContentRecommendation` — per-org, `kind`, `details JSON`, `confidence`, `dismissedAt`.

**Modify:**
- `SupportMessage` — add `authorType String @default("user")` (values: `'user' | 'admin' | 'agent'`).

**Back-relations:** Add three `OrganizationOnboarding?` / `CustomerIncident[]` / `ContentRecommendation[]` lines to `Organization`.

**Migration:**
```bash
cd packages/database
export $(grep DATABASE_URL ../../.env | xargs)
npx prisma migrate dev --name add_agent_system_tables
npx prisma generate
```

Migration must be purely additive. Rerun `pnpm --filter @vizora/middleware build` to confirm types compile.

### 2. Shared lib — `scripts/agents/lib/`

**Files to create:**
- `types.ts` — re-exports `Incident`, `Severity`, etc. from `scripts/ops/lib/types.ts` + adds:
  - `TicketCategory`, `TicketPriority`, `OrgTier` unions
  - `TicketSignal`, `RankedTicket`, `OnboardingSignal`, `NudgeSuggestion`, `ContentPerfSignal`, `ContentRec`
  - `AgentFamilyState` — extends `OpsState` with `emailsSentThisRun`, `pendingManualRun`.
- `ai.ts` — `AgentAI` interface + `HeuristicAgentAI` class + `AnthropicAgentAI.stub.ts` + `OpenAIAgentAI.stub.ts`. Stubs throw on construction with "not implemented — set `AGENT_AI_PROVIDER=heuristic`".
- `state.ts` — parameterized `readAgentState(family)` / `writeAgentState(family, state)`. Per-family lock file at `logs/agent-state/{family}.json.lock`. Reuses lock impl from `scripts/ops/lib/state.ts`.
- `alerting.ts` — re-exports `log`, `sendSlackAlert`, `updateDashboard` from ops lib. Adds `sendCustomerEmail(...)` with:
  - SHA-256 email-hash helper `maskEmail()`
  - `resolveRecipients()` (TEST_EMAILS > LIVE > [])
  - persisted counter increment via `writeAgentState`
- `api-client.ts` — re-export ops `OpsApiClient`.

### 3. Middleware agents module

**Directory:** `middleware/src/modules/agents/`

**Files:**
- `agents.module.ts` — registers `AgentsController`, `OnboardingService`, `CustomerIncidentService`, `AgentStateService`, `AGENT_AI_TOKEN` provider. Imports `DatabaseModule`, `ConfigModule`. DOES NOT import `EventEmitterModule` (global).
- `agents.controller.ts` — class-level `@UseGuards(JwtAuthGuard, AdminGuard)` + `@SkipOutputSanitize()`. Endpoints:
  - `GET /api/v1/agents/status` (paginated via `AgentStatusQueryDto`)
  - `GET /api/v1/agents/:name/state` (reads + sanitizes)
  - `POST /api/v1/agents/:name/run` (202, allowlisted names, enqueue flag)
  - `POST /api/v1/agents/incidents` (create `CustomerIncident`)
- `dto/agent-status-query.dto.ts` — extends existing `PaginationDto`.
- `onboarding.service.ts` — 5 `@OnEvent` listeners, private `markMilestone(orgId, field)` with upsert + coalesce update.
- `customer-incident.service.ts` — `create()`, `resolve()`, `listOpenForOrg()`. All queries scoped by `organizationId`.
- `agent-state.service.ts` — disk reader with recursive `sanitize()` using expanded forbidden-key regex. `enqueueManualRun(name)` writes `pendingManualRun: true` flag.
- `ai/agent-ai.interface.ts` — re-exports from `scripts/agents/lib/ai.ts` via path alias or duplicates the interface.
- `ai/heuristic-agent-ai.ts`, `ai/anthropic-agent-ai.stub.ts`, `ai/openai-agent-ai.stub.ts`.

**App module registration:** Add `AgentsModule` to `middleware/src/app.module.ts` imports.

### 4. Event emissions at publisher sites

Add one `this.events.emit(...)` line after the successful op in each:
- `middleware/src/modules/auth/auth.service.ts` — after `sendWelcomeEmail` → `user.welcomed`.
- `middleware/src/modules/pairing/pairing.service.ts` — `completePairing()` → `display.paired`.
- `middleware/src/modules/content/content.service.ts` — after create → `content.created`.
- `middleware/src/modules/playlists/playlists.service.ts` — after create → `playlist.created`.
- `middleware/src/modules/schedules/schedules.service.ts` — after create → `schedule.created`.

All payloads: `{ orgId: user.organizationId, <entity>Id: <entity>.id }`. Never accept orgId from request body.

Inject `EventEmitter2` in any service that doesn't already have it.

### 5. Customer Lifecycle agent

**File:** `scripts/agents/customer-lifecycle.ts`

**Flow:**
1. Read `logs/agent-state/customer.json`, reset `emailsSentThisRun = 0`.
2. Query candidate orgs with `ORDER BY createdAt ASC LIMIT 200`.
3. Loop orgs → `buildOnboardingSignal(org)` → `ai.suggestNudge(signal)`.
4. If `template !== 'none'` → transaction: check dedup, check circuit breaker, stamp nudge column, call `sendCustomerEmail(...)`.
5. Auto-complete orgs > 7 days old with no nudges pending: set `completedAt=now()`.
6. Write final state, log JSON summary, `process.exitCode = 0`.

### 6. Support Triage agent

**File:** `scripts/agents/support-triage.ts`

**Flow:**
1. Per-org loop: `findMany({ where: { organizationId, status: 'open', messages: { none: { authorType: 'agent' } } }, take: 20 })`.
2. Build `TicketSignal[]` (no raw message bodies).
3. `ai.rerank(signals)` → `RankedTicket[]`.
4. For each ticket: write `SupportMessage` with `authorType='agent'` + suggested reply. Bump priority if rerank score differs from heuristic by >0.4.
5. Log counts, exit.

### 7. Four scaffolded agents

One file each, all env-gated:
- `scripts/agents/screen-health-customer.ts` — `SCREEN_HEALTH_CUSTOMER_ENABLED`
- `scripts/agents/billing-revenue.ts` — `BILLING_REVENUE_ENABLED` (must call read-only billing APIs; no writes)
- `scripts/agents/content-intelligence.ts` — `CONTENT_INTELLIGENCE_ENABLED`
- `scripts/agents/agent-orchestrator.ts` — `AGENT_ORCHESTRATOR_ENABLED`

Each: early-exit if `*_ENABLED !== 'true'`, log marker, `exitCode=0`.

### 8. Unit tests

**Middleware (Jest):**
- `middleware/src/modules/agents/onboarding.service.spec.ts`
- `middleware/src/modules/agents/agent-state.service.spec.ts`
- `middleware/src/modules/agents/customer-incident.service.spec.ts`
- `middleware/src/modules/agents/agents.controller.spec.ts`

**Scripts (Vitest — add `scripts/agents/vitest.config.ts`):**
- `scripts/agents/__tests__/customer-lifecycle.nudge-selector.spec.ts`
- `scripts/agents/__tests__/customer-lifecycle.circuit-breaker.spec.ts`
- `scripts/agents/__tests__/customer-lifecycle.test-allowlist.spec.ts`
- `scripts/agents/__tests__/customer-lifecycle.dedup.spec.ts`
- `scripts/agents/__tests__/support-triage.reply-loop.spec.ts`
- `scripts/agents/__tests__/support-triage.org-scope.spec.ts`
- `scripts/agents/__tests__/support-triage.rerank.spec.ts`
- `scripts/agents/__tests__/agent-state.path-isolation.spec.ts`

### 9. PM2 `ecosystem.config.js`

Add 6 entries, all with `autorestart: false`, `interpreter_args: '--loader ts-node/esm'`, `cron_restart` per spec, env vars per spec (scaffolds default `*_ENABLED=false`, `LIFECYCLE_LIVE=false`).

### 10. Final checks

```bash
pnpm --filter @vizora/middleware test
pnpm --filter @vizora/middleware build
cd scripts/agents && npx vitest run
```

All green → commit, push, open draft PR, launch 3 review agents in parallel.

## Verification acceptance (per spec)

- [ ] Typecheck green on all three services
- [ ] 16+ new unit tests pass
- [ ] Prisma migration applies cleanly
- [ ] `logs/agent-state/customer.json` appears after first lifecycle cycle
- [ ] `GET /api/v1/agents/status` returns sanitized aggregate JSON
- [ ] Dry-run audit line appears on every send decision (hashed recipient)
- [ ] 3 code-review agents sign off

## STOP points

- **After step 1:** verify migration applied cleanly before touching code.
- **After step 3:** verify middleware compiles before adding event emissions.
- **After step 5:** smoke-test customer-lifecycle dry-run locally.
- **Before step 10 push:** typecheck + unit tests MUST be green.
- **After PR open:** human approval required before any deploy.
