# Schedule Trust Polish Pass 23

**Date:** 2026-06-01
**Branch:** `feat/customer-dashboard-improvements-pass-23`

## Why Now

After PR #145 merged with green post-merge `main` CI, production deployment
remains blocked by the dirty/diverged production checkout. The next
customer-dashboard review identified schedule trust as the most bounded
customer-facing improvement: schedule cards currently render inactive schedules
as active, and the conflict-warning UI exists but is never populated.

## Customer Dashboard Analysis

Ranked current improvement backlog from customer/release/performance review:

1. Schedules page trust: inactive schedules shown as active.
2. Schedules page trust: conflict warning panel is dead.
3. Schedules page trust: timezone selector implies schedule timezone support,
   while runtime uses the display timezone.
4. Analytics empty states: fetch errors can look like "No Data Yet".
5. Analytics labels: some uptime/availability labels are synthetic and
   not signage-specific enough.
6. Content filters: tag filters are hardcoded instead of driven by content
   metadata.
7. AI Designer affordance: prominent CTA can overpromise when backend
   capability is unavailable.
8. Performance: dashboard org broadcasts still inspect device sockets.
9. Performance: playlist update fan-out can issue unbounded per-display
   internal requests.
10. Performance: content impressions are written synchronously per playback.
11. Performance: dashboard status provider fetches up to 1000 displays.
12. Performance: response sanitization is CPU-heavy on large payloads.
13. Performance: content upload still does multiple full-file passes.
14. Performance: pairing active-list scans Redis keyspace.

## New Primitives Introduced

None. This uses the existing dashboard schedules page and existing
`apiClient.checkScheduleConflicts` endpoint.

## Hermes-First Analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

## Scope

- Render schedule status badges from actual `isActive`/`active` state.
- Populate conflict warnings from `apiClient.checkScheduleConflicts` while the
  create/edit modal has enough target/day/time input.
- Send candidate date ranges to the conflict endpoint so expired/disjoint
  schedules are not over-reported as conflicts.
- Fix backend conflict and active-schedule time math for schedules that cross
  midnight, including display-group overlap cases.
- Show explicit conflict-verification failure state instead of silently clearing
  warnings.
- Keep the UI inside existing Cockpit/dashboard patterns.
- Preserve existing create/update API shapes and tenant/auth boundaries.

## TDD Red State

Focused schedules page test failed before implementation:

- Inactive schedule test expected two `Active` badges and one `Inactive` badge,
  but received three `Active` badges.
- Conflict-warning test expected `apiClient.checkScheduleConflicts` to be called
  for the selected display/day/time candidate, but it was never called.
- Review-follow-up middleware tests failed for group-target overlap, overnight
  conflict detection, active overnight schedule lookup, and adjacent-day all-day
  false positives before the service fixes.
- Review-follow-up frontend tests failed for missing date range, raw minute
  conflict display, missing conflict-check failure state, duplicate checked
  device preview calls, and missing live-region roles before the dashboard fixes.

## Verification Plan

- Focused schedules page Jest test.
- Focused schedules service Jest test.
- Broader web and middleware verification after review is clean.
- Changed-file lint/type/build checks as needed.
- Browser verification if local web services are available.

## Review Results

- Schedule/runtime reviewer: CLEAN after fixes for display-group overlap,
  overnight schedule math, and adjacent-day all-day false positives.
- Dashboard UX/test reviewer: CLEAN after fixes for formatted conflict times,
  explicit conflict-verification failure state, already-verified device request
  dedupe, and live-region semantics.

## Verification Results

- `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/schedules/__tests__/schedules-page.test.tsx`
  passed: 1 suite / 20 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/schedules/schedules.service.spec.ts`
  passed: 1 suite / 37 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=schedules`
  passed: 2 suites / 55 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=schedules`
  passed: 1 suite / 20 tests.
- `pnpm --filter @vizora/web test -- --runInBand` passed: 96 suites / 1005
  tests. Existing unrelated React `act(...)` warnings remain in other
  dashboard suites.
- `pnpm --filter @vizora/middleware test -- --runInBand` passed: 143 suites /
  2887 tests / 1 snapshot.
- `npx nx build @vizora/middleware --skip-nx-cache` passed with known webpack
  optional-dependency warnings.
- Web production build passed after setting required local build env:
  `NODE_OPTIONS=--max-old-space-size=4096`,
  `NEXT_PUBLIC_SOCKET_URL=http://localhost:3002`,
  `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`, and
  `BACKEND_URL=http://localhost:3000`. The first run without
  `NEXT_PUBLIC_SOCKET_URL` failed at the expected production CSP env
  precondition.
- `ESLINT_USE_FLAT_CONFIG=false npx eslint --ext .ts,.tsx middleware/src realtime/src`
  completed with 0 errors / 195 warnings. Warnings are pre-existing broad repo
  warnings.
- `pnpm security:no-hardcoded-jwts` passed.
- `git diff --check` passed with Windows CRLF conversion warnings only.

Browser verification was not run in this worktree because the local middleware,
web, and realtime stack was not available; the UI behavior is covered by the
focused React tests and production build.
