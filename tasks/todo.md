# Vizora - Task Tracker

## Active Workstream: Ops Escalated Incident Status Pass 58 (2026-06-03)

**Branch:** `fix/ops-escalated-status`

**Why now:** The ops dashboard treats any incident with `status !== 'resolved'`
as active, but the shared ops status calculation and reporter summaries only
count `status === 'open'`. That means an unresolved `escalated` critical
incident can be dropped from `systemStatus` and alert details, hiding precisely
the incidents that need operator attention.

**New primitives introduced:** none planned. This pass should reuse the
existing ops-state model, `IncidentStatus` union, ops reporter, and
release-readiness guard tests. No new route, model, migration, env var,
process, response shape, realtime event, MCP tool, Hermes skill, AI/provider
spend path, or runtime change is expected.

**Hermes-first analysis:** checked per project convention. This is
deterministic ops-state severity calculation and reporting, not a
business-agent, MCP, Hermes runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Ops incident severity rollup | none applicable | fix existing deterministic ops-state helper |
| Ops reporter alert incident selection | none applicable | reuse existing reporter path and active-incident semantics |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
local ops-state severity rollup.

**Plan**
- [x] Add focused red tests proving escalated critical/warning incidents affect
      `systemStatus` until resolved.
- [x] Add a release-readiness guard proving ops reporter summarizes active
      non-resolved incidents, not only `open` incidents.
- [x] Implement the smallest shared helper in the existing ops-state path and
      update ops reporter/alerting to use active-incident wording.
- [x] Run focused ops tests and TypeScript checks.
- [x] Request Claude Code review and resolve findings.
- [ ] Commit, PR, CI, and merge if green.
- [ ] Do not deploy by default; hand off deploy/runtime status and remaining
      operator-only blockers.

**Evidence so far**
- Current `origin/main`: `a0f136fb3ea426d7d58744926b7c8f6ec5b543da`.
- Drift-check:
  - `scripts/ops/lib/state.ts` `determineSystemStatus` filtered only
    `status === 'open'`.
  - `scripts/ops/ops-reporter.ts` used the same open-only filter for alert
    incident lists and summary counts.
  - `web/src/app/dashboard/ops/page.tsx` already treats incidents with
    `status !== 'resolved'` as active, so shared state/reporter semantics were
    narrower than dashboard semantics.
- Red focused run:
  - `pnpm test:ops` failed as expected: escalated critical returned `HEALTHY`
    instead of `CRITICAL`, escalated warning returned `HEALTHY` instead of
    `DEGRADED`, and the ops reporter static guard found open-only filtering.
- Fix:
  - Added shared `isActiveIncident` helper in `scripts/ops/lib/state.ts`.
  - `determineSystemStatus` and `ops-reporter` now count unresolved incidents
    (`status !== 'resolved'`) consistently.
  - `scripts/ops/lib/alerting.ts` now labels those alert lists as "active
    incidents" instead of "open incidents."
  - Addressed Claude Code's HIGH finding by adding a health-guardian recovery
    branch for escalated `pm2-errored` incidents when the PM2 process is back
    online.
  - Added `.gitignore` coverage for `.tmp-health-guardian-*/`, matching the
    existing ops-watchdog temp-dir pattern.
- Green focused run:
  - `pnpm test:ops` => 24/24 ops tests passing after adding the alerting label
    guard and PM2 recovery-resolution regression test.
- Static/hygiene verification:
  - `pnpm exec tsc --noEmit --pretty false --module esnext --moduleResolution bundler --target es2022 --lib es2022 --strict --types node scripts/ops/lib/state.ts scripts/ops/lib/state.test.ts scripts/ops/ops-reporter.ts scripts/ops/lib/alerting.ts scripts/ops/health-guardian.ts scripts/ops/health-guardian.test.ts scripts/ops/release-readiness-gates.test.ts`
    => passing.
  - `git diff --check -- .gitignore scripts/ops/lib/state.ts scripts/ops/lib/state.test.ts scripts/ops/ops-reporter.ts scripts/ops/lib/alerting.ts scripts/ops/health-guardian.ts scripts/ops/health-guardian.test.ts scripts/ops/release-readiness-gates.test.ts tasks/todo.md`
    => exit 0, with LF/CRLF normalization warnings only.
  - `pnpm security:no-hardcoded-jwts` => passing.
- Claude Code review:
  - First review approved the active-incident semantics but surfaced one HIGH
    finding: escalated `pm2-errored` incidents could pin `CRITICAL` forever
    after process recovery because health-guardian had no PM2 recovery branch.
  - Final review returned `APPROVE` after the PM2 recovery-resolution test/fix
    and active-incident alert wording guard. Reviewer independently verified
    24/24 ops tests passing and cross-platform fake-PM2 test reliability.

## Active Workstream: Middleware Container Healthcheck Truth Pass 57 (2026-06-03)

**Branch:** `fix/overnight-healthchecks`

**Why now:** After PR #196 aligned realtime health probes, the next repo-side
runtime drift is the middleware container healthcheck path. Middleware is served
under `/api/v1`, and direct container/compose probes do not pass through the
public nginx backwards-compat rewrite from `/api/` to `/api/v1/`. A stale
container probe at `/api/health` can make a healthy middleware container look
unhealthy in Docker/runtime orchestration.

**New primitives introduced:** none planned. This pass should reconcile
Dockerfile/docs healthcheck references to the existing middleware health
routes and align Docker docs with the PM2 app-service topology. No new route,
model, migration, env var, process, response shape,
realtime event, MCP tool, Hermes skill, AI/provider spend path, or runtime
change is expected.

**Hermes-first analysis:** checked per project convention. This is
deterministic Docker/runtime healthcheck route reconciliation, not a
business-agent, MCP, Hermes runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Middleware container healthcheck route | none applicable | reconcile Docker healthchecks to existing `/api/v1/health` route |
| Local Docker healthcheck commands | none applicable | update existing docs only |
| Docker/PM2 deployment topology docs | none applicable | document existing topology, no new process |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
local Docker healthcheck endpoint reconciliation.

**Plan**
- [x] Create isolated worktree from current `origin/main` to avoid the dirty
      primary checkout.
- [x] Add focused red release-readiness tests proving middleware Dockerfile and
      Docker README health references use `/api/v1/health`.
- [x] Update Dockerfile/docs references to match middleware route truth.
- [x] Run focused ops/release-readiness tests.
- [x] Run relevant hygiene/static checks.
- [x] Request Claude Code review and resolve findings.
- [ ] Commit, PR, CI, and merge if green.
- [ ] Do not deploy by default; hand off deploy/runtime status and remaining
      operator-only blockers.

**Evidence so far**
- Current `origin/main`: `7f6a16f37a481d5cb274e6fb67cc7b3cbe25d13d`.
- Drift-check:
  - Middleware sets global prefix `api/v1` in `middleware/src/main.ts`.
  - `HealthController` is mounted at `@Controller('health')`, so the direct
    middleware health route is `/api/v1/health`.
  - `docker/Dockerfile.middleware` still probed `/api/health`.
  - `docker/docker-compose.yml` has a `/api/health` reference under Grafana,
    not middleware; it is Grafana's own API health route and remains untouched.
  - `docker/README.md` had stale app ports, presented PM2 app services as
    docker-compose services, and told operators to scale realtime to 2
    instances, conflicting with the single-instance Socket.IO rule.
- Red focused run:
  - `pnpm test:ops` failed as expected on the new middleware Dockerfile,
    Docker README health endpoint, Docker/PM2 topology, and realtime
    single-instance README guards.
- Fix:
  - `docker/Dockerfile.middleware` now probes
    `http://localhost:3000/api/v1/health`.
  - `docker/README.md` now documents compose-managed infrastructure separately
    from PM2/local app services, middleware `3000`, web `3001`, realtime
    `3002`, the current health endpoints, and the realtime single-instance
    rule.
- Green focused run:
  - `pnpm test:ops` => 18/18 ops/readiness tests passing.
- Static/hygiene verification:
  - `pnpm exec tsc --noEmit --pretty false --module esnext --moduleResolution bundler --target es2022 --lib es2022 --strict --types node scripts/ops/release-readiness-gates.test.ts`
    => passing.
  - `git diff --check -- docker/Dockerfile.middleware docker/README.md scripts/ops/release-readiness-gates.test.ts tasks/todo.md`
    => exit 0, with LF/CRLF normalization warnings only.
  - `pnpm security:no-hardcoded-jwts` => passing.
- Claude Code review:
  - Review returned `CLEAN`.
  - Reviewer independently verified middleware route truth (`api/v1` global
    prefix + `@Controller('health')`), Docker README PM2/compose topology, port
    assignments, realtime single-instance guidance, and that the new guards
    cannot false-positive on Grafana's valid `/api/health` route.
- PR / CI:
  - PR #197: `https://github.com/Trivenidigital/Vizora/pull/197`.
  - Initial CI was green before this evidence update: audit 32s, lint 32s,
    security 25s, build 1m31s, test 4m26s, e2e 8m41s.

## Active Workstream: Realtime Health Smoke Truth Pass 56 (2026-06-03)

**Branch:** `fix/realtime-health-smoke-truth-20260603`

**Why now:** After PR #195 merged, a read-only production snapshot showed
middleware and web healthy, but realtime returns `404` at
`http://127.0.0.1:3002/health` and `200` at
`http://127.0.0.1:3002/api/health`. Repo code matches prod runtime:
`realtime/src/main.ts` applies global prefix `api`, and
`realtime/src/app/app.controller.ts` exposes `@Get('health')`, making the
actual route `/api/health`. The smoke script and first-customer runbook drifted
to `/health`, which would make a go-live smoke fail for the wrong reason.

**New primitives introduced:** none planned. This pass should reconcile smoke
and runbook expectations to the existing realtime route. No new route, model,
migration, env var, process, response shape, realtime event, MCP tool, Hermes
skill, AI/provider spend path, or runtime change is expected.

**Hermes-first analysis:** checked per project convention. This is deterministic
smoke/runbook route reconciliation, not a business-agent, MCP, Hermes runtime,
or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Realtime health smoke route | none applicable | reconcile smoke/runbook to repo/runtime truth |
| First-customer runbook health checks | none applicable | update existing runbook text only |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
local smoke-script endpoint reconciliation.

**Plan**
- [x] Add a focused red release-readiness test proving smoke/runbook expect
      realtime `/api/health`.
- [x] Update `scripts/smoke/api-critical-path.sh` and
      `docs/runbooks/first-customer-onboarding.md` to match repo/runtime truth.
- [x] Run focused ops/release-readiness tests.
- [x] Run relevant hygiene/security checks.
- [x] Request Claude Code review and resolve findings.
- [x] PR, CI, and merge if green. PR #196 merged at
      `7f6a16f37a481d5cb274e6fb67cc7b3cbe25d13d`.
- [ ] Do not deploy by default; hand off deploy/runtime status.

**Evidence so far**
- Current `origin/main`: `72314d3f74de093077a133bf63ad799ded0d0c00`.
- Production read-only endpoint matrix:
  - realtime `/health` => `404`
  - realtime `/api/health` => `200`
  - realtime `/api/v1/health` => `404`
  - middleware `/api/v1/health` => `200`
  - middleware `/api/v1/health/ready` => `200`
  - web `/` => `200`
- Local code evidence:
  - `realtime/src/main.ts` calls `app.setGlobalPrefix('api')`.
  - `realtime/src/app/app.controller.ts` exposes `@Get('health')`, so the
    actual route is `/api/health`.
- Red focused run:
  - `pnpm test:ops` failed as expected after updating the release-readiness
    assertions: `scripts/smoke/api-critical-path.sh` and
    `docs/runbooks/first-customer-onboarding.md` still referenced realtime
    `/health`.
- Fix:
  - `scripts/smoke/api-critical-path.sh` now probes realtime health at
    `$RT_BASE/api/health`.
  - `docs/runbooks/first-customer-onboarding.md` now documents the same
    local-VPS realtime health path in the smoke and pre-flight sections.
  - `docker/Dockerfile.realtime` now probes the same `/api/health` route in its
    latent container healthcheck.
  - `scripts/ops/health-guardian.ts` now probes realtime at `/api/health` and
    resolves recovered `service-down` incidents even when the old incident had
    escalated after exhausted restart attempts.
  - `.gitattributes` now keeps `*.sh` checked out with LF line endings.
  - `docs/plans/2026-06-02-release-readiness-gates-pass-50.md` now notes that
    pass 56 supersedes the earlier `/health` assumption.
- Green verification:
  - `pnpm test:ops` => 14/14 ops/release-readiness tests passing.
  - `pnpm exec tsc --noEmit --pretty false --module esnext --moduleResolution bundler --target es2022 --lib es2022 --strict --types node scripts/ops/health-guardian.ts scripts/ops/release-readiness-gates.test.ts`
    => passing.
  - `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh`
    => passing.
  - `git diff --check -- .gitattributes docker/Dockerfile.realtime docs/plans/2026-06-02-release-readiness-gates-pass-50.md docs/runbooks/first-customer-onboarding.md scripts/smoke/api-critical-path.sh scripts/ops/health-guardian.ts scripts/ops/release-readiness-gates.test.ts tasks/todo.md`
    => exit 0, with LF/CRLF normalization warnings only.
  - `pnpm security:no-hardcoded-jwts` => passing.
  - Generic `bash -n` failed on this Windows host because the WSL relay points
    at missing `/bin/bash`; Git Bash was used explicitly for Bash syntax.
- Claude Code review:
  - First review returned `CLEAN` on the scoped diff and requested folding in
    the same stale `/health` route in `docker/Dockerfile.realtime`.
  - Addressed that Dockerfile healthcheck, tightened the runbook negative
    assertion, added static Dockerfile coverage, added shell LF normalization,
    and marked the stale pass-50 plan assumption as superseded.
  - Second review found the active `health-guardian` consumer still probing
    realtime `/health`; added a red static assertion proving the drift before
    changing the script.
- Production runtime attribution:
  - Read-only grep of `/opt/vizora/app/logs/ops-state.json` found
    `health-guardian:service-down:realtime` with `status: "escalated"`,
    `attempts: 2`, and `error: "HTTP 404"`; prod `systemStatus` is still
    `CRITICAL`.
  - After this code is deployed, a successful health-guardian run should probe
    `/api/health` and resolve that existing escalated false incident. Dashboard
    visibility may still lag until the next ops-reporter sync.
  - Final Claude Code review returned `CLEAN`. Residual risks are non-blocking:
    prod still needs a reviewed deploy before the fix runs; realtime `/api/health`
    is process-health only while `/api/health/ready` dependency parity is a
    future pass; the old resolved incident may retain its stale `HTTP 404`
    error text after status changes to `resolved`.

## Active Workstream: Ops State Incident Resolution Pass 55 (2026-06-03)

**Branch:** `fix/ops-state-incident-resolution-20260603`

**Why now:** Weekend production-readiness validation found core prod services,
health endpoints, CI, deploy SHA, and API smoke checks green, but
`/api/v1/health/ops-status` still reported `systemStatus: CRITICAL`.
Runtime evidence showed recent `lastRun` values for the ops cron agents while
older `ops-watchdog:agent-silent:*` incidents remained open. That makes the
readiness report noisy and can hide real launch blockers behind stale recovered
conditions.

**New primitives introduced:** none planned. This pass should reuse the
existing `scripts/ops` state file, incident IDs, `recordAgentRun`,
`determineSystemStatus`, and ops-watchdog PM2 cron path. No new route, model,
migration, env var, process, response shape, realtime event, MCP tool, Hermes
skill, or AI/provider spend path is expected.

**Hermes-first analysis:** checked per project convention. This is deterministic
ops-state reconciliation in the existing PM2 cron watchdog, not a business-agent
decision task, MCP tool, Hermes runtime task, or provider-spend path.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Ops watchdog stale incident closure | none applicable | fix in existing deterministic ops watchdog/state path |
| Production readiness status calculation | none applicable | reuse existing ops-state status functions |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
local `ops-state.json` incident lifecycle reconciliation.

**Plan**
- [x] Drift-check existing ops watchdog/state incident lifecycle and capture
      file/line evidence before proposing code.
- [x] Add a focused red test proving recovered ops agents close their own stale
      `agent-silent` incidents and recalculate `systemStatus`.
- [x] Implement the smallest Vizora-native fix in the existing ops watchdog/state
      path.
- [x] Run focused tests for the watchdog/state lifecycle.
- [x] Run relevant broader verification for ops scripts and static checks.
- [x] Request Claude Code review for plan/diff/test evidence and resolve
      findings.
- [x] Commit with conventional message and update this section with evidence.
- [x] Do not deploy by default; hand off deploy/runbook evidence unless explicit
      deployment approval is given.

**Evidence so far**
- Current `origin/main`: `2c92b1f8e82c2f05a295e6a90d41167b68a46272`.
- Current local `HEAD`: `2c92b1f8e82c2f05a295e6a90d41167b68a46272`.
- Production-runtime evidence from the weekend state check: core PM2 services
  online, health/readiness endpoints 200, API critical-path smoke 27/27 passing,
  SMTP startup self-test passing, but ops-state still `CRITICAL` with recovered
  cron agents and open stale `agent-silent` incidents.
- Dirty worktree note: pre-existing local modification `web/next-env.d.ts` and
  many untracked scratch/evidence files remain untouched.
- Drift-check:
  - `scripts/ops/lib/state.ts` `recordAgentRun` upserts only incidents present
    in the current agent result, then recalculates status.
  - `scripts/ops/fleet-manager.ts` already resolves stale incidents by pushing
    resolved incident copies before `recordAgentRun`.
  - `scripts/ops/ops-watchdog.ts` records open `agent-silent` incidents when
    stale agents exist, but records no resolved incidents when the watched agent
    becomes fresh again.
- Red focused run:
  - `pnpm test:ops` failed as expected in
    `scripts/ops/ops-watchdog.test.ts`: recovered
    `ops-watchdog:agent-silent:fleet-manager` remained `open` instead of
    `resolved`.
- Fix:
  - `scripts/ops/ops-watchdog.ts` now tracks agents with valid fresh `lastRun`
    values and records resolved copies of watchdog-owned `agent-silent`
    incidents for those recovered agents.
  - Missing or malformed `lastRun` values are still skipped and do not resolve
    prior incidents, because they are not proof of recovery.
- Green verification:
  - `pnpm test:ops` => 11/11 ops tests passing.
  - Initial ad-hoc `tsc` check with CommonJS output failed on existing
    `import.meta` usage in ops scripts; rerun with ESM-compatible flags passed:
    `pnpm exec tsc --noEmit --pretty false --module esnext --moduleResolution bundler --target es2022 --lib es2022 --strict --types node scripts/ops/ops-watchdog.ts scripts/ops/ops-watchdog.test.ts`
  - `git diff --check -- .gitignore scripts/ops/ops-watchdog.ts scripts/ops/ops-watchdog.test.ts tasks/todo.md`
    => exit 0, with LF/CRLF normalization warnings only.
  - `pnpm security:no-hardcoded-jwts` => passing.
- Claude Code review:
  - First review returned `CLEAN` with one low-severity request for mixed
    guard-path coverage.
  - Added `ops-watchdog does not resolve stale, missing, or malformed agent
    records`, proving only positively fresh agents resolve while real stale or
    unverified records remain open.
  - Second review returned `CLEAN`; only residual risks were non-blocking:
    dashboard Redis cache may lag source-of-truth `ops-state.json` until the
    next `ops-reporter` cycle, and any future removal from
    `SLA_MINUTES_BY_AGENT` should explicitly resolve/decommission old
    `agent-silent` incidents.
- Deploy status:
  - Not deployed by default. This change is safe for the next reviewed deploy;
    after deploy, the next `ops-watchdog` firing should update source-of-truth
    `logs/ops-state.json`, and dashboard-visible status may lag until the next
    `ops-reporter` sync.
- Commit:
  - `fix: resolve recovered ops watchdog incidents` (final hash recorded in
    handoff; self-referential commit hashes are not embedded in the commit).

## Active Workstream: Schedule Target Names Pass 54 (2026-06-02)

**Branch:** `fix/schedule-target-names-pass-54`

**Why now:** PR #193 merged with green CI, but production deployment remains
blocked by dirty/diverged prod state. The next customer-visible dashboard gap is
small and testable: schedule list rows already load display metadata, but
individual display targets render only as `1 device`, making it hard to tell
which screen a schedule affects.

**New primitives introduced:** none. This pass reuses the existing Schedules
page, existing loaded display data, existing group-target display-name pattern,
and existing Jest/RTL schedule coverage. No new route, model, migration,
module, env var, process, response shape, realtime event, MCP tool, Hermes
skill, or AI/provider spend path.

**Hermes-first analysis:** checked per project convention. This is local
dashboard schedule-list rendering, not a business-agent, MCP, Hermes runtime, or
provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Schedule target display names | none applicable | resolve labels from already-loaded displays |
| Schedule list UX | none applicable | keep fix in existing schedules page/test |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
React schedule target label rendering.

**Plan**
- [x] Add a focused red test proving individual schedule targets render display names.
- [x] Resolve schedule display targets against loaded display metadata.
- [x] Run focused schedules page tests.
- [x] Run multi-vector diff review.
- [x] Run broader web verification.
- [ ] PR, CI, and merge if green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Current `origin/main`: `3bbfd6e53b6646d5aa07f092c2643a85aecdaeb8`.
- Red focused run:
  - `pnpm --filter @vizora/web test -- --runInBand src/app/dashboard/schedules/__tests__/schedules-page.test.tsx`
    failed because `Morning Announcements` rendered target `1 device` instead
    of `Lobby Display`.
- Fix:
  - `getScheduleTargetDescription` now resolves individual display targets
    against the `devices` list already loaded by the schedules page.
  - If display metadata is unavailable, it preserves the previous count-based
    fallback instead of exposing raw IDs.
- Green focused run:
  - Same command => 1 suite / 29 tests passing.
- Review:
  - UX/API-truth reviewer found that fallback labels could expose raw device
    identifiers and that truncated target text had no full-text recovery. Fixed
    by using only trimmed nickname/location for display labels, preserving the
    count fallback when labels are unavailable, and adding `title` to the
    rendered target label. Final re-review returned CLEAN.
  - Test/release reviewer returned CLEAN after independently running the
    focused schedules test, web type-check, full web suite, and diff check.
- Broader verification:
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` => passing
    (run independently by reviewer).
  - `pnpm --filter @vizora/web test -- --runInBand` => 105 suites / 1109 tests
    passing, with existing React `act(...)` and jsdom navigation warnings (run
    independently by reviewer).
  - Production-like web build with public URLs set to `https://vizora.cloud`:
    `npx nx build @vizora/web` => passing, with existing Next/Nx warnings.
  - `pnpm security:no-hardcoded-jwts` => passing.
  - `git diff --check` => exit 0, with only LF/CRLF normalization warnings.

## Completed Workstream: Dashboard Overview Accessibility Pass 53 (2026-06-02)

**Branch:** `fix/customer-dashboard-next-pass-53`

**Why now:** PR #192 merged with green CI, but production deployment remains
blocked by dirty/diverged prod state. From a customer dashboard perspective, the
overview stat cards are primary navigation affordances, but Devices, Content,
and Playlists were clickable `<div>` elements instead of real route links.

**New primitives introduced:** none. This pass reuses the existing dashboard
page, existing card styling, existing router navigation, and existing Jest/RTL
coverage. No new route, model, migration, module, env var, process, response
shape, realtime event, MCP tool, Hermes skill, or AI/provider spend path.

**Hermes-first analysis:** checked per project convention. This is local
dashboard accessibility/interaction polish, not a business-agent, MCP, Hermes
runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard card navigation accessibility | none applicable | use styled Next `Link` elements in existing page |
| Customer dashboard UX review | none applicable | keep fix in the existing dashboard component/test |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
React card semantics in Vizora's dashboard.

**Plan**
- [x] Add a focused red test proving overview card navigation is exposed through semantic controls.
- [x] Convert navigable stat cards to route links without changing destinations or data flow.
- [x] Run focused dashboard page tests.
- [x] Run multi-vector diff review.
- [x] Run broader web verification.
- [x] PR, CI, and merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Current `origin/main`: `680b7a6f161248f26ee2aae123dcbdc0f6b36ce2`.
- Red focused run:
  - `pnpm --filter @vizora/web test -- --runInBand src/app/dashboard/__tests__/dashboard-page.test.tsx`
    failed because no semantic navigation affordance existed for the overview
    cards.
- Fix:
  - Converted the Devices, Content, and Playlists overview cards from clickable
    `<div>` elements to styled Next `Link` controls with `href` destinations
    and focus ring styling.
  - Left the non-navigating System Status card as static content.
- Green focused run:
  - Same command => 1 suite / 18 tests passing.
- Review:
  - UX/accessibility reviewer initially found that the interim `button` version
    used button semantics for route navigation and overrode visible stat text
    with `aria-label`. Accepted and changed the implementation to route links
    with visible text as the accessible name. Final re-review returned CLEAN.
  - Test/release reviewer returned CLEAN on the link-based implementation after
    independently running the focused dashboard test, web type-check, and diff
    check.
- Broader verification:
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` => passing.
  - `pnpm --filter @vizora/web test -- --runInBand` => 105 suites / 1108 tests
    passing, with existing React `act(...)` and jsdom navigation warnings.
  - Production-like web build with public URLs set to local/prod-safe values:
    `npx nx build @vizora/web` => passing, with existing Next/Nx warnings.
  - `pnpm security:no-hardcoded-jwts` => passing.
  - `git diff --check` => exit 0, with only LF/CRLF normalization warnings.
- Browser smoke:
  - Started temporary local web server on port 3001 and used a dummy
    JWT-shaped cookie only to pass the client proxy route guard. No backend
    auth or production state was touched.
  - Playwright checked desktop 1366x900 and mobile 390x844. The Devices,
    Content, and Playlists overview links were present, nonzero-sized, and had
    expected hrefs; no page errors were reported.
- PR / CI / merge:
  - PR #193: `https://github.com/Trivenidigital/Vizora/pull/193`.
  - Squash merge commit: `3bbfd6e53b6646d5aa07f092c2643a85aecdaeb8`.
  - CI green: audit 29s, lint 36s, security 26s, build 1m29s, test 4m12s,
    e2e 8m43s.
- Deploy gate:
  - Not deployed. Read-only production check showed prod at
    `bb76aa1838740bff5b58623dfef7a906d44f46a6`, remote main at
    `3bbfd6e53b6646d5aa07f092c2643a85aecdaeb8`, 72 dirty/untracked paths, and
    branch state `ahead 17, behind 164`.
  - Core PM2 services were online, but `/api/v1/health/ready` was degraded with
    the memory check marked unhealthy. No pull/restart/deploy was performed.

## Completed Workstream: Realtime Command Timeout Pass 52 (2026-06-02)

**Branch:** `fix/display-realtime-timeouts-pass-52`

**Why now:** PR #191 merged with green CI, but production deployment remains
blocked by dirty/diverged prod state. The next performance/reliability gap is
bounded middleware request time for realtime command handoffs: DisplaysService
and FleetService call the realtime gateway through Axios without an explicit
timeout, while adjacent realtime paths already use bounded timeouts and the
realtime gateway's ACK-backed delivery contract waits up to 10s.

**New primitives introduced:** none. This pass reuses the existing
`HttpService`, circuit-breaker/fallback paths, internal realtime endpoints, and
NestJS service methods. No new route, model, migration, module, env var,
process, response shape, realtime event, MCP tool, Hermes skill, or AI/provider
spend path.

**Hermes-first analysis:** checked per project convention. This is local
middleware service-to-service timeout hardening, not a business-agent, MCP,
Hermes runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Realtime command HTTP timeout | none applicable | reuse existing Axios `timeout` option above the gateway ACK window |
| Circuit-breaker fallback | none applicable | preserve existing `CircuitBreakerService` path |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
NestJS Axios timeout configuration on Vizora's realtime gateway handoffs.

**Plan**
- [x] Add focused red tests that assert realtime HTTP handoffs include a bounded timeout.
- [x] Patch DisplaysService realtime calls with shared timeout config.
- [x] Patch FleetService gateway broadcast calls with the same timeout.
- [x] Run focused middleware tests.
- [x] Run multi-vector diff review.
- [x] Run broader middleware verification.
- [x] PR, CI, and merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Current `origin/main`: `c75643b89686e4729a7dca2a1e5abc2a1071ec91`.
- Drift evidence:
  - `DisplaysService` had timeout-less `HttpService.post` calls for playlist
    update notification, direct content push, screenshot request, and
    enable/disable display commands.
  - `FleetService` had a timeout-less broadcast call to
    `/api/commands/broadcast`.
  - Adjacent realtime paths already use bounded Axios calls:
    `PlaylistsService` uses `timeout: 5000`, and notification broadcast uses
    `timeout: 3000`; realtime gateway ACK-backed device delivery waits up to
    10s.
- Red focused run:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/displays.service.spec.ts src/modules/fleet/fleet.service.spec.ts`
    failed on 6 expected assertions because realtime handoff options lacked a
    bounded timeout.
- Fix:
  - Added `REALTIME_HTTP_TIMEOUT_MS = 15000` in DisplaysService and FleetService
    so middleware waits longer than the gateway's 10s ACK window while still
    bounding broken realtime calls.
  - Passed the timeout through existing Axios calls without changing routes,
    payloads, auth headers, response handling, or circuit-breaker names.
- Green focused run:
  - Same command => 2 suites / 74 tests passing.
- Review:
  - Realtime/circuit reviewer initially found a high-risk timeout-contract
    mismatch: a 5s middleware timeout would preempt the realtime gateway's
    10s ACK-backed delivery window and could falsely fail delivered commands.
    Fixed by raising the shared timeout to 15s; final re-review returned CLEAN.
  - Test/release reviewer returned CLEAN after independently re-running the
    focused tests, middleware type-check, full middleware suite, and diff check.
- Broader verification:
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` =>
    passing.
  - `pnpm --filter @vizora/middleware test -- --runInBand` => 148 suites /
    3028 tests passing.
  - `npx nx build @vizora/middleware` => passing, with existing webpack/Nx
    warnings only.
  - `pnpm security:no-hardcoded-jwts` => passing.
  - `git diff --check` => exit 0, with only LF/CRLF normalization warnings for
    `tasks/todo.md`.
- PR / CI / merge:
  - PR #192: `https://github.com/Trivenidigital/Vizora/pull/192`.
  - Squash merge commit: `680b7a6f161248f26ee2aae123dcbdc0f6b36ce2`.
  - CI green: audit 25s, lint 35s, security 24s, build 1m26s, test 4m17s,
    e2e 8m53s.
- Deploy gate:
  - Not deployed. Read-only production check showed prod at
    `bb76aa1838740bff5b58623dfef7a906d44f46a6`, remote main at
    `680b7a6f161248f26ee2aae123dcbdc0f6b36ce2`, 72 dirty/untracked paths, and
    branch state `ahead 17, behind 164`.
  - Core PM2 services were online, but `/api/v1/health/ready` was degraded on
    the existing memory check. No pull/restart/deploy was performed.

## Completed Workstream: Dashboard Settings Trust Pass 51 (2026-06-02)

**Branch:** `fix/customer-dashboard-settings-pass-51`

**Why now:** PR #190 merged with green CI, but production deployment remains
blocked by dirty/diverged prod state. The next customer-visible dashboard gap is
small, buildable, and testable: the main Settings page renders the signed-in
admin email as an editable organization field even though neither the
organization API nor the profile API persists email changes.

**New primitives introduced:** none. This pass reuses the existing Settings page
and existing organization/profile API clients. No new route, model, migration,
module, env var, process, response shape, realtime event, MCP tool, Hermes
skill, or AI/provider spend path.

**Hermes-first analysis:** checked per project convention. This is local
dashboard UI/API-truth alignment, not a business-agent, MCP, Hermes runtime, or
provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard settings UI | none applicable | update existing Settings page |
| Account email mutation | none applicable | do not add without verification-email policy |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
React settings-form affordance alignment.

**Plan**
- [x] Add focused Settings page regression coverage for the admin email field.
- [x] Prove the regression test fails on current main.
- [x] Patch the field so it is honest/read-only and the save payload remains org-scoped.
- [x] Run focused web verification.
- [x] Run multi-vector diff review.
- [x] Run broader verification.
- [x] PR, CI, and merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Current `origin/main`: `b07f8e671d680aff389a4dc80c398963bc39773e`.
- Red focused regression:
  - `pnpm test --runInBand src/app/dashboard/settings/__tests__/settings-page-source.test.ts`
    initially failed because the `Admin Email` block was editable, had no
    `readOnly`, and carried an unsupported `onChange`.
- Fix:
  - Settings now renders the current signed-in account email as `Account Email`,
    read-only, labeled with `htmlFor` / `id`, and described with
    `aria-describedby`.
  - Removed the fake `admin@vizora.com` fallback while the current user is still
    loading or unavailable.
  - Organization settings save remains scoped to organization fields and does
    not send `email`.
- Review:
  - Customer UX/API-truth reviewer first found a medium accessibility labeling
    issue plus low copy/fallback issues. Fixed all three; final re-review
    returned CLEAN.
  - Test/release reviewer first reported the new test was untracked and saw a
    stale red guard while the label was being changed. Current re-review
    returned CLEAN after the guard used `Account Email`.
- Verification:
  - Focused guard:
    `pnpm test --runInBand src/app/dashboard/settings/__tests__/settings-page-source.test.ts`
    => 1 suite / 2 tests passing.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` => passing.
  - Full web suite: `pnpm test --runInBand` from `web/`
    => 105 suites / 1107 tests passing, with existing React `act(...)`
    warnings.
  - Production-like web build with public URLs set to `https://vizora.cloud`:
    `npx nx build @vizora/web` => passing, with existing Nx/Next warnings.
  - `git diff --check` => exit 0, with only LF/CRLF normalization warnings.
