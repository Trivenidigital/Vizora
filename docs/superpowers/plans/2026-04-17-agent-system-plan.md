# Vizora Agent System — High-Level Plan

**Date:** 2026-04-17
**Branch:** `feat/agent-system`
**Scope:** 6-agent customer-facing automation system, extending the existing `scripts/ops/` pattern.

## Problem

Vizora needs proactive automation that watches over customers' fleets and businesses, not just internal ops. The current 6 autonomous-ops agents (`health-guardian`, `content-lifecycle`, `fleet-manager`, `schedule-doctor`, `ops-reporter`, `db-maintainer`) monitor infrastructure for the operator team. What's missing is automation that:

1. Nurtures new signups through onboarding (Customer Lifecycle)
2. Watches each customer's screens and auto-remediates (Content & Screen Health — customer-facing extension of fleet-manager)
3. Triages inbound support intelligently (Support Triage)
4. Normalizes dual Stripe/Razorpay billing into a single revenue view (Billing & Revenue — extends existing `BillingLifecycleService`)
5. Analyzes content performance and suggests optimizations (Content Intelligence)
6. Coordinates across all agents for cross-cutting concerns (Ops Orchestrator)

## Goals

- **Reuse the existing ops agent pattern** — detect → remediate → verify → log → exit, driven by PM2 cron, state persisted to JSON with atomic locks
- **LLM-ready abstraction** — `AgentAI` interface with a `HeuristicAgentAI` default; real LLM swap is a single adapter change
- **Zero cost of idle agents** — 4 of 6 agents scaffolded but env-disabled
- **Safe defaults** — nudge emails gated behind `LIFECYCLE_LIVE=true`; default is dry-run log

## Non-Goals (overnight scope)

- ClickHouse wiring (keep Postgres + `ContentImpression`)
- Customer-facing Next.js dashboard pages (JSON endpoints only)
- Razorpay test coverage beyond Stripe-mirror logic
- Production deploy
- E2E Playwright tests
- Slack outbound to customers (internal ops Slack only, existing)

## Architecture

### Layer 1 — Shared library (new)

`scripts/agents/lib/` — new sibling to `scripts/ops/lib/`, shares types but isolates state files:

| File | Purpose | New vs reused |
|---|---|---|
| `types.ts` | Re-export ops types + new: `LifecycleStage`, `OnboardingMilestone`, `CustomerIncident`, `RevenueAnomaly`, `ContentRecommendation` | New file, re-exports ops types |
| `state.ts` | Per-family state files: `logs/agent-state/{customer,content,fleet,billing,ops}.json` | New, parameterized copy of ops `state.ts` |
| `api-client.ts` | Re-export ops `api-client.ts` as-is | Reuse |
| `alerting.ts` | Re-export ops `alerting.ts` + add `sendCustomerEmail(orgId, template, dryRun)` | Extend ops |
| `ai.ts` | `AgentAI` interface, `HeuristicAgentAI` impl, `AnthropicAgentAI` stub, `OpenAIAgentAI` stub, `createAgentAI()` factory reading `AGENT_AI_PROVIDER` env | New |

### Layer 2 — Six agent scripts

All live under `scripts/agents/`, each a standalone TS file following the ops pattern:

1. **`customer-lifecycle.ts`** — `*/30 * * * *` — watches `OrganizationOnboarding` milestones, sends nudge emails at Day 1/3/7 if milestones incomplete. Dry-run by default. **IMPLEMENTED END-TO-END.**

2. **`screen-health-customer.ts`** — `*/10 * * * *` — per-org scan of `Display` status. When an org has 3+ offline for >1h, creates customer-visible incident in new `CustomerIncident` table and sends email to org admins. **SCAFFOLDED.**

3. **`support-triage.ts`** — `*/5 * * * *` — processes new `SupportRequest` rows with `category='help_question'` and `priority='medium'` (heuristic fallback from classifier), uses `AgentAI.classify()` to re-rank, auto-responds for known issues (password reset, screen offline) via `SupportMessage`. **IMPLEMENTED END-TO-END** (heuristic AI mode).

