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
- [ ] Implementation plan
- [ ] Build phase
- [ ] Draft PR
- [ ] Round 3 review (on diff)