- CI result on PR #191:
  - audit pass 29s
  - lint pass 35s
  - security pass 33s
  - build pass 1m30s
  - test pass 4m27s
  - e2e pass 8m52s
- PR #191 merged to `origin/main` at
  `c75643b89686e4729a7dca2a1e5abc2a1071ec91`.
- Post-merge production deploy gate remained blocked: prod HEAD is still
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, remote main is
  `c75643b89686e4729a7dca2a1e5abc2a1071ec91`, `/opt/vizora/app` has
  72 dirty/untracked paths and is `ahead 17, behind 164`. No production pull,
  restart, or deploy was performed.

## Completed Workstream: Release Readiness Gates Pass 50 (2026-06-02)

**Branch:** `fix/release-readiness-gates-pass-50`

**Why now:** PR #189 merged with green CI, but the next buildable
customer-readiness gap is release-gate drift: the operator smoke script and
first-customer runbook still use the stale realtime `/api/health` path, and CI
builds the web dashboard without running the web unit-test suite in the test
job. These are small repo-side fixes that reduce fake-green launch evidence.

**New primitives introduced:** none. This pass changes existing CI, smoke, and
runbook surfaces only. No new route, model, migration, module, env var,
process, response shape, realtime event, MCP tool, Hermes skill, or AI/provider
spend path.

**Hermes-first analysis:** checked per project convention. This is local
release-gate alignment, not a business-agent, MCP, Hermes runtime, or
provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| CI test gating | none applicable | update existing GitHub Actions workflow |
| Smoke health endpoint | none applicable | update existing smoke script |
| Operator runbook | none applicable | update existing runbook |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
GitHub Actions coverage or shell smoke endpoint alignment.

**Plan/design:**
`docs/plans/2026-06-02-release-readiness-gates-pass-50.md`

**Plan**
- [x] Add static regression coverage for release-readiness gates.
- [x] Prove the regression test fails on current main.
- [x] Patch smoke script, runbook, and CI workflow.
- [x] Run focused static/ops verification.
- [x] Run multi-vector diff review.
- [x] Run broader verification, including the newly gated web unit tests.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Current `origin/main`: `f524b6b0eb6a70a7fad7ea3241939a69709d02dc`.
- Red regression run:
  - `node --import tsx --test scripts/ops/release-readiness-gates.test.ts`
    failed on all three intended assertions: smoke realtime path, runbook
    realtime path, and missing CI web unit-test gate.
- Review:
  - Operator/runbook reviewer returned CLEAN: localhost realtime `/health`
    matches the documented production ingress model, and tracker wording does
    not overclaim deployment.
  - Release/CI reviewer first found a medium issue: the static CI guard matched
    the web unit-test step anywhere in the workflow, not specifically in the
    `test` job. Fixed by extracting the CI `test` job block before assertion.
  - Release/CI re-review returned CLEAN after the static guard hardening.
  - Production CSP/security reviewer found a medium issue in the initial
    CI-env fix: explicit empty API/socket overrides would have masked production
    env drift. Fixed at the helper level and added loopback-origin rejection;
    re-review returned CLEAN.
  - CI/build-env reviewer found a high issue after adding loopback rejection:
    workflow-level localhost public URLs would fail the web build. Fixed by
    overriding `Build web` with non-loopback public origins and adding static
    coverage; re-review returned CLEAN.
- Verification:
  - `node --import tsx --test scripts/ops/release-readiness-gates.test.ts`
    => 4 tests passing.
  - `pnpm test:ops` => 9 tests passing.
  - `pnpm test --runInBand next.config.security.test.js` from `web/`
    => 1 suite / 6 tests passing.
  - CI-style focused reproduction with localhost public env and
    `pnpm test --runInBand next.config.security.test.js` from `web/`
    => 1 suite / 6 tests passing.
  - `bash -n scripts/smoke/api-critical-path.sh` => passing.
  - `pnpm security:no-hardcoded-jwts` => passing.
  - `git diff --check` => exit 0 with only CRLF normalization warnings.
  - `pnpm test --runInBand` from `web/`
    => 104 suites / 1105 tests passing, with existing React `act(...)`
    warnings in several suites.
  - `npx nx build @vizora/web` with production-like public origins
    (`https://vizora.cloud`) => passing.
- CI result on PR #190:
  - First run failed in the newly added web unit-test step. Root cause: on the
    Linux runner with `working-directory: web`, `pnpm test -- --runInBand`
    invoked `jest -- --runInBand`, so Jest treated `--runInBand` as a test
    path pattern and found no tests.
  - Fixed by changing the CI step and static guard to the workspace-local
    command `pnpm test --runInBand`.
  - Second run reached the web suite and failed `next.config.security.test.js`
    because CI's top-level localhost `NEXT_PUBLIC_API_URL` /
    `NEXT_PUBLIC_SOCKET_URL` leaked into production CSP unit-test scenarios.
    Root cause: `buildSecurityHeaderRoutes()` passed explicit `undefined`
    values into `parseOriginSafe()`, whose default parameter then fell back to
    ambient `process.env`. Fixed at the helper level so a supplied env object is
    self-contained.
  - Added a production-readiness guard so `NEXT_PUBLIC_API_URL` and
    `NEXT_PUBLIC_SOCKET_URL` cannot use localhost/loopback origins in
    production CSP generation.
  - CI/env reviewer found the new production loopback guard would fail the web
    build job because workflow-level public URLs are localhost. Fixed by
    overriding the `Build web` step to production-like non-loopback public
    origins and adding static coverage for that override.
  - Local reproduction after fix:
    `NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 pnpm test --runInBand next.config.security.test.js`
    => 1 suite / 6 tests passing.
  - `npx nx build @vizora/web` with
    `NEXT_PUBLIC_API_URL=https://vizora.cloud`,
    `NEXT_PUBLIC_SOCKET_URL=https://vizora.cloud`, and
    `BACKEND_URL=https://vizora.cloud` => passing.

## Completed Workstream: Readiness Memory Calibration Pass 49 (2026-06-02)

**Branch:** `feat/customer-dashboard-perf-pass-49`

**Why now:** PR #188 is merged with green CI and no open PRs remain, but
production deployment remains blocked by dirty/diverged prod state. The latest
prod gate shows `/api/v1/health/ready` degraded only because V8 heap usage is
98.2% at a small absolute size (`152MB / 155MB`) while RSS is `389MB`, below
the existing 512 MB middleware PM2/ops budget. This creates a false deploy and
customer trust signal.

**New primitives introduced:** none. This pass reuses the existing
`HealthService` memory check and the existing PM2/health-guardian 512 MB
middleware memory budget. No new route, model, migration, module, env var,
process, response shape, realtime path, MCP tool, Hermes skill, or AI/provider
spend path.

**Hermes-first analysis:** checked per project convention. This is local NestJS
health/readiness calibration, not a business-agent, MCP, Hermes runtime, or
provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Health memory calibration | none applicable | reuse existing `HealthService` |
| Ops memory budget | none applicable | align with existing PM2/health-guardian budget |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
NestJS readiness memory thresholds.

**Plan/design:**
`docs/plans/2026-06-02-readiness-memory-calibration-pass-49.md`

**Plan**
- [x] Add red health-service coverage for the production false-positive memory
  case.
- [x] Add red health-service coverage for real RSS pressure.
- [x] Add red health-service coverage for large saturated heap pressure.
- [x] Implement calibrated memory thresholds.
- [x] Run focused health tests.
- [x] Run multi-vector diff review.
- [x] Run broader middleware verification and build.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Current `origin/main`: `6025c49d794a00297f1caaf4b4d451a0994b55d1`.
- No open PRs after merging PR #188.
- Production deploy gate remains blocked: `/opt/vizora/app` is still dirty with
  72 dirty/untracked paths; production HEAD is
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, while remote main is
  `6025c49d794a00297f1caaf4b4d451a0994b55d1`.
- Production runtime: middleware/web/realtime are online; most ops/Hermes cron
  processes are stopped. `/api/v1/health` and `/api/v1/health/live` return OK.
  `/api/v1/health/ready` is degraded by memory only
  (`heapUsedMB=152`, `heapTotalMB=155`, `heapUsagePercent=98.2`,
  `rssMB=389`).
- Red/green verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/health/health.service.spec.ts`
    failed before implementation on the small saturated heap case and RSS
    pressure cases.
  - Same command passed after implementation: 1 suite / 26 tests.
- Review:
  - Health/ops/runtime reviewer returned CLEAN: the 512 MB budget matches
    `ecosystem.config.js` and `scripts/ops/health-guardian.ts`, real RSS
    pressure still surfaces, public readiness semantics are unchanged, and no
    operator-gated assumption was introduced.
  - Code/test/release reviewer returned CLEAN: threshold math, tests, public
    response shape, TypeScript, and release-safety evidence were clean.
- Full verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/health/health.service.spec.ts src/modules/health/health.controller.spec.ts`
    => 2 suites / 37 tests passing.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
    => passing.
  - Changed-file ESLint => passing with only the existing eslintrc deprecation
    warning.
  - `pnpm security:no-hardcoded-jwts` => passing.
  - `git diff --check` => passing with CRLF normalization warnings.
  - `pnpm --filter @vizora/middleware test -- --runInBand`
    => 148 suites / 3027 tests passing / 1 snapshot.
  - `npx nx build @vizora/middleware` => passing with existing webpack
    warnings.
- PR #189 merged to `origin/main` at
  `f524b6b0eb6a70a7fad7ea3241939a69709d02dc`; CI was green including e2e.
- Post-merge production deploy gate remained blocked because `/opt/vizora/app`
  is dirty/diverged from `origin/main`; no production pull, restart, or deploy
  was performed.
- Deferred follow-up candidates from parallel analysis:
  - Release-readiness gate drift: smoke script's realtime probe still uses a
    stale path and CI builds web without running web unit tests.
  - Dashboard trust: settings admin email appears editable but is not persisted;
    widgets failures can look like an empty account; playlists list may eagerly
    fetch content for an unreachable builder.
  - Middleware hot paths: add realtime HTTP timeouts from `DisplaysService`,
    align playlist update duplicate-content handling with create, and gate very
    short content searches.

## Active Workstream: Dashboard Write Gates and Layout Create Pass 48 (2026-06-02)

**Branch:** `fix/dashboard-write-gates-layout-pass-48`

**Why now:** PR #187 is merged with green CI and no PRs remain open, but
production deploy remains blocked by dirty/diverged production state. The next
customer-dashboard findings are small, repo-side, testable regressions:
dashboard-adjacent write routes miss the existing subscription-active guard,
and normal dashboard layout creation can fail because the frontend omits
server-owned preset zones.

**New primitives introduced:** none. This pass reuses the existing
`@RequiresSubscription()` decorator / `SubscriptionActiveGuard` and the existing
`LAYOUT_PRESETS` table. No new route, model, migration, module, env var,
process, response shape, realtime path, MCP tool, Hermes skill, or AI/provider
spend path.

**Hermes-first analysis:** checked per project convention. This is local
NestJS controller authorization and layout DTO/service contract repair, not a
business-agent, MCP, Hermes runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard write gating | none applicable | reuse existing billing guard decorator |
| Layout preset materialization | none applicable | reuse existing `LAYOUT_PRESETS` |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
NestJS guard metadata or preset-backed layout creation.

**Plan/design:**
`docs/plans/2026-06-02-dashboard-write-gates-layout-pass-48.md`

**Plan**
- [x] Drift-check current guard/decorator usage and dashboard layout payloads.
- [x] Document pass 48 design and test plan.
- [x] Add guard metadata regression coverage for newly gated mutating handlers.
- [x] Add executable guard-resolution coverage for display-group/folder modules.
- [x] Add service regression coverage for preset-based layout creation without
  zones.
- [x] Add dashboard regressions for server-shaped presets and metadata-backed
  saved-layout/editor loads.
- [x] Patch controllers, modules, layout DTO, layout creation service, and
  dashboard normalization.
- [x] Run focused middleware/web tests.
- [x] Run multi-vector subagent diff review.
- [x] Run broader middleware verification and build.
- [ ] PR, CI, merge if green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Current `origin/main`: `913ed1b0661209858f45f1b034daac3c695de942`.
- No open PRs after merging PR #187.
- Production deploy gate remains blocked: `/opt/vizora/app` is
  `main...origin/main [ahead 17, behind 164]` with 72 dirty/untracked paths;
  middleware/web/realtime are online, `/api/v1/health` is 200, and readiness is
  degraded by high middleware heap memory.
- Focused verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/billing/subscription-write-gates.spec.ts src/modules/content/content.service.spec.ts`
    => 2 suites / 151 tests passing.
  - `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/layouts/__tests__/layouts-page.test.tsx src/app/dashboard/layouts/[id]/__tests__/layout-editor-page.test.tsx`
    => 2 suites / 13 tests passing; existing React `act()` warnings remain in
    the older layouts page tests.
- Targeted controller slice:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/content/controllers/layouts.controller.spec.ts src/modules/content/controllers/templates.controller.spec.ts src/modules/content/controllers/widgets.controller.spec.ts src/modules/content/controllers/bulk-operations.controller.spec.ts src/modules/display-groups/display-groups.controller.spec.ts src/modules/folders/folders.controller.spec.ts src/modules/billing/subscription-write-gates.spec.ts`
    => 7 suites / 149 tests passing.
- Full verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand`
    => 148 suites / 3023 tests passing / 1 snapshot.
  - `pnpm --filter @vizora/web test -- --runInBand`
    => 104 suites / 1103 tests passing; existing React `act()` warnings remain
    in older unrelated tests.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
    => passing.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
    => passing.
  - Changed-file ESLint => 0 errors / 19 warnings, mostly existing `any`
    warnings plus existing unused `idx` in the layout editor.
  - `git diff --check` => passing, with CRLF normalization warnings.
  - `npx nx build @vizora/middleware` => passing, with existing webpack
    warnings.
  - `npx nx build @vizora/web` with production env values => passing, with
    existing Next middleware/proxy warning.
  - `pnpm security:no-hardcoded-jwts` => passing.
- Review:
  - Plan/security reviewer found missing `BillingModule` imports for
    display-groups and folders; fixed and covered with executable guard
    resolution tests.
  - Plan/layout reviewer found backend `layoutType`/metadata shape drift
    against the dashboard; fixed with list/editor normalization and tests.
  - Diff security/module reviewer returned CLEAN after focused tests and
    `git diff --check`.
  - Diff layout reviewer found saved-layout list normalization was still
    incomplete; fixed with metadata-backed saved-layout coverage.
  - Follow-up layout reviewer returned CLEAN.

## Completed: Pairing Active Index Pass 47 (2026-06-02)

**Branch:** `feat/dashboard-customer-readiness-pass-47`

**Why now:** PR #186 is merged and no PRs remain open, but deployment remains
blocked by dirty/diverged production state. The remaining verified
customer-critical performance gap in the active worktree is pairing-list
scalability: `PairingService.getActivePairings()` still scans every `pairing:*`
Redis key for every dashboard org request. Recent stale-review candidates
around media streaming, random health telemetry, and hard-coded dashboard health
do not reproduce on current `origin/main`.

**New primitives introduced:** one Redis sorted-set key prefix inside the
existing pairing service: `pairing-active-org:{organizationId}` with pairing
codes scored by expiry and a five-minute sliding TTL. No new route, model,
migration, module, env var, process, response shape, realtime path, MCP tool,
Hermes skill, or AI/provider spend path.

**Hermes-first analysis:** checked per project convention. This is local
NestJS/Redis request-serving performance, not a business-agent, MCP, Hermes
runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard pairing Redis index | none applicable | build in existing `PairingService` |
| Pairing tenant visibility | none applicable | preserve existing service-level visibility rules |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
an in-process NestJS Redis index on the dashboard pairing hot path.

**Plan/design:**
`docs/plans/2026-06-02-pairing-active-index-pass-47.md`

**Plan**
- [x] Add red pairing service coverage proving active-list uses the org-specific
  active zset instead of Redis `SCAN`.
- [x] Add red pairing service coverage proving completed indexed pairings are
  removed/hidden.
- [x] Implement pairing active-index helpers and request/completion cleanup.
- [x] Run focused pairing tests.
- [x] Run multi-vector subagent diff review.
- [x] Run broader middleware verification and build.
- [x] PR, CI, merge if green. PR #187 merged to `origin/main` at
  `913ed1b0661209858f45f1b034daac3c695de942`.
- [x] Re-check deployment gate; deploy only if prod checkout is safe. Gate
  remains blocked by dirty/diverged production checkout.

**Evidence so far**
- Current `origin/main` merge SHA after Pass 47: `913ed1b0661209858f45f1b034daac3c695de942`.
- No open PRs after merging PR #186.
- PR #187: https://github.com/Trivenidigital/Vizora/pull/187.
- Feature commit: `71fdcb723409c8b2590829da24fc0328e7e64c11`.
- Production deploy gate remains blocked: `/opt/vizora/app` is `main...origin/main [ahead 17, behind 164]` with 72 dirty/untracked paths; readiness is degraded by high middleware memory.
- Stale subagent findings were traced to reviewers inspecting `C:\projects\vizora`
  instead of the active isolated worktree. `tasks/lessons.md` now captures the
  worktree-verification rule.
- Focused pairing service test is green:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/displays/pairing.service.spec.ts`
  => 42/42 passing.
- Diff review is CLEAN from both tenant/security and performance/regression
  subagents after the revised zset design.
- Verification:
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` => pass.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/displays/pairing.service.spec.ts middleware/src/modules/displays/pairing.controller.spec.ts`
    => 54/54 passing.
  - `npx nx build @vizora/middleware` => pass with existing webpack warnings.
  - `pnpm --filter @vizora/middleware test -- --runInBand` => 147 suites /
    2993 tests passing.
  - Root `pnpm lint` is not Windows-compatible (`ESLINT_USE_FLAT_CONFIG=...`);
    PowerShell-equivalent `$env:ESLINT_USE_FLAT_CONFIG='false'; npx eslint --ext .ts,.tsx middleware/src realtime/src`
    => pass with warnings only.
  - `pnpm security:no-hardcoded-jwts` => pass.
  - CI-gated middleware E2E subset:
    `pnpm --filter @vizora/middleware exec jest --config=jest.e2e.config.js --runInBand --testPathPattern="(agents|customer-critical-path)"`
    => 2 suites / 4 tests passing.
  - PR #187 CI passed lint, audit, test, build, security, and e2e before
    merge.

## Completed: Backend Heartbeat and Notification Scoping Pass 46 (2026-06-02)

**Branch:** `fix/backend-heartbeat-notifications-pass-46`

**PR:** #186

**Commit:** `5c76f374a77c02da192f81c09a41b2a8cf798d3c`

**Merge SHA:** `4eef5d5a51afea83a660195d6f374e741a554434`

**CI:** Green - audit, build, e2e, lint, security, and test.

**Deploy:** Not deployed. Production checkout remains dirty/diverged and unsafe
for automated pull/reload; middleware readiness is degraded by high memory.

**Why now:** Pass 45 is merged and deployment remains blocked by dirty/diverged
production state. The highest-value buildable backend defects from the
customer-readiness review are both local, testable, and customer-visible:
device REST heartbeats can miss the row because the controller verifies a
display id while the service queries by `deviceIdentifier`, personal
notifications are not scoped to the current user on list/count/read/dismiss
paths, and targeted `notification:new` events can still leak live through the
realtime org room.

**New primitives introduced:** none. Reuse existing device JWT verification,
DisplaysService heartbeat status-transition behavior, NotificationsService,
Notification model, response envelope, and `/api/v1` routing.

**Hermes-first analysis:** checked per project convention. These are local
middleware identity/tenant-boundary fixes, not business-agent, MCP, Hermes
runtime, or AI/provider-spend tasks.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| REST display heartbeat identity semantics | none found | build in existing displays controller/service path |
| Notification user visibility and mutation scoping | none found | build in existing notifications controller/service path |
| Targeted realtime notification delivery | none found | build in existing Socket.IO org-room delivery path |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
NestJS route identity alignment, local Prisma notification filters, or
Socket.IO room filtering; proceed with Vizora-native code.

**Plan/design:**
`docs/plans/2026-06-02-backend-heartbeat-notifications-pass-46.md`

**Plan**
- [x] Add red display service coverage for id/deviceIdentifier mismatch.
- [x] Add red display service coverage for verified-token write-site races.
- [x] Add red notification service coverage for user visibility and dismissed
  filtering before pagination/mutation.
- [x] Add red notification controller coverage for forwarding current user id.
- [x] Implement heartbeat id alignment and notification user scoping.
- [x] Add red realtime coverage for targeted notification delivery.
- [x] Implement targeted realtime delivery.
- [x] Run focused middleware/realtime tests.
- [x] Run multi-vector subagent diff review.
- [x] Run broader middleware/realtime verification and build.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Red middleware verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/displays/displays.service.spec.ts middleware/src/modules/displays/displays.controller.spec.ts middleware/src/modules/notifications/notifications.service.spec.ts middleware/src/modules/notifications/notifications.controller.spec.ts`
  failed as expected because heartbeat still queried `deviceIdentifier` and
  notification methods still treated the new `userId` argument as the old
  filters/id argument.
- Focused middleware green verification: same command passed 4 suites / 118
  tests after implementation.
- Red realtime verification:
  `pnpm --filter @vizora/realtime test -- --runInBand realtime/src/gateways/device.gateway.spec.ts`
  failed as expected because sibling dashboard sockets received targeted
  `notification:new` events.
- Focused realtime green verification: same command passed 1 suite / 103 tests
  after targeted delivery filtering.
- Security review finding fixed: reviewer identified that heartbeat verification
  and heartbeat update were separate database operations. The controller now
  passes the verified device `organizationId` and token hash into
  `DisplaysService.updateHeartbeat()`, and the service update predicate includes
  `id`, `organizationId`, `isDisabled: false`, and `jwtToken`. If that predicate
  no longer matches, the service rejects the heartbeat and does not emit
  `device.online`.
- Review-fix verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/displays/displays.service.spec.ts middleware/src/modules/displays/displays.controller.spec.ts`
  passed 2 suites / 69 tests.
- Post-review focused verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/displays/displays.service.spec.ts middleware/src/modules/displays/displays.controller.spec.ts middleware/src/modules/notifications/notifications.service.spec.ts middleware/src/modules/notifications/notifications.controller.spec.ts`
  passed 4 suites / 119 tests.
- Post-review focused realtime verification:
  `pnpm --filter @vizora/realtime test -- --runInBand realtime/src/gateways/device.gateway.spec.ts`
  passed 1 suite / 103 tests.
- Follow-up security review: CLEAN. Reviewer confirmed the heartbeat
  write-site race is closed, notification REST scoping is intact, and targeted
  realtime notification delivery skips sibling dashboards and device sockets.
- Broader verification:
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
    passed.
  - `pnpm --filter @vizora/realtime exec tsc --noEmit --project tsconfig.json --pretty false`
    passed.
  - `pnpm --filter @vizora/middleware test -- --runInBand` passed 147 suites /
    2990 tests.
  - `pnpm --filter @vizora/realtime test -- --runInBand` passed 12 suites /
    286 tests.
  - `pnpm --filter @vizora/web test -- --runInBand web/src/lib/hooks/__tests__/useNotifications.test.ts web/src/components/NotificationBell.test.tsx web/src/components/__tests__/NotificationBell.test.tsx`
    passed 3 suites / 16 tests with existing React `act(...)` warnings in
    `useNotifications.test.ts`.
  - Changed-file ESLint with `ESLINT_USE_FLAT_CONFIG=false` passed with 0
    errors. Existing warnings remain in touched realtime/test files and
    `notifications.service.ts`.
  - `npx nx build @vizora/realtime` passed with existing webpack/source-map
    warnings.
  - First `npx nx build @vizora/middleware` run failed in the shared
    `@vizora/database:build` copy step with a Windows file-lock `EPIPE` while
    middleware and realtime builds were running concurrently. Sequential rerun
    passed with existing webpack warnings.
  - `pnpm security:no-hardcoded-jwts` passed.

## Completed: Dashboard Upload Preflight Pass 45 (2026-06-02)

**Branch:** `feat/customer-dashboard-improvement-pass-45`

**PR:** #185

**Commit:** `e8f84d4553f6a9f40d09011ae8a32d103c5286a4`

**Merge SHA:** `1376aadf44adf7c54006e4d12bb8dea2fc4a06b5`

**CI:** Green - audit, build, e2e, lint, security, and test.

**Deploy:** Not deployed. Production checkout remains dirty/diverged and unsafe
for automated pull/reload; middleware readiness is degraded by high memory.

**Why now:** PRs #182-#184 are merged and no PRs remain open, but production
deploy is blocked by dirty/diverged prod state. The next buildable
customer-facing performance/trust slice is web-only: dashboard SSR already
fetches summary/storage/health/activity data but the client still auto-refreshes
on mount, and content uploads spend browser/server bandwidth before checking
known organization storage quota.

**New primitives introduced:** none. Reuse existing dashboard server prefetch,
existing `apiClient.getStorageInfo()`, existing content upload queue/progress
path, and existing web Jest suites.

**Hermes-first analysis:** checked per project convention. These are dashboard
hydration and browser upload-preflight behaviors, not business-agent, MCP,
Hermes runtime, or AI/provider-spend tasks.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard initial API refresh suppression | none found | build in existing `DashboardClient` |
| Browser upload quota preflight | none found | build in existing content upload UI using existing storage endpoint |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
React dashboard hydration fetch suppression or browser-side storage quota
preflight; proceed with Vizora-native code.

**Plan/design:**
`docs/plans/2026-06-02-dashboard-upload-preflight-pass-45.md`

**Plan**
- [x] Reconcile backlog/current-state and choose a repo-side web performance
  slice.
- [x] Add red dashboard tests for complete-SSR no-refresh and missing-data
  recovery.
- [x] Add red content upload tests for single and bulk quota preflight.
- [x] Implement dashboard refresh suppression and upload preflight.
- [x] Run focused web tests.
- [x] Run multi-vector subagent review.
- [x] Run broader web verification and build.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far**
- Red verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/app/dashboard/__tests__/dashboard-page.test.tsx web/src/app/dashboard/content/__tests__/content-page.test.tsx`
  failed as expected because complete server dashboard snapshots still triggered
  `getAnalyticsSummary()` on mount and queued uploads never called
  `getStorageInfo()` before starting XHR uploads.
- Focused green verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/app/dashboard/__tests__/dashboard-page.test.tsx web/src/app/dashboard/content/__tests__/content-page.test.tsx`
  passed 2 suites / 67 tests after implementation.
- Diff review finding fixed: both reviewers found the frontend treated
  `quotaBytes <= 0` as unlimited even though backend quota reservation rejects
  positive uploads against nonpositive quotas. The preflight now treats
  nonpositive quota as zero available bytes and keeps the queued files visible
  and retryable after blocking.
- Post-review focused verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/app/dashboard/__tests__/dashboard-page.test.tsx web/src/app/dashboard/content/__tests__/content-page.test.tsx`
  passed 2 suites / 68 tests. `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
  passed.
- Follow-up subagent review: CLEAN after the nonpositive-quota fix. Reviewer
  confirmed preflight semantics align with backend quota reservation, blocked
  queues remain visible/retryable, and incomplete dashboard snapshots still
  recover through `loadStats(false)`.
- Broader verification:
  - `pnpm --filter @vizora/web test -- --runInBand` passed 103 suites / 1100
    tests, with existing React `act(...)` and jsdom navigation warning noise in
    unrelated suites.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` passed.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint web/src/app/dashboard/page-client.tsx web/src/app/dashboard/content/page-client.tsx web/src/app/dashboard/__tests__/dashboard-page.test.tsx web/src/app/dashboard/content/__tests__/content-page.test.tsx`
    passed with 0 errors and existing `any` warnings in the touched dashboard
    files.
  - `pnpm security:no-hardcoded-jwts` passed.
  - `git diff --check` passed with Windows CRLF warnings only.
  - `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 pnpm --filter @vizora/web build`
    passed with existing Next middleware/proxy and TypeScript project-reference
    warnings.

**Queued next-pass findings**
- Backend/customer: REST heartbeat verifies `:deviceId` as display id but
  `DisplaysService.updateHeartbeat()` looks up by `deviceIdentifier`; add
  id/deviceIdentifier mismatch coverage and align the service/controller
  contract.
- Backend/security: notification list, read, dismiss, and read-all APIs need
  current-user scoping for user-targeted notifications and should filter
  `dismissedAt: null` before pagination.
- Release safety: CI lacks a web unit job and customer-critical Playwright
  smoke gate; security/audit gates are advisory in places.
- Release safety: deploy verification and Docker health checks still probe
  stale routes (`/templates`, `/devices`, `/api/health`, realtime `/health`)
  instead of current `/api/v1` routes/auth expectations.
- Admin trust: hard-coded admin backlog page is stale against `backlog.md`.

## Completed: CSRF + Pairing Authorization Pass 44 (2026-06-02)

**Branches:** `feat/customer-dashboard-improvement-pass-44`,
`fix/pass44-cleanup-evidence`

**PRs:** #182, #183

**Commits:** `04e2ee3`, `0f00862`, `6573eb9`

**Merge SHAs:** `14936c4fd37a1439871a246dd60e0f4e3c8d364b`,
`c1fe047411ee8f41d2ef484cacfe119cfbda735a`

**CI:** Green on both PRs - audit, build, e2e, lint, security, and test.

**Deploy:** Not deployed. Production checkout is dirty/diverged
(`ahead 17, behind 157`) and unsafe for automated pull/reload. Middleware and
web are reachable; realtime `/health` still returns 404, and middleware
detailed health is degraded by high memory usage.

**Why now:** Pass 44 customer/security/performance review found two high-value
repo-side gaps that are buildable and testable without operator actions:
existing CSRF middleware is not mounted in the Nest runtime, and device-pairing
completion is not protected by the same role/subscription/quota path as normal
display creation. The current dashboard also exposes the top-level pair flow to
viewers.

**New primitives introduced:** none. Reuse existing `CsrfMiddleware`,
`RolesGuard`, `@Roles`, `@RequiresSubscription`, existing screen-quota
semantics, dashboard permission helper, response envelope, and `/api/v1`
routing.

**Hermes-first analysis:** checked per project convention. These are local
dashboard/API authorization and runtime middleware wiring concerns, not
business-agent, MCP, provider-spend, or Hermes runtime tasks.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| CSRF runtime enforcement | none found | wire existing Nest middleware |
| Device-pairing role/subscription/quota checks | none found | reuse existing Vizora guards/decorators and quota semantics |
| Dashboard pairing UI gating | none found | reuse existing web permission helper |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
Nest CSRF middleware registration or local dashboard permission truth; proceed
with Vizora-native code.

**Plan/design:**
`docs/plans/2026-06-02-csrf-pairing-authorization-pass-44.md`

**Plan**
- [x] Run multi-vector customer/security/performance review and select scoped
  target.
- [x] Reconcile stale Pass 43 note: device row actions were gated, but top-level
  viewer pairing CTAs and backend complete-pairing guard gaps still exist.
- [x] Add red coverage for CSRF runtime wiring and pairing authorization/UI.
- [x] Implement CSRF middleware registration and pairing backend/frontend gates.
- [x] Run focused tests.
- [x] Run multi-vector code review.
- [x] Run broader local verification.
- [x] PR, CI, merge, and deployment gate.

**Evidence**
- Red verification:
  `pnpm --filter @vizora/middleware test -- --runInBand src/app/app.module.spec.ts src/modules/displays/pairing.controller.spec.ts`
  failed as expected because `AppModule.configure()` did not exist and
  `completePairing` had no roles/quota metadata.
- Red verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/lib/__tests__/permissions.test.ts web/src/app/dashboard/devices/__tests__/devices-page.test.tsx web/src/app/dashboard/devices/pair/__tests__/pair-device-page.test.tsx`
  failed as expected because the permission helper lacked `canPairDevices`,
  viewers still saw pair CTAs/actions, and the direct pair page rendered the
  pairing form for viewers.
- Focused green verification:
  `pnpm --filter @vizora/middleware test -- --runInBand src/app/app.module.spec.ts src/modules/displays/pairing.controller.spec.ts`
  passed 2 suites / 12 tests after implementation.
- Focused green verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/lib/__tests__/permissions.test.ts web/src/app/dashboard/devices/__tests__/devices-page.test.tsx web/src/app/dashboard/devices/pair/__tests__/pair-device-page.test.tsx`
  passed 3 suites / 25 tests after implementation.
- Review findings fixed:
  - CSRF now allows bearer-only service/mobile/API clients while still
    requiring CSRF when the Vizora auth cookie is present.
  - Pairing completion rejects Redis replay, rejects existing displays owned by
    another tenant, and enforces screen quota only when creating a new display.
  - Viewer pairing UI no longer exposes the direct form, QR deep-link success,
    empty-state CTA, or existing-device pair action.
- Focused review-fix verification:
  `pnpm --filter @vizora/middleware test -- --runInBand src/modules/common/middleware/csrf.middleware.spec.ts src/app/app.module.spec.ts src/modules/displays/pairing.controller.spec.ts src/modules/displays/pairing.service.spec.ts`
  passed 4 suites / 86 tests after adding concurrent pairing-claim and
  org-level new-display serialization coverage.
- Review audit findings fixed:
  - Pairing completion's Redis claim helpers were present but incomplete in the
    dead-session state; the service now rejects concurrent completion claims
    before display creation/update.
  - Completed pairing records carry the plaintext device-token handoff and are
    now suppressed from `getActivePairings()` dashboard list responses.
  - E2E browser-CSRF helpers strip stale CSRF cookies from auth-cookie bundles so
    duplicate CSRF cookies cannot make valid browser writes fail.
  - Backend clean-gate found quota enforcement was still raceable across two
    different new-device pairing codes for the same org; new-display pairing
    now takes an org-scoped Redis claim before quota check/create and releases
    it after the create/failure path.
  - Google auth endpoints are explicitly exempted from CSRF so raw OAuth POST
    callbacks are not gated by dashboard CSRF cookies.
- Latest focused quota-race verification:
  `pnpm --filter @vizora/middleware test -- --runInBand src/modules/displays/pairing.service.spec.ts`
  passed 1 suite / 39 tests, including org-level new-display serialization.
- Latest focused middleware verification:
  `pnpm --filter @vizora/middleware test -- --runInBand src/modules/common/middleware/csrf.middleware.spec.ts src/app/app.module.spec.ts src/modules/displays/pairing.controller.spec.ts src/modules/displays/pairing.service.spec.ts`
  passed 4 suites / 86 tests.
- Runtime E2E verification:
  `pnpm --filter @vizora/middleware test:e2e -- --runInBand --testPathPattern="customer-critical-path"`
  passed 1 suite / 3 tests, including missing-CSRF rejection, viewer pairing
  API rejection, and the scheduled playlist delivery path.
- Focused web verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/lib/__tests__/permissions.test.ts web/src/app/dashboard/devices/__tests__/devices-page.test.tsx web/src/app/dashboard/devices/pair/__tests__/pair-device-page.test.tsx`
  passed 3 suites / 27 tests.
