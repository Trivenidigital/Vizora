# Agent System — Overnight Build Tracker

**Started:** 2026-04-17
**Branch:** `feat/agent-system`
**Scope:** Full design spec for 6 agents, 2 implemented end-to-end (Customer Lifecycle, Support Triage), 4 scaffolded (env-gated, default off).
**Stop point:** PR opened + 3 code-review agents reported. No deploy without human approval.

## Accepted defaults

1. LLM deferred — ship `AgentAI` strategy interface + `HeuristicAgentAI` fallback + adapter stubs.
2. State files isolated per family: `logs/agent-state/{customer,content,fleet,billing,ops}.json`.
3. New Prisma model `OrganizationOnboarding` (no backfill, existing orgs treated as complete).
4. 4 scaffolded agents: env-gated, default OFF, PM2 entries present.
5. Customer dashboard UI deferred; JSON endpoints only.
6. Unit tests on lifecycle state machine, classifier, alert dedup. No E2E.
7. Branch: `feat/agent-system`.
8. Review agents: typescript-software-architect-review, typescript-security-expert, nestjs-code-review-expert.
9. Ambiguity policy: best judgment + log to `## Decisions` below, keep going.
10. Wakeup trigger: PR opened + all 3 review agents reported.

## Workflow checklist

- [ ] Draft high-level plan (`docs/superpowers/plans/2026-04-17-agent-system-plan.md`)
- [ ] Parallel review round 1 (plan)
- [ ] Incorporate feedback → revised plan
- [ ] Draft design spec (`docs/superpowers/specs/2026-04-17-agent-system-design.md`)
- [ ] Parallel review round 2 (spec)
- [ ] Incorporate feedback → final spec
- [ ] Write implementation plan (`docs/superpowers/plans/2026-04-17-agent-system-impl.md`)
- [ ] Build: shared `AgentAI` interface + adapters
- [ ] Build: `OrganizationOnboarding` Prisma model + migration
- [ ] Build: Customer Lifecycle agent (end-to-end)
- [ ] Build: Support Triage LLM upgrade (end-to-end, using heuristic today, interface ready)
- [ ] Scaffold: Content & Screen Health (customer-facing)
- [ ] Scaffold: Billing & Revenue
- [ ] Scaffold: Content Intelligence
- [ ] Scaffold: Ops Orchestrator
- [ ] Unit tests
- [ ] PM2 `ecosystem.config.js` entries (disabled by env)
- [ ] Open draft PR
- [ ] Parallel code review (3 agents on diff)
- [ ] Write final status summary

## Decisions log

### Round 1 review feedback — all must-fix items accepted

**Architect (must-fix):**
- D1. `billing-revenue.ts` is **read-only/aggregate-only**. `BillingLifecycleService` is sole writer to subscription status.
- D2. `agent-orchestrator.ts` writes only to its own state file + `CustomerIncident` via middleware API. Never writes to other family state files.
- D3. Every `onboarding.markMilestone()` call site is fire-and-forget (`.catch(err => logger.warn(...))`).
- D4. `AgentAI.classify` renamed to `rerank(requests) → scored` — rerank the already-classified tickets instead of re-classifying.
- D5. Drop redundant `@@index([organizationId])` on `OrganizationOnboarding` (unique constraint already indexes).

**Security (must-fix):**
- D6. `OnboardingService.markMilestone()` method signature takes `(user: User, milestone)` — orgId derived from authenticated user, never from caller.
- D7. `SupportMessage.authorType = 'agent' | 'user' | 'admin'` field added; triage query excludes `authorType = 'agent'` to prevent reply loop.
- D8. All support-triage DB queries include explicit `organizationId` scope.
- D9. `GET /agents/:name/state` runs response through `sanitizeAgentState()` recursive key-exclusion (blocks `token|secret|key|password|apiKey|webhook|jwt`).
- D10. `MAX_EMAILS_PER_RUN = 50` hard circuit breaker in customer-lifecycle.
- D11. Per-org nudge dedup check inside DB transaction before every send.
- D12. `LIFECYCLE_TEST_EMAILS` allowlist env — when set, all outbound redirects to allowlist only, regardless of `LIFECYCLE_LIVE`.
- D13. `AgentAI` interface signatures accept **only structural signals** — `{ category, orgTier, deviceCount, milestoneFlags }`. No raw user/email/billing/token objects.
- D14. Orchestrator correlation always groups by `organizationId` first before any cross-agent join.

**NestJS (must-fix):**
- D15. `OnboardingService` uses `@OnEvent()` listeners via existing `EventEmitter2`. No constructor injection into 5 existing services. New event `user.welcomed` emitted from `auth.service.ts`.
- D16. `AgentAI` registered as **custom provider with `useFactory`** using a `Symbol` token `AGENT_AI_TOKEN`. No `AgentAiService` wrapper class.
- D17. `@SkipOutputSanitize()` on `AgentsController` class.
- D18. `@UseGuards(JwtAuthGuard, AdminGuard)` at class level on `AgentsController`.
- D19. Disk state-file reads go through `AgentStateService`, not controller directly.
- D20. `AgentStatusQueryDto` with `page`/`limit` on `GET /agents/status`.

