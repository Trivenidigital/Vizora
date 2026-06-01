# Analytics Empty-State Trust Pass 24

**Date:** 2026-06-01
**Branch:** `feat/analytics-empty-state-trust-pass-24`

## Why Now

The customer-dashboard review after Pass 23 ranked analytics trust as the next
bounded customer-facing issue. Current analytics hooks catch API failures and
turn them into empty/mock states, so a customer can see "No Data Yet" when the
dashboard actually failed to load metrics.

## New Primitives Introduced

None. This uses the existing analytics API client hooks and dashboard page.

## Hermes-First Analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

## Scope

- Preserve true empty states when analytics endpoints return empty arrays.
- Preserve loading and chart behavior for populated API responses.
- Surface API failures as explicit analytics unavailable states instead of
  `No Data Yet`.
- Show section-level errors for failed chart data and suppress the global
  "No Data Yet" notice whenever any analytics section failed.
- Capture analytics summary load failure so KPI placeholders do not silently
  masquerade as no data.

## TDD Plan

- Add hook tests proving rejected analytics API calls return `error` and do not
  set `isMockData`.
- Add hook tests proving successful empty arrays still produce true empty state.
- Add page tests proving a section error renders an alert and does not render
  the global "No Data Yet" notice.

## TDD Results

- Red hook tests reproduced the root problem: rejected analytics API calls still
  returned empty/mock states instead of errors.
- Red page tests reproduced the customer-visible failure mode: analytics load
  failure did not render an unavailable alert and could still show "No Data Yet."
- Green implementation keeps successful empty arrays as true empty state while
  failed calls surface as explicit analytics-unavailable states.

## Implementation Notes

- `useAnalyticsData` now shares a typed dataset helper for analytics endpoints,
  maps rejected calls through the existing user-safe error-message helper, and
  ignores stale date-range responses after cleanup.
- The analytics dashboard renders global and per-section `role="alert"` failure
  states, suppresses the global "No Data Yet" notice when any analytics section
  failed, and treats summary load failure as unavailable rather than below-target
  KPI data.
- CSV export typing was tightened while preserving the existing export behavior.

## Review Results

- UX/accessibility/test reviewer: CLEAN.
- Hook/API-state reviewer: CLEAN.
- Final sanity review after type/lint cleanup: CLEAN from both reviewers.

## Verification Plan

- Focused analytics hook tests.
- Focused analytics page tests.
- Broader web analytics test sweep.
- Web build if code changes affect production compilation.

## Verification Results

- `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/lib/hooks/__tests__/useAnalyticsData.test.ts`:
  15/15 tests pass.
- `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/analytics/__tests__/analytics-page.test.tsx`:
  9/9 tests pass.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="analytics|useAnalyticsData"`:
  34/34 tests pass.
- `pnpm --filter @vizora/web test -- --runInBand`: 1016/1016 tests pass.
  Existing unrelated React `act(...)` warnings remain in broader suites.
- `npx nx build @vizora/web --skip-nx-cache` with production web env defaults:
  pass.
- Changed-file ESLint via direct `npx eslint`: pass with no file warnings or
  errors.
- `pnpm security:no-hardcoded-jwts`: pass.
- `git diff --check`: pass with CRLF warnings only.

## Residual Risk

- Package-level lint scripts remain stale for Next 16 and Windows POSIX env var
  syntax, so equivalent direct ESLint commands were used for this pass.
- Production deploy remains blocked unless the prod checkout is no longer dirty
  or diverged at deploy-gate time.