- Broader verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand` passed 147 suites /
    2988 tests on the current worktree after the final lint cleanup.
  - `pnpm --filter @vizora/web test -- --runInBand` passed 103 suites / 1097
    tests, with existing React `act()` warning noise in unrelated suites.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
    passed.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` passed.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint middleware/src/modules/displays/pairing.service.ts middleware/src/modules/displays/pairing.service.spec.ts`
    passed with 0 errors / 0 warnings in touched TypeScript files; ESLint
    emitted its existing eslintrc deprecation warning.
  - `npx nx build @vizora/middleware` passed with the existing webpack warning
    class.
  - `pnpm security:no-hardcoded-jwts` passed.
  - `git diff --check` passed aside from existing CRLF conversion warnings.
  - Plain `npx nx build @vizora/web` failed before compilation because
    `NEXT_PUBLIC_SOCKET_URL` is intentionally required for production CSP.
    Rerun with local production URLs
    (`NEXT_PUBLIC_SOCKET_URL=http://localhost:3002`,
    `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`,
    `BACKEND_URL=http://localhost:3000`) passed.

**Deferred from Pass 44**
- Team/API-key admin-only UI truth.
- Settings admin-email read-only/copy cleanup.
- Content URL update SSRF validation.
- Realtime public health detail hardening.
- Dashboard duplicate refresh and `/analytics/summary` query consolidation.
- Upload quota preflight, short content-search gating, and deferred device-group
  fetch.

## Completed: Dashboard Role Truth Pass 43 (2026-06-02)

**Branch:** `feat/dashboard-role-truth-pass-43`

**PR:** #180

**Commit:** `22982ea`

**Merge SHA:** `b8d16aaa4c73297af8ea15a6b98443e196184f9c`

**CI:** Green - audit, build, e2e, lint, security, and test.

**Deploy:** Not deployed. Production checkout is dirty/diverged and unsafe for
automation.

**Why now:** Customer-dashboard review found high-trust UI gaps where read-only
users can see write workflows and support messages can disappear after a send
failure. Drift check shows device pairing is already role-gated; schedules and
support failed-send state remain concrete repo-side gaps.

**New primitives introduced:** `canManageSchedules` and `canDeleteSchedules`
on the existing dashboard permission helper; optional `clientMutationId` on
support requests/messages with scoped unique indexes. No env var, runtime
process, notification path, realtime substrate, MCP tool, Hermes skill,
provider spend path, or parallel infrastructure.

**Hermes-first analysis:** checked per project convention. These are local
dashboard role/state concerns, not agent-runtime tasks.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard role-based action gating | none found | build in existing web permission helper |
| Support chat failed-message state | none found | build in existing support chat provider/panel |
| Support retry idempotency | none found | build in existing support API/service with Prisma indexes |

Awesome-hermes-agent ecosystem check: no applicable runtime/library primitive
for React dashboard role gating or support-chat failure state; proceed with
Vizora-native code.

**Plan/design:**
`docs/plans/2026-06-02-dashboard-role-truth-pass-43.md`

**Plan**
- [x] Drift-check stale device pairing role finding.
- [x] Document scope and Hermes-first analysis.
- [x] Add red tests for schedule role truth and support failed sends.
- [x] Implement permission/helper and support state fixes.
- [x] Run focused and broader web verification.
- [x] Run multi-vector subagent review.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Scoped fixes**
- Schedules: viewers see read-only schedule information; create/edit/duplicate
  controls are admin/manager-only; delete is admin-only.
- Support chat: failed existing-message and new-conversation sends keep the
  customer text visible with an idempotent error/retry state instead of
  silently removing it.
- Release hygiene: realtime Docker builds generate Prisma in the builder stage,
  then copy the generated database package into the runtime image; Docker
  context ignores nested workspace `node_modules`.

**Evidence so far**
- Drift check: `web/src/app/dashboard/devices/page-client.tsx` already uses
  `getDashboardPermissions` and gates pairing/device mutation entry points, so
  the older viewer-pairing finding is stale.
- Backend schedule role truth: `SchedulesController` allows
  create/update/duplicate/conflict-check for admin/manager and delete for
  admin only.
- Red verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/lib/__tests__/permissions.test.ts web/src/app/dashboard/schedules/__tests__/schedules-page.test.tsx web/src/components/support/__tests__/SupportChat.test.tsx`
  failed as expected because schedule controls ignored role permissions, the
  shared dashboard permission helper lacked schedule flags, and failed support
  sends removed the optimistic customer message.
- Focused verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/lib/__tests__/permissions.test.ts web/src/app/dashboard/schedules/__tests__/schedules-page.test.tsx web/src/components/support/__tests__/SupportChat.test.tsx`
  passed 3 suites / 42 tests after implementation.
- Review findings fixed:
  - Schedule Duplicate now calls the existing backend duplicate endpoint
    instead of opening a prefilled create form.
  - Manager individual-device create is single-target, so it cannot need
    admin-only delete rollback after partial batch failure.
  - Support retries now carry a durable client mutation id through the web API,
    DTOs, service, Prisma schema, and migration.