### Round 2 review feedback — all must-fix + cheap nice-to-fix items accepted

**Architect (must-fix):**
- D-arch-R2-1. `markMilestone` upsert must use `update: {}` + separate coalesce `updateMany`. Empty update block = race-safe no-op on already-set timestamps.
- D-arch-R2-2. `POST /:name/run` must NOT use `child_process.spawn(name)`. Name is user input. Allowlist Set + state-file flag (`pendingManualRun: true`) that cron picks up next tick.
- D-arch-R2-3. Drop `@@index([organizationId, targetId])` — orchestrator correlates via `organizationId + status='open'`; targetId joins in-memory.
- D-arch-R2-5. Real emit site for `display.paired` is `pairing.service.ts:completePairing()`, NOT `displays.service.ts`.

**Security (must-fix):**
- D-sec-R2-1. Hash email addresses (SHA-256 first-10-hex) in audit JSON — no PII in agent logs.
- D-sec-R2-2. `LIFECYCLE_TEST_EMAILS` must iterate ALL entries, not just `TEST_EMAILS[0]`.
- D-sec-R2-3. `emailsSentThisRun` counter persisted to state file, not in-memory. Manual re-trigger cannot reset the budget.

**NestJS (must-fix):**
- D-nestjs-R2-1. Drop `EventEmitterModule` from `AgentsModule.imports` — it's registered globally; re-importing causes double-firing listeners.
- D-nestjs-R2-2. Same as D-arch-R2-1 (duplicate catch — confirms severity).