4. **`billing-revenue.ts`** — `0 */2 * * *` — builds MRR snapshot, flags failed payment > 3 attempts, detects revenue anomalies (>20% drop week-over-week). Extends the existing `BillingLifecycleService` which runs as in-process cron. **SCAFFOLDED.**

5. **`content-intelligence.ts`** — `0 4 * * *` (daily 4am) — queries `ContentImpression`, computes best-performing content per hour bucket, writes recommendations to new `ContentRecommendation` table. **SCAFFOLDED.**

6. **`agent-orchestrator.ts`** — `*/15 * * * *` — reads all 5 family state files + ops state, correlates (e.g. offline display + open support ticket mentioning that display), creates cross-cutting incidents. **SCAFFOLDED.**

### Layer 3 — Middleware additions

New NestJS module: `middleware/src/modules/agents/`:

- `agents.module.ts` — registers everything below
- `agents.controller.ts` — admin-only endpoints:
  - `GET /api/v1/agents/status` — aggregate all agent state files
  - `GET /api/v1/agents/:name/state` — one agent's state
  - `POST /api/v1/agents/:name/run` — trigger ad-hoc run (admin only)
- `onboarding.service.ts` — tracks `OrganizationOnboarding` milestones; emits hooks from display pairing, content upload, playlist create, schedule create
- `customer-incident.service.ts` — creates + resolves `CustomerIncident` rows, triggers email
- `agent-ai.service.ts` — DI wrapper around the `AgentAI` interface for use in NestJS context

### Layer 4 — Prisma schema additions

```prisma
model OrganizationOnboarding {
  id                        String   @id @default(cuid())
  organizationId            String   @unique
  organization              Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  welcomeEmailSentAt        DateTime?
  firstScreenPairedAt       DateTime?
  firstContentUploadedAt    DateTime?
  firstPlaylistCreatedAt    DateTime?
  firstScheduleCreatedAt    DateTime?

  day1NudgeSentAt           DateTime?
  day3NudgeSentAt           DateTime?
  day7NudgeSentAt           DateTime?

  completedAt               DateTime?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  @@index([organizationId])
}

model CustomerIncident {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  agent           String   // 'screen-health-customer' | 'billing-revenue' | ...
  type            String   // 'cluster-offline' | 'failed-payment-retry-exhausted' | ...
  severity        String   // 'critical' | 'warning' | 'info'
  target          String
  targetId        String
  message         String   @db.Text
  remediation     String   @db.Text

  status          String   @default("open")  // 'open' | 'resolved' | 'escalated'
  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?
  notifiedAt      DateTime?

  @@index([organizationId, status])
  @@index([agent, type])
}

model ContentRecommendation {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  kind            String   // 'time-of-day' | 'underperforming' | 'rotation-frequency'
  contentId       String?
  playlistId      String?

  summary         String   @db.Text
  details         Json
  confidence      Float    // 0.0-1.0

  createdAt       DateTime @default(now())
  dismissedAt     DateTime?

  @@index([organizationId, createdAt])
}
```

No backfill: existing orgs get `OrganizationOnboarding` rows lazily when touched (upsert on first lifecycle run per org); existing orgs older than 7 days are auto-flagged `completedAt = now()` to skip nudges.

### Layer 5 — Integration hooks

Emit onboarding events from existing code (minimal edits):

| Event source | File | New emission |
|---|---|---|
| Display paired | `middleware/src/modules/displays/displays.service.ts` (pairing confirm handler) | `onboarding.markMilestone(orgId, 'firstScreenPairedAt')` |
| Content uploaded | `middleware/src/modules/content/content.service.ts` (create handler) | `onboarding.markMilestone(orgId, 'firstContentUploadedAt')` |
| Playlist created | `middleware/src/modules/playlists/playlists.service.ts` (create handler) | `onboarding.markMilestone(orgId, 'firstPlaylistCreatedAt')` |
| Schedule created | `middleware/src/modules/schedules/schedules.service.ts` (create handler) | `onboarding.markMilestone(orgId, 'firstScheduleCreatedAt')` |
| Welcome email | `middleware/src/modules/auth/auth.service.ts` (after `sendWelcomeEmail`) | `onboarding.markMilestone(orgId, 'welcomeEmailSentAt')` |