- Review-fix verification:
  - `pnpm exec prisma generate --schema prisma/schema.prisma` from
    `packages/database` passed.
  - `pnpm --filter @vizora/web test -- --runInBand web/src/app/dashboard/schedules/__tests__/schedules-page.test.tsx web/src/components/support/__tests__/SupportChat.test.tsx`
    passed 2 suites / 43 tests.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/support/support.service.spec.ts middleware/src/modules/support/support.controller.spec.ts`
    passed 2 suites / 66 tests.
- Second review findings fixed:
  - Support request creation now writes the request and initial messages in one
    nested Prisma create, so a failed assistant-message write cannot leave a
    partial request.
  - Support message duplicate/race paths now re-read on `P2002` and reopen
    resolved/closed user tickets when the duplicate is the durable retry
    result.
  - Viewer schedule empty-state copy no longer invites create actions; admin
    delete and manager update paths have explicit test coverage.
  - Realtime Dockerfile no longer runs the dev-only Prisma CLI in the runtime
    stage, and `.dockerignore` excludes nested workspace `node_modules`.
- Broad local verification:
  - `pnpm --filter @vizora/web test -- --runInBand` passed 102 suites / 1092
    tests, with existing React `act()` console warnings in unrelated suites.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` passed.
  - `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 npx nx build @vizora/web --skip-nx-cache`
    passed with existing Next middleware/proxy and Nx flaky-task warnings.
  - `pnpm --filter @vizora/middleware test -- --runInBand` passed 146 suites /
    2975 tests.
  - `pnpm --filter @vizora/realtime test -- --runInBand` passed 12 suites /
    285 tests.
  - `git diff --check` passed with Windows CRLF warnings only.
  - `pnpm security:no-hardcoded-jwts` passed.
  - `docker build -f docker/Dockerfile.realtime -t vizora-realtime-pass43 .`
    now gets past Docker context loading but is blocked before project code by
    local Docker TLS trust (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` fetching pnpm);
    a minimal `node:22-alpine` package fetch has the same TLS failure. No
    insecure TLS bypass was added.
- Final subagent re-review:
  - Schedule/RBAC reviewer CLEAN after manager update, admin delete, and
    viewer empty-state tests.
  - Support idempotency reviewer CLEAN after nested create, `P2002` re-read,
    scoped unique indexes, and reopen-on-duplicate handling.
  - Release/Docker reviewer CLEAN after moving Prisma generation to the builder
    stage only and excluding nested workspace `node_modules` from Docker
    context.
- PR/CI/merge: PR #180 merged at
  `b8d16aaa4c73297af8ea15a6b98443e196184f9c`; audit, build, e2e, lint,
  security, and test passed.
- Deployment gate after merge: production remains on `main` at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, while `origin/main` is
  `b8d16aaa4c73297af8ea15a6b98443e196184f9c` (`ahead 17, behind 150`) with
  many tracked/untracked template, Hermes, public asset, and landing-page
  changes. Middleware and web responded, realtime `/health` still returns
  404. No deploy attempted.

## Completed: Customer Hot-Path Follow-up Pass 42 (2026-06-02)

**Branch:** `feat/customer-hotpath-followup-pass-42`

**PR:** #178

**Commits:** `f109579`, `151e3d5`

**Merge SHA:** `a89d200dffb7f56b230265ed673d06697a6d3fba`

**CI:** Green - audit, build, e2e, lint, security, and test.

**Deploy:** Not deployed. Production checkout is dirty/diverged and unsafe for
automation.

**Why now:** The Pass 41 merge hardened the web display client and public
readiness basics. The next coherent follow-up closes adjacent repo-side gaps:
Electron display clients should use the same no-video-preload policy, public
readiness should not expose dependency internals, missing object-storage wiring
should fail readiness, and post-header media stream failures need actionable
request context in logs.

**New primitives introduced:** one tiny Electron renderer preload-policy helper.
No schema, env var, runtime process, notification path, realtime substrate, MCP
tool, Hermes skill, provider spend path, or parallel infrastructure.

**Hermes-first analysis:** checked per project convention. These are in-repo
display/runtime-health/logging mechanics; no Hermes runtime skill is applicable.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Electron display preload policy | none found | build in existing display renderer |
| Public readiness response shaping | none found | build in existing NestJS health controller |
| Object-storage readiness requirement | none found | build in existing HealthService |
| Device media stream error context | none found | build in existing DeviceContentController |

Awesome-hermes-agent ecosystem check: no applicable runtime/library primitive
for Electron media preload policy, NestJS readiness shaping, or HTTP stream
error logging; proceed with Vizora-native code.

**Plan/design:**
`docs/plans/2026-06-02-customer-hotpath-followup-pass-42.md`

**Plan**
- [x] Preserve carried dirty work on a fresh branch from merged `origin/main`.
- [x] Document scope and Hermes-first analysis.
- [x] Run focused verification for display, health, and device-content changes.
- [x] Run build/hygiene verification.
- [x] Run multi-vector subagent re-review.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Scoped fixes**
- Electron display: centralize preload eligibility and skip video preloads so
  native playback/range streaming controls large files. Existing cached video
  paths are still usable, but video cache misses do not trigger background full
  downloads.
- Readiness: return a minimal public `/health/ready` payload instead of full
  dependency checks and mark missing storage wiring unhealthy.
- Device media streaming: include request id, content id, path, and response
  status when a stream fails after headers are sent.

**Evidence so far**
- Pass 41 merged as PR #177. Production deploy remains blocked because
  `/opt/vizora/app` is dirty/diverged and behind `origin/main`.
- Red verification:
  - `pnpm --filter @vizora/display test -- --runInBand src/renderer/preload-policy.spec.ts`
    initially failed because the preload-policy helper did not exist, then
    failed again on missing playback cache policy predicates before the video
    cache-miss download guard was added.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/device-content.controller.spec.ts --testNamePattern="log request context"`
    failed as expected because post-header stream errors only logged the stream
    error message.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/health/health.controller.spec.ts middleware/src/modules/health/health.service.spec.ts`
    failed as expected because public readiness exposed `checks` and missing
    storage wiring returned degraded.
- Focused verification:
  - `pnpm --filter @vizora/web test -- DisplayClient.test.tsx` passed 1 suite
    / 3 tests.
  - `pnpm --filter @vizora/display test -- --runInBand src/renderer/ids.spec.ts src/renderer/preload-policy.spec.ts`
    passed 2 suites / 8 tests.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/common/interceptors/logging.interceptor.spec.ts middleware/src/modules/content/device-content.controller.spec.ts middleware/src/modules/health/health.controller.spec.ts middleware/src/modules/health/health.service.spec.ts middleware/src/modules/playlists/playlists.service.spec.ts`
    passed 5 suites / 128 tests.
  - Reviewer-fix rerun:
    `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/device-content.controller.spec.ts`
    passed 1 suite / 41 tests, and
    `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/common/interceptors/logging.interceptor.spec.ts`
    passed 1 suite / 22 tests after the post-write stream-failure test was
    tightened.
- Broader local verification:
  - `pnpm --filter @vizora/display test -- --runInBand` passed 7 suites / 131
    tests, with existing console noise from older Electron tests.
  - `pnpm --filter @vizora/display typecheck` passed.
  - `pnpm --filter @vizora/display build` passed.
  - `npx nx build @vizora/middleware --skip-nx-cache` passed with existing
    webpack warnings and Nx flaky-task note for `@vizora/database:build`.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` passed.
  - `git diff --check` passed with Windows CRLF line-ending warnings only.
  - `pnpm security:no-hardcoded-jwts` passed.
- Subagent re-review:
  - Readiness/tenant reviewer CLEAN after public readiness sanitization and
    missing-storage readiness fixes.
  - Media reviewer first found Electron `preloadContent()` still allowed video
    downloads; fixed with image-only preload policy.
  - Final media reviewer then found playback cache-miss still background
    downloaded videos; fixed with separate read-vs-download cache policy.
  - Final narrow media re-review CLEAN after the second Electron cache fix.
  - Stream-logging reviewer found the post-header stream failure regression
    test was artificially forcing `headersSent=true`; fixed by making the mock
    response mark headers sent on an actual write, writing a partial chunk
    before stream failure, and asserting the `(status=200)` log suffix. Final
    re-review CLEAN.
- PR/CI/merge: PR #178 merged at
  `a89d200dffb7f56b230265ed673d06697a6d3fba`; audit, build, e2e, lint,
  security, and test passed.
- Deployment gate after merge: production remains on
  `bb76aa1838740bff5b58623dfef7a906d44f46a6` while remote main is
  `a89d200dffb7f56b230265ed673d06697a6d3fba`; prod status is
  `ahead 17, behind 146` with tracked and untracked files. Middleware/web are
  HTTP 200; realtime `/health` is HTTP 404. No deploy or restart attempted.

## Completed: Customer Readiness Hot-Path Pass 41 (2026-06-02)

**Branch:** `feat/customer-dashboard-performance-pass-41`

**PR:** #177

**Commit:** `fbc2ae0`

**Merge SHA:** `4db861dd1124a68dbed52bc0a0b059086b490e2f`

**CI:** Green - audit, build, e2e, lint, security, and test.

**Deploy:** Not deployed. Production checkout is dirty/diverged and unsafe for
automation.

**Why now:** The customer/performance analysis lanes found several repo-side
production-readiness issues. The first buildable slice should harden the
customer-1 hot paths that are small enough to verify in one PR: display media
prefetching, streaming-route logging, readiness semantics, and playlist
tenant-boundary fanout.

**New primitives introduced:** one logging skip metadata decorator on the
existing LoggingInterceptor. No schema, env var, runtime process, notification
path, realtime substrate, MCP tool, Hermes skill, provider spend path, or
parallel infrastructure.

**Hermes-first analysis:** checked per project convention. The Hermes Agent
Skills Hub currently reports no listed skills, and the awesome-hermes-agent
community index is informational rather than a runtime primitive for these
in-repo hot-path fixes.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Display playback cache policy | none found | build in Vizora display client |
| Middleware health/readiness | none found | build in existing NestJS health module |
| HTTP media-stream logging | none found | build in existing LoggingInterceptor |
| Playlist realtime fanout tenant scope | none found | build in existing playlist/realtime path |

Awesome-hermes-agent ecosystem check: no applicable runtime/library primitive
for display media caching, NestJS readiness, HTTP logging, or tenant-scoped
playlist fanout; proceed with Vizora-native code.

**Plan/design:**
`docs/plans/2026-06-02-customer-readiness-hotpath-pass-41.md`

**Plan**
- [x] Start fresh branch from merged `origin/main`.
- [x] Run multi-vector analysis lanes: customer UX, performance, backend
  security/readiness, and customer-critical tests.
- [x] Add red tests for scoped hot-path fixes.
- [x] Implement display/media/readiness/playlist fanout fixes.
- [x] Run focused verification.
- [x] Run broader verification.
- [x] Run multi-vector subagent re-review.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Scoped fixes**
- Display playback: preload image content only; do not full-fetch/cache video
  files before playback.
- Middleware logging: suppress normal and slow-request logs for successful
  device-content media streaming while preserving request IDs and error logs.
- Readiness: make public `/health/ready` fail when MinIO/storage is unhealthy
  and stop exposing detailed self-test failure messages on the public endpoint.
- Playlist fanout: scope display lookup for playlist-update push by
  `organizationId` so polluted display rows cannot receive cross-tenant
  playlist payloads.

**Backlog/customer-improvement findings to carry forward**
- P1 schedule role truth: viewers can currently open create/edit/delete
  schedule workflows.
- P1 support chat failure state: failed sends can disappear without a visible
  retry/error state.
- P2 device pairing role truth: viewer users see pairing entry points.
- P2 dashboard landing role truth: quick actions advertise write workflows to
  all roles.
- P2 settings email truth: editable admin email is not persisted by the save
  path.
- P2 team/API key admin gates: sensitive controls are visible to non-admins.
- P3 content push semantics: offline devices can be selected with unclear
  delivery expectations.
- Test gaps: strict browser upload, pairing, playlist/schedule, support, and
  fleet-command critical paths still need stronger Playwright/API smoke
  coverage.
- Performance backlog: dashboard all-page overfetch, playlist list payload
  bloat, output sanitization cost on large list responses, search indexes, and
  pairing Redis scan remain for follow-up passes.

**Evidence so far**
- PR #175 and #176 merged; no open PRs at the start of this pass.
- Production deploy remains blocked from prior probe: `/opt/vizora/app` is
  dirty/diverged and behind `origin/main`. No deploy will be attempted unless
  the checkout becomes safe.
- Red verification:
  - `pnpm --filter @vizora/web test -- DisplayClient.test.tsx` failed as
    expected because video device-content URLs were included in `preloadItems`.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/common/interceptors/logging.interceptor.spec.ts middleware/src/modules/health/health.controller.spec.ts middleware/src/modules/health/health.service.spec.ts middleware/src/modules/playlists/playlists.service.spec.ts`
    failed as expected because successful media streams were logged, MinIO
    outage was degraded, public readiness exposed `self_test_failures`, and
    playlist fanout queried displays without `organizationId`.
- Focused green verification:
  - `pnpm --filter @vizora/web test -- DisplayClient.test.tsx` passed 1 suite
    / 3 tests.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/common/interceptors/logging.interceptor.spec.ts middleware/src/modules/health/health.controller.spec.ts middleware/src/modules/health/health.service.spec.ts middleware/src/modules/playlists/playlists.service.spec.ts`
    passed 4 suites / 85 tests.
- Subagent re-review follow-up: reviewers found that media-stream logging also
  suppressed completed 4xx responses such as 416, and that the plan needed the
  mandatory Hermes-first table. Added a red test for completed 4xx media
  responses before narrowing the logging skip to 2xx/3xx successes.
- Reviewer-fix focused green:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/common/interceptors/logging.interceptor.spec.ts`
  passed 1 suite / 22 tests.
- Broader affected verification:
  - `pnpm --filter @vizora/web test -- src/app/display` passed 6 suites / 25
    tests.
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/device-content.controller.spec.ts middleware/src/modules/common/interceptors/logging.interceptor.spec.ts middleware/src/modules/health/health.controller.spec.ts middleware/src/modules/health/health.service.spec.ts middleware/src/modules/playlists/playlists.service.spec.ts`
    passed 5 suites / 126 tests.
- Build and hygiene verification:
  - `npx nx build @vizora/middleware --skip-nx-cache` passed with existing
    webpack warnings and Nx flaky-task note for `@vizora/database:build`.
  - `NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web --skip-nx-cache`
    passed with existing Next middleware/proxy and TypeScript project-reference
    warnings.
  - `git diff --check` passed with Windows CRLF line-ending warnings only.
  - `pnpm security:no-hardcoded-jwts` passed.
- Final subagent re-review: performance/regression reviewer CLEAN; security,
  architecture, readiness, and process reviewer CLEAN. No tenant/auth/readiness
  envelope or realtime-substrate drift found.
- PR/CI/merge: PR #177 merged at
  `4db861dd1124a68dbed52bc0a0b059086b490e2f`; audit, build, e2e, lint,
  security, and test passed.
- Deployment gate after merge: production remains on
  `bb76aa1838740bff5b58623dfef7a906d44f46a6` while remote main is
  `4db861dd1124a68dbed52bc0a0b059086b490e2f`; prod status is
  `ahead 17, behind 123` with tracked and untracked files. Middleware/web are
  online; public realtime `/health` probe returned no HTTP response. No deploy
  or restart attempted.

## Completed: Content MinIO Tenant Boundary Pass 40 (2026-06-02)

**Branch:** `feat/customer-performance-readiness`

**PR:** #175

**Commit:** `ddad81b`

**Merge SHA:** `591ab52395a8f3df758a785c223b97f678af5623`

**CI:** Green — lint, test, build, security, e2e, and Security Audit.

**Deploy:** Not deployed. Production checkout is dirty/diverged and unsafe for
automation.

**Why now:** Reviewer lane C found a high-severity storage tenant-boundary gap:
device content streaming guards MinIO object keys by organization prefix, but
dashboard download/delete paths can operate on any `minio://` key already
persisted on an org-owned content row.

**New primitives introduced:** one storage-module MinIO ownership helper. No
schema, env var, runtime process, realtime substrate, notification path, MCP
tool, Hermes skill, provider spend path, or parallel storage path.

**Hermes-first analysis:** not applicable. This is storage tenant-boundary
hardening inside existing NestJS content/storage services, not a business-agent,
MCP, Hermes, AI/provider, or spend-path change.

**Plan/design:**
`docs/plans/2026-06-02-content-minio-tenant-boundary-pass-40.md`

**Plan**
- [x] Start fresh branch from merged `origin/main`.
- [x] Run multi-vector review lanes for customer dashboard, performance, and
  architecture/security.
- [x] Verify the high-severity MinIO object-key finding against repo truth.
- [x] Add failing tests for foreign MinIO keys on download, thumbnail read,
  create/update persistence, single delete, and bulk delete.
- [x] Implement shared org-owned MinIO object-key helper and wire it through
  create/update/download/delete and org/account teardown cleanup paths.
- [x] Run focused verification.
- [x] Run broader verification.
- [x] Run subagent re-review before PR/merge.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence:**
- Final prod deploy gate remains blocked: `/opt/vizora/app` is on `main` at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, remote main is
  `591ab52395a8f3df758a785c223b97f678af5623`, and prod is dirty/diverged
  (`ahead 17, behind 123`) with tracked and untracked template/Hermes/public
  files. Middleware health returned OK, web returned HTTP 200, realtime
  `/health` returned HTTP 404. No deploy attempted.
- Reviewer lane C finding: `DeviceContentController` checks MinIO object keys
  start with `${organizationId}/`, while `ContentController.getDownloadUrl`,
  `ContentService.remove`, and `ContentService.bulkDelete` extract keys without
  that guard.
- Local verification: `CreateContentDto` allows `minio://...` by regex, while
  the controller's URL validator rejects non-HTTP(S) on JSON create; update and
  service-level callers still need a service-side boundary check.
- Red verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/content.service.spec.ts middleware/src/modules/content/content.controller.spec.ts`
  failed as expected before implementation: foreign MinIO keys were presigned,
  service create/update/remove did not reject with `BadRequestException`, and
  bulk delete called storage deletion for `other-org/secret.png`.
- Implementation: added `middleware/src/modules/storage/minio-object-key.ts`
  and wired it into content create/update, dashboard download URL generation,
  manual MinIO thumbnail reads, single delete, replacement cleanup, and bulk
  delete.
- Focused verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/content.service.spec.ts middleware/src/modules/content/content.controller.spec.ts`
  passed 2 suites / 163 tests after initial implementation.
- Diff review follow-up: replacement cleanup originally reused the strict
  ownership helper for the old URL, which blocked normal replacement of legacy
  polluted rows. Added a red regression proving
  `minio://other-org/... -> minio://org-123/...` simple replacement should
  repair the DB pointer without deleting the foreign object, plus positive
  same-org download, thumbnail read, and single-delete coverage.
- Review-fix verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/content.service.spec.ts middleware/src/modules/content/content.controller.spec.ts`
  passed 2 suites / 168 tests. The backup replacement path remains fail-closed
  for polluted old MinIO URLs so the bad pointer is not preserved in an
  archived backup row.
- Subagent re-review found two same-class teardown gaps outside content
  controller/service paths: organization deletion and sole-admin account
  deletion could derive storage delete keys from polluted content URLs and
  thumbnails. Added red tests, then moved the helper to the storage module and
  applied cleanup-safe org-prefix checks to both teardown paths.
- Reviewer-fix red verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/organizations/organizations.service.spec.ts middleware/src/modules/auth/auth.service.spec.ts`
  failed as expected before teardown fixes: organization cleanup deleted
  `other-org/secret.png`, and account deletion attempted six storage deletes
  instead of the two same-org MinIO objects.
- Reviewer-fix green verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/organizations/organizations.service.spec.ts middleware/src/modules/auth/auth.service.spec.ts`
  passed 2 suites / 90 tests.
- Post-helper-move content verification:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=modules/content`
  passed 19 suites / 567 tests.
- Final security re-review found one remaining medium thumbnail persistence
  gap: content create/update/replacement could preserve `thumbnail:
  minio://other-org/...` even though teardown no longer deletes it. Added red
  tests for create/update thumbnail rejection and replacement thumbnail cleanup,
  then validated with
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/content.service.spec.ts`
  passing 1 suite / 121 tests.
- Final focused affected verification:
  `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/content/content.service.spec.ts middleware/src/modules/content/content.controller.spec.ts middleware/src/modules/auth/auth.service.spec.ts middleware/src/modules/organizations/organizations.service.spec.ts`
  passed 4 suites / 262 tests.
- Broader content verification:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=modules/content`
  passed 19 suites / 571 tests.
- Full middleware verification:
  `pnpm --filter @vizora/middleware test -- --runInBand` passed 146 suites /
  2959 tests, 1 snapshot.
- Build/hygiene verification:
  `npx nx build @vizora/middleware --skip-nx-cache` exited 0 with the existing
  webpack warning class; `git diff --check` exited 0 aside from CRLF warnings;
  `pnpm security:no-hardcoded-jwts` reported no hardcoded JWT-looking tokens.
- Final subagent re-review: CLEAN. The prior thumbnail finding is resolved;
  content presign/read/delete, bulk delete, org cleanup, and sole-admin account
  cleanup now either require org-owned MinIO keys or skip/retain polluted
  foreign pointers without touching foreign storage objects.
- PR #175 CI: lint, test, build, security, e2e, and Security Audit all passed.
- PR #175 merged at
  `591ab52395a8f3df758a785c223b97f678af5623`; remote feature branch deleted.

---

## Completed: Dashboard Action Truth Pass 39 (2026-06-01)

**Branch:** `feat/dashboard-action-truth-pass-39`

**PR:** #173

**Commit:** `bd182c2`

**Merge SHA:** `d92b88d02236f947cc9bdb09eda85a98eb0cd332`

**Why now:** Pass 38 fixed a destructive confirmation gap. The next customer
trust issue is dashboard action truthfulness: viewers and managers can still see
some controls that backend roles reject, and failed primary list loads can still
look like real empty accounts.

**New primitives introduced:** one frontend permission helper. No backend route,
schema, env var, realtime substrate, notification path, MCP tool, Hermes skill,
provider spend path, or runtime process changes.

**Hermes-first analysis:** not applicable. This is dashboard UI state and tests,
not a business-agent, MCP, Hermes, AI/provider, or spend-path change.

**Plan/design:**
`docs/plans/2026-06-01-dashboard-action-truth-pass-39.md`

**Plan**
- [x] Start fresh isolated branch from updated `origin/main`.
- [x] Drift-check backend role contracts and existing list-error patterns.
- [x] Document pass 39 design and scope.
- [x] Add failing tests for permission helper, role-gated controls, and primary
  load-error panels.
- [x] Implement minimal permission helper, UI gates, read-only playlist select,
  and list-error panels.
- [x] Run multi-vector subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far:**
- Drift-check: schedules already has `loadError` with an inline panel and
  suppresses empty state while failed.
- Drift-check: content/devices/playlists primary loads still toast on failure
  and can render empty states.
- Drift-check: backend `@Roles` contracts show admin/manager can create/update
  content/devices/playlists; admin-only deletes apply to content, devices,
  playlists, and playlist item removal. Emergency override is admin-only by
  fleet service guard.
- Implementation: added `web/src/lib/permissions.ts` and focused tests for
  admin/manager/viewer/missing-user permissions.
- Implementation: content, devices, and playlists now suppress unauthorized
  mutation controls and modal submit surfaces; devices keep Pair New Device
  visible because backend `/devices/pairing/complete` has no role decorator.
- Implementation: content, devices, and playlists now render persistent
  `DashboardSectionError` panels on primary load failure and suppress misleading
  empty states while errors are active.
- Implementation: device playlist quick-select is disabled for viewers;
  emergency override create/clear is admin-only; screenshot read remains
  available in preview but screenshot capture request controls are hidden unless
  the user can manage devices.
- Review: UX/test reviewer found a medium false affordance where viewers could
  still re-flag already-flagged content; fixed by excluding `flagged` from the
  viewer flag branch and adding a regression test.
- Review: RBAC/security reviewer found a medium false affordance where viewers
  could request a screenshot capture from the device preview modal; fixed by
  passing `canRequestScreenshot` into `DevicePreviewModal` and adding page +
  component regression tests.
- Review: final RBAC/security reviewer found a medium direct-route gap where
  `/dashboard/playlists/:id` still exposed viewer/manager backend-rejected
  mutations; fixed by applying the same permission helper to the builder route
  and shared playlist panels. Re-review returned CLEAN.
- Review: UX/test/release re-review returned CLEAN after the flagged-content
  and screenshot-capture fixes.
- Focused verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/lib/__tests__/permissions.test.ts web/src/app/dashboard/content/__tests__/content-page.test.tsx web/src/app/dashboard/devices/__tests__/devices-page.test.tsx web/src/app/dashboard/playlists/__tests__/playlists-page.test.tsx web/src/components/__tests__/DevicePreviewModal.test.tsx web/src/components/__tests__/PlaylistBuilder.test.tsx`
  passed 6 suites / 144 tests. The existing playlist-builder tests emitted
  React `act(...)` warnings but exited 0.
- Broader verification:
  `pnpm --filter @vizora/web test -- --runInBand` passed 102 suites / 1080
  tests with existing React `act(...)` warnings in several suites;
  `npx nx build @vizora/web --skip-nx-cache` passed with production env
  placeholders; `pnpm security:no-hardcoded-jwts` passed; `git diff --check`
  passed with Windows CRLF warnings only.
- CI: PR #173 passed GitHub `audit`, `lint`, `test`, `build`, `security`, and
  `e2e`, then merged.
- Deploy gate: deploy NOT attempted. Prod `/opt/vizora/app` remains unsafe for
  automated deploy: branch `main`, HEAD
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  `main...origin/main [ahead 17, behind 123]`, dirty tracked Hermes/template/
  public frontend files present, and untracked production/template/public-doc
  directories present. Remote main at probe:
  `d92b88d02236f947cc9bdb09eda85a98eb0cd332`. Core prod services were online
  for middleware/web/realtime, but ops/Hermes agent PM2 jobs remained stopped.

---

## Completed: Dashboard Safety and Truth Pass 38 (2026-06-01)

**Branch:** `feat/customer-dashboard-pass-38`

**PR:** #171

**Commit:** `7920db8`

**Merge SHA:** `d09bfc514aa37cb03bfb308193894b9065211fa0`

**Why now:** After PR #169/#170, CI now gates the customer-critical API path.
The next buildable customer-facing gap is dashboard trust: destructive bulk
content deletion can execute from the toolbar without a confirmation step, and
dashboard copy includes Unicode separators plus stale "Publish" wording.

**New primitives introduced:** none. This pass changes existing web UI state,
copy, and tests only. No route, backend module, schema, env var, realtime
substrate, notification path, MCP tool, Hermes skill, provider spend path, or
runtime process changes.

**Hermes-first analysis:** not applicable. This is not a business-agent, MCP,
Hermes, AI/provider, or spend-path change.

**Plan/design:**
`docs/plans/2026-06-01-dashboard-safety-truth-pass-38.md`

**Plan**
- [x] Start fresh isolated branch from updated `origin/main`.
- [x] Drift-check prior customer UX findings against current repo truth.
- [x] Document pass 38 design and customer-improvement list.
- [x] Add failing web tests for content bulk-delete confirmation and dashboard
  copy cleanup.
- [x] Implement minimal UI state/copy fixes.
- [x] Run multi-vector subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far:**
- Drift-check: `web/src/lib/server-api.ts` already uses `vizora_auth_token`, so
  the prior server cookie mismatch concern is stale.
- Drift-check: `web/src/app/dashboard/devices/page-client.tsx` already wraps
  device bulk delete in `ConfirmDialog`.
- Backend/security reviewer findings verified stale in this worktree:
  `PairingService.getActivePairings` already hides brand-new unclaimed codes
  from org dashboards and has a test for it; `DisplaysService.bulkAssignGroup`
  already counts display IDs by `organizationId` before membership inserts and
  has a mixed-org rejection test; `ApiClient.updateContent` already maps
  dashboard `title` to backend `name` with a unit test.
- Residual gap: `web/src/app/dashboard/content/page-client.tsx` calls
  `apiClient.deleteContent` immediately in `handleBulkDelete` from the selected
  items toolbar.
- Residual gap: `web/src/app/dashboard/page-client.tsx` renders Unicode bullet
  separators in recent activity and says "Publish & Schedule" in the first-run
  guide.
- Queued high-value follow-ups from customer UX/security/performance review:
  frontend role/action matrix, persistent list-load error panels, schedule
  multi-device/group truthfulness, schedule precedence copy vs backend ordering,
  offline-device immediate push gating, health dashboard mock metrics, help-copy
  drift, device-content streaming, thumbnail storm prevention, stream/disk-backed
  uploads, compact list selects/indexes, active-schedule caching, and pairing
  active-list scaling.
- Implementation: content bulk deletion now opens `ConfirmDialog` and defers
  `apiClient.deleteContent` until confirmation; dashboard recent-activity
  separators now use ASCII ` - ` and the first-run guide says "Assign &
  Schedule".
- Review: replacement frontend reviewer found a real failure-path issue where
  the bulk-delete confirmation could close after a rejected delete; fixed by
  rethrowing after the toast and adding a regression test. Release-safety
  reviewer found a low-risk docs wording issue; fixed before verification.
- Focused verification:
  `pnpm --filter @vizora/web test -- --runInBand web/src/app/dashboard/content/__tests__/content-page.test.tsx web/src/app/dashboard/__tests__/dashboard-page.test.tsx`
  passed 2 suites / 62 tests.
- Broader verification:
  `pnpm --filter @vizora/web test -- --runInBand` passed 101 suites / 1067
  tests; `npx nx build @vizora/web --skip-nx-cache` passed with production env
  placeholders; `git diff --check` passed with Windows CRLF warnings only;
  `pnpm security:no-hardcoded-jwts` passed.
- CI: PR #171 passed GitHub `audit`, `lint`, `test`, `build`, `security`, and
  `e2e`, then merged.
- Deploy gate: deploy NOT attempted. Prod `/opt/vizora/app` remains unsafe for
  automated deploy: `main...origin/main [ahead 17, behind 123]`, dirty tracked
  and untracked template/Hermes/public-doc files present, prod HEAD
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, remote main
  `d09bfc514aa37cb03bfb308193894b9065211fa0`. Core prod probe showed
  middleware 200, web 200, realtime `/health` 404; ops/Hermes PM2 jobs remain
  stopped.

---

## Completed: Customer Critical Path E2E Gate Pass 37 (2026-06-01)

**Branch:** `feat/customer-experience-pass-37`

**Why now:** Recent smoke-script work now exercises the customer path from
register/login through pairing, content, playlist, schedule, uploaded-content
streaming, and device active-schedule reads. CI still only gates the agents E2E
suite, so this customer-critical path can regress without blocking a merge.

**New primitives introduced:** none. This pass adds automated E2E coverage and
CI wiring only. It reuses existing NestJS modules/controllers/services/DTOs,
Prisma models, Redis pairing flow, device JWT verification, response envelope,
and `/api/v1` routing. No route, schema, runtime process, env var, realtime
substrate, notification substrate, MCP tool, Hermes skill, or provider spend
path changes.

**Hermes-first analysis:** not applicable. This is a repo-local middleware E2E
gate for existing customer-critical API paths, not a business-agent, MCP,
Hermes, or AI/provider workflow.

**Plan/design:**
`docs/plans/2026-06-01-customer-critical-path-e2e-pass-37.md`

**Plan**
- [x] Start fresh isolated branch from updated `origin/main`.
- [x] Drift-check smoke, runbook, and CI coverage against current repo truth.
- [x] Document pass 37 design and verification plan.
- [x] Add middleware E2E coverage for register/login, pairing, content,
  playlist, schedule, and device active-schedule read through `/api/v1`.
- [x] Wire GitHub Actions E2E job to run the customer-critical-path spec
  alongside the existing agents suite.
- [x] Run multi-vector subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green. PR #169 merged to `origin/main` at
  `cc708d539cddeb686c64d11bd8f6abf351d9f524`; PR CI green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe. Rechecked
  after PR #169: blocked because `/opt/vizora/app` remains dirty and diverged
  (`main...origin/main [ahead 17, behind 123]`, prod `HEAD bb76aa...`,
  prod local `origin/main 7728ea0...`, remote `origin/main cc708d5...`).
  No deploy attempted.

**Evidence:**
- Drift-check: `scripts/smoke/api-critical-path.sh` already covers full pairing
  completion, URL content, multipart PDF upload, authenticated device-content
  range streaming, playlist creation, schedule creation, and device
  `/schedules/active/:displayId` reads. The current CI E2E job still runs only
  `--testPathPattern=agents`.
- Customer UX reviewer findings queued for follow-up after this gate:
  dashboard server fetch cookie mismatch, 401/403 client handling, viewer action
  gating, misleading playlist Publish, multi-device schedule mismatch, bulk
  delete safeguards, content/template performance hotspots, mobile fit, and trust
  copy drift.
- Performance reviewer findings queued for follow-up after this gate: device
  media buffering, memory-backed uploads/replacements, thumbnail generation
  stampede, playlist realtime fan-out, playlist list overfetch, missing list
  sort indexes, first-page-only dashboard assumptions, global response sanitize
  overhead, proof-of-play write path, reorder scaling, and pairing Redis scans.
- Implementation: added `customer-critical-path.e2e-spec.ts` covering
  register + login, public pairing request/status, authenticated pairing
  completion, URL content creation, playlist creation, active schedule creation,
  device-token active schedule read, no-token rejection, user-JWT rejection,
  foreign-device-token rejection, cross-org playlist-content rejection, and
  cross-org display-schedule rejection. The schedule uses all seven days to
  avoid midnight flakes and cleanup deletes any leftover `pairing:{code}` Redis
  keys.
- CI wiring: GitHub Actions middleware E2E job now runs
  `--testPathPattern="(agents|customer-critical-path)"`.
- Test cleanup: `agents.e2e-spec.ts` now deletes its user before deleting the
  org so the gated suite does not emit a Prisma not-found cleanup error.
- Review: CI/release-safety reviewer CLEAN. API/security reviewer initially
  found missing negative device-token and tenant-isolation assertions; after
  follow-up assertions, re-review CLEAN.
- Verification:
  `pnpm --filter @vizora/middleware exec jest --config=jest.e2e.config.js --runInBand --testPathPattern=customer-critical-path --detectOpenHandles`
  passed 1 suite / 1 test. `pnpm --filter @vizora/middleware exec jest --config=jest.e2e.config.js --runInBand --testPathPattern="(agents|customer-critical-path)"`
  passed 2 suites / 2 tests. `pnpm --filter @vizora/middleware test -- --runInBand`
  passed 146 suites / 2942 tests. `npx nx build @vizora/middleware --skip-nx-cache`
  passed with existing webpack warnings. `git diff --check` passed with only
  Windows CRLF conversion warnings. `pnpm security:no-hardcoded-jwts` passed.
  Direct `tsc --project tsconfig.spec.json` is not a valid
  repo check because the spec tsconfig has a pre-existing
  `moduleResolution: NodeNext` / `module` mismatch; Jest/ts-jest is the E2E
  compile path and passed.
- PR/CI/merge: PR #169 passed `audit`, `build`, `lint`, `security`, `test`,
  and `e2e`; merged 2026-06-01T22:46:28Z as
  `cc708d539cddeb686c64d11bd8f6abf351d9f524`.
- Production gate: blocked. `/opt/vizora/app` remains dirty and diverged with
  many modified template/landing/Hermes files plus untracked production files.
  Core health at probe time: middleware HTTP 200, web HTTP 200, realtime
  `/health` HTTP 404. Most ops/Hermes PM2 jobs remain stopped; `vizora-web`,
  `vizora-realtime`, and two `vizora-middleware` cluster workers are online.

---

## Completed: Template Action Truthfulness Pass 36 (2026-06-01)

**Branch:** `feat/customer-experience-pass-36`

**Why now:** PR #166 is merged with green PR and post-merge main CI, but
production deploy remains blocked by dirty/diverged prod-local state. The next
customer trust issue from the dashboard audit is template authoring: the UI
shows AI Designer and template editing affordances that ordinary customer admins
cannot complete because the backend intentionally keeps AI generation disabled
and template create/update/delete behind `SuperAdminGuard`.

**New primitives introduced:** none. This pass only aligns existing frontend
affordances with existing backend guards and unavailable AI response. No route,
module, middleware, schema, response envelope, realtime path, notification path,
MCP tool, Hermes skill, provider spend path, env var, or production process
changes.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-template-action-truthfulness-pass-36.md`

**Plan**
- [x] Start fresh branch from updated `origin/main`.
- [x] Drift-check template frontend actions against backend guards.
- [x] Document pass 36 design and test plan.
- [x] Add failing ordinary-admin template action tests.
- [x] Gate super-admin-only actions and make AI Designer unavailable state honest.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green. PR #167 merged to `origin/main` at
  `923c6ddd097151d89637916aa021f582eddfa466`; PR CI and post-merge main CI
  green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe. Rechecked
  after PR #167: blocked because `/opt/vizora/app` remains dirty and diverged
  (`main...origin/main [ahead 17, behind 123]`, prod `HEAD bb76aa...`,
  `origin/main 923c6dd...`). No deploy attempted.

**Evidence so far:**
- PR #166 / pass 35 integration: merged at
  `7728ea03dfa0a108f957d0225727f9613915f776`; PR CI and post-merge main CI run
  `26779421101` completed with build, lint, test, security, and e2e all
  successful.
- Production gate after PR #166: blocked. `/opt/vizora/app` is still dirty and
  diverged (`main...origin/main [ahead 17, behind 123]`, `HEAD bb76aa...`,
  `origin/main 7728ea0...`) with many modified template/landing/Hermes files and
  untracked production files. Core API health is OK, but most ops/agent PM2
  entries remain stopped. No deploy attempted.
- Open PR check after PR #166: no open pull requests.
- Drift-check: `template-library.controller.ts` uses `SuperAdminGuard` on
  create/update/delete, while `template-library.service.ts` returns
  `available: false` for AI generation. The dashboard currently keys some
  create/edit actions from `role === 'admin'` and simulates AI generation before
  showing the unavailable state.
- Implementation: `/auth/me` now preserves optional `isSuperAdmin`, global
  template authoring is gated on `isSuperAdmin === true`, org-owned template
  editing stays available to admin/manager roles through the existing
  `/template-library/:id/save` route, and clone/use actions are hidden for
  viewers and org-owned templates because backend clone accepts global templates
  only.
- Implementation: AI Designer entry points now show an honest coming-soon modal
  and no longer simulate or call disabled generation.
- Multi-vector review: authorization/architecture reviewer CLEAN; customer-flow
  and backend-contract reviewer CLEAN after follow-up tests hid clone/use actions
  on org-owned templates.
- Focused verification:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/templates/__tests__/templates-page.test.tsx src/components/templates/__tests__/AIDesignerModal.test.tsx src/components/templates/__tests__/TemplateDetailModal.test.tsx src/lib/api/__tests__/templates.test.ts 'src/app/dashboard/templates/[id]/__tests__/template-detail-page.test.tsx' 'src/app/dashboard/templates/[id]/edit/__tests__/page-client.test.tsx'`
  passed 6 suites / 26 tests. `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/auth/strategies/jwt.strategy.spec.ts`
  passed 34 tests.
- Broader verification: `pnpm --filter @vizora/web test -- --runInBand` passed
  101 suites / 1065 tests; `pnpm --filter @vizora/middleware test -- --runInBand`
  passed 146 suites / 2942 tests. Existing warning noise remains from React
  `act(...)`, jsdom navigation, MinIO/storage logs, and expected health/circuit
  breaker logs.
- Type/build/security: web and middleware `tsc --noEmit --pretty false` passed;
  changed-file ESLint passed with warnings only from existing `any` debt;
  `npx nx build @vizora/web --skip-nx-cache`, `npx nx build @vizora/middleware --skip-nx-cache`,
  and `npx nx build @vizora/realtime --skip-nx-cache` passed. The first
  concurrent middleware build hit a Windows Prisma generated-client copy lock;
  serial retry passed. `git diff --check` and `pnpm security:no-hardcoded-jwts`
  passed.
- PR #167 / pass 36 integration: merged at
  `923c6ddd097151d89637916aa021f582eddfa466`; PR checks passed (`audit`,
  `build`, `lint`, `security`, `test`, `e2e`). Post-merge main CI run
  `26782351951` completed successfully with `test`, `build`, `security`,
  `lint`, and `e2e` all green.
- Production gate after PR #167: blocked. `/opt/vizora/app` is dirty and
  diverged (`main...origin/main [ahead 17, behind 123]`, prod `HEAD bb76aa...`,
  remote main `923c6dd...`) with many modified template/landing/Hermes files and
  untracked production files. Middleware and web local health probes returned
  OK; realtime `/health` returned 404 while the `vizora-realtime` PM2 process was
  online. Most ops/agent PM2 entries remain stopped. No deploy attempted.

---

## Completed: Bounded Playlist Fan-out Pass 35 (2026-06-01)

**Branch:** `feat/customer-experience-pass-35`

**Why now:** PR #165 is merged with green PR and post-merge main CI, but
production deploy remains blocked by dirty/diverged prod-local state. The next
highest performance issue from the audit is playlist update fan-out:
`notifyDisplaysOfPlaylistUpdate()` currently sends one realtime HTTP request per
assigned display through `Promise.allSettled(displays.map(...))`. For larger
fleets this can create an avoidable burst against middleware, realtime, and the
internal command path.

**New primitives introduced:** none. This pass only adds a small private
bounded-concurrency helper in the existing playlist service notification path.
No route, module, middleware, schema, response envelope, realtime gateway
contract, notification substrate, MCP tool, Hermes skill, provider spend path,
env var, or production process changes.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-playlist-fanout-performance-pass-35.md`

**Plan**
- [x] Start fresh branch from updated `origin/main`.
- [x] Drift-check playlist update notification path and tests.
- [x] Document pass 35 design and test plan.
- [x] Add failing bounded fan-out tests.
- [x] Implement bounded notification dispatch with existing circuit breaker path.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green. PR #166 merged to `origin/main` at
  `7728ea03dfa0a108f957d0225727f9613915f776`; PR CI and post-merge main CI
  green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe. Rechecked
  after PR #166: blocked because `/opt/vizora/app` is dirty and diverged
  (`main...origin/main [ahead 17, behind 123]`) despite healthy core API.

**Evidence so far:**
- Drift-check: `middleware/src/modules/playlists/playlists.service.ts`
  `notifyDisplaysOfPlaylistUpdate()` loads displays by `currentPlaylistId` and
  currently uses unbounded `Promise.allSettled(displays.map(...))` around the
  existing `this.circuitBreaker.executeWithFallback('realtime-service', ...)`
  realtime POST. Existing focused tests cover dispatch count, no-display skip,
  missing-secret skip, and fallback behavior, but not concurrency.
- PR #165 / pass 34 integration: merged at
  `4827344cab9c538461e8b7a6bd368a084e33b694`; post-merge main CI run
  `26777703887` completed with build, lint, test, security, and e2e all
  successful.
- Production gate after PR #165: blocked. `/opt/vizora/app` is still dirty and
  diverged (`main...origin/main [ahead 17, behind 121]`, `HEAD bb76aa...`,
  `origin/main 4827344...`) with many modified template/landing/Hermes files and
  untracked production files. Core services are healthy, but most ops/agent PM2
  entries remain stopped. No deploy attempted.
- Red TDD: focused playlist service suite failed on the new fan-out test because
  the existing `Promise.allSettled(displays.map(...))` path reached 45 active
  realtime notifications with 45 displays, exceeding the 20-request cap.
- Focused green: after adding the bounded runner, the focused playlist service
  suite passed 31/31. Review follow-up hardened the test set with a final
  post-drain peak assertion and an explicit "earlier rejects do not stop later
  displays" regression; the focused suite then passed 32/32.
- Multi-vector review: performance/correctness reviewer CLEAN with low notes to
  add explicit reject-continuation coverage and update docs; architecture,
  security, and runtime/deploy-safety reviewer CLEAN with a low note to reassert
  peak concurrency after all batches drain. Both low notes were addressed.
- Verification: focused playlist service suite passed 32/32; middleware
  `tsc --noEmit` passed; changed-file ESLint passed with 0 errors and only the
  existing ESLintRC deprecation warning; hardcoded JWT scan passed; `git diff
  --check` passed with CRLF warnings only; full middleware Jest passed 146/146
  suites and 2940/2940 tests; `npx nx build @vizora/middleware
  --skip-nx-cache` passed with existing webpack dependency warnings and the
  existing Nx flaky-task note for `@vizora/database:build`.

---

## Completed: Display Cache Streaming Pass 34 (2026-06-01)

**Branch:** `feat/customer-experience-pass-34`

**Why now:** PR #164 is merged with green PR and post-merge main CI, but
production deploy remains blocked by dirty/diverged prod-local state. The next
highest device/customer performance issue is display media playback: the display
client preloads protected image/video URLs into the browser Cache API, yet
`ContentRenderer` does not read from that cache during playback. That makes
screen transitions pay repeat network fetch cost and weakens offline/poor-link
behavior.

**New primitives introduced:** none. This pass only wires existing display
cache helpers into existing display rendering components and tests. No route,
module, middleware, schema, response envelope, realtime path, notification path,
MCP tool, Hermes skill, provider spend path, env var, or production process
changes.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-display-cache-streaming-pass-34.md`

**Plan**
- [x] Start fresh branch from updated `origin/main`.
- [x] Drift-check display preloading/cache/rendering path.
- [x] Document pass 34 design and test plan.
- [x] Add failing display renderer cache-first tests.
- [x] Wire existing `getCachedUrl()` through playback components.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green. PR #165 merged to `origin/main` at
  `4827344cab9c538461e8b7a6bd368a084e33b694`; PR CI and post-merge main CI
  green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe. Rechecked
  after PR #165: blocked because `/opt/vizora/app` is dirty and diverged
  (`main...origin/main [ahead 17, behind 121]`) despite healthy core services.

**Evidence so far:**
- Red TDD: `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/display/components/__tests__/ContentRenderer.test.tsx`
  failed on the new cache-first media tests because protected images still used
  the old network blob path and videos ignored the browser cache.
- Focused green: `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/display/components/__tests__/ContentRenderer.test.tsx src/app/display/components/__tests__/ContentScreen.test.tsx src/app/display/__tests__/DisplayClient.test.tsx`
  passed 3/3 suites and 11/11 tests after threading `getCachedUrl()` through
  display playback. Web `tsc --noEmit` passed; changed-file ESLint passed with
  0 errors and only the repo's existing ESLintRC deprecation warning.
- Review finding fixed: protected videos now wait for cache lookup before
  mounting a network `src`, and external lookalike `/device-content/.../file`
  URLs are treated as ordinary external media rather than protected display
  media. Focused display suite now passes 3/3 suites and 12/12 tests; web
  `tsc --noEmit` and changed-file ESLint pass.
- Multi-vector review: first playback/performance reviewer found the video
  pre-cache network mount and external lookalike URL issues above; follow-up
  playback reviewer CLEAN after fixes. React lifecycle/browser/security
  reviewer CLEAN. Reviewers independently ran focused display suites.
- Verification: full web Jest passed 96/96 suites and 1049/1049 tests, with
  existing unrelated React `act()`/jsdom navigation console warnings; web
  `tsc --noEmit` passed; changed-file ESLint passed with 0 errors; hardcoded
  JWT scan passed; `git diff --check` passed with CRLF warnings only; production
  `pnpm --filter @vizora/web build` passed with existing Next middleware/proxy
  and TypeScript project-reference warnings.
- PR/CI: PR #165 merged; post-merge main CI run `26777703887` succeeded for
  build, lint, test, security, and e2e.

---

## Active: Template Publish Tenant Guardrail Pass 33 (2026-06-01)

**Branch:** `feat/customer-experience-pass-33`

**Why now:** The pass 32 security review fixed pairing and display-tag tenant
guardrails, but it also left one bounded residual in template publishing:
`publishTemplate()` still resolves a source template by id/type only and updates
usage metadata by id. That can let a tenant publish another organization's
private non-global template if they guess the id, and it mutates that private
template's metadata. Nearby template read/edit paths already use the intended
global-or-own boundary, so this pass closes the isolated publish gap.

**New primitives introduced:** none. This pass only tightens existing
`TemplateLibraryService` query predicates and focused tests. No route, module,
middleware, schema, response envelope, realtime path, notification path, MCP
tool, Hermes skill, provider spend path, or production process changes.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-template-publish-tenant-pass-33.md`

**Plan**
- [x] Start fresh branch from updated `origin/main`.
- [x] Drift-check existing template read/edit tenant boundaries.
- [x] Document pass 33 design and test plan.
- [x] Add failing publish-template tenant-boundary tests.
- [x] Implement global-or-own source-template scope and scoped use-count write.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green. PR #164 merged to `origin/main` at
  `a0e1d915d7034c2c5c9b05f7f8ed0e5187dc8dec`; PR CI and post-merge main CI
  green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe. Rechecked
  after PR #164: blocked because `/opt/vizora/app` is dirty and diverged
  (`main...origin/main [ahead 17, behind 119]`) despite healthy core services.

**Evidence so far:**
- Red TDD: `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/template-library/template-library.service.spec.ts`
  failed on the new publish-template tests because source lookup used only
  `{ id, type }` and use-count writes did not use the scoped predicate.
- Focused green: the same command passed 52/52 after moving source-template
  lookup into the transaction with the global-or-own predicate and updating
  use-count through `updateMany` with that same predicate.
- Multi-vector review: tenant/security reviewer CLEAN; Prisma/transaction/API
  compatibility reviewer CLEAN. Both independently reran the focused
  template-library service suite and saw 52/52 pass.
- Verification: focused template-library service suite passed 52/52; middleware
  `tsc --noEmit` passed; changed-file ESLint passed with 0 errors and 2
  pre-existing warnings in `template-library.service.ts`; hardcoded JWT scan
  passed; `git diff --check` passed with CRLF warnings only; full middleware
  Jest passed 146/146 suites and 2938/2938 tests; `npx nx build
  @vizora/middleware --skip-nx-cache` passed with existing webpack warnings and
  the existing Nx flaky-task note for `@vizora/database:build`.

---

## Active: Middleware Guardrail + Sanitize Fast Path Pass 32 (2026-06-01)

**Branch:** `feat/customer-experience-pass-32`

**Why now:** PR #161/#162 are merged with green CI, while production deploy
remains blocked by dirty/diverged prod-local state. A remaining middleware
performance hot path is the global `SanitizeInterceptor`, which recursively
passes every ordinary response string through `sanitize-html` even when the
string contains no HTML/entity trigger characters. A synthetic 20k-row safe
payload benchmark of the current call pattern took about 190 ms locally.
Parallel security review also found two bounded tenant guardrail gaps worth
fixing in the same middleware pass: brand-new unclaimed pairing codes were
visible in every tenant dashboard's active pairing list, and display tag
assignment could write cross-org tag join rows. Diff review then identified the
read-side residual: existing polluted display-tag rows also needed org-scoped
filters on display tag reads.

**New primitives introduced:** none. This pass only tightens existing
middleware service/interceptor behavior and tests. No route, module, middleware
order, schema, response envelope, realtime path, notification path, MCP tool,
Hermes skill, provider spend path, or production process changes.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-sanitize-fast-path-performance-pass-32.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch customer UX/trust, performance, and security/tenant reviewers.
- [x] Drift-check sanitizer behavior and existing tests.
- [x] Add failing sanitizer tests for safe-string fast path.
- [x] Implement conservative sanitizer trigger check.
- [x] Add failing pairing/tag tenant-boundary tests.
- [x] Implement bounded pairing visibility and display tag ownership fixes.
- [x] Add and fix display-tag read-side tenant filters for historical polluted
  rows.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green. PR #163 merged to `origin/main` at
  `3249ee22495371d9b3d41f6fd3ba457dcfa6e004`; post-merge main CI green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far:**
- Sanitizer TDD red: focused interceptor spec failed because safe plain strings
  still called `sanitize-html` 9 times.
- Sanitizer focused green: `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/common/interceptors/sanitize.interceptor.spec.ts`
  passed 52/52 after the fast path.
- Synthetic sanitizer benchmark: old safe-string call pattern ~190 ms for
  20,000 safe rows locally; new helper path ~28.6 ms locally. Independent
  performance reviewer measured old avg 134.2 ms vs new avg 13.1 ms.
- Tenant TDD red: focused display/pairing suite failed on brand-new unclaimed
  pairing visibility and cross-org display tag assignment behavior.
- Tenant focused green: `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/pairing.service.spec.ts src/modules/displays/displays.service.spec.ts src/modules/displays/displays.service.tag-events.spec.ts`
  passed 80/80 after the guardrail fixes.
- Review finding fixed: display list/detail/update/create selects and `getTags`
  now scope tag relation reads by tag organization, so existing polluted
  display-tag rows are filtered before response serialization.
- Multi-vector diff review: security/tenant reviewer found the display-tag
  read-side residual above; follow-up reviewer returned CLEAN after the scoped
  select builders and `getTags` filter. Compatibility/performance reviewer
  returned CLEAN, with residual note that pairing Redis scan scalability remains
  a separate backlog item.
- Verification: focused sanitizer tests passed 52/52; focused display/pairing
  tests passed 81/81; TypeScript `tsc --noEmit` passed; changed-file ESLint
  passed with only the repo's existing ESLintRC deprecation warning; JWT secret
  scan passed; `git diff --check` passed; full middleware Jest passed 146/146
  suites and 2935/2935 tests; `npx nx build @vizora/middleware --skip-nx-cache`
  succeeded with existing webpack dependency warnings.

---

## Completed: Analytics Truthfulness Pass 31 (2026-06-01)

**Branch:** `feat/analytics-truthfulness-pass-31`

**Why now:** Pass 30 is merged with green PR and post-merge `main` CI, but
production deploy remains blocked by dirty/diverged prod-local state. The next
highest customer-trust issue from dashboard review is the analytics page
presenting current-state or estimated metrics as real-time measured uptime and
bandwidth. Plan review also found a P1 analytics data-isolation gap: malformed
impression rows can carry the caller's `organizationId` while pointing at
another tenant's content, playlist, or display IDs, and current analytics
relation lookups resolve those related names by ID only.

**New primitives introduced:** none. This pass only adds optional provenance
metadata to existing analytics response shapes, tenant predicates to existing
relation lookups, and updates existing dashboard copy/labels. No migration,
route, module, queue, realtime path, notification path, MCP tool, Hermes skill,
provider spend path, or production process.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-analytics-truthfulness-pass-31.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch customer-copy/UX and API-contract/backcompat reviewers.
- [x] Capture plan-review findings before test edits.
- [x] Add failing middleware tests for analytics provenance.
- [x] Add failing middleware tests for analytics tenant-isolated relation lookups.
- [x] Add failing web tests for customer-facing truthfulness.
- [x] Implement analytics DTO provenance and dashboard copy/label updates.
- [x] Run multiple subagent diff reviews before broader verification.
- [x] Run focused middleware and web tests.
- [x] Run broader verification.
- [x] PR, CI, merge if green. PR #161 merged to `origin/main` at
  `4a8403c000590d45771f54da51c00274c665e753`; post-merge main CI passed
  lint, security, build, test, and e2e.
- [x] Re-check deployment gate; deploy only if prod checkout is safe. Gate
  checked and deployment remains blocked by dirty/diverged prod-local checkout.

**Evidence so far:**
- Drift evidence: `AnalyticsService.getDeviceMetrics` simulates category
  uptime from device inventory, `getBandwidthUsage` estimates transfer from
  content sizes and device count, while the dashboard labels the page as
  real-time performance metrics, shows a `System Uptime` KPI, and charts
  bandwidth as `MB/s`.
- Plan-review evidence: two read-only reviewers found misleading real-time,
  uptime, bandwidth, views/shares/unique-device/top-engagement copy; stale web
  analytics types; and analytics relation lookups that need organization
  predicates before returning related names.
- TDD red evidence: focused middleware analytics tests failed on missing
  provenance fields and cross-tenant content/playlist/proof-of-play name
  redaction; focused web analytics tests failed on `System Uptime`, `Device
  Uptime Timeline`, real-time analytics copy, `MB/s`, views/shares/unique-device
  CSV labels, and old chart titles.
- Focused green evidence: middleware analytics service/proof-of-play suites
  passed 55/55; web analytics page suite passed 12/12.
- Diff review findings fixed: usage-trends raw SQL now joins `Content` by both
  content ID and organization ID; proof-of-play relation sanitization fails
  closed when relation `organizationId` is absent; realtime device-status events
  no longer render a stale analytics `Updated Ns ago` freshness claim; frontend
  analytics types now expose honest required aliases with legacy fields optional
  for response compatibility; usage trends include an `other` bucket and clearer
  reported-content-type copy.
- Post-review focused green evidence: middleware analytics service/proof-of-play
  suites passed 57/57; web analytics page suite passed 13/13.
- Follow-up backend and frontend diff reviewers both returned CLEAN.
- Broader local verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/analytics/analytics.controller.spec.ts src/modules/analytics/analytics.service.spec.ts src/modules/analytics/proof-of-play.service.spec.ts` passed 70/70.
  - `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/analytics/__tests__/analytics-page.test.tsx src/lib/hooks/__tests__/useAnalyticsData.test.ts` passed 28/28.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` passed.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` passed.
  - `pnpm --filter @vizora/middleware test -- --runInBand` passed 146 suites / 2930 tests.
  - `pnpm --filter @vizora/web test -- --runInBand` passed 96 suites / 1045 tests with unrelated existing React `act()` warnings.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint ...changed analytics files...` passed with 0 errors / 0 warnings; only the ESLint config deprecation notice remains.
  - `pnpm security:no-hardcoded-jwts` passed.
  - `npx nx build @vizora/middleware --skip-nx-cache` passed with existing webpack dependency warnings.
  - `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web --skip-nx-cache` passed with existing Next middleware/proxy and TS project-reference warnings.
  - `git diff --check` passed with CRLF warnings only.
- PR/CI/deploy evidence:
  - PR #161 passed branch CI: audit, lint, security, build, test, and e2e.
  - PR #161 was merged remotely via GitHub API after `gh pr merge` hit the
    local multi-worktree `main` checkout guard.
  - Post-merge `main` CI run `26769194160` passed: lint, security, build,
    test, and e2e.
  - Production deploy was not run. Read-only prod probe showed
    `/opt/vizora/app` on `main` at `bb76aa1838740bff5b58623dfef7a906d44f46a6`
    with `git status` reporting `[ahead 17, behind 109]` against its local
    `origin/main`, many modified template/Hermes/landing files, and untracked
    production files. Health endpoint was OK and middleware/web/realtime were
    online, but updating the checkout would risk overwriting unreconciled
    prod-local work.

---

## Completed: Realtime Widget Secret Boundary Pass 30 (2026-06-01)

**Branch:** `feat/customer-readiness-pass-30`

**Why now:** Pass 29 fixed widget truthfulness and HTTP response redaction, but security review found the realtime/device path still builds playlist payloads from raw content metadata. A generic API widget can therefore leak saved API headers to display clients even though dashboard/API responses are redacted.

**New primitives introduced:** one realtime-local device payload sanitizer. No new database model, migration, route, queue, realtime room model, MCP tool, Hermes skill, provider spend path, or production process.

**Hermes-first analysis:** not applicable to runtime delivery code. Official Hermes bundled skills and the current awesome-Hermes ecosystem do not provide a reusable NestJS/Socket.IO payload sanitizer; this is an in-process Vizora secret-boundary concern and must stay in the realtime service.

**Plan/design:** `docs/plans/2026-06-01-realtime-widget-secret-boundary-pass-30.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch customer, performance, and architecture/security reviewers for the next pass.
- [x] Select the highest-risk bounded target from review: generic API widget header leakage through realtime/device payloads.
- [x] Add failing realtime tests for cached, primary, fallback, update, initial-state, and layout metadata redaction.
- [x] Implement realtime-side payload sanitizer and wire existing delivery paths.
- [x] Run focused tests.
- [x] Run multi-subagent review before broader verification.
- [x] Run broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far:**
- Drift evidence: middleware HTTP responses redact generic API widget headers, but `realtime/src/services/playlist.service.ts` and `realtime/src/gateways/device.gateway.ts` still copy raw `item.content.metadata` into device-bound payloads.
- TDD red: focused realtime specs failed on raw `Bearer live-secret` / `live-api-key` values in cached playlists, DB playlists, fallback playlists, admin-updated playlists, initial-state payloads, direct `playlist:update` emissions, and layout metadata.
- Focused green after implementation: `pnpm --filter @vizora/realtime test -- --runInBand --runTestsByPath src/services/playlist.service.spec.ts src/gateways/device.gateway.spec.ts` passed 128/128.
- Review findings fixed: stale pending playlist replay now sanitizes Redis payloads on read/requeue, and generic API widget `widgetConfig` is stripped entirely from device-bound metadata so query-string secrets do not survive. Focused specs now pass 129/129.
- Final follow-up review: security and realtime/display reviewers both returned CLEAN.
- Broader local verification: full realtime Jest passed 12 suites / 285 tests; `npx nx build @vizora/realtime --skip-nx-cache` passed with existing third-party webpack warnings; `pnpm security:no-hardcoded-jwts` passed; changed-file ESLint exited 0 with existing warnings; `git diff --check` passed with CRLF warnings only.
- PR #159 merged as `47af00d11dfe026a701386215059d6b8a86dbe0f`. PR CI passed audit, build, lint, security, test, and e2e. Post-merge `main` CI run `26764596096` also passed build, test, security, lint, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy: `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main` is `47af00d11dfe026a701386215059d6b8a86dbe0f`, the checkout is 17 commits ahead / 109 behind with 72 dirty/untracked entries, and many ops/Hermes PM2 jobs are stopped. Core probes: middleware 200, web 200, realtime `/health` 404.

---

## Completed: Widget Truthfulness Pass 29 (2026-06-01)

**Branch:** `feat/widget-truthfulness-pass-29`

**Why now:** Pass 28 is merged with green PR and post-merge `main` CI, but production deploy remains blocked by dirty/diverged prod-local state. The next highest customer-trust issue from the dashboard review is widgets saving sample or stale data while reporting success.

**New primitives introduced:** one server-only optional strict-fetch mode on existing widget data sources, plus dashboard schema normalization for existing widget type metadata. No new database model, migration, process, queue, realtime path, MCP tool, Hermes skill, provider spend path, or deployment primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-06-01-widget-truthfulness-pass-29.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Drift-check widget create/update/runtime behavior.
- [x] Run plan review before implementation.
- [x] Add failing service/data-source tests for no sample/stale widget saves.
- [x] Add failing dashboard tests for schema normalization, disabled fallback types, and error toasts without false success.
- [x] Implement strict live-data fetch path for saved widgets.
- [x] Fix dashboard schema handling, fallback type behavior, and refresh pending state.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence so far:**
- TDD red: focused middleware widget/data-source suite failed because strict mode did not exist, data sources returned sample data, create/update saved fallback or stale HTML, and refresh wrapped provider failure as `BadRequestException`.
- TDD red: focused web widget page test failed because backend JSON schema rendered as raw `type/properties/required`, fallback catalog entries were creatable, refresh had no pending state, and create relied on a swallowed reload.
- Focused green after implementation: middleware widget/data-source suite 158/158; web widgets page 14/14.
- Review findings fixed: generic API widget headers are redacted from content responses while preserving stored secrets on redacted save-back; RSS strict mode now uses the shared SSRF guard with redirect and body-size checks; weather strict mode validates units; widget update/refresh writes are tenant-scoped; fallback widget types are disabled; refresh state is per-widget; required schema fields gate create/update.
- Final review: backend and frontend subagents both returned CLEAN.
- Final focused evidence: middleware widget/data-source suite passed 165/165; widgets page suite passed 16/16. Post-cleanup `content.service.spec.ts` passed 110/110.
- Broader evidence: middleware full Jest passed 146 suites / 2920 tests; web full Jest passed 96 suites / 1041 tests. Middleware and web `tsc --noEmit` passed. `pnpm security:no-hardcoded-jwts` passed. `pnpm build:middleware` passed with existing webpack warnings. `pnpm build:web` passed with local required `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, and memory env; the first web build without `NEXT_PUBLIC_SOCKET_URL` correctly failed the production CSP guard. Changed-file ESLint exited 0 with non-blocking existing `any` warnings in the widgets page. `git diff --check` passed with CRLF warnings only.
- PR #157 merged as `a52d3f4daa59c386cd85e58fee2c0351941fb707`. PR CI passed audit, build, lint, security, test, and e2e. Post-merge `main` CI run `26760099592` also passed lint, build, security, test, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy: `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main` is `a52d3f4daa59c386cd85e58fee2c0351941fb707`, the checkout is 105 commits behind / 17 ahead with 72 dirty/untracked entries, and many ops/Hermes PM2 jobs are stopped. Core probes: middleware 200, web 200, realtime `/health` 404.

---

## Completed: Content Tag Filter Trust Pass 28 (2026-06-01)

**Branch:** `feat/customer-readiness-pass-28`

**Why now:** Pass 27 is merged with green post-merge `main` CI, but production
deploy remains blocked by dirty/diverged prod-local state. The next bounded
customer-dashboard trust gap still present in current code is the content
library's tag filter: it shows hardcoded `Marketing`, `Seasonal`, `Featured`,
and `Archive` choices even though Vizora has tenant-scoped `Tag`/`ContentTag`
data and server-side `tagNames` filtering.

**New primitives introduced:** one content-module read endpoint,
`GET /api/v1/content/tags`, one web API client method, and a `tagIds`
content-list query filter. No new database model, migration, process, queue,
realtime path, MCP tool, Hermes skill, provider spend path, or deployment
primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-content-tag-filter-trust-pass-28.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Reconcile backlog/current state after Pass 27.
- [x] Add failing middleware tests for tenant-scoped content tag listing.
- [x] Add failing web tests for real content-tag filter options.
- [x] Implement the content tag list endpoint and web API client method.
- [x] Replace hardcoded dashboard tag filters with fetched real tags.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence so far:**
- TDD red: middleware content tests failed on missing
  `ContentService.listContentTags` / `ContentController.listContentTags`; web
  content test failed because `apiClient.getContentTags` was never called.
- Implementation: added tenant-scoped `GET /api/v1/content/tags`, web API
  client support, and content-library tag filter loading/error/empty states.
  Removed the hardcoded `Marketing` / `Seasonal` / `Featured` / `Archive`
  filter source.
- Regression fix: initial tag metadata loading now keeps the empty selected
  tag-name value stable, so mounting the content page does not duplicate the
  first content fetch.
- Focused web evidence:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/content/__tests__/content-page.test.tsx`
  passed 43/43.
- Review findings fixed: content tag usage counts now filter the counted
  content relation by `organizationId`; dashboard tag filtering now sends
  `tagIds` so comma-bearing tenant tag names keep working; folder content
  queries now forward `tagIds` as well.
- Focused post-review evidence:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/content/content.service.spec.ts src/modules/content/content.controller.spec.ts src/modules/content/dto/content-query.dto.spec.ts src/modules/folders/folders.controller.spec.ts`
  passed 196/196.
- Focused post-review web evidence:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/content/__tests__/content-page.test.tsx src/lib/api/__tests__/content.test.ts`
  passed 45/45.
- Broader evidence: `pnpm --filter @vizora/web test -- --runInBand` passed
  96 suites / 1035 tests; `pnpm --filter @vizora/middleware test -- --runInBand`
  passed 143 suites / 2892 tests. `tsc --noEmit` passed for middleware and
  web. Changed-file ESLint exited 0 with existing warnings in touched files.
  `npx nx build @vizora/middleware --skip-nx-cache` passed with existing
  webpack warnings; `npx nx build @vizora/web --skip-nx-cache` passed with the
  existing Next middleware/proxy warning. `git diff --check` and
  `pnpm security:no-hardcoded-jwts` passed.
- PR #156 merged as `ef12326737cbbe8133148af97468607cc34528c4`. Post-merge
  `main` CI passed. Deployment was not performed because the same dirty/diverged
  prod checkout gate remained blocked.

---

## Completed: Playlist Publish Trust Pass 27 (2026-06-01)

**Branch:** `feat/playlist-publish-trust-pass-27` -> PR #154 -> `main`

**Why now:** Pass 26 is merged with green post-merge `main` CI, but production
deploy remains blocked by dirty/diverged prod-local state. The next
customer-trust blocker from the Pass 26 dashboard review is the playlist card's
`Publish` action claiming success even though it only PATCHes the playlist name
and does not put anything on a screen.

**New primitives introduced:** none. This pass reuses the playlists dashboard,
existing loaded display list, `apiClient.bulkAssignPlaylist`, middleware display
bulk assignment endpoint, and realtime display notification path.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Drift-check playlist publish action and existing display assignment path.
- [x] Write failing tests for fake publish removal and real device assignment.
- [x] Implement assignment modal and bulk assignment through existing APIs.
- [x] Run focused playlist tests.
- [x] Run multi-vector review before broader verification.
- [x] Run broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-playlist-publish-trust-pass-27.md`

**Local evidence:**
- TDD red: playlist tests failed because the card's `Publish` action called
  `updatePlaylist(playlist.id, { name: playlist.name })` immediately, never
  opened a device-targeting flow, and still claimed publish success when no
  display assignment happened.
- Implementation: playlist cards now use `Assign`; the modal selects target
  devices and calls `apiClient.bulkAssignPlaylist`. It blocks empty playlists,
  device-list loading, device-list load failure, and zero paired devices. The
  success toast reports the backend `{ updated }` assignment count and adds
  non-online device copy instead of implying live delivery. Already-assigned
  devices render read-only, and close/selection changes are guarded while an
  assignment is in flight.
- Status-model follow-up: frontend `DisplayStatus` now matches backend reality
  (`online | offline | pairing | error`), realtime event/device page types
  propagate it, and `DeviceStatusIndicator` renders `Pairing` explicitly.
- Review: customer-trust/UX reviewers initially found over-promising delivery
  copy, misleading already-assigned checkboxes, false no-device messaging while
  devices load/fail, in-flight close ambiguity, non-online status gaps, and
  in-flight selection drift. All were fixed and final UX review was CLEAN.
  Runtime/API reviewers were CLEAN throughout: assignment uses the existing
  `bulkAssignPlaylist` API, backend auth/tenant checks remain unchanged, and no
  parallel realtime/delivery path was added.
- Verification: focused playlist suite 22/22 pass; focused playlist +
  realtime-events + status-indicator suites 47/47 pass; status propagation
  reviewer also ran 4 focused suites / 64 tests pass; web `tsc --noEmit` pass;
  changed-file ESLint exits 0 with existing warnings only; full web Jest suite
  96 suites / 1033 tests pass; web production build pass with explicit local
  API/socket env and memory env; repo JWT secret guard pass; `git diff --check`
  pass with CRLF warnings only.
- Browser evidence: local Next production server on port 3001 with browser-
  mocked `/api/v1` responses opened `/dashboard/playlists`, showed the
  assignment modal and non-online copy, submitted `{ displayIds: ['display-2'],
  playlistId: 'playlist-1' }`, displayed the non-online assignment toast, and
  recorded zero page errors. Scratch screenshots were not committed.
- PR #154 merged as `cd1e7681d86f29ce89f0c7fe4d8828d477d81268`. PR CI passed
  audit, build, lint, security, test, and e2e. Remote feature branch was deleted
  manually because `gh pr merge` merged remotely but could not check out local
  `main` while `C:/projects/vizora` had `main` checked out.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  its local `origin/main` is stale at `84e572f2ee0c86230ef42b0817266a1a8a1f2e43`,
  and the checkout remains 17 commits ahead / 96 behind that stale ref with many
  tracked and untracked local changes. Core prod probes remain up: middleware
  200, web 200; realtime `/health` returns the known 404. Many ops/agent PM2
  jobs remain stopped; no services were restarted.

---

## Completed: Dashboard Bulk-Action Safety Pass 26 (2026-06-01)

**Branch:** `feat/customer-dashboard-pass-26`

**Why now:** After Pass 25 merged with green CI, the next customer-dashboard
analysis found multiple customer trust and performance gaps. The safest bounded
first build target is destructive device bulk-action safety: currently device
bulk delete fires immediately, bulk action toasts use selected row counts rather
than backend result counts, and the shared confirmation dialog closes before
async destructive actions finish.

**New primitives introduced:** none. This pass reuses existing dashboard client
pages, `ConfirmDialog`, display bulk endpoints, and API client methods.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch customer UX, frontend performance, and action-safety reviewers.
- [x] Record Pass 26 findings and choose a bounded first build target.
- [x] Write failing tests for async confirmation and device bulk-action safety.
- [x] Implement shared confirmation pending state.
- [x] Implement device bulk-delete confirmation and backend count toasts.
- [x] Run focused tests.
- [x] Run multi-vector review before broader verification.
- [x] Run broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-dashboard-bulk-action-safety-pass-26.md`

**Local evidence:**
- TDD red: shared confirmation test failed because `onClose` fired before an
  async confirm resolved; device tests failed because bulk delete called the API
  before confirmation and bulk action toasts used selected row counts instead of
  backend result counts.
- Implementation: `ConfirmDialog` now awaits async confirm handlers, disables
  actions while pending, keeps the dialog open until success, resets pending
  state before close so reopen is usable, and exposes `role="dialog"` with
  modal label/description semantics. Device bulk delete now opens a confirmation
  dialog, and device bulk delete/playlist/group toasts use `{ deleted }`,
  `{ updated }`, and `{ added }` counts returned by the backend.
- Review: initial destructive-action and runtime reviewers both found a real
  high issue where the shared dialog could reopen with buttons permanently
  disabled; fixed with a reopen regression test. Re-review from both vectors was
  CLEAN, with residual risk limited to no full browser/aXe focus-trap pass and
  existing fire-and-forget ConfirmDialog consumers outside this scope.
- Verification: focused `ConfirmDialog` suite 11/11 pass; focused devices page
  suite 17/17 pass; full web Jest suite 96 suites / 1023 tests pass; web
  `tsc --noEmit` pass; changed-file ESLint exits 0 with existing warnings only;
  web production build pass with explicit local `NEXT_PUBLIC_SOCKET_URL`,
  `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, and memory env; repo JWT secret guard
  pass; `git diff --check` pass with CRLF warnings only.
- PR #152 merged as `84e572f2ee0c86230ef42b0817266a1a8a1f2e43`. PR CI passed
  audit, build, lint, security, test, and e2e. Post-merge `main` CI run
  `26749346574` passed build, security, test, lint, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  `origin/main` is `84e572f2ee0c86230ef42b0817266a1a8a1f2e43`, and the
  checkout is 17 commits ahead / 96 behind with many tracked and untracked
  local changes. Core prod probes remain up: middleware 200, web 200; realtime
  `/health` returns the known 404.

---

## Completed: Realtime Status Catch-Up Performance Pass 25 (2026-06-01)

**Branch:** `feat/performance-readiness-pass-25`

**Why now:** Pass 24 is merged with green post-merge `main` CI, but production
deploy remains blocked by dirty/diverged prod-local state. The next
repo-side performance review found dashboard reconnect catch-up emits one socket
event per display even though the dashboard already handles batch status events.

**New primitives introduced:** none. This reuses the existing realtime gateway,
Socket.IO room model, and `device:status:batch` client event path.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch performance reviewers for upload, pairing/status,
  streaming/realtime, and dashboard bottlenecks.
- [x] Drift-check realtime catch-up code and dashboard batch handler.
- [x] Write focused failing realtime tests proving catch-up emits one batch.
- [x] Implement batched dashboard status catch-up.
- [x] Run multi-vector review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence:**
- TDD red: realtime catch-up tests failed because large/small fleets still
  emitted one `device:status` socket event per display; web hook test failed
  because `useRealtimeEvents` ignored `device:status:batch`.
- Implementation: realtime dashboard catch-up now emits one capped
  `device:status:batch` payload with the same per-device fields; the dashboard
  hook subscribes to batch updates and fans them through the existing
  single-update handler so Devices page row state remains current.
- Review: realtime correctness/security reviewer CLEAN; dashboard
  compatibility reviewer initially found the missing `useRealtimeEvents` batch
  listener, then re-reviewed the fixed diff as CLEAN. Local Claude Code review
  was CLEAN before the web compatibility fix but the post-fix Claude rerun
  exited without usable output, so it is not counted as evidence.
- Verification: focused realtime catch-up test 4/4 pass; full gateway spec
  98/98 pass; full realtime suite 277/277 pass; focused web realtime hook suite
  18/18 pass; full web suite 1017/1017 pass; realtime production build pass;
  web production build pass with explicit local `NEXT_PUBLIC_SOCKET_URL`,
  `NEXT_PUBLIC_API_URL`, and `BACKEND_URL`; changed-file ESLint exits 0 with
  pre-existing warnings only; repo security JWT guard pass; `git diff --check`
  pass with CRLF warnings only.
- Known unrelated verification noise: existing React `act(...)` warnings in
  broader web suites; realtime/web builds show known package/source-map and
  Next middleware deprecation warnings. The first realtime build attempt failed
  with a Windows file-lock in `@vizora/database:build` while tests were running
  in parallel; sequential rerun passed.
- PR #150 merged as `327a642b426e02045d6e02d60439efa89d6f4755`. PR CI passed
  audit, build, lint, security, test, and e2e. Post-merge `main` CI run
  `26745939486` passed build, lint, security, test, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  `origin/main` is `327a642b426e02045d6e02d60439efa89d6f4755`, the checkout is
  17 commits ahead / 93 behind with many tracked and untracked local changes.
  Core prod probes remain up: middleware 200, web 200; realtime `/health`
  returns the known 404. PM2 shows middleware, realtime, and web online.

**Plan/design:**
`docs/plans/2026-06-01-realtime-status-catchup-performance-pass-25.md`

---

## Completed: Analytics Empty-State Trust Pass 24 (2026-06-01)

**Branch:** `feat/analytics-empty-state-trust-pass-24`

**Why now:** Pass 23 is merged and `main` CI is green, but production deploy
remains blocked by dirty/diverged prod-local state. The next bounded
customer-dashboard trust issue is analytics failures being presented as "No
Data Yet."

**New primitives introduced:** none. This uses the existing analytics API
client hooks and dashboard page.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Drift-check analytics dashboard hooks, page states, and tests.
- [x] Write focused failing tests for analytics API failures vs true empty
  responses.
- [x] Implement explicit section/global analytics failure states.
- [x] Run reviewer pass before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence:**
- TDD red: analytics hook/page tests failed before implementation because rejected
  API calls were treated as empty/mock states and summary failure rendered "No
  Data Yet."
- Implementation: `useAnalyticsData` now preserves successful empty arrays as
  true empty state, reports rejected calls as errors, uses user-safe error
  messages, and ignores stale date-range responses. The analytics page now shows
  global and section-level unavailable states and suppresses "No Data Yet" on
  failed loads.
- Review: UX/accessibility/test reviewer CLEAN; hook/API-state reviewer CLEAN.
- Verification: focused hook tests 15/15 pass; focused analytics page tests 9/9
  pass; analytics sweep 34/34 pass; full web Jest 1016/1016 pass; web
  production build pass; changed-file ESLint pass; repo security JWT guard pass;
  `git diff --check` pass with CRLF warnings only.
- Known unrelated verification noise: existing React `act(...)` warnings in
  broader web suites; stale package lint scripts still fail on Next 16/Windows,
  so equivalent ESLint commands were run directly.
- PR #148 merged as `56ba589a2babc1cad4b5d4ce4518bb58266ef673`. PR CI passed
  audit, build, lint, security, test, and e2e. Post-merge `main` CI run
  `26742702487` passed build, lint, security, test, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  `origin/main` is `56ba589a2babc1cad4b5d4ce4518bb58266ef673`, the checkout is
  17 commits ahead / 91 behind with many tracked and untracked local changes.
  Core prod probes remain up: middleware 200, web 200; realtime `/health`
  returns the known 404.

**Plan/design:**
`docs/plans/2026-06-01-analytics-empty-state-trust-pass-24.md`

---

## Completed: Schedule Trust Polish Pass 23 (2026-06-01)

**Branch:** `feat/customer-dashboard-improvements-pass-23`

**Why now:** PR #145 merged with green post-merge `main` CI, but production
deployment remains blocked by dirty/diverged prod-local state. The next
customer-dashboard analysis found the schedules page is the highest-value
bounded customer-facing target: inactive schedules are shown as active and the
conflict-warning UI is never populated.

**New primitives introduced:** none. This uses the existing schedules page and
existing `apiClient.checkScheduleConflicts` endpoint.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #145 after PR CI green and confirm post-merge `main` CI.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Review current schedule UI/API/runtime evidence.
- [x] Write focused failing tests for inactive status badges and conflict
  warnings.
- [x] Implement schedule status and conflict-warning fixes.
- [x] Address first review pass: group-target conflict false negatives, missing
  candidate date range, overnight schedule conflict/active math, raw conflict
  times, silent conflict-check failures, and timezone test underfit.
- [x] Address second review pass: adjacent-day all-day false positives,
  duplicate already-verified device conflict checks, and missing live-region
  semantics for dynamic conflict states.
- [x] Run final multi-subagent code review before broader tests.
- [x] Run focused and broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-schedule-trust-polish-pass-23.md`

**Implementation notes**
- [x] Schedule list badges now render `Active`/`Inactive` from actual
  `isActive`/`active` state.
- [x] Create/edit modal now calls the existing conflict endpoint when target,
  days, and time are present; preview calls include candidate `startDate` and
  edit `endDate` when available.
- [x] Conflict warnings now format backend minute values as `HH:MM`, expose
  `role="status"`, and show `role="alert"` when conflicts cannot be verified.
- [x] Device-target conflict preview caches request/results per candidate so
  adding another selected device does not re-check already verified devices.
- [x] Middleware conflict detection now checks display-group schedules against
  direct-display and overlapping-group schedules under the same organization.
- [x] Middleware weekly time-window math now handles schedules crossing
  midnight and avoids adjacent-day all-day false positives.

**Focused verification**
- [x] Web schedule page test passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/schedules/__tests__/schedules-page.test.tsx`
  - 20 tests / 1 suite.
- [x] Middleware schedule service test passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/schedules/schedules.service.spec.ts`
  - 37 tests / 1 suite.

**Review gate**
- [x] Schedule/runtime reviewer final pass: clean after group overlap,
  overnight, and all-day-adjacency fixes.
- [x] Dashboard UX/test reviewer final pass: clean after formatted conflict
  times, explicit verification failure state, device-preview dedupe, and
  live-region semantics.

**Broader verification**
- [x] Middleware schedules sweep passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=schedules`
  - 2 suites / 55 tests.
- [x] Web schedules sweep passed:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=schedules`
  - 1 suite / 20 tests.
- [x] Full web Jest suite passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  - 96 suites / 1005 tests. Existing unrelated React `act(...)` warnings
    remain in other dashboard suites.
- [x] Full middleware Jest suite passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  - 143 suites / 2887 tests / 1 snapshot.
- [x] Middleware build passed:
  `npx nx build @vizora/middleware --skip-nx-cache`
  - Build completed with known webpack optional-dependency warnings.
- [x] Web production build passed with required local build env:
  `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web --skip-nx-cache`
  - Initial run without `NEXT_PUBLIC_SOCKET_URL` failed at the expected
    production CSP env precondition; rerun with env passed.
- [x] ESLint completed with no errors:
  `ESLINT_USE_FLAT_CONFIG=false npx eslint --ext .ts,.tsx middleware/src realtime/src`
  - 0 errors / 195 warnings. Warnings are pre-existing broad repo warnings.
- [x] JWT secret guard passed:
  `pnpm security:no-hardcoded-jwts`
  - No hardcoded JWT-looking tokens found.
- [x] Whitespace check passed:
  `git diff --check`
  - Exit 0; Windows CRLF conversion warnings only.

**Current merge/deploy state**
- [x] PR #146 merged at
  `b373760f373e31e0f0c3fb76f9b0ddef7c396e74`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI run `26739722438` completed successfully: security,
  lint, build, test, and e2e all green.
- [x] PR #145 merged at
  `89a33b99d15abe82d99d1f767e6d5475f320c155`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI run `26737775963` completed successfully: security,
  lint, build, test, and e2e all green.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, remote `main` is
  `b373760f373e31e0f0c3fb76f9b0ddef7c396e74`, and prod is
  `ahead 17, behind 89` with many tracked edits and untracked files. Core PM2
  services are online; middleware `/api/v1/health` and web `/` returned 200,
  while realtime `/health` remains 404. No
  production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

**Customer dashboard analysis**
- [x] Schedules page trust: inactive schedules shown as active.
- [x] Schedules page trust: conflict warning panel is dead.
- [x] Schedules page trust: timezone selector implies schedule timezone support,
  while runtime uses display timezone.
- [x] Analytics empty states can make fetch errors look like "No Data Yet".
- [x] Analytics labels need more signage-specific wording.
- [x] Content tag filters are hardcoded instead of metadata-driven.
- [x] AI Designer CTA can overpromise when backend capability is unavailable.
- [x] Performance backlog: dashboard org broadcasts inspect device sockets,
  playlist fan-out is unbounded, content impressions write synchronously,
  dashboard status fetches up to 1000 displays, response sanitization is
  CPU-heavy, upload has multiple full-file passes, and pairing active-list scans
  Redis keyspace.

---

## Completed: Security Token Guard Pass 22 (2026-06-01)

**Branch:** `feat/customer-dashboard-improvements-pass-22`

**Why now:** PR #144 merged with green PR checks and green post-merge `main`
CI, but production deployment remains blocked by a dirty/diverged checkout. The
next read-only customer/performance/release review found several valid targets;
the smallest high-severity repo-side gap is committed long-lived JWT-looking
tokens in manual verification scripts plus no blocking CI guard for that class.

**New primitives introduced:** one repository-local security scan script,
`scripts/security/check-no-hardcoded-jwts.js`. No new runtime service, route,
database model, migration, agent, MCP tool, Hermes skill, provider, or
infrastructure primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Dispatch read-only customer UX, backend/performance, and release/security
  reviewers after PR #144.
- [x] Select highest-value bounded target.
- [x] Add red hardcoded-JWT guard and confirm it catches existing committed
  tokens.
- [x] Replace manual-script committed JWTs with required environment variables.
- [x] Wire the guard into CI security workflows before advisory dependency
  audit.
- [x] Address first review pass: stage/include the new guard script at commit
  time, derive `test-content-delivery` playlist data from local API state or
  env, and make thumbnail device-token validation fail fast/nonzero.
- [x] Address re-review pass: support nested playlist list envelopes and
  document `VIZORA_TEST_*` variables in `.env.example` and `CLAUDE.md` (no
  tracked `AGENTS.md` exists in this worktree).
- [x] Address final manual-script review: use direct `/api/v1` middleware
  paths and make thumbnail/content verification failures exit nonzero.
- [x] Address final response-shape review: unwrap current response envelopes in
  older manual scripts and use the actual `/api/v1/displays` status source.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader verification.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-security-token-guard-pass-22.md`

**Reviewer target synthesis**
- [x] Customer UX reviewer found valid current dashboard issues: inactive
  schedules shown as active, dead schedule conflict warning UI, fictional
  schedule timezone selector, hardcoded content tag filters, synthetic
  analytics labels, and AI Designer CTA prominence while backend capability is
  unavailable.
- [x] Backend/performance reviewer found valid performance targets: dashboard
  org broadcasts still inspect device sockets, playlist fan-out can send
  unbounded per-display internal requests, content impressions write
  synchronously, dashboard status fetches up to 1000 displays, response
  sanitization is CPU-heavy, upload does multiple full-file passes, and pairing
  active-list scans Redis keyspace.
- [x] Release/security reviewer found valid launch-readiness targets: CI E2E is
  still thin for customer-1, dependency audit is advisory, long-lived JWTs were
  committed in manual scripts, prod deploy is unsafe until prod checkout is
  reconciled, and customer-1 operator gates remain open.
- [x] Selected first bounded target for this pass: committed JWT cleanup plus a
  blocking CI guard, because it is high-severity, repo-side, testable, and does
  not require operator credentials.

**Operator-only residual**
- [ ] If any removed token was ever valid in shared, staging, or production-like
  environments, revoke/rotate it outside the repo. This pass prevents future
  commits but cannot invalidate already-issued tokens.

**Review gate**
- [x] Security/CI reviewer CLEAN after staging follow-up. Confirmed the guard
  script is staged, package script is wired, both CI security workflows run it
  before advisory audit, `.env.example` / `CLAUDE.md` document the
  `VIZORA_TEST_*` inputs, no full JWT-shaped tracked tokens remain, and diff
  check passes.
- [x] Manual-script/runtime reviewer CLEAN after follow-ups. Confirmed direct
  middleware paths use `/api/v1`, `test-content-delivery` uses
  `/api/v1/displays` and nested playlist envelopes, `test-end-to-end-streaming`
  unwraps current auth/content/playlist response shapes, and
  `test-thumbnails-http` unwraps paginated content and exits nonzero on check
  failures.

**Verification**
- [x] Hardcoded JWT guard passed:
  `pnpm security:no-hardcoded-jwts`.
- [x] Syntax checks passed:
  `node --check scripts/security/check-no-hardcoded-jwts.js`,
  `node --check realtime/test-content-delivery.js`,
  `node --check realtime/test-device-realtime.js`,
  `node --check realtime/test-end-to-end-streaming.js`,
  `node --check scripts/test-thumbnails-http.js`.
- [x] Diff hygiene passed: `git diff --check` and `git diff --cached --check`.
- [x] Realtime unit suite passed:
  `pnpm --filter @vizora/realtime test -- --runInBand` - 12 suites / 275 tests.

---

## Completed: Display Response Projection Pass 21 (2026-06-01)

**Branch:** `feat/customer-dashboard-improvements-pass-21`

**Why now:** PR #143 merged the shared dashboard socket pass and post-merge
`main` CI is green, but deployment remains blocked by dirty/diverged prod-local
state. A fresh customer/performance/release review found several valid next
targets; local drift-check also found the authenticated display API still
returns full Prisma `Display` rows, which can include hashed device JWTs,
pairing-code fields, and transient socket IDs. This pass closes that sensitive
response surface and reduces display list/detail payloads.

**New primitives introduced:** one shared Prisma display response projection
module. No new runtime service, route, database model, migration, agent, or
infrastructure primitive.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #143 after PR CI green and confirm post-merge `main` CI.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch read-only customer UX, backend/performance, and test/release
  readiness reviewers.
- [x] Drift-check display response shape against current code.
- [x] Select highest-value bounded target.
- [x] Write scoped plan/design before code.
- [x] Add focused failing display response projection tests.
- [x] Implement safe display list/detail/update projections.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #143 merged at
  `384b584054446547ec3d64a37f7f6839dc10ac39`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI for `384b584054446547ec3d64a37f7f6839dc10ac39`
  completed successfully: build, test, lint, security, and e2e all green.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, while its stale local
  `origin/main` is `1618f31f9e151ca394f4e0471e457267805415a9`; prod is
  `ahead 17, behind 77` with many tracked edits and untracked files. No
  production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

**Plan/design:**
`docs/plans/2026-06-01-display-response-projection-pass-21.md`

**Implementation notes**
- [x] Added `middleware/src/modules/displays/display-response.select.ts` with
  shared safe list/detail/embedded/member projections.
- [x] Updated display create/list/detail/update response paths to use explicit
  safe Prisma `select`s.
- [x] Updated display-group nested display responses to reuse the safe embedded
  projection.
- [x] Changed QR overlay update/delete service contracts to return the saved
  overlay config / `void` instead of re-reading and returning the display row.
- [x] Tightened pairing-service internal queries to select only the fields each
  path needs: token-only paired check, id/org status lookup, existing id/location
  read, and safe result fields on create/update.

**Review gate**
- [x] Security/API reviewer CLEAN after pairing follow-up. Confirmed response
  paths omit `jwtToken`, `pairingCode`, `pairingCodeExpiresAt`, and `socketId`;
  tenant/API conventions remain intact; QR overlay return shape matches web/API.
- [x] Regression/dashboard reviewer CLEAN except for expected low staging note:
  new selector file must be staged before commit. This will be closed at commit
  staging.

**Verification so far**
- [x] Red focused projection tests reproduced missing explicit safe selectors
  before implementation.
- [x] Focused display/pairing run passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/pairing.service.spec.ts src/modules/displays/displays.service.spec.ts src/modules/displays/displays.controller.spec.ts src/modules/display-groups/display-groups.service.spec.ts src/modules/displays/displays.service.bulk.spec.ts`
  - 5 suites / 137 tests.
- [x] Broader display/display-group unit run passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/pairing.service.spec.ts src/modules/displays/pairing.controller.spec.ts src/modules/displays/displays.controller.spec.ts src/modules/displays/displays.service.spec.ts src/modules/displays/displays.service.bulk.spec.ts src/modules/displays/displays.service.tag-events.spec.ts src/modules/display-groups/display-groups.service.spec.ts src/modules/display-groups/display-groups.controller.spec.ts`
  - 8 suites / 166 tests.
- [x] Middleware typecheck passed:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`.
- [x] Changed-file ESLint passed with only the existing ESLintRC deprecation
  notice:
  `ESLINT_USE_FLAT_CONFIG=false npx eslint ...`.
- [x] Middleware build passed:
  `npx nx build @vizora/middleware`; existing webpack warnings remain.
- [x] Full middleware unit suite passed:
  `pnpm --filter @vizora/middleware test -- --runInBand` - 143 suites /
  2,884 tests.
- [x] `git diff --check` passed with Windows CRLF warnings only.
- [x] PR #144 merged at
  `929b95764a96dcca2786a5e36606be457207f47b`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI run `26735439846` completed successfully: audit,
  build, e2e, lint, security, and test all green.
- [x] Post-merge prod deploy gate re-checked and remains blocked:
  `/opt/vizora/app` is dirty/diverged (`ahead 17, behind 77`) with many tracked
  edits and untracked files. No production pull, reset, stash, env edit, service
  restart, DB mutation, or deploy performed.

**Reviewer target synthesis**
- [x] Customer UX reviewer found valid current dashboard issues: inactive
  schedules shown as active, dead schedule conflict warning UI, hardcoded
  content tag filters, and synthetic analytics labels.
- [x] Backend/performance reviewer found a valid next performance target:
  dashboard-only org broadcasts still iterate device sockets and can trigger
  per-device DB checks.
- [x] Test/release reviewer found a larger release-gate target: middleware E2E
  currently gates only the agents suite and older specs still use `/api`.
- [x] Selected first bounded target for this pass: safe display response
  projections, because it is a small high-severity security/payload fix in a
  customer-facing API and does not require operator action.

---

## Completed: Dashboard Customer Improvements Pass 20 (2026-06-01)

**Branch:** `feat/dashboard-customer-improvements-pass-20`

**Why now:** PR #142 merged the content-list payload pass with green PR checks,
but production deployment remains blocked by a dirty/diverged production
checkout. The next autonomous step is to review the dashboard as a customer,
pick the highest-value repo-side improvement that is small enough to build,
test, review, merge, and keep deployment gated until prod state is safe.

**New primitives introduced:** one dashboard-scoped `SocketProvider` in the
existing web `useSocket` module. No new transport, gateway, event type,
process, backend route, agent, or deployment primitive.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #142 after full PR CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch read-only customer UX, backend/performance, and test/release
  readiness reviewers.
- [x] Reconcile tracker/backlog stale state after recent merges.
- [x] Select the highest-value buildable repo-side target.
- [x] Write scoped plan/design before code.
- [x] Add focused failing shared-socket tests.
- [x] Implement dashboard shared Socket.IO provider.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [x] PR, CI, merge. PR #143 merged at
  `384b584054446547ec3d64a37f7f6839dc10ac39`.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #142 merged at
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI for `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`
  completed successfully.
- [x] PR #143 merged at
  `384b584054446547ec3d64a37f7f6839dc10ac39`; PR CI green for audit, build,
  e2e, lint, security, and test. Post-merge `main` CI for `384b584054` also
  completed successfully.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, while `origin/main` is
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`; prod is `ahead 17, behind 77`
  with many tracked edits and untracked files. No production pull, reset,
  stash, env edit, service restart, DB mutation, or deploy performed.

**Plan/design:**
`docs/plans/2026-06-01-dashboard-shared-socket-pass-20.md`

**Selected target**
- [x] Current-branch drift check confirmed several stale UX findings are
  already fixed on `origin/main` (multi-file upload queue, filtered content
  empty state, health page mock telemetry, and multi-device schedule creation).
- [x] Remaining buildable customer/performance target: share one dashboard
  Socket.IO connection across notification bell, device status context,
  page-level realtime hooks, and device preview instead of creating one client
  per hook instance.

**Focused verification**
- [x] Red/green shared-socket hook test added. Initial focused run failed
  because `SocketProvider` did not exist.
- [x] Multi-vector code review CLEAN after two reviewer passes:
  architecture/tenant/listener-isolation review and UX/release/regression
  review. Initial findings added missing listener-isolation, layout
  integration, tenant fallback, and custom-option fallback coverage; all were
  fixed before broader tests.
- [x] Focused web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/lib/hooks/__tests__/useSocket.test.ts src/lib/hooks/__tests__/useRealtimeEvents.test.ts src/app/dashboard/__tests__/dashboard-page.test.tsx src/app/dashboard/__tests__/dashboard-layout.test.tsx`
  (4 suites / 47 tests).
- [x] Web TypeScript passed:
  `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`.
- [x] Changed-file ESLint passed with warnings only:
  `ESLINT_USE_FLAT_CONFIG=false npx eslint web/src/lib/hooks/useSocket.ts web/src/lib/hooks/__tests__/useSocket.test.ts web/src/app/dashboard/layout.tsx web/src/app/dashboard/__tests__/dashboard-layout.test.tsx`
  (legacy explicit-`any` / test `require()` warnings only).
- [x] Full web Jest passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (96 suites / 1001 tests). Existing unrelated React `act(...)` warnings
  remain in older suites.
- [x] Web build passed:
  `$env:NODE_OPTIONS='--max-old-space-size=4096'; $env:NEXT_PUBLIC_SOCKET_URL='http://localhost:3002'; $env:NEXT_PUBLIC_API_URL='http://localhost:3000/api/v1'; $env:BACKEND_URL='http://localhost:3000'; npx nx build @vizora/web`.
- [x] `git diff --check` passed with CRLF normalization warnings only.

---

## Completed: Content List Payload Performance Pass 19 (2026-06-01)

**Branch:** `feat/content-list-payload-pass-19`

**Why now:** PR #141 merged playlist-builder server-side content search and CI
is green, but production deployment remains blocked by dirty/diverged prod
state. The next customer-visible performance gap is list payload size: root and
folder content-list endpoints still fetch full content rows even though the
dashboard cards need only summary fields.

**New primitives introduced:** no new runtime primitives. This pass adds a
shared content-list projection and uses the existing `GET /content/:id` detail
endpoint for modal-only dashboard hydration.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #141 after full CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Write scoped plan/design for content-list payload slimming.
- [x] Add focused failing middleware and web tests.
- [x] Implement backend list projection and frontend detail hydration.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [x] PR, CI, merge. PR #142 merged at
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #141 merged at
  `6fcc39deb60634037be37758843aa638dcf1cb3d`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] PR #142 merged at
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`; PR CI green for audit, build,
  e2e, lint, security, and test.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is dirty and
  ahead/behind stale prod `origin/main`; no production pull, reset, stash, env
  edit, service restart, DB mutation, or deploy performed.

**Plan/design:**
`docs/plans/2026-06-01-content-list-payload-performance-pass-19.md`

**Review**
- [x] Backend/API/data-contract reviewer CLEAN: list projection keeps tenant
  scoping, valid Prisma select shape, envelope-compatible paginated response,
  and full-detail paths still use `findOne` / device-specific fetches.
- [x] Frontend reviewer found stale detail races, edit hydration gap, and
  repeated-detail request fanout. Fixed with request invalidation, pending
  request dedupe, edit detail hydration, pagination invalidation, and regression
  tests. Follow-up frontend re-review CLEAN.
- [x] Test/CI reviewer found the untracked helper risk and stale tracker counts.
  The helper will be staged with the commit; verification counts below are
  updated after final focused/broad runs.

**Verification**
- [x] Focused middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="content.service|folders.service"`
  (2 suites / 140 tests).
- [x] Focused web content dashboard tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/content/__tests__/content-page.test.tsx`
  (1 suite / 42 tests).
- [x] Full middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  (143 suites / 2879 tests).
- [x] Full web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (95 suites / 994 tests; existing unrelated React `act(...)` and jsdom
  navigation warnings remain).
- [x] TypeScript checks passed:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` and
  `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`.
- [x] Changed-file ESLint passed with warnings only:
  `npx eslint middleware/src/modules/content/content.service.ts middleware/src/modules/content/content-list-select.ts middleware/src/modules/folders/folders.service.ts web/src/app/dashboard/content/page-client.tsx web/src/app/dashboard/content/__tests__/content-page.test.tsx`
  (legacy explicit-`any` warnings remain in `page-client.tsx`).
- [x] Builds passed:
  `npx nx build @vizora/middleware`,
  `npx nx build @vizora/realtime`, and
  `npx nx build @vizora/web` with local public URL env vars.
- [x] `git diff --check` passed with CRLF warnings only.
- [x] Targeted Playwright content/folder E2E attempted:
  `npx playwright test e2e-tests/04-content.spec.ts e2e-tests/20-content-folders.spec.ts --reporter=list`
  failed 14/14 at auth fixture setup with `ECONNREFUSED ::1:3000`
  (`POST http://localhost:3000/api/v1/auth/register`). Docker Desktop is not
  available and no services are listening on ports 3000/3001/3002, so this is
  an environment failure before the changed content flows are exercised.

---

## In Progress: Dashboard Summary Performance Pass 15 (2026-05-31)

**Branch:** `feat/customer-dashboard-pass-15`

**Why now:** PR #137 merged server-side content-library pagination/filtering,
but the dashboard overview still risks all-page content/playlist refreshes just
to compute top-level counts. A customer with a real media library should see the
overview hydrate from aggregate counters and tiny recent-activity samples.

**New primitives introduced:** two aggregate fields on the existing analytics
summary response: `processingContent` and `activePlaylists`.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #137 after CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Write scoped plan/design for dashboard summary performance.
- [x] Collect multi-subagent customer/performance/security/test review
  findings before test gate.
- [x] Add focused failing tests.
- [x] Implement analytics-summary-backed dashboard overview.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-05-31-dashboard-summary-performance-pass-15.md`

**Current merge/deploy state**
- [x] PR #137 merged at
  `7d32929678162e60ad7560f7c3cc81db4c9fc019`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is on `main` at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, ahead 17 and behind 77 from
  `origin/main`, with tracked edits across Hermes scripts, seed templates,
  thumbnails, landing UI, Tailwind config, plus untracked operator approvals,
  docs, and preview assets. No production pull, reset, stash, env edit,
  service restart, DB mutation, or deploy performed.

**Review**
- [x] Pre-implementation customer/performance/security/test review found the
  next high-value repo-side dashboard/performance slice: replace overview
  all-page refreshes with analytics aggregates and bounded activity samples.
- [x] Backend contract/security review CLEAN: `/analytics/summary` remains
  tenant-scoped, envelope-compatible, and safe for `viewer` read access.
- [x] Frontend/runtime review found two blockers: missing server activity
  samples were not retried, and late summary refreshes could overwrite fresher
  realtime device counts. Both were fixed and regression-tested.
- [x] Test/CI review found `AnalyticsSummary` should keep backend-required
  fields required in web types and that viewer role metadata needed a test.
  Both were fixed.
- [x] Follow-up review CLEAN after fixes.

**Verification**
- [x] Focused middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="analytics.(service|controller)"`
  (2 suites, 47 tests).
- [x] Focused dashboard tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/__tests__/dashboard-page.test.tsx src/app/dashboard/__tests__/dashboard-server-page.test.tsx`
  (2 suites, 20 tests).
- [x] Broader dashboard web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard"`
  (22 suites, 303 tests; pre-existing React `act(...)` warnings remain).
- [x] Full middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  (143 suites, 2874 tests).
- [x] Full web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (95 suites, 982 tests; pre-existing React `act(...)` and jsdom navigation
  warnings remain).
- [x] TypeScript passed:
  `pnpm --filter @vizora/web exec tsc --noEmit` and
  `pnpm --filter @vizora/middleware exec tsc --noEmit`.
- [x] Builds passed:
  `npx nx build @vizora/middleware`, `npx nx build @vizora/realtime`, and
  `npx nx build @vizora/web` with the standard local public URL env vars.
  The first realtime build attempt failed only because it ran concurrently with
  middleware build and Windows locked `packages/database/dist/generated/prisma`;
  sequential rerun passed.
- [x] Changed-file ESLint passed with warnings only; `git diff --check` passed
  with CRLF warnings only.

---

## Completed: Content Library Performance Pass 14 (2026-05-31)

**Branch:** `feat/customer-performance-pass-14`

**Why now:** PR #136 merged the real dashboard health/storage trust pass and CI
was green, but production deployment remains blocked by dirty/diverged prod
state. The next buildable customer-performance gap is the content library:
it still loads all content rows and filters client-side, which can become slow
or hit the pagination safety cap for real customer libraries.

**New primitives introduced:** bounded `search`, `dateRange`, and `tagNames`
content-list query parameters plus paged content-library dashboard state.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #136 after full CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Write scoped plan/design for content-library server filtering and
  pagination.
- [x] Run multi-subagent pre-implementation review/analysis.
- [x] Add focused failing tests.
- [x] Implement backend query filters and web paged loading.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #136 merged at
  `35609734a185366f981efc47246e46229836f22d`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] PR #137 merged at
  `7d32929678162e60ad7560f7c3cc81db4c9fc019`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is dirty and
  ahead/behind stale prod `origin/main`, with many local template/web/script
  changes and untracked operator/docs assets. No production pull, reset, stash,
  env edit, service restart, DB mutation, or deploy performed.

