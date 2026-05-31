# Dashboard Contract Readiness Pass 8

**Date:** 2026-05-31  
**Branch:** `feat/customer-dashboard-improvements-8`

## Goal

Fix bounded customer-visible dashboard contract failures found during the
post-merge customer dashboard and performance review. This pass intentionally
targets correctness defects that can be verified with focused unit tests and do
not require secrets, production state mutation, payment-provider setup, live
hardware, or deployment.

**New primitives introduced:** none. Reuse the existing web `ApiClient`,
billing module, dashboard pages, content API wrappers, and schedules/dashboard
client components.

**Hermes-first analysis:** not applicable. This pass does not add or change
business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend
paths.

## Customer Dashboard Improvement List

1. Billing correctness: prices are stored by the backend in minor units, but the
   dashboard can render them as major units. Yearly display prices are also
   computed client-side instead of using backend canonical plan prices.
2. Billing trial state: the backend emits `subscriptionStatus: "trial"`, while
   parts of the billing dashboard look for `trialing`.
3. API auth handling: the browser client treats `403 Forbidden` like an expired
   session, clearing valid auth and redirecting customers away from dashboard
   pages.
4. Content rename: the web client sends `title` to the strict middleware update
   DTO, while the middleware accepts `name`.
5. Schedules loading: partial schedule/reference-data failures are silently
   rendered as empty or incomplete setup states.
6. Dashboard activity: device-status initialization updates count cards but can
   leave recent activity stale until a separate content/playlist refresh.
7. Pairing UX: dashboard and help copy describe inconsistent code direction
   between display client and dashboard.
8. First-run checklist: onboarding disappears after the first device even if
   content, playlist, and schedule milestones are incomplete.
9. Advanced controls: customer pages expose emergency/fleet/moderation actions
   too early in the main onboarding surface.
10. Runtime performance: dashboard shell can create multiple Socket.IO
    connections per route, overview pages fetch full paginated lists, and list
    endpoints return detail-sized payloads.
11. Content upload performance: bulk upload can overload middleware memory
    before the larger direct-to-storage redesign.

## Selected Fix Bundle

- Keep auth on `403`, redirect only on `401`, and throw status-bearing
  `ApiError` instances from JSON/FormData requests.
- Pass billing interval through `GET /billing/plans`, refetch plans when the
  interval toggle changes, and render minor-unit prices as customer-visible
  major-unit prices.
- Use `trial` consistently in billing page/status UI.
- Map content update payloads from web `title` to middleware `name`.
- Surface schedule partial-load failures with an error banner instead of a false
  empty state.
- Rebuild dashboard recent activity when device-status context initializes.

## Verification Plan

1. Add failing focused tests for each contract defect.
2. Implement the smallest code changes needed to pass those tests.
3. Run focused web and middleware tests.
4. Run multi-subagent code review before broader tests.
5. Run relevant broader tests/build/type checks.
6. Open PR, wait for CI, merge if green.
7. Re-check production deployment gate; do not deploy over dirty/diverged prod
   work without a reviewed reconciliation path.

## Review Results

- API/security reviewer initially found one residual contract bug:
  `GET /billing/plans?interval=` still behaved like yearly. Fixed by rejecting
  present-but-empty interval query values in the billing controller.
- Customer/runtime reviewer returned CLEAN after the stale yearly-card, recent
  activity, and interval-validation fixes.
- API/security re-review returned CLEAN after the empty-interval fix.

## Verification Results

- Focused web tests passed: 9 suites / 113 tests.
- Focused billing controller tests passed: 1 suite / 24 tests.
- Full web Jest passed: 94 suites / 953 tests. Existing React `act(...)`
  warnings still appear in several suites.
- Full middleware Jest passed: 143 suites / 2824 tests.
- Middleware and web TypeScript checks passed.
- Middleware build passed with existing webpack warnings.
- Web production build passed when required production CSP variables were set
  for the local verification build.
- Browser smoke passed against local `next start` with Playwright-mocked API
  data for desktop/mobile billing plans, yearly-plan failure, and schedules
  partial-load error visibility. Screenshots are in `test-results/pass8-browser/`.