**Cheap nice-to-fix items (all folded):**
- Expand sanitize regex with `credential|auth|cookie|session|private|access`.
- Factory logs warning on unknown `AGENT_AI_PROVIDER` (falls back, doesn't throw — prevents boot flap).
- Constrain `TicketSignal.category/priority/orgTier` to union types.
- Candidate query `ORDER BY createdAt ASC` prevents starvation at `LIMIT 200`.
- Explicit note: `suppressErrors` is NOT a real `@OnEvent` option; inner try/catch is the authoritative guard.

## Status

- [x] Plan drafted
- [x] Round 1 review complete (3 agents)
- [x] Design spec drafted
- [x] Round 2 review complete (3 agents)
- [x] Round 2 feedback folded into spec
- [x] Implementation plan
- [x] Build phase
- [x] Draft PR (#32)
- [x] Round 3 review (on diff)
- [x] Round 3 merge-blocker fixes applied
- [ ] Human approval + merge
- [ ] Go-live blockers cleared (follow-up PR)
- [ ] Deploy

## Round 3 review outcome (PR #32 diff)

Three reviewers: `typescript-software-architect-review`, `typescript-security-expert`, `nestjs-code-review-expert`. No critical vulns, no hard merge blockers.

### Fixes applied in this pass (round 3 fold-in)

| ID | Source | Fix |
|---|---|---|
| D-R3-1 (was C1) | Arch + Nest | Standardized event payload key to `organizationId` across all publishers. Dropped `resolveOrgId` shim in `OnboardingService`. Single `OnboardingEvent` type — no more dual-shape tolerance. |
| D-R3-2 (was C2) | Security + Nest BLOCKER | `POST /agents/incidents` now pulls `organizationId` from JWT via `@CurrentUser('organizationId')`. Removed `organizationId` field from `CreateCustomerIncidentDto`. `CustomerIncidentService.create(orgId, dto)` signature updated accordingly. |
| D-R3-3 (was Nest-B1) | Nest | `@SkipOutputSanitize()` narrowed from class-level to method-level on the two state-read endpoints only. Incident creation now passes through global SanitizeInterceptor. |
| D-R3-4 (was Nest-B2) | Nest | `AgentStateService` file I/O migrated to `fs/promises`. `aggregateStatus`, `read`, `enqueueManualRun` all async. Controller updated to await. |
| D-R3-5 (was C3) | Arch + Nest | Stub `OpenAIAgentAI` and `AnthropicAgentAI` method signatures now include full `AgentAI` parameters for refactor safety + editor autocomplete. |
| D-R3-6 (was C4) | Arch + Nest | `enqueueManualRun` now acquires the `{family}.json.lock` file with the same wait/stale-takeover convention used by cron workers. Degraded-but-alive policy on timeout. |
| D-R3-7 (collateral) | — | `CreateCustomerIncidentDto.remediation` marked `@IsOptional()` (was required; Nest flagged timing mismatch). |
| D-R3-8 (collateral) | — | `auth.service.spec.ts` and `pairing.service.spec.ts` updated to inject `EventEmitter2` mock — these mocks were missed when event emission was introduced earlier in the branch. |

Specs updated to match: `agent-state.service.spec.ts`, `onboarding.service.spec.ts`, `customer-incident.service.spec.ts`. All 50 agent-module tests pass; auth + pairing + publisher-service specs also green (262 tests across the affected suites).

## Pending items — deliberately deferred to follow-up PR

### Must clear before `LIFECYCLE_LIVE=true` in production

| ID | Severity | Source | File | Issue | Fix direction |
|---|---|---|---|---|---|
| PEND-H1 | HIGH | Security | `scripts/agents/customer-lifecycle.ts:186-190` | Email counter re-read per iteration with gap window — concurrent runs can each send up to 50, doubling the cap | Hold the family state lock across the full send decision, not per-iteration. Atomic increment-and-check. |
| PEND-H2 | HIGH | Security | `scripts/agents/lib/alerting.ts:23-25` | SHA-256 email hash is unsalted — reversible via dictionary attack if logs exfiltrated | Add `LOG_HASH_SALT` env var; include in hash input. |
| PEND-M2 | MEDIUM | Security | `scripts/agents/customer-lifecycle.ts:285` | SMTP rejection `.message` commonly contains raw email — leaks to PM2 logs / Loki | Wrap catch to `maskEmail(admin.email)` before logging. |
| PEND-M4 | MEDIUM | Security | `scripts/agents/support-triage.ts:136` | `RankedTicket.reason` written verbatim to `SupportMessage.content` — prompt-injection bleed-through risk once LLM adapter wired | Add `sanitizeAIOutput(text)` step (control-char strip, length cap, anomaly warn) before `writeAgentMessage`. |

### Should fix before merge-to-main (concerns, not blockers)

| ID | Source | File | Issue | Fix direction |
|---|---|---|---|---|
| PEND-A1 | Architect | `packages/database/prisma/schema.prisma:813-834` | `CustomerIncident.severity/status/agent/type` are free-text strings | Migrate to Prisma `enum` declarations for DB-level enforcement. |
| PEND-A2 | Architect | `packages/database/prisma/schema.prisma:836-854` | `ContentRecommendation.contentId/playlistId` have no FK constraints + no `updatedAt` | Add `@relation(..., onDelete: SetNull)` + `updatedAt @updatedAt`. |
| PEND-A3 | Architect | `middleware/src/modules/agents/agent-state.service.ts:44` | `stateDir` derived from `__dirname` — couples compiled layout to output convention | Inject via `ConfigService` (new `AGENT_STATE_DIR` env). |
| PEND-N1 | Nest | — | No controller-level spec for `AgentsController` | Add spec covering 401 (unauthenticated), 400 (unknown agent name), 422 (invalid DTO). |
| PEND-N2 | Nest | `middleware/src/modules/agents/ai/heuristic-agent-ai.spec.ts` | No tests for `analyzeContent` boundary cases (`completionRate < 0.3`, `peakShare > 0.25`) | Add threshold tests. |

### Nits (low priority, non-blocking)

| ID | Source | File | Issue |
|---|---|---|---|
| PEND-L1 | Security | `scripts/agents/lib/state.ts:59` | Lock-timeout silent fallback undocumented; mtime staleness check fragile on Windows (antivirus touch) |
| PEND-L2 | Security | `scripts/agents/lib/alerting.ts` | FORBIDDEN_KEY_REGEX misses Map/Set/unicode-homoglyph bypasses (low exploitability today — no external-input field names) |
| PEND-X1 | Arch | both interface files | `AgentAI` interface duplicated in `middleware/.../ai/agent-ai.interface.ts` and `scripts/agents/lib/ai.ts` — signatures can drift silently. Future: extract to `@vizora/shared`. |
| PEND-X2 | Nest | `agents.controller.ts` | `RUNNABLE` Set reused for both run-allowlist and state-read-allowlist — consider renaming to `KNOWN_AGENTS` or splitting. |
| PEND-X3 | Nest | `agents.module.ts` factory | Factory fallback-to-heuristic on unknown provider is logger.warn only — not surfaced on `/health`. Add observability when LLM adapters are introduced. |

### Go-live checklist (must complete before flipping `LIFECYCLE_LIVE=true` in prod)

1. PEND-H1, PEND-H2, PEND-M2, PEND-M4 merged.
2. Staging smoke: `LIFECYCLE_LIVE=true` + `LIFECYCLE_TEST_EMAILS` with dev mailbox; confirm one nudge dispatched, one `OrganizationOnboarding.dayNNudgeSentAt` stamped, no errors in PM2 logs.
3. Staging smoke: post a real support ticket; within ≤5min confirm `SupportMessage` row with `authorType='agent'` exists, category coercion sensible, no prompt-injected content in message body.
4. Grafana / dashboard shows 6 new PM2 apps as `online` and the 4 scaffolds logging "disabled via *_ENABLED — exiting" with exit code 0.
5. Human approval gate — all four staging checks green → flip prod env, narrow-start with `LIFECYCLE_TEST_EMAILS` still set to on-call mailbox, observe 24h before broadening.