**Plan/design:**
`docs/plans/2026-05-31-content-library-server-filter-pagination-pass-14.md`

**Selected fix bundle**
- [x] Added tenant-scoped server filters for content library lists:
  `search`, `dateRange`, and `tagNames` now share the middleware DTO and
  Prisma where-builder for root and folder-scoped content.
- [x] Added a folder/content list index:
  `Content(organizationId, folderId, createdAt DESC)`.
- [x] Updated the dashboard content library to request bounded pages instead
  of fetching every content row before client-side filtering.
- [x] Preserved modal-only lazy loading for push/add-to-playlist option data.

**Review**
- [x] Pre-implementation review:
  customer/UX and backend/API reviewers confirmed the highest-value small
  gap was content-library server-side filtering/pagination. The UX reviewer
  inspected the main checkout instead of this worktree, so its comments were
  treated as directional and reconciled against local code truth.
- [x] Backend/API/data code review CLEAN. Residual risk accepted:
  legacy `metadata.tags` JSON fallback is exact-case while relation-backed
  tag filtering is case-insensitive.
- [x] Dashboard UX/performance review found and fixes landed for an unstable
  toast dependency refetch loop, stale pagination after deleting the only item
  on a later page, stale page/search fetch sequencing, and mobile paginator
  wrapping.