Idempotent — service checks if already set before writing.

### Layer 6 — PM2 entries (env-gated, disabled by default)

```js
// ecosystem.config.js — 6 new entries
{
  name: 'agent-customer-lifecycle',
  script: 'scripts/agents/customer-lifecycle.ts',
  cron_restart: '*/30 * * * *',
  env: {
    VALIDATOR_BASE_URL: 'http://localhost:3000',
    CUSTOMER_LIFECYCLE_ENABLED: 'true',   // default-ON for implemented agent
    LIFECYCLE_LIVE: 'false',              // dry-run default
  },
},
{
  name: 'agent-support-triage',
  script: 'scripts/agents/support-triage.ts',
  cron_restart: '*/5 * * * *',
  env: { ..., SUPPORT_TRIAGE_ENABLED: 'true', SUPPORT_TRIAGE_LIVE: 'false' },
},
{
  name: 'agent-screen-health-customer',
  cron_restart: '*/10 * * * *',
  env: { ..., SCREEN_HEALTH_CUSTOMER_ENABLED: 'false' },  // scaffold OFF
},
// ...and 3 more scaffolds
```

Each script first-line checks its `*_ENABLED` flag and exits early if unset.

## Implementation order (during build)

1. Shared lib — `ai.ts`, state.ts, types.ts (re-export + extend)
2. Prisma schema — 3 new models + migration
3. Onboarding service + integration hooks
4. Customer Lifecycle agent (end-to-end) + unit tests
5. Support Triage agent (end-to-end, heuristic AI) + unit tests
6. Four scaffolds with env-gated exits + state stubs
7. Agents NestJS module + admin endpoints
8. PM2 entries
9. Draft PR

## Testing strategy

- **Unit tests** — `scripts/agents/__tests__/` (Vitest):
  - `customer-lifecycle.state-machine.spec.ts` — milestone + nudge transitions
  - `support-triage.classifier-extension.spec.ts` — heuristic AI matches classifier; LLM path mocked
  - `alert-dedup.spec.ts` — repeated incidents don't double-notify
- **No E2E, no Playwright** — overnight scope excludes
- **Middleware tests** — add to existing Jest suite:
  - `onboarding.service.spec.ts` — idempotent milestone marking
  - `agents.controller.spec.ts` — admin guard + state aggregation

## Risk & mitigation

| Risk | Mitigation |
|---|---|
| Nudge emails flood real users | Default dry-run; `LIFECYCLE_LIVE=true` is per-env flag; adds log-only first run |
| State file contention across agent families | Per-family files + same locking as ops; separate lock names |
| Support Triage auto-responds incorrectly | Only for known-safe categories (`password_reset` via email link, never modifies customer data); every auto-reply logged; admin can disable with `SUPPORT_TRIAGE_AUTO_RESPOND=false` |
| Onboarding events missed on existing orgs | Auto-complete orgs > 7 days old; lazy upsert on first lifecycle run |
| Prisma migration on prod | Migration is additive (new tables, no alters); safe to deploy |
| PM2 bloat from 6 more cron entries | All env-gated OFF except 2 implemented; memory cap 256MB each (same as ops agents) |
| LLM interface leak | `HeuristicAgentAI` is DI default; accidental import of Anthropic SDK breaks build (not added to `package.json`) |

## Success criteria for this PR

- [ ] Build + typecheck pass: `npx nx build @vizora/middleware`, `tsc --noEmit scripts/agents/*.ts`
- [ ] Middleware unit tests pass: `pnpm --filter @vizora/middleware test`
- [ ] Onboarding milestones increment correctly in a manual smoke test (Prisma Studio)
- [ ] Customer Lifecycle dry-run logs a representative nudge decision
- [ ] Support Triage re-ranks a seeded ticket
- [ ] 3 code-review agents sign off (architect, security, nestjs-review)

## Out of scope explicitly

- Production deploy
- Customer-facing dashboard UI
- ClickHouse wiring
- LLM provider selection + key
- Real outbound emails in Lifecycle
- Razorpay deep test coverage
- E2E tests