- [x] Targeted re-review CLEAN after the dashboard fixes.

**Verification**
- [x] Focused middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="content-query.dto|content.service|content.controller|folders.service|folders.controller"`
  (10 suites / 352 tests).
- [x] Focused web content tests passed after final cleanup:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/content"`
  (1 suite / 35 tests).
- [x] Full middleware Jest passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  (143 suites / 2873 tests).
- [x] Full web Jest passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (95 suites / 980 tests). Existing unrelated React `act(...)` and jsdom
  navigation warnings remain in the broader suite.
- [x] Prisma validate passed for `packages/database/prisma/schema.prisma`.
- [x] TypeScript checks passed for middleware and web.
- [x] Production builds passed with required local verification env:
  `NEXT_PUBLIC_SOCKET_URL=http://localhost:3002`,
  `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`,
  `BACKEND_URL=http://localhost:3000`.
- [x] `git diff --check` passed; Windows CRLF conversion warnings only.

**Residual risks / deploy gate**
- [x] CI green and PR #137 merged.
- [x] Production deploy still blocked by the dirty/diverged prod checkout.
  No production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

---

## Completed: Customer/Performance Readiness Pass 11 (2026-05-31)

**Branch:** `feat/performance-readiness-pass-11`

**Why now:** PR #133 merged the upload-memory-pressure fix and all checks are
green, but production deploy is still blocked by dirty/diverged prod-local
state. The next autonomous slice should use fresh customer-dashboard,
performance, and production-risk reviews to pick repo-side issues that are
small enough to build, test, review, merge, and safely defer deploy if the prod
checkout remains unsafe.

**New primitives introduced:** `GenericApiDataSource` bounded response reader
and local lazy-load guards for modal-only dashboard option data.

**Hermes-first analysis:** not applicable yet. This pass will avoid business
agent, MCP, Hermes skill, AI/provider, or spend paths unless a reviewer finds a
specific existing-agent gap that must use the Hermes/MCP substrate.

**Plan**
- [x] Merge PR #133 after full CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Run multi-subagent customer, performance, and production-risk scans before
  selecting a build target.
- [x] Reconcile reviewer findings with backlog/repo truth and select the
  smallest high-value buildable bundle.
- [x] Write/update a short design plan for selected fixes.
- [x] Add focused failing tests.
- [x] Implement scoped fixes.
- [x] Run focused red/green tests, then multi-subagent code review.
- [x] Run broader affected tests/builds/typecheck.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #133 merged at
  `153091861732b5971e76cbff456763a8e2619ef6`; CI green for audit, build,
  e2e, lint, security, and test.
- [x] No open GitHub PRs after #133 merge.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is `ahead 17, behind 73`
  from `origin/main=153091861732b5971e76cbff456763a8e2619ef6`, with many dirty
  template/web/script files and untracked operator-approval/docs assets.
- [x] Prod runtime probe: middleware/web/realtime PM2 processes are online and
  middleware health is OK; several ops/Hermes cron processes are stopped. No
  production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

**Plan/design:** `docs/plans/2026-05-31-performance-readiness-pass-11.md`

**Selected fix bundle**
- [x] Cap Generic API widget response bodies before JSON parsing.
- [x] Lazy-load content push/add-to-playlist modal options instead of loading
  devices/playlists on content-page mount.
- [x] Skip redundant devices-page client refetches only when server pagination
  metadata proves the server props include the complete devices/playlists list.

**Focused verification and review**
- [x] Focused tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=generic-api.data-source`
  (35/35) and
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/(content|devices)"`
  (44/44).
- [x] Middleware reviewer re-review CLEAN after adding stream cancellation on
  oversized Generic API responses.
- [x] Dashboard reviewer re-review CLEAN after fixing incomplete first-page
  devices props, modal lazy-load error states, and playlist option refresh after
  add-to-playlist.
- [x] Broader verification passed:
  middleware full Jest (143 suites / 2846 tests), web full Jest (94 suites /
  969 tests after review fixes), middleware and web TypeScript checks,
  `git diff --check`, middleware build, web production build, realtime build,
  and CI-equivalent middleware/realtime lint. Full ad-hoc web-inclusive ESLint
  still has a pre-existing repo warning/error backlog outside this branch;
  changed-file lint exits 0 with warnings only.
- [x] Final multi-agent review: backend/security/resource review CLEAN; dashboard
  review low findings fixed and targeted re-review CLEAN.

**Reviewer findings deferred from this slice**
- [ ] Shared dashboard Socket.IO provider.
- [ ] Full server-side content-library pagination/search.
- [ ] Playlist index summary payload.
- [ ] Template refresh overlap guard and DB-side refresh-enabled scan.
- [ ] Real dashboard health/quota cards.
- [ ] API-key customer surface cleanup.

---

## Completed: Upload Pressure Readiness Pass 10 (2026-05-31)

**PR / merge commit:** #133 /
`153091861732b5971e76cbff456763a8e2619ef6`

**Branch:** `feat/performance-readiness-pass-10`

**Why now:** Pass 9 hardened content streaming and display recovery, but the
largest remaining customer-critical upload bottleneck is still the middleware
and dashboard accepting large files in ways that can drive avoidable memory and
concurrency pressure. This pass stays repo-side and does not require secrets,
live hardware, production env edits, or production state mutation.

**New primitives introduced:** small helpers in existing modules only:
`FileValidationService.validateFileAtPath`, `StorageService.uploadFileFromPath`,
and private `ContentController` upload-temp cleanup helpers.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from merged `origin/main`.
- [x] Re-check pass-9 deploy gate and keep production deployment blocked until
  `/opt/vizora/app` is reconciled.
- [x] Write plan/design for disk-backed upload and dashboard backpressure fixes.
- [x] Run multi-subagent design review before tests.
- [x] Add focused failing tests for file-path validation, upload-from-path, temp
  cleanup, and dashboard upload backpressure.
- [x] Implement bounded middleware/dashboard upload-pressure fixes.
- [x] Run focused red/green tests.
- [x] Run multi-subagent code review before broader tests.
- [x] Run broader affected tests/builds/typecheck.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Deployment gate inherited from pass 9**
- [x] PR #132 merged at `4383c09b75f3cdbba0d0965ce477fe135d6439d6`; CI green
  for audit, lint, security, build, test, and e2e.
- [x] Prod deploy blocked after merge: `/opt/vizora/app` is still dirty and now
  `ahead 17, behind 70` from `origin/main=4383c09b75f3cdbba0d0965ce477fe135d6439d6`.
- [x] Prod core services health check is OK; no deploy, pull, reset, stash, or
  service restart performed.

**Plan/design:** `docs/plans/2026-05-31-upload-pressure-readiness-pass-10.md`

**Selected fix bundle**
- [x] Switch content upload and replace-file interceptors to disk-backed temp
  storage while preserving the 100MB HTTP limit.
- [x] Add file-path validation that hashes by stream, checks offset-aware RIFF
  signatures, scans full PDFs for active-content markers, and scans the first
  suspicious-content window for other media.
- [x] Add MinIO upload-from-path using a read stream and known size.
- [x] Preserve buffer-backed direct controller tests and local-dev fallback behavior.
- [x] Clean temp files on upload success/failure and after image thumbnail
  background generation.
- [x] Add dashboard upload guards: per-type max-size enforcement, bounded queue,
  and single-concurrency large uploads.

**Focused verification**
- [x] Red run:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|storage.service|content.controller"` -
  failed on missing `validateFileAtPath`, `uploadFileFromPath`, path-based
  thumbnailing, RIFF subtype checks, and late-PDF scanning.
- [x] Red run:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/content"` -
  failed on video concurrency, cumulative queue cap, rejected-file reporting,
  and partial-failure retry labels.
- [x] Green run:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|storage.service|content.controller"` -
  pass, 8 suites / 293 tests.
- [x] Green run:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/content"` -
  pass, 1 suite / 25 tests.

**Review gate**
- [x] Design review found thumbnail temp-file ownership, local fallback, temp
  root/cleanup, RIFF subtype, PDF full-scan, and dashboard backpressure gaps;
  all selected implementation gaps fixed except durable orphan-cleanup retry,
  which remains deferred.
- [x] Code review found web typecheck failure from `onDropRejected` typing;
  fixed by using `FileRejection`.
- [x] Code review found `react-dropzone` `maxFiles` rejected over-limit drops
  before manual queue truncation; fixed by removing `maxFiles` and asserting
  the manual queue cap owns truncation.
- [x] Final delta review after all fixes: middleware/upload and dashboard/upload
  reviewers both CLEAN.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `git diff --check` - pass with expected LF-to-CRLF warnings only.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2842 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 94 suites / 960 tests
  with pre-existing React `act(...)` and jsdom navigation warnings only.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/web` with local API/socket env and 4096MB heap - pass
  with existing Next middleware/proxy and TS project-reference warnings.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 12 suites / 273 tests.
- [x] `npx nx build @vizora/realtime` - pass when run serially; earlier parallel
  run failed on a Windows file lock in `@vizora/database:build`.
- [x] `pnpm test:ops` - pass, 5 tests.
- [x] Lint equivalent on Windows:
  `$env:ESLINT_USE_FLAT_CONFIG='false'; pnpm exec eslint --no-error-on-unmatched-pattern --ext .ts,.tsx "middleware/src/**/*.ts" "middleware/src/**/*.tsx" "realtime/src/**/*.ts" "realtime/src/**/*.tsx"` -
  pass with warnings only. The literal `pnpm lint` script is POSIX-env syntax
  and fails under PowerShell before ESLint starts.
- [x] `pnpm --dir display test:ci` - pass, 6 suites / 126 tests.
- [x] `pnpm --dir display typecheck` - pass.
- [x] `pnpm --dir display build` - pass.
- [x] `NODE_OPTIONS=--use-system-ca pnpm audit --audit-level=high` - fails with
  150 dependency advisories (1 critical, 56 high). CI marks audit
  continue-on-error; dependency upgrades are deferred to a dedicated security pass.
- [x] PR #133 opened. Initial CI build failed on Linux because `multer` was
  only available transitively in local installs; fixed by declaring
  `multer@2.1.1` in `@vizora/middleware` and updating the lockfile importer.
- [x] Post-CI-fix verification: `pnpm install --frozen-lockfile --offline
  --ignore-scripts`, `npx nx build @vizora/middleware`, `pnpm --filter
  @vizora/middleware exec tsc --noEmit --pretty false`, and `git diff --check`
  pass locally.

**Deferred follow-ups**
- [ ] True multipart/chunked resumable uploads with server-side session state.
- [ ] Background thumbnail queue instead of in-process fire-and-forget work.
- [ ] Server-backed content-library pagination/search plus thumbnail lazy/virtualized rendering.
- [ ] Shared dashboard realtime socket provider for status, notifications, and route events.

---

## Completed: Performance Readiness Review Pass 9 (2026-05-31)

**Branch:** `feat/performance-readiness-pass-9`
**PR / merge commit:** #132 / `4383c09b75f3cdbba0d0965ce477fe135d6439d6`

**Why now:** PR #131 merged the bounded dashboard contract fixes. The next
autonomous slice is a comprehensive repo-side performance/code-review pass over
customer-critical flows: content upload, pairing, content streaming/playback,
middleware hot paths, and dashboard workflows. Production deploy remains blocked
by dirty/diverged prod-local state, so this pass stays inside buildable,
testable repo work.

**New primitives introduced:** none planned. Prefer existing NestJS modules,
Prisma models, storage services, realtime gateway, web API client, and dashboard
patterns.

**Hermes-first analysis:** not applicable unless a selected fix touches
business agents, MCP tools, Hermes skills, or AI/provider spend paths.

**Plan**
- [x] Start fresh branch from merged `origin/main`.
- [x] Re-check production deploy gate after PR #131 merge.
- [x] Run multi-subagent performance/code-review analysis.
- [x] Write plan/design for selected buildable fixes.
- [x] Add focused failing tests/benchmarks where practical.
- [x] Implement bounded performance/readiness fixes.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader tests/builds/browser checks.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Deployment gate after PR #131**
- [x] PR #131 merged at `58df1a276b8252dba7145c75705ae4deabde431f` with CI green.
- [x] Prod deploy blocked: `/opt/vizora/app` is still `ahead 17, behind 66`, has
  many modified/untracked prod-local files, and prod `origin/main` is stale while
  remote `main` is `58df1a276b8252dba7145c75705ae4deabde431f`.
- [x] Prod core services health check is OK; no deploy/restart performed.

**PR / CI / deployment**
- [x] PR #132 opened from `105f081ba8acb0b1f298d93dd53bdf9d68df74f3`.
- [x] GitHub CI green: audit, lint, security, build, test, and e2e.
- [x] PR #132 merged at `4383c09b75f3cdbba0d0965ce477fe135d6439d6`.
- [x] Deployment gate checked after merge: production health OK, core PM2
  services online, but `/opt/vizora/app` is dirty/diverged (`ahead 17, behind 70`),
  so deploy was not attempted.

**Analysis feed**
- [x] Middleware/storage reviewer prioritized streaming-upload memory pressure,
  unsupported multi-range playback behavior, missing authenticated media validators,
  unbounded template data-source fetches, and template refresh overlap risk.
- [x] Pairing/realtime reviewer prioritized false offline status from stale Postgres
  heartbeat writes, browser-display `clear_cache` deleting credentials, and display
  clients not recovering from stale-token socket errors.
- [x] Frontend/dashboard reviewer prioritized content-library all-fetch/render caps,
  bulk-upload pressure, duplicate dashboard sockets, playlist index eager builder load,
  dashboard overview list fan-out, and pairing help copy drift.

**Plan/design:** `docs/plans/2026-05-31-performance-readiness-pass-9.md`

**Selected fix bundle**
- [x] Reject unsupported device-content multi-range requests instead of streaming the
  full object.
- [x] Add authenticated `ETag` / `Last-Modified` validators and `304` revalidation
  path before MinIO stream acquisition.
- [x] Keep successful protected media cacheable only by revalidation (`private, no-cache`).
- [x] Refresh display `lastHeartbeat` in Postgres on a throttle and fix stale-status
  cleanup to use active device IDs.
- [x] Make browser-display `clear_cache` clear media cache without unpairing.
- [x] Reset browser/Electron displays on terminal stale-token / missing-device socket errors.

**Focused verification**
- [x] Red run: middleware device-content, realtime device gateway, web display, and
  Electron display-client suites failed on the expected missing behaviors.
- [x] Green run:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller` -
  pass, 1 suite / 37 tests after review fixes.
- [x] Green run:
  `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=device.gateway` -
  pass, 2 suites / 105 tests after review fixes.
- [x] Green run:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="display"` -
  pass, 6 suites / 20 tests.
- [x] Green run:
  `pnpm --filter @vizora/display test -- --runInBand device-client.spec.ts` -
  pass, 1 suite / 49 tests.

**Broader verification**
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 12 suites / 273 tests.
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 6 suites / 126 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2827 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 94 suites / 956 tests with
  existing React `act(...)` and jsdom navigation warnings only.
- [x] TypeScript: middleware, realtime, and web `tsc --noEmit --pretty false` pass;
  display `pnpm --filter @vizora/display run typecheck` passes.
- [x] Builds:
  `npx nx build @vizora/middleware` - pass with existing webpack warnings;
  `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings;
  `pnpm --filter @vizora/display run build` - pass;
  `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx nx build @vizora/web` - pass with
  existing Next middleware/proxy deprecation and TS project-reference warnings.
- [x] `git diff --check` - pass with expected LF-to-CRLF warnings only.

**Review gate**
- [x] Display-client reviewer: CLEAN.
- [x] Realtime reviewer found stale socket heartbeats could still write Redis/Postgres
  and cleanup trusted `deviceSockets` entries without checking live Socket.IO state;
  fixed with an active-socket guard before heartbeat persistence and live-socket pruning.
- [x] Middleware reviewer found weak ETags on `206`, `304` from cached stale validators,
  and missing validator cleanup on stream errors; fixed by omitting ETag on partial
  responses, limiting `304` to fresh-resolved media contexts, and clearing validators
  on pre-header stream failure.
- [x] Middleware/realtime re-review after fixes: both CLEAN.

**Deferred follow-ups**
- [ ] Disk-backed/streaming upload pipeline and per-type frontend upload caps
  (selected for pass 10).
- [ ] Server-backed content-library pagination/search plus thumbnail lazy/virtualized rendering.
- [ ] Shared dashboard realtime socket provider for status, notifications, and route events.
- [ ] Playlist index summary payload and removal of dead builder-modal code.
- [ ] Dashboard overview summary/read-model endpoint.
- [ ] Pairing help copy update.
- [ ] Template/widget data-source response caps and template refresh overlap guard.
- [ ] Single-display queued push response contract.
- [ ] Electron cache invalidation for replaced media.

---

## Completed: Dashboard Contract Readiness Pass 8 (2026-05-31)

**Branch:** `feat/customer-dashboard-improvements-8`
**PR / merge commit:** #131 / `58df1a276b8252dba7145c75705ae4deabde431f`

**Why now:** After PR #130 merged, the next highest-value repo-side customer
readiness work is a bounded set of dashboard contract defects found by the
customer UX, performance, and reliability reviews. These affect billing accuracy,
auth behavior, content rename, schedule load failure visibility, and dashboard
activity freshness without requiring secrets, live hardware, or production state
mutation.

**New primitives introduced:** none. Reuse the existing web `ApiClient`,
billing module, content API wrapper, schedules page, and dashboard overview.

**Hermes-first analysis:** not applicable; this pass does not add business-agent
behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-dashboard-contract-readiness-pass-8.md`

**Plan**
- [x] Reconcile post-PR #130 tracker state and create fresh branch from `origin/main`.
- [x] Run multi-subagent customer UX, performance, and reliability analysis.
- [x] Write plan/design and customer-dashboard improvement list.
- [x] Add failing focused tests for the selected contract defects.
- [x] Implement bounded fixes.
- [x] Run focused web/middleware tests.
- [x] Run multi-subagent code review before broader tests.
- [x] Run broader affected tests/builds/typecheck.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Analysis feed**
- [x] Customer UX review prioritized billing display/trial correctness, pairing guidance,
  first-run checklist, schedule prerequisites, advanced control exposure, filter-empty states,
  and overloaded settings.
- [x] Performance review prioritized duplicate dashboard sockets, full-list overview fetches,
  detail-sized list payloads, unbounded content library rendering, playlist/schedule reference
  fetch fan-out, and upload-memory pressure.
- [x] Reliability review prioritized 403 logout behavior, billing interval drift, trial status
  naming, content rename payload drift, schedule partial-load silence, and stale dashboard
  recent activity.

**Selected fix bundle**
- [x] Keep auth on `403`, redirect only on `401`, and throw status-bearing `ApiError` objects.
- [x] Pass billing interval through plans API and render backend minor-unit prices correctly.
- [x] Use `trial` consistently in billing page/status UI.
- [x] Map content rename payloads from web `title` to middleware `name`.
- [x] Surface schedule partial-load failures with an error banner.
- [x] Rebuild dashboard recent activity when device-status context initializes.

**Review / verification**
- [x] API/security reviewer initially found `GET /billing/plans?interval=` still bypassed validation;
  fixed by rejecting present-but-empty interval query values and adding controller coverage.
- [x] Customer/runtime reviewer: CLEAN after yearly-fetch failure, recent activity, and interval
  validation fixes.
- [x] API/security re-review: CLEAN after empty-interval fix.
- [x] Focused web suite:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="api/__tests__/(client|billing|content)|billing|schedules-page|dashboard-page"` -
  pass, 9 suites / 113 tests.
- [x] Focused middleware billing controller:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=billing.controller` -
  pass, 1 suite / 24 tests.
- [x] Full web Jest:
  `pnpm --filter @vizora/web test -- --runInBand` - pass, 94 suites / 953 tests
  (pre-existing React `act(...)` warnings still appear in several suites).
- [x] Full middleware Jest:
  `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2824 tests.
- [x] Type checks:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` and
  `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] Builds:
  `npx nx build @vizora/middleware` - pass with existing webpack warnings;
  `$env:NEXT_PUBLIC_SOCKET_URL='http://localhost:3002'; $env:NEXT_PUBLIC_API_URL='http://localhost:3000'; $env:BACKEND_URL='http://localhost:3000'; npx nx build @vizora/web` - pass.
- [x] Browser smoke: local production `next start` plus Playwright-mocked API verified desktop/mobile
  billing plan pricing, yearly refetch, no stale monthly cards after yearly failure, and schedules
  partial-load permission banner. Screenshots saved under `test-results/pass8-browser/`.

---

## Completed: Device Content Streaming Performance Pass 7 (2026-05-31)

**Branch:** `feat/content-streaming-performance-7`
**PR / merge commit:** #130 / `c617cef6cc6b44e29bb8ef19c04f3a7071532809`

**Why now:** Customer display playback is a hot path and the middleware device-content route repeats
device-token DB validation, content DB lookup, and MinIO metadata lookup for every video byte-range
request. This is repo-side, customer-visible performance work that does not require secrets,
production state mutation, or live hardware.

**New primitives introduced:** small in-process TTL caches inside `DeviceContentController` for
verified current device-token payloads, tenant-scoped content rows, and MinIO object metadata.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools,
Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-device-content-streaming-performance-pass-7.md`

**Plan**
- [x] Create fresh branch from merged `origin/main`.
- [x] Write plan/design and tracker section.
- [x] Run multi-subagent design review before tests.
- [x] Add failing focused tests for duplicate range-request work and cache headers.
- [x] Implement bounded short-TTL auth/content/metadata caches on the existing controller path.
- [x] Run focused middleware tests.
- [x] Run multi-subagent code review before broader tests.
- [x] Run broader affected tests/builds/typecheck.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Baseline evidence**
- [x] Code inspection: `DeviceContentController.serveFile` calls `verifyCurrentDeviceToken`,
  `contentService.findByIdForDevice`, and `storageService.getFileMetadata` on every request before
  selecting full/range streaming.
- [x] Existing response headers use `Cache-Control: private, no-store` on successful media responses,
  preventing short browser/device cache reuse.

**Design review gate**
- [x] Customer/performance reviewer found a blocking design problem with `private, max-age=30` on
  stable media URLs; revised design keeps successful media responses `private, no-store`.
- [x] Customer/performance reviewer found a stale-content replacement failure mode; revised design
  invalidates cached content/metadata and retries once on pre-header MinIO stream-acquisition failure.
- [x] Security/tenant reviewer found the same response-cache stale-auth risk and called out the
  pre-existing org-scoped content authorization model; revised docs make that boundary explicit.
- [x] Security/tenant reviewer accepted a 5s server-side auth cache if populated only after full
  current-token validation and capped by JWT `exp`.

**Focused verification**
- [x] Red run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller`
  failed on duplicate JWT/content/metadata calls and missing stale-object retry.
- [x] Green run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller`
  passed, 1 suite / 30 tests.
- [x] Code review found concurrent stale-object misses could poison the shared MinIO range circuit;
  fixed by serializing cached-object stream acquisition per old object key and re-resolving waiters
  after invalidation.
- [x] Code review found metadata-miss replacement could transiently 404 for the content-cache TTL;
  fixed by evicting cached content/metadata on metadata miss and retrying cached rows once.
- [x] Code review found the content cache stored full rows; fixed `findByIdForDevice` to select only
  `id`, `organizationId`, `url`, and `mimeType`.
- [x] Review-fix run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="device-content.controller|content.service"`
  passed, 2 suites / 130 tests.
- [x] Post-review low coverage fix: added direct same-request cached-row metadata-miss retry coverage.
- [x] Post-review focused run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="device-content.controller|content.service"`
  passed, 2 suites / 131 tests.

**Review gate**
- [x] Security/runtime re-review: CLEAN; verified metadata-miss retry, narrow content query, stale old-key lock,
  token-exp auth-cache cap, org cache keying, and no browser `max-age`.
- [x] Playback/performance re-review: CLEAN; verified pending-load coalescing, stale old-key retry/circuit fix,
  no-store behavior, and that only stream acquisition is serialized, not response body transfer.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2821 tests.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings; Nx reported
  `@vizora/database:build` as flaky after successful completion.
- [x] `git diff --check` - pass with expected LF-to-CRLF warnings only.

**PR / CI**
- [x] Branch commit created: `perf(middleware): cache device content streaming lookups`.
- [x] PR #130 opened and mergeable.
- [x] GitHub CI green at first pushed head: audit, lint, test, build, security, and e2e passed.
- [x] PR #130 merged after final CI green at head `7846dafa0c91ca9f804f4d62613127f67626ab9c`;
  merge commit `c617cef6cc6b44e29bb8ef19c04f3a7071532809`.
- [x] Deployment gate checked after merge: production health OK, core PM2 services online, but
  `/opt/vizora/app` is dirty and diverged (`ahead 17, behind 66`), so deploy was not attempted.

---

## Completed: Customer Contract, Security, and Performance Pass 6 (2026-05-31)

**Branch:** `feat/customer-performance-review-6`
**PR / merge commit:** #129 / `8805aa90ea2fb04df907c71ceb5a11d723e22bea`

**Why now:** PR #128 merged and CI is green, but deploy remains blocked by dirty/diverged prod-local work. The next repo-side slice should fix customer-visible contract failures and small performance/security defects that do not require secrets, customer credentials, live hardware, or production state mutation.

**New primitives introduced:** none. Reuse the existing `ApiClient`, Next `serverFetch`, display push path, realtime push response contract, shared SSRF guard, and display Cache API preload path.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-customer-contract-security-performance-pass-6.md`

**Selected fix bundle**
- [x] Billing checkout/portal responses normalize backend `{ checkoutUrl }` / `{ portalUrl }` to web `{ url }`.
- [x] `serverFetch` reads `vizora_auth_token`, forwards auth correctly, and unwraps response envelopes.
- [x] Middleware display push-content surfaces realtime `success:false` as failure instead of returning false success.
- [x] Bulk playlist assignment rejects mixed-organization display IDs before DB update or realtime notification.
- [x] Bulk group assignment rejects mixed-organization display IDs before membership creation.
- [x] RSS preview, template data sources, and URL-thumbnail fetches reject redirects after SSRF validation.
- [x] Display media preload uses authenticated `/device-content/...` URLs so cache warmup can actually succeed.
- [x] Run focused red/green tests.
- [x] Run multi-subagent review before broader tests.
- [x] Run post-fix re-review before broader tests.
- [x] Run broader affected tests/builds.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Analysis feed**
- [x] Local drift check confirmed billing response mismatch, `serverFetch` cookie/envelope drift, push-content false success, RSS/thumbnail redirect gap, and unauthenticated display preload path still exist after PR #128.
- [x] Customer/dashboard subagent review returned and triaged. In-scope: billing response drift. Deferred: pairing UX canonicalization, content rename `title`/`name`, overnight schedules, 403 handling, conflict warnings, storage estimates, proof-of-play UI, notification pagination.
- [x] Performance subagent review returned and triaged. In-scope: authenticated display preload. Deferred: streaming upload/direct-to-storage design, dashboard summary endpoint, dashboard-only realtime rooms, media metadata cache, pairing-key index, summary list endpoints.
- [x] Security/reliability subagent review returned and triaged. In-scope: cross-tenant bulk playlist/group assignment and template data-source SSRF redirect/DNS guard. Deferred: active schedule playback path and REST heartbeat ID contract.

**Focused verification**
- [x] Red run: `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="billing|server-api|DisplayClient"` failed on backend-shaped billing responses, missing `serverFetch` auth/envelope unwrap, and unauthenticated display preload.
- [x] Red run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|widgets.controller|thumbnail.service|template-rendering.service"` failed on push-content false success, mixed-org bulk operations, and redirect-following SSRF surfaces.
- [x] Green run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|widgets.controller|thumbnail.service|template-rendering.service"` - pass, 6 suites / 170 tests.
- [x] Green run: `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="billing|server-api|DisplayClient"` - pass, 7 suites / 81 tests.
- [x] Review-fix run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|widgets.controller|thumbnail.service|template-rendering.service"` - pass, 6 suites / 171 tests.
- [x] Review-fix run: `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="billing|server-api|DisplayClient"` - pass, 7 suites / 83 tests.
- [x] Redirect follow-up run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="ssrf-guard|widgets.controller|thumbnail.service|template-rendering.service|displays.service"` - pass, 7 suites / 218 tests.
- [x] Template redirect-secret follow-up run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="ssrf-guard|widgets.controller|thumbnail.service|template-rendering.service|displays.service"` - pass, 7 suites / 220 tests.

**Review gate**
- [x] Security/tenant/SSRF reviewer: CLEAN for tenant checks and redirect SSRF guards.
- [x] Customer/performance reviewer: initial findings fixed by keeping realtime `success:false` outside circuit-failure accounting, rethrowing template redirect policy errors from fallback, failing fast on malformed billing redirect responses, and consolidating thumbnail URL validation to the shared SSRF guard.
- [x] Customer/performance post-fix reviewer found P2 customer breakage from blanket redirect rejection; fixed with bounded redirect following that validates every hop through the shared SSRF guard.
- [x] Security post-fix reviewer found P2 template redirect downgrade/header-leak risk; fixed by enforcing production HTTPS on redirected template URLs and dropping non-safe headers on cross-origin redirects.
- [x] Post-fix security re-review: CLEAN. Residual risks: documented DNS lookup-to-fetch TOCTOU remains, and billing redirect URLs still trust middleware/provider responses.
- [x] Post-fix customer/performance re-review: CLEAN. Residual risk: template APIs that require custom headers after cross-origin redirects must use the final URL directly or a same-origin redirect.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2813 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 92 suites / 942 tests; existing React `act(...)`, jsdom navigation, and intentional negative-path console warnings remain.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware/proxy deprecation and TS project-reference warnings.
- [x] `git diff --check origin/main...HEAD` - pass.

**Merge / CI / deployment gate**
- [x] PR #129 merged after GitHub checks passed: lint, audit, test, build, security, and e2e.
- [x] GitHub main after merge: `8805aa90ea2fb04df907c71ceb5a11d723e22bea`.
- [x] Open PRs after merge: none.
- [x] Production health probe returned `success: true`, database connected at `2026-05-31T15:33:14.762Z`.
- [x] Production deploy remains blocked: `/opt/vizora/app` is dirty and diverged
  (`HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main=8805aa90ea2fb04df907c71ceb5a11d723e22bea`,
  `ahead 17, behind 65`). Do not pull/reset/stash/restart services until prod-local work is
  reconciled.

---

## Completed: Device Token Current-Hash Enforcement (2026-05-31)

**Branch:** `feat/customer-performance-review-5`
**PR / merge commit:** #128 / `48e6a229d8cb0557f304629c54ed1b605eba7e2d`

**Why now:** PR #127 merged and CI is green, but deployment remains blocked by dirty/diverged prod-local work. A fresh realtime/display/code review found a P0 auth-boundary gap: signed display JWTs remain accepted after re-pairing or token rotation because middleware and realtime verify signature claims but do not compare the presented token to the current token hash stored on `Display.jwtToken`.

**New primitives introduced:** one shared middleware device-token helper and one realtime hash helper. Reuse the existing display `jwtToken` hash column, pairing token hash behavior, device JWT model, middleware controllers, realtime gateway, and WebSocket guards.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-device-token-current-hash-enforcement.md`

**Reviewer synthesis**
- [x] Customer/UX review: PR #127 fixed pairing-token rendering and bulk upload progress; remaining customer-visible issues include billing redirect shape, stale schedule conflict UI, push-to-device false success, and no-op playlist publish.
- [x] Performance review: larger follow-ups remain for memory-buffered uploads, authenticated media caching/preload, dashboard list payloads, and folder indexes.
- [x] Realtime/display review: P0 stale device JWT acceptance selected for this slice; other follow-ups include active-schedule playback, template display rendering, initial playlist ACKs, and direct-playlist clear semantics.
- [x] Adversarial review: SSRF redirect handling, server-side API cookie/envelope drift, and CSRF mounting remain queued after this auth-boundary slice.

**Plan**
- [x] Record PR #127 merge/CI/deploy evidence.
- [x] Drift-check device token storage and validation paths.
- [x] Write plan/design and checklist.
- [x] Add failing middleware tests for stale/missing `Display.jwtToken` rejection in device-content streaming.
- [x] Add failing realtime tests for stale/missing `Display.jwtToken` rejection and rotation persistence.
- [x] Implement current-hash validation in middleware and realtime.
- [x] Add connected-socket current-hash revalidation in `WsDeviceGuard`.
- [x] Add server-push current-hash revalidation for playlist, command, and QR-overlay delivery.
- [x] Add organization-room broadcast current-hash filtering for stale device sockets.
- [x] Exempt public device endpoints from subscription guard pre-emption before device JWT validation.
- [x] Disable unsafe realtime auto-rotation until a grace/ACK-backed rotation design exists.
- [x] Run focused verification.
- [x] Run multi-subagent review before broad verification.
- [x] Run broader affected tests/builds.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout and runtime token state are safe.

**Runtime-state gate before deploy**
- [x] Query prod display token-hash coverage: 15 displays total, 15 with `jwtToken`, 0 missing `jwtToken`, 15 active non-pairing, 0 active non-pairing missing `jwtToken`.
- [x] Query prod malformed hash coverage: 0 malformed `jwtToken` hashes, 0 active non-pairing malformed hashes.
- [x] Reconcile any legacy displays without a current hash before deploying fail-closed enforcement: no legacy missing-token or malformed-token displays found in the read-only prod counts.
- [ ] Reconcile prod `/opt/vizora/app` dirty/diverged checkout before any pull/restart/deploy.

**Focused verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller` - red first on stale/missing token-hash acceptance, then pass, 26 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=device.gateway` - red first on stale-token acceptance and rotation-without-persist, then pass, 2 suites / 100 tests.
- [x] Review-fix red run: middleware heartbeat/active schedules and realtime guard tests failed before widening the implementation.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.controller|schedules.controller|device-content.controller"` - pass, 3 suites / 65 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|ws-auth.guard"` - pass, 3 suites / 102 tests.
- [x] Second review-fix run: realtime server-push stale-socket tests and subscription public-endpoint test added; `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="subscription-active.guard|displays.controller|schedules.controller|device-content.controller"` - pass, 4 suites / 88 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|ws-auth.guard"` - pass after server-push revalidation, 3 suites / 106 tests.
- [x] Final review-fix run: malformed-hash tests added, `WsDeviceGuard` cache removed, org-room broadcasts filtered. `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="subscription-active.guard|displays.controller|schedules.controller|device-content.controller"` - pass, 4 suites / 89 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|ws-auth.guard|app.controller"` - pass, 4 suites / 117 tests.

**Review gate**
- [x] Subagent code-path review: CLEAN for stale device-token enforcement across middleware REST routes, realtime handshakes, guarded socket messages, direct server-push delivery, and org-room broadcasts. Residual risk documented: guarded realtime messages and server-push fanout now hit the DB for current-hash checks.
- [x] Subagent verification/deploy review: initial gate was not clean until full suites/builds were run; requested broad verification completed below. Deployment remains blocked by prod-local dirty/diverged checkout.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2796 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 12 suites / 271 tests.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/realtime` - pass with existing webpack/source-map/optional `ws` warnings.
- [x] Initial parallel `npx nx build @vizora/middleware` collided with simultaneous `@vizora/database:build` copying into `packages/database/dist/generated` on Windows (`EPIPE`, file in use). Serial rerun completed successfully.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `git diff --check origin/main...HEAD` - pass.

**Merge / CI / deployment gate**
- [x] PR #128 merged after GitHub checks passed: lint, audit, test, build, security, and e2e.
- [x] GitHub main after merge: `48e6a229d8cb0557f304629c54ed1b605eba7e2d`.
- [x] Open PRs after merge: none.
- [x] Production health probe returned `success: true`, database connected at `2026-05-31T14:28:38.620Z`.
- [x] Production deploy remains blocked: `/opt/vizora/app` is dirty and diverged (`HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main=48e6a229d8cb0557f304629c54ed1b605eba7e2d`, `ahead 17, behind 58`). Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Customer Dashboard UX Hotspots (2026-05-31)

**Branch:** `fix/customer-dashboard-ux-hotspots`
**PR / merge commit:** #127 / `c82b1521da7db94ba07caeced4339b8a1b17731a`

**Why now:** PR #126 merged and CI is green, but deployment is blocked by dirty/diverged prod-local work. The next customer-visible repo-side issues are small, testable dashboard defects in existing-device pairing and bulk content upload.

**New primitives introduced:** none. Reuse existing dashboard pages, `ApiClient`, `/content/upload`, XHR upload progress, and `/displays/:id/pair`.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-ux-hotspots.md`

**Plan**
- [x] Drift-check pairing and bulk upload against repo truth.
- [x] Write plan/design and checklist.
- [x] Add failing tests for pairing-token rendering and bulk-upload behavior.
- [x] Implement pairing contract and copy alignment.
- [x] Implement per-file upload type, progress, bounded concurrency, and upload-while-running locks.
- [x] Run focused verification.
- [x] Run multi-subagent review before broad verification.
- [x] Run broader web verification/build.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Focused verification**
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="devices-page|content-page"` - red first on missing `pairingToken` rendering and missing bulk `uploadContentWithProgress`, then pass, 2 suites / 30 tests.
- [x] Post-review regression run for hidden URL-mode queue and modal-close upload lock - red first, then pass, 2 suites / 32 tests.
- [x] Re-review regression for removed-file URL upload - red first, then pass, content page 21 tests; combined focused suite now 2 suites / 33 tests.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `git diff --check` - pass; line-ending warnings only.

**Broader verification**
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 89 suites / 934 tests; existing React `act(...)` and jsdom navigation warnings remain.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `git diff --check origin/main...HEAD` - pass.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware deprecation and TypeScript project-reference warnings.

**Review gate**
- [x] Customer/UX reviewer: initial P1 hidden queued files after switching to URL mode fixed with disabled URL option and guarded change handler; P2 modal-close upload state loss fixed by ignoring close while uploading.
- [x] Performance/concurrency reviewer: no P0/P1; P2 modal-close finding fixed and pairing response type tightened to required backend shape.
- [x] Post-fix re-review: initial P1 removed-file URL upload path fixed by clearing selected file state when queue items are removed/cleared and by requiring a file upload type before using the file branch.

**Merge / CI / deployment gate**
- [x] PR #127 merged after GitHub checks passed: lint, audit, test, build, security, and e2e.
- [x] Open PRs after merge: none.
- [x] GitHub main after merge: `c82b1521da7db94ba07caeced4339b8a1b17731a`.
- [x] Production health probe returned `success: true`, database connected at `2026-05-31T13:09:33.049Z`.
- [x] Production deploy remains blocked: `/opt/vizora/app` is dirty and diverged (`HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main=c82b1521da7db94ba07caeced4339b8a1b17731a`, `ahead 17, behind 51`). Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Customer Dashboard + Performance Pass 4 (2026-05-31)

**Branch:** `feat/customer-dashboard-performance-pass`
**PR / merge commit:** #126 / `cd978e4d8474393c85e0e4342218b4cbd708585f`

**Why now:** PRs #123-#125 are merged and CI-green, but production deploy is blocked by dirty/diverged prod-local work. Fresh customer, performance, and adversarial scans found several repo-side issues that directly affect customer-1 readiness without requiring operator-only actions.

**New primitives introduced:** none. Reuse existing Electron display client, NestJS controllers/services, realtime gateway, display web components, response envelope, and critical smoke script.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-performance-pass-4.md`

**Selected fix bundle**
- [x] Electron pairing unwraps the middleware response envelope.
- [x] Active schedule endpoint rejects device JWTs whose subject does not match the requested display.
- [x] Active schedule lookup rejects missing/disabled displays before returning schedules.
- [x] Display content-error messages redact device JWT query params before UI, Redis, or Sentry.
- [x] Critical smoke pairing-complete parsing handles enveloped `data.display.id`.
- [x] Run multi-subagent review before broad verification.
- [x] Run focused/broad verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Review gate**
- [x] Subagent runtime/security review: CLEAN.
- [x] Subagent customer/performance review: initial untracked-helper CI-safety finding fixed by staging the full intended patch; re-review CLEAN.

**Local verification**
- [x] `pnpm exec prisma generate --schema prisma/schema.prisma` in `packages/database` - pass; generated local Prisma client needed before realtime tests in this worktree.
- [x] `npx nx build @vizora/database` - pass.
- [x] `pnpm --filter @vizora/display test -- --runInBand --testPathPattern=device-client` - pass, 47 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="schedules.controller|schedules.service"` - pass, 51 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=ContentRenderer` - pass, 3 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|heartbeat.service"` - pass, 3 suites / 124 tests.
- [x] `git diff --check --cached` - pass.
- [x] `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh` - pass.
- [x] `pnpm --filter @vizora/display test:ci` - pass, 6 suites / 124 tests.
- [x] `pnpm --filter @vizora/display typecheck` - pass.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2790 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 258 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 89 suites / 927 tests; existing React `act(...)` and jsdom navigation warnings remain.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware deprecation and TypeScript project-reference warnings.
- [x] `pnpm --filter @vizora/display build` - pass.

**Current deployment gate**
- GitHub main: `cd978e4d8474393c85e0e4342218b4cbd708585f` after PR #126.
- Open PRs: none after merging PR #126.
- Production health: `/api/v1/health` returned `success: true`, database connected at `2026-05-31T12:24:48.285Z`.
- Production deploy is blocked: `/opt/vizora/app` is dirty, local `HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, and after fetch is `ahead 17, behind 45` relative to `origin/main=cd978e4d8474393c85e0e4342218b4cbd708585f`. Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Display Runtime Reliability (2026-05-31)

**Branch:** `fix/display-runtime-reliability`
**PR / merge commit:** #125 / `0a509cb0c1ee03f2fda558a7be38247c19bc8f3a`

**Why now:** PR #124 merged critical upload/streaming smoke coverage, and production deploy remains blocked by dirty/diverged prod-local work. The next repo-side customer-1 reliability gap is unattended display runtime behavior: after reboot/screensaver/power policy changes, displays must come back and continue emitting reliable proof-of-play signals.

**New primitives introduced:** none. Reuse Electron lifecycle APIs, `powerSaveBlocker`, Linux desktop autostart files, existing renderer proof-of-play paths, and CI workflow patterns.

**Hermes-first analysis:** not applicable; this is display runtime/CI hardening, not a business-agent, MCP, Hermes, or AI/spend path.

**Plan/design:** `docs/plans/2026-05-31-display-runtime-reliability.md`

**Plan**
- [x] Drift-check K1/K2/K3/K4 and renderer proof-of-play ID paths.
- [x] Add packaged-display auto-start.
- [x] Add packaged-display sleep prevention.
- [x] Fix renderer proof-of-play/error IDs to prefer API `id` with `_id` fallback.
- [x] Gate display unit tests in CI.
- [x] Gate display renderer/main typecheck and display build in CI.
- [x] Run multi-subagent review before broad verification.
- [x] Run focused/broad verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Review gate**
- [x] Electron runtime reviewer: initial packaged-guard and process-listener findings fixed; final re-review CLEAN.
- [x] Customer-readiness/CI reviewer: initial cache ID, AppImage, and docs findings fixed; final re-review found only stale wording, now corrected.

**Local verification**
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 6 suites / 124 tests.
- [x] `pnpm --filter @vizora/display test:ci` - pass, 6 suites / 124 tests; validates the CI-safe Jest invocation after GitHub Actions exposed pnpm argument-forwarding drift.
- [x] `pnpm --filter @vizora/display typecheck` - pass.
- [x] `pnpm --filter @vizora/display build` - pass.
- [x] `git diff --check` - pass; line-ending warnings only.

---

## Completed: Critical Smoke Upload + Streaming Coverage (2026-05-31)

**Branch:** `feat/customer-readiness-next`
**PR / merge commit:** #124 / `81e5cd25da6c2030d339b3d48866f40bba15a4c7`

**Why now:** PR #123 merged the customer-readiness hot-path hardening, but the operator smoke still proves URL content creation rather than real multipart upload and authenticated media streaming. Customer-1 go-live needs the smoke to exercise the path displays actually use for uploaded assets.

**New primitives introduced:** none. Reuse the existing smoke script, upload endpoint, device JWT pairing flow, and device-content streaming route.

**Hermes-first analysis:** not applicable; this is API smoke coverage in existing middleware/display paths, not a business-agent, MCP, Hermes, or AI/spend path.

**Plan/design:** `docs/plans/2026-05-31-critical-smoke-upload-streaming.md`

**Plan**
- [x] Re-check current branch/CI/prod deploy gate after PR #123 merge.
- [x] Drift-check smoke coverage for upload and device-content streaming.
- [x] Add generated tiny PDF multipart upload to the critical-path smoke.
- [x] Add authenticated device-content byte-range streaming verification.
- [x] Add uploaded-object cleanup so production smoke runs do not leave MinIO objects behind.
- [x] Run subagent review before broad verification.
- [x] Run focused verification; full smoke blocked because Docker/local services are unavailable.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Review gate**
- [x] Bash/operator-safety reviewer: initial run-ID, range-validation, and interrupt-handling notes fixed; final re-review CLEAN.
- [x] Customer-readiness/operator-state reviewer: initial persistent-artifact finding fixed with PDF fixture + uploaded-content delete; final re-review CLEAN.

**Local verification**
- [x] `pnpm install --frozen-lockfile` - pass.
- [x] `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh` - pass.
- [x] `git diff --check` - pass; line-ending warnings only.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|content.controller|device-content.controller"` - pass, 7 suites / 190 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2787 tests.
- [x] `pnpm --dir packages/database exec prisma validate --schema prisma/schema.prisma` with `NODE_OPTIONS=--use-system-ca` - pass.
- [x] Full local smoke not run: Docker Desktop is not running and local 3000/3001/3002 services are unavailable. Production smoke is intentionally not used as a substitute while prod deploy gate is blocked.

---

## Completed: Customer Performance Readiness Pass 3 (2026-05-31)

**Branch:** `feat/customer-performance-readiness-3`
**PR / merge commit:** #123 / `0c45c468243b5271eb3afee24284dc16ecce370f`

**Why now:** PRs #120-#122 closed the first display delivery, dashboard readiness, and stale PR #34 residual slices. The next repo-side push is a fresh customer-perspective review plus performance/code-review pass focused on content upload, pairing, content streaming, middleware hot paths, and any remaining production-readiness issues that are buildable and testable without operator-only actions.

**New primitives introduced:** none planned. Prefer existing Next dashboard pages/components, NestJS modules/controllers/services/DTOs, Prisma models/indexes, realtime gateway/Socket.IO paths, display clients, ops scripts, and the existing response envelope.

**Hermes-first analysis:** not applicable unless a selected fix involves business agents, MCP tools, Hermes skills, or AI/provider spend. This pass is dashboard UX, middleware/content performance, realtime/display reliability, and code-review hardening.

**Plan/design:** `docs/plans/2026-05-31-customer-performance-readiness-3.md`

**Plan**
- [x] Merge PR #122 and close stale PR #34.
- [x] Re-check production deploy gate.
- [x] Run independent dashboard/customer UX analysis.
- [x] Run independent middleware/content performance analysis.
- [x] Run independent pairing/realtime/display reliability analysis.
- [x] Run independent code-review/security/readiness analysis.
- [x] Synthesize a ranked customer-facing issue list.
- [x] Select a scoped buildable bundle with file/line evidence.
- [x] Implement fixes with focused tests.
- [x] Run multi-subagent review before broad tests.
- [x] Run focused/broad local verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Selected fix bundle**
- [x] Reject disabled/deleted display tokens in realtime and device-content paths.
- [x] Filter command/playlist delivery to active device sockets, not dashboard sockets in `device:{id}` rooms.
- [x] Prevent web display token leakage to attacker-origin device-content lookalikes.
- [x] Persist browser display `token:refresh` and move Electron pairing requests to `/api/v1`.
- [x] Execute Electron main-process override commands even when the renderer path is unavailable.
- [x] Preserve back-online notifications after offline notifications have already fired.
- [x] Reserve upload quota atomically and release reservations on upload/DB failure.
- [x] Fail closed for production MinIO upload failures instead of creating unreachable `/uploads` content.
- [x] Keep DB rows when storage delete fails; avoid silent bucket/accounting drift.
- [x] Add query-shaped database indexes for hot customer list and active schedule paths.
- [x] Fix dashboard API-key scopes, device group filter, schedule group round-trip / multi-device targeting, active playlist KPI, and customization save durability.

**Review gate**
- [x] Backend/runtime reviewer: initial storage quota/delete/realtime findings fixed; final re-review CLEAN.
- [x] Frontend/customer UX reviewer: initial schedule/customization/display-token findings fixed; final re-review CLEAN.

**Local verification**
- [x] `git diff --check` - pass; line-ending warnings only.
- [x] `pnpm --filter @vizora/middleware test -- content.service.spec.ts --runInBand` - pass, 96 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2787 tests.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vizora pnpm --filter @vizora/database exec prisma validate` - pass.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 256 tests.
- [x] Post-PR E2E fixture follow-up: `pnpm --filter @vizora/realtime test -- device.gateway.spec.ts --runInBand` - pass, 1 suite / 85 tests. Local realtime E2E run is blocked in this worktree by generated `realtime/dist/package.json` Jest haste collision plus missing local E2E `DATABASE_URL`/Redis setup; GitHub CI is the authoritative E2E verifier.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 89 suites / 925 tests; existing React `act(...)` and jsdom navigation warnings remain.
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 116 tests; expected negative-path logs and existing MaxListeners warning remain.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 npx nx build @vizora/web` - pass with existing Next middleware deprecation and TypeScript project-reference warnings.

**Current deployment gate**
- GitHub main: `0c45c468243b5271eb3afee24284dc16ecce370f` after PR #123.
- Open PRs: none after merging PR #123.
- Production health: `/api/v1/health` returned `success: true`, database connected at `2026-05-31T10:16:01.382Z`.
- Production deploy is blocked: `/opt/vizora/app` is dirty, local `HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, and after fetch is `ahead 17, behind 39` relative to `origin/main=0c45c468243b5271eb3afee24284dc16ecce370f`. Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: PR #34 Readiness Residuals (2026-05-31)

**Branch:** `fix/readiness-pr34-residual`
**PR / merge commit:** #122 / `48affb3e0ff6163ae5babf6bbe74d702c67e5348`

**Why now:** PR #34 is the only remaining open PR, but it is stale, dirty against main, and has failing April checks. Current main already absorbed part of it (`TRUST_PROXY_HOPS`), while web CSP hardening, realtime orphan notification cleanup, and content lifecycle archive endpoint fixes still have residual gaps.

**New primitives introduced:** none. This ports stale PR behavior into existing Vizora modules/scripts.

**Hermes-first analysis:** not applicable. This task is repository runtime hardening in existing web/middleware/realtime/ops paths, not a business-agent workflow, MCP tool, or AI/provider spend path.

**Plan/design:** `docs/plans/2026-05-31-pr34-readiness-residuals.md`

**Plan**
- [x] Classify PR #34 diff against current `origin/main`.
- [x] Port only residual web security header/CSP fixes.
- [x] Port middleware unhandled-rejection and bind-error diagnostics without replacing current `TRUST_PROXY_HOPS`.
- [x] Port realtime orphan Redis notification cleanup with tests.
- [x] Port content-lifecycle archive endpoint and failure-classification fixes while preserving current inline operator alerts.
- [x] Update env/docs for `TRUST_PROXY_HOPS` and CI web build env.
- [x] Run focused tests/builds, review, PR, CI, merge.
- [x] Close or supersede stale PR #34 after replacement is merged.

**Evidence**
- Replacement PR branch: `fix/readiness-pr34-residual`; stale PR #34 is not mergeable on current main and is superseded by this branch.
- PR #122 CI passed: audit, build, e2e, lint, security, test.
- Stale PR #34 closed as superseded.
- Security/runtime reviewer: initial CSP and external image findings fixed; final re-review CLEAN.
- Ops/realtime reviewer: initial lock-scope, CI wiring, overlap, and archive-error findings fixed; final re-review CLEAN.
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=notification.service` - pass, 24 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=next.config.security` - pass, 4 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="ContentRenderer|next.config.security"` - pass, 2 suites / 5 tests.
- `pnpm test:ops` - pass, 5 tests.
- `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 248 tests.
- `pnpm --filter @vizora/web test -- --runInBand` - pass, 88 suites / 910 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2763 tests.
- `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware/proxy deprecation and TypeScript reference warnings.
- Direct ESLint equivalent (`ESLINT_USE_FLAT_CONFIG=false eslint "middleware/src/**/*.ts" "realtime/src/**/*.ts"`) - exit 0, 186 warnings, no errors. Local `pnpm lint` wrapper is Windows-incompatible because the script uses Unix-style env assignment.
- Ops TypeScript check (`tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --types node scripts/ops/content-lifecycle.ts scripts/ops/lib/archive-error.ts`) - pass.
- `git diff --check` - pass; line-ending warnings only.

---

## Completed: Customer Dashboard Quality + Performance Pass (2026-05-31)

**Branch:** `feat/customer-dashboard-quality-pass`
**PR / merge commit:** #121 / `043c82a18b0480a646be1c8b90f06e20fae7d5bb`

**Why now:** After PR #120 closed the display-delivery reliability slice, the next customer-facing gaps are dashboard quality and middleware/display performance bottlenecks that are repo-side, testable, and do not need production secrets or hardware.

**New primitives introduced:** small web formatting/pagination helpers only. Prefer existing Next dashboard components/API clients, NestJS modules/services/DTOs, Prisma query patterns, and the existing `/api/v1` response envelope.

**Hermes-first analysis:** not applicable unless the selected fix involves business agents, MCP tools, or AI/provider spend. This pass is dashboard UX, middleware performance, content upload/pairing/streaming, and critical-path reliability.
**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-quality-performance-pass.md`

**Plan**
- [x] Merge PR #120 after CI green.
- [x] Re-check deploy gate after merge.
- [x] Run parallel customer-dashboard, middleware-performance, and customer-1 readiness analyses.
- [x] Select the highest-value buildable repo-side fixes with file/line evidence.
- [x] Write/update a short plan/design before code.
- [x] Implement fixes with focused tests.
- [x] Run multi-subagent review before broader tests.
- [x] Run focused and broader verification.
- [x] Open PR, wait for CI, merge if clean.

**First scoped bundle selected from subagent reviews**
- [x] SMTP env parity: `MailService` must accept `SMTP_PASS` as documented/health-checked.
- [x] Display layout zones: emit/read `resolvedPlaylist` / `resolvedContent` so layout content renders.
- [x] Realtime command replay: preserve FIFO order for queued offline commands.
- [x] Fleet push content: map Prisma `Content.name` / `thumbnail`, not non-existent `title` / `thumbnailUrl`.
- [x] Fleet UI command results: report delivered/queued/failed honestly.
- [x] Health dashboard: remove random/fabricated metrics and derive stable health from real display status/heartbeat.
- [x] Content library: clear tag filters with Clear all and stop duplicate post-upload thumbnail generation.
- [x] Pairing clients: slow polling enough to respect the current status endpoint throttle, with basic 429 handling where feasible.
- [x] Dashboard list/picker pagination: fetch all pages for content, devices, playlists, schedules, health, status context, overview stats, and emergency override picker instead of truncating at the backend default page.

**Focused verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="mail.service|fleet.service|content.service"` - pass, 3 suites / 126 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="redis.service|device.gateway"` - pass, 3 suites / 107 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/health|FleetCommandDropdown|EmergencyOverrideModal|content-page|usePairing|DeviceHealthMonitor"` - pass, 6 suites / 49 tests; existing React `act(...)` warnings remain in `EmergencyOverrideModal` tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="pagination|dashboard/content|dashboard/devices|dashboard/playlists|dashboard/schedules|dashboard/health|dashboard/__tests__|EmergencyOverrideModal|FleetCommandDropdown|usePairing|DeviceHealthMonitor"` - pass, 11 suites / 93 tests; existing React `act(...)` warnings remain in schedule, emergency modal, and upgrade banner tests.
- [x] Review follow-up `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="pagination|dashboard/__tests__|dashboard/health"` - pass, 3 suites / 25 tests; existing React `act(...)` warnings remain in dashboard/upgrade banner tests.
- [x] Review follow-up `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="pagination|dashboard/content|dashboard/devices|dashboard/playlists|dashboard/schedules|dashboard/health|dashboard/__tests__|EmergencyOverrideModal|FleetCommandDropdown|commandResultMessage|useDeviceConnection|usePlaylistPlayer|usePairing|DeviceHealthMonitor"` - pass, 14 suites / 106 tests; existing React `act(...)` warnings and intentional negative-path console errors remain.
- [x] `git diff --check` - pass; line-ending warnings only.

**Broad verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2763 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 245 tests.
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 115 tests; known MaxListeners warning and expected negative-path logs remain.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 86 suites / 905 tests; existing React `act(...)` warnings and expected negative-path logs remain.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- [x] `pnpm --filter @vizora/display build` - pass.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` - pass with existing Next middleware/proxy and missing production API URL warnings.
- [x] Direct ESLint equivalent (`ESLINT_USE_FLAT_CONFIG=false eslint "middleware/src/**/*.ts" "realtime/src/**/*.ts"`) - exit 0, 187 warnings, no errors. Local `pnpm lint` wrapper is Windows-incompatible because the script uses Unix-style env assignment.
- [x] Final `git diff --check` - pass; line-ending warnings only.

**Review gate**
- [x] Backend/realtime reviewer: initial high/medium findings fixed; final re-review CLEAN.
- [x] Frontend/customer UX reviewer: initial and follow-up findings fixed; final re-review CLEAN.
- [x] Performance/readiness reviewer: initial and follow-up findings fixed; final re-review CLEAN.

**Current deployment gate**
- GitHub main: `70285350105ba46e457fdf702ea9fe33279efc19` after PR #120.
- Production runtime health: `/api/v1/health` returned `success: true`, database connected at 2026-05-31T06:11:55Z.
- Production deploy is blocked: `/opt/vizora/app` is dirty, local `HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, and after fetch is `ahead 17, behind 36` relative to `origin/main=70285350105ba46e457fdf702ea9fe33279efc19`. Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Display Delivery Reliability Follow-up (2026-05-31)

**Branch:** `feat/customer-performance-hardening-2`
**PR / merge commit:** #120 / `70285350105ba46e457fdf702ea9fe33279efc19`

**Plan/design:** `docs/plans/2026-05-31-display-delivery-reliability-follow-up.md`

**Why now:** The post-merge customer/realtime review found customer-visible playback and remote-control reliability gaps that are repo-side, testable, and do not need operator secrets or production state changes.

**New primitives introduced:** none. Use existing middleware display command callers, realtime `DeviceGateway`, Redis pending-delivery queues, and Electron display client.

**Hermes-first analysis:** not applicable. This is realtime/device transport and Electron display playback reliability; it does not introduce business agents, MCP tools, AI provider calls, or spend paths.

**Plan**
- [x] Add failing focused tests for heartbeat-triggered pending playlist/command replay without returning queued commands in the heartbeat response.
- [x] Route realtime fleet broadcast commands through `DeviceGateway.sendCommand`.
- [x] Append Electron device JWT query tokens to protected `/device-content/:id/file` URLs before playback/cache and `push_content`.
- [x] Fix middleware display command callers to send realtime's nested `{ deviceId, command: { type, payload } }` shape.
- [x] Run focused realtime/display/middleware tests.
- [x] Run multi-review on the diff before broader tests.
- [x] Run broader package tests/builds proportional to touched packages.
- [x] Open PR, wait for CI, merge if clean.

**Verification so far**
- `NODE_OPTIONS=--use-system-ca pnpm --dir packages/database exec prisma generate` - pass; needed in fresh worktree before realtime tests could import `@vizora/database`.
- `npx nx build @vizora/database` - pass.
- `git diff --check` - pass; line-ending warnings only.
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|app.controller|redis.service"` - pass, 4 suites / 112 tests.
- `pnpm --filter @vizora/display test -- --runInBand --testPathPattern="device-client"` - pass, 1 suite / 46 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|fleet.service"` - pass, 4 suites / 72 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="DeviceControls"` - pass, 1 suite / 6 tests.
- `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 242 tests.
- `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 115 tests; existing MaxListeners warning remains in full display suite.
- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2761 tests.
- `pnpm --filter @vizora/web test -- --runInBand` - pass, 82 suites / 882 tests; existing unrelated React `act(...)` warnings remain.
- `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- `npx nx build @vizora/realtime` - pass with existing source-map/optional `ws` warnings.
- `pnpm --filter @vizora/display build` - pass.
- `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` - pass with existing Next middleware/proxy and missing production API URL warnings.
- PR #120 CI - pass: audit, build, lint, security, test, and e2e.
- Deploy status - not deployed; blocked by dirty/diverged production checkout.

**Review inputs**
- Realtime/display reviewer: high findings on negative-ACK replay, broadcast bypassing ACK/queue path, Electron protected media URLs, and middleware single-device command DTO drift.
- Customer dashboard reviewer: high findings on paginated dashboard datasets, duplicate sockets, and analytics error masking; these are queued after this delivery reliability slice.
- Middleware performance reviewer: high findings on template/content list payloads and buffered uploads; these are queued after this delivery reliability slice.
- Deployment/backlog reviewer: prod deployment is blocked by dirty/diverged production checkout; do not pull/reset/deploy until prod-only work is reconciled.
- Internal API final re-review: CLEAN after preserving `devicesOnline`, whitelisting `commandId`, and checking screenshot gateway `success: false`.
- Display-client final re-review: CLEAN after refreshing live Socket.IO `auth.token` alongside persisted device token.
- Realtime final re-review: CLEAN after generation-guarded pending playlist replay, active-socket command replay rechecks, and non-poisoning socket-handoff requeues.

---

## In Progress: Customer Dashboard + Playback Performance Push (2026-05-31)

**Branch:** `feat/customer-dashboard-performance-push`

**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-performance-push.md`

**Why now:** Multiple read-only subagents found customer-visible playback and troubleshooting gaps. The first buildable slice focuses on production hot paths that are repo-side, testable, and do not require secrets, live payment setup, DNS, SMTP, or real hardware.

**New primitives introduced:** none. Use existing StorageService, `device-content` controller, Socket.IO display event path, and dashboard component patterns.

**Hermes-first analysis:** not applicable. This is runtime media delivery, display-client ACK handling, and dashboard UI reliability; it does not introduce business agents, MCP tools, AI provider calls, or spend paths.

**Plan**
- [x] Run parallel customer, middleware-performance, frontend-performance, and readiness analyses.
- [x] Stream MinIO-backed device media with Content-Length and Range support instead of buffering whole files in middleware memory.
- [x] Preserve device JWT org scoping before storage access.
- [x] ACK `playlist:update` and display commands in web and Electron display clients.
- [x] Remove content-library page-load thumbnail fanout.
- [x] Fix screenshot refresh timeout state.
- [x] Run multi-subagent review before tests.
- [x] Run focused tests, service builds, and broader regression checks.
- [ ] Open PR, wait for CI, merge if clean, then deploy approved main.

**Implemented slice**
- Device media playback now streams from storage with single-range/suffix-range support, `Content-Range`, `Accept-Ranges`, bounded object size, and device-JWT/org-prefix checks before object access.
- Storage metadata/range reads now use the existing MinIO circuit-breaker path and distinguish not-found from unexpected storage errors.
- The global exception filter no longer hangs requests whose stream has already sent headers.
- Realtime display delivery now uses capability-aware ACKs for playlist updates and commands, preserving legacy best-effort behavior for older clients.
- Electron and browser display clients advertise `deliveryAck`, ACK only after local application succeeds, negative-ACK on failures, and avoid heartbeat command drains.
- Electron restart/reboot commands ACK before self-termination and wait a short flush window before relaunch/exit.
- Content library no longer triggers thumbnail generation for every item on initial page load.
- Device screenshot modal now guards stale request responses and cleans timeout state on close/device changes.
- Web Tailwind config now shares CJS theme tokens for Next build compatibility and has a drift test against TS theme exports.

**Review gates**
- Middleware/storage reviewer found early streaming/header/org-scope issues; fixed before full tests.
- Frontend reviewer found screenshot stale-request and build config drift risks; fixed with request epochs and theme drift test.
- Realtime/display reviewers found ACK capability, pending-command replay, renderer command ACK, duplicate Electron client, heartbeat-drain, and self-terminating command risks; fixed with regression tests.
- Final self-terminating command reviewer result: CLEAN. Residual note: the 500ms ACK flush is a pragmatic timing guard, not a transport-level receipt.

**Verification plan**
- [x] `git diff --check` — pass; line-ending warnings only.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` — pass, 141 suites / 2757 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` — pass, 11 suites / 235 tests.
- [x] `pnpm --filter @vizora/display test -- --runInBand` — pass, 5 suites / 109 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` — pass, 82 suites / 881 tests. Existing unrelated React `act(...)` warnings remain in older test files; touched modal/content tests now run clean on focused paths.
- [x] `npx nx build @vizora/middleware` — pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` — pass with existing source-map/optional `ws` warnings.
- [x] `pnpm --filter @vizora/display build` — pass.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` — pass with existing Next middleware/prod URL warnings.

**Customer improvement backlog from analysis**
- [ ] Replace fake random health metrics with real status-derived health.
- [ ] Fix schedule multi-device selection mismatch.
- [ ] Wire device-group filter.
- [ ] Replace misleading playlist publish action with assignment/push workflow.
- [ ] Use real storage quota in dashboard.
- [ ] Replace fake content tag filters with real tag data or hide them.
- [ ] Use backend bulk content operations from the UI.
- [ ] Convert getting-started panel into a real onboarding checklist.
- [ ] Consolidate dashboard auth/socket fetches.
- [ ] Add real multipart upload to smoke/E2E coverage.

---

## Completed: M12 Unrecognized Login Alert (2026-05-31)

**Branch:** `feat/m12-unrecognized-login-alert`
**PR / merge commit:** #117 / `1b28608`

**Why now:** `backlog.md` marks M12 partial. Password-changed alerts shipped, but the remaining new-login/unrecognized-device alert is deferred. This is a repo-side P2 security/readiness item and does not require operator credentials.

**New primitives introduced:** none planned. Use existing `AuditLog.ipAddress` + `AuditLog.userAgent` fields as login history instead of adding a parallel device-history table.

**Hermes-first analysis:** not applicable. This is a synchronous auth/mail security notification path, not a business-agent, MCP, or AI/provider-spend workflow.

**Plan**
- [x] Drift-check existing auth/mail/audit support for login metadata.
- [x] Add request IP/User-Agent propagation from `AuthController.login` to `AuthService.login`.
- [x] Log `ipAddress` and `userAgent` on `user_login` audit rows.
- [x] Send a non-blocking security email only when a successful password/Google login has prior metadata-bearing login history but no prior matching IP/User-Agent pair.
- [x] Seed metadata-bearing login audit rows on password and Google registration so the first later different-context login can alert.
- [x] Add MailService template and tests for HTML escaping.
- [x] Add focused AuthService/AuthController tests for metadata propagation, audit writes, first-login suppression, recognized-login suppression, normalized browser-version matching, unrecognized-login email, and mail-failure non-blocking.
- [x] Run focused tests and final review.
- [x] Open PR, wait for CI, and merge if clean.

**Verification so far**
- `pnpm install --frozen-lockfile` in isolated worktree (needed because worktree had no `node_modules`).
- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="auth.service|auth.controller|mail.service"`: PASS, 3 suites / 90 tests.
- `NODE_OPTIONS=--use-system-ca pnpm --dir packages/database exec prisma generate`: PASS. Needed only for the fresh isolated worktree because generated Prisma client was absent.
- `npx nx build @vizora/middleware`: PASS with existing webpack warnings.
- `pnpm --filter @vizora/middleware test -- --runInBand`: PASS, 141 suites / 2739 tests.
- PR #117 CI: PASS — audit, build, lint, security, test, and e2e.

**Review notes**
- Local `claude -p` review is blocked by operator auth (`Not logged in - Please run /login`). Fallback reviewers used via local subagent tool.
- Reviewer findings fixed: mail send and alert-history lookup now run after audit write in a fail-open background task; same-IP history lookup is bounded; prior rows are constrained to `createdAt < currentAuditLog.createdAt`; existing Google OAuth logins now pass IP/User-Agent through the same audit/alert path; password and Google registration now seed metadata-bearing login rows without sending an alert; Firefox `rv:` and mobile Edge UA version normalization are covered by tests.
- Final reviewer gate: CLEAN.

**Deploy status:** not deployed. No env/secrets/schema changes.

---

## Completed: Customer-1 Smoke Hardening (2026-05-31)

**Branch:** `feat/customer1-smoke-hardening`

**Why now:** `backlog.md` still gates customer-1 on C4/B16 smoke evidence. The existing `scripts/smoke/api-critical-path.sh` is useful, but it stops at auth, pairing-code generation, and list endpoints; it does not prove pair-complete, playlist creation, schedule assignment, or the device-side active-schedule read path.

**New primitives introduced:** none. This extends the existing smoke script/runbook only.

**Hermes-first analysis:** not applicable. This task is a repo-local launch-readiness smoke harness, not a business-agent/Hermes workflow, MCP tool, or AI/provider spend path.

**Plan**
- [x] Drift-check existing smoke/runbook coverage against current controllers.
- [x] Extend `scripts/smoke/api-critical-path.sh` with full customer path probes.
- [x] Update runbook wording so operators know the script now creates disposable smoke content/playlist/schedule/display rows.
- [x] Verify shell syntax and focused script behavior where local runtime permits.
- [x] Run Claude Code review before PR/merge decision.
- [x] Record tests, CI, residual runtime/operator risks.

**Review notes**
- Local Claude Code CLI hung/returned empty output twice; fallback subagent reviewer found three issues.
- Fixed blocking temp-file issue by using `umask 077` + private `mktemp -d` directory for cookie/token-bearing JSON and headers.
- Fixed prod-ingress runbook false-negative by removing direct public `:3002` HTTPS guidance. Realtime script health remains local to the VPS; public WebSocket ingress remains a real-device/manual walkthrough item.
- Residual: full real-stack smoke not run locally because Docker/services are unavailable in this environment, and prod smoke writes timestamped rows so it needs operator approval.

**Verification so far**
- `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh` — pass.
- Strict mocked success path with cookie + CSRF + device-token enforcement — pass, `ALL 23 CRITICAL-PATH CHECKS PASSED`.
- Unreachable-service failure-mode run — expected fail, 23 numbered failures, no missing temp-file noise.
- `git diff --check` — pass; line-ending warnings only.
- `shellcheck` unavailable in this environment.

---

## Current Status: Pilot Readiness Sprint COMPLETE (2026-02-09)

69/69 findings fixed + 32/32 remaining items addressed. 13 items intentionally deferred. All builds verified, all critical tests passing.

---

## Verification Checklist (Post-Fix)

- [x] `pnpm --filter @vizora/middleware test` — all 1460 tests pass
- [~] `pnpm --filter @vizora/realtime test` — 28 pass, 1 suite fails (pre-existing Prisma generate issue)
- [~] `pnpm --filter @vizora/web test` — 40+ suites pass, 2 admin test suites fail (pre-existing async Client Component issue tied to RSC migration deferral)
- [x] `npx nx build @vizora/middleware` — builds successfully
- [x] `npx nx build @vizora/realtime` — builds successfully
- [x] `npx nx build @vizora/web` — compiles successfully, all 35 routes generated
- [x] `docker-compose -f docker/docker-compose.yml config` — validates (requires GRAFANA_ADMIN_USER/PASSWORD env vars)
- [x] Spot-check: webhook endpoints have @Public() decorator
- [x] Spot-check: device JWT expiry is 90 days
- [x] Spot-check: loading.tsx files exist in all dashboard routes
- [x] Spot-check: `as any` eliminated from non-test middleware files

---

## Remaining Items — COMPLETED (2026-02-09)

### Database/Schema Suggestions
- [x] **PromotionRedemption Organization relation** — Added `@relation` with cascade delete, migration created
- [x] **ContentImpression retention script** — `scripts/cleanup-impressions.ts` with 90-day default, `scripts/setup-cron.sh` for daily job
- [~] **Display.jwtToken stored as full text** — DEFERRED: @db.Text is appropriate for JWTs
- [~] **Schedule.startTime/endTime as String** — DEFERRED: Data migration risk for existing records
- [~] **PlaylistItem unique constraint reordering** — DEFERRED: @@unique is correct, acceptable as-is

### Frontend Architecture
- [~] **Nearly all pages are client components** — DEFERRED: RSC migration of 49 pages is a separate project
- [x] **useAuth client-side flash** — Next.js middleware (`web/src/middleware.ts`) already handles server-side auth checks
- [x] **Duplicate `<main id="main-content">`** — Removed from root layout, kept in dashboard layout
- [x] **Inconsistent response envelope** — Created `ResponseEnvelopeInterceptor` applied globally, with `@SkipEnvelope()` decorator

### Code Quality
- [x] **ESLint configuration** — Created `.eslintrc.js` with TypeScript rules, added lint script to package.json
- [x] **Remove deprecated `csurf` devDependency** — Removed from middleware/package.json
- [x] **Remove unused `optional` package** — Removed from root package.json
- [x] **Synchronous file operations** — Replaced with `fs.promises` in content.controller.ts
- [x] **SanitizeInterceptor strips ALL HTML** — Added skip list for template fields (templateHtml, htmlContent, customCss)
- [x] **API versioning** — Changed to `/api/v1` prefix, nginx backwards-compat rewrite for `/api/`
- [x] **AllExceptionsFilter WebSocket guard** — Added `host.getType() === 'ws'` guard at top

### Remaining TODOs in Codebase
- [x] `billing/constants/plans.ts:21` — Documentation comment, not a TODO to fix. Left as-is.
- [x] `web/src/app/dashboard/content/page.tsx` — Implemented tag filter UI with chip/button toggles
- [x] `web/src/lib/error-handler.ts` — Added Sentry integration stub with `captureException`
- [x] `web/src/components/ErrorBoundary.tsx` — Connected to error-handler for error tracking
- [x] `ecosystem.config.js` — Already uses `GIT_REPO_URL` env var, added to `.env.example`

### Realtime / WebSocket Improvements
- [x] **Device DB existence check on connect** — Queries database after JWT verify, disconnects if device not found
- [x] **handleConnection decomposed** — Split into 5 methods: validateConnectionRate, authenticateConnection, setupDeviceRooms, sendInitialState, broadcastDeviceOnline
- [x] **leave:room authorization check** — Verifies `client.rooms.has(data.room)` before leaving
- [x] **Screenshot PNG/JPEG magic number validation** — Checks first bytes against PNG/JPEG signatures
- [x] **Screenshot base64 format validation** — Regex validates base64 format before Buffer.from()
- [x] **Realtime health endpoint** — Already exists (`/health`, `/health/live`, `/health/ready` in app.controller.ts)
- [x] **join:organization/join:room/leave:room DTOs** — Created JoinOrganizationDto, JoinRoomDto, LeaveRoomDto with class-validator
- [~] **Dashboard auth model** — Verified auth token passing in useRealtimeEvents; device-only auth is by design
- [~] **CPU usage calculation** — DEFERRED: Needs device firmware changes
- [~] **Android TV WebSocket integration** — DEFERRED: Separate feature

### Deployment / Infrastructure
- [x] **Grafana health check** — Added healthcheck to docker-compose (wget /api/health)
- [x] **Nginx health check** — Added healthcheck to docker-compose (curl /health), /health endpoint in nginx.conf
- [~] **Single Nginx instance (no HA)** — DEFERRED: Infrastructure architecture decision
- [~] **No service mesh / circuit breaker** — DEFERRED: Requires Consul/Istio
- [x] **Grafana admin credentials** — Changed to required env vars (no insecure defaults)
- [x] **Off-site backup** — Added optional S3 upload to backup-db.sh when BACKUP_S3_BUCKET is set
- [x] **API_PORT → MIDDLEWARE_PORT mismatch** — Fixed in env.validation.ts
- [x] **Missing BCRYPT_ROUNDS in Zod schema** — Added with min(10).max(15).default(12)
- [x] **Rotate dev secrets enhancement** — Added BCRYPT_ROUNDS and MinIO/PostgreSQL rotation instructions

### Test Coverage Gaps — DEFERRED (Separate Sprint)
- [~] Web dashboard at 23% coverage
- [~] Middleware branch coverage at 58%
- [~] Display client has zero test coverage
- [~] React act() warnings in Toast tests
- [~] Increase realtime test coverage

---

## Completed Workstreams

### Phase 1: Pilot Readiness Fixes (2026-02-09)
| WS | Description | Agent | Items |
|----|-------------|-------|-------|
| WS1 | Security Hardening | security-fixer | 11 fixes |
| WS2 | Realtime Hardening | realtime-fixer | 12 fixes + 47 tests |
| WS3 | Architecture Refactor | arch-fixer | 5 refactors |
| WS4 | Test Fixes | arch-fixer | 84+34 tests fixed + rate limit E2E |
| WS5 | Frontend Polish | frontend-fixer | 13 loading states + console cleanup |
| WS6 | Deployment Infrastructure | infra-fixer | 16 infra items |
| WS7 | Code Quality | infra-fixer | 4 quality items |
| WS8 | Documentation | frontend-fixer | 3 docs |

### Phase 2: Remaining Items (2026-02-09)
| WS | Description | Agent | Items |
|----|-------------|-------|-------|
| WS-A | Database & Deployment | schema-deploy-fixer | 9 items |
| WS-B | Realtime Hardening | realtime-hardener | 7 items |
| WS-C | Code Quality | code-quality-fixer | 7 items |
| WS-D | Frontend & TODOs | frontend-fixer | 9 items |

### Deferred Items (13)
| Item | Reason |
|------|--------|
| RSC migration (49 client pages) | Separate project |
| Nginx HA (redundancy) | Infrastructure decision |
| Service mesh / circuit breaker | Infrastructure decision |
| Android TV WebSocket integration | Separate feature |
| Web test coverage 23% → higher | Separate test sprint |
| Middleware branch coverage 58% → 80% | Separate test sprint |
| Display client test coverage (0%) | Separate test sprint |
| Toast act() warnings | Low priority |
| More realtime edge case tests | Separate test sprint |
| Schedule startTime/endTime to Int | Data migration risk |
| PlaylistItem reorder friction | Acceptable as-is |
| Display.jwtToken optimization | Acceptable as-is |
| CPU delta measurement | Needs firmware changes |

---

## Active Workstream: Customer Performance Pass 12 (2026-05-31)

Branch: `feat/customer-performance-pass-12`
Plan: `docs/plans/2026-05-31-customer-performance-pass-12.md`

- [x] Collect customer-dashboard and performance read-only reviews.
- [x] Pick a small backend performance slice that is repo-side and testable.
- [x] Document pass 12 design and test plan.
- [x] Share bounded JSON response reader between Generic API widgets and legacy template data sources.
- [x] Return cached media 304s without opening MinIO object streams while preserving stale-object recovery.
- [x] Skip realtime impression display lookup when authenticated socket organization context is available.
- [x] Run multiple subagent diff reviews before tests.
- [x] Run focused middleware/realtime tests.
- [x] Run relevant broader builds/tests and changed-file lint.
- [x] Open PR, wait for CI, merge if green. PR #135 merged to `origin/main` at `1618f31f9e151ca394f4e0471e457267805415a9`.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

## Active Workstream: Customer Dashboard Trust Pass 13 (2026-05-31)

Branch: `feat/customer-dashboard-trust-pass-13`
Plan: `docs/plans/2026-05-31-customer-dashboard-trust-pass-13.md`

- [x] Document pass 13 design and test plan.
- [x] Add dashboard storage API client method for the existing organization storage endpoint.
- [x] Pass server-fetched pagination completeness, storage, and readiness data into the dashboard client.
- [x] Replace hardcoded dashboard system/storage indicators with real readiness and storage state.
- [x] Skip redundant mount-time content/playlist fetches when SSR pagination proves the data is complete.
- [x] Run multiple subagent diff reviews before tests. UI/trust reviewer CLEAN; API/data/performance reviewer CLEAN. Follow-up UI review for the dashboard layout hydration fix CLEAN.
- [x] Run focused dashboard tests and broader web verification:
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard-(page|server-page)"` — 2 suites / 18 tests pass.
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=server-api` — 1 suite / 3 tests pass.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` — pass.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint ...changed web files...` — 0 errors, 19 existing `any` warnings.
  - `npx nx build @vizora/web` — pass.
  - `pnpm --filter @vizora/web test -- --runInBand` — 95 suites / 977 tests pass; unrelated existing act warnings remain in non-dashboard suites.
  - Playwright browser smoke against `next start` on `localhost:3001`: desktop and mobile dashboard render with no page errors after the layout hydration fix; screenshots in `logs/dashboard-pass13-{desktop,mobile}.png`.
- [x] Open PR, wait for CI, merge if green. PR #139 opened; CI passed audit, lint, security, build, test, and e2e.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

## Next Up (Not Started)

Continue the ranked customer/performance findings after pass 13: shared dashboard
Socket.IO provider, server-side content-library search, playlist summary payloads,
org broadcast scaling, and template refresh scheduling.

---

## Active Workstream: Pairing Active List Performance Pass 16 (2026-05-31)

Branch: `feat/device-content-streaming-pass-16`
Plan: `docs/plans/2026-05-31-pairing-active-list-performance-pass-16.md`

- [x] Drift-check old device streaming bottleneck against current code.
- [x] Identify residual pairing-dashboard serial Redis/DB work.
- [x] Document pass 16 design and test plan.
- [x] Add failing unit tests for batched active-pairing Redis reads and display ownership lookup.
- [x] Implement batched Redis `MGET` parsing and one-query display ownership lookup in existing `PairingService`.
- [x] Run multiple subagent reviews before broader tests.
- [x] Run focused pairing/display middleware tests.
- [x] Run broader middleware verification and build.
- [x] Open PR, wait for CI, merge if green. PR #139 merged to `origin/main` at `f9a3df8ad802caaa4a9a7e737e4fd6ff2b4dce60`.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

**Pass 16 verification**
- Red/green TDD:
  - Initial `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=pairing.service` failed on the new batching assertions before implementation.
  - Post-fix focused run passed: 1 suite / 32 tests.
- Reviewer gate:
  - Security/tenant/architecture reviewer: CLEAN; focused pairing suite passed.
  - Redis/performance/test-safety reviewer: CLEAN; focused pairing suite, middleware build, and `git diff --check` passed.
- Local verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/pairing.service.spec.ts src/modules/displays/pairing.controller.spec.ts src/modules/displays/displays.service.spec.ts src/modules/displays/displays.controller.spec.ts` — 4 suites / 103 tests passed.
  - `pnpm --filter @vizora/middleware test -- --runInBand` — 143 suites / 2876 tests passed.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` — passed.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint middleware/src/modules/displays/pairing.service.ts middleware/src/modules/displays/pairing.service.spec.ts` — 0 errors, 1 pre-existing warning in `pairing.service.spec.ts`.
  - `npx nx build @vizora/middleware` — passed with existing webpack warnings.
  - `git diff --check` — passed with CRLF warnings only.
- CI verification:
  - PR #139 passed audit, lint, security, build, test, and e2e before merge.

## Active Workstream: Playlist List Payload Performance Pass 17 (2026-06-01)

Branch: `feat/playlist-list-payload-pass-17`
Plan: `docs/plans/2026-06-01-playlist-list-payload-performance-pass-17.md`

- [x] Drift-check playlist list/detail split and dashboard consumers.
- [x] Document pass 17 design and test plan.
- [x] Add failing unit test for nested content projection on playlist lists.
- [x] Implement minimal content projection in existing `PlaylistsService.findAll`.
- [x] Run multiple subagent reviews before broader tests.
- [x] Run focused playlist middleware tests.
- [x] Run broader middleware verification and build.
- [x] Open PR, wait for CI, merge if green. PR #140 merged to `origin/main` at `a3b4380ebbb5a6196ac66db8971060120471b663`.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

**Pass 17 verification**
- Red/green TDD:
  - Initial `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=playlists.service` failed on the new projection assertion while `findAll` still used `content: true`.
  - Post-fix focused run passed: playlist service suite 30 tests.
- Reviewer gate:
  - Backend correctness/Prisma/tenant reviewer: CLEAN.
  - API/frontend contract reviewer first found a medium summary-type contract gap; fixed with `PlaylistSummary` typing and consumer updates.
  - Follow-up backend reviewer: CLEAN.
  - Follow-up API/frontend contract reviewer: CLEAN.
- Local verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/playlists/playlists.service.spec.ts src/modules/playlists/playlists.controller.spec.ts` — 2 suites / 42 tests passed.
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="playlists-page|content-page|devices-page|schedules-page|PlaylistPreview|DeviceQuickChange"` — 6 suites / 100 tests passed, with pre-existing React `act()` warnings.
  - `pnpm --filter @vizora/middleware test -- --runInBand` — 143 suites / 2877 tests passed.
  - `pnpm --filter @vizora/web test -- --runInBand` — 95 suites / 982 tests passed, with pre-existing React `act()`/jsdom navigation warnings.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` — passed.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` — passed.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint ...changed files...` — 0 errors, existing warnings remain in touched web files.
  - `npx nx build @vizora/middleware` — passed after killing abandoned local e2e Jest processes that held the generated Prisma directory; existing webpack warnings remain.
  - `NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` — passed.
  - `git diff --check` — passed with CRLF warnings only.
- Local e2e status:
  - `pnpm --filter @vizora/middleware test:e2e -- --runInBand --testPathPattern=playlists` timed out locally because Docker Desktop is unavailable and test DB/Redis ports `5433`/`6380` are closed. CI e2e must verify the added playlist list contract test.
- CI verification:
  - PR #140 passed audit, lint, security, build, test, and e2e before merge.

## Active Workstream: Content Library Search Performance Pass 18 (2026-06-01)

Branch: `feat/content-library-search-pass-18`
Plan: `docs/plans/2026-06-01-content-library-search-performance-pass-18.md`

- [x] Drift-check content API search and dashboard content consumers.
- [x] Document pass 18 design and test plan.
- [x] Add failing ContentLibraryPanel test for server-side search.
- [x] Implement debounced server-side search and pagination reset.
- [x] Run multiple subagent reviews before broader tests.
- [x] Run focused playlist-builder web tests.
- [x] Run broader web verification and build.
- [ ] Open PR, wait for CI, merge if green.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

**Pass 18 verification**
- Red/green TDD:
  - Initial `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=PlaylistBuilder` failed on the new server-search assertion while `ContentLibraryPanel` only filtered the current page locally.
  - Reviewer-driven red cases reproduced stale response ordering, debounce-window stale response, whitespace-only page reset/refetch, and stale pagination during pending search before the final fixes.
  - Post-fix focused run passed: `PlaylistBuilder` suite 29 tests.
- Reviewer gate:
  - Initial API/performance reviewer: NOT CLEAN; found stale response race and whitespace-only excess fetch.
  - Initial React/UX/test reviewer: NOT CLEAN; found stale response race and missing pagination/filter coverage.
  - Follow-up API reviewer: NOT CLEAN; found whitespace-only edit reset/refetch from page 2.
  - Follow-up React reviewer: NOT CLEAN; found debounce-window stale response.
  - Final clean-gate reviewers after request invalidation and pagination guard: CLEAN / CLEAN.
- Local verification:
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=PlaylistBuilder` - 1 suite / 29 tests passed, with existing React `act()` warnings.
  - `pnpm --filter @vizora/web test -- --runInBand` - 95 suites / 987 tests passed, with existing React `act()`/console warnings.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - passed.
  - `$env:ESLINT_USE_FLAT_CONFIG='false'; npx eslint web/src/components/playlist/ContentLibraryPanel.tsx web/src/components/__tests__/PlaylistBuilder.test.tsx` - 0 errors, 0 warnings in touched files.
  - `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 pnpm --filter @vizora/web build` - passed with existing Next middleware/proxy and TS project-reference warnings.
  - `git diff --check` - passed with CRLF warnings only.
