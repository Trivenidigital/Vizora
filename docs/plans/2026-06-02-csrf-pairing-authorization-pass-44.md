# CSRF + Pairing Authorization Pass 44

**Branch:** `feat/customer-dashboard-improvement-pass-44`

**Goal:** Close two customer-trust/security gaps found by the Pass 44 reviewer
sweep: CSRF protection is implemented but not mounted in the Nest runtime, and
dashboard device-pairing completion does not enforce role/subscription/quota
rules consistently with normal display creation.

**New primitives introduced:** none. Reuse the existing `CsrfMiddleware`,
`RolesGuard`, `@Roles`, `@RequiresSubscription`, existing screen-quota
semantics, dashboard permission helper, response envelope, and `/api/v1`
routing.

**Hermes-first analysis:** checked per project convention. This is local
dashboard/API authorization and runtime middleware wiring; no business-agent,
MCP, provider-spend, or Hermes runtime path applies.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| CSRF runtime enforcement | none found | wire existing Nest middleware |
| Device-pairing role/subscription/quota checks | none found | reuse existing Vizora guards/decorators and quota semantics |
| Dashboard pairing UI gating | none found | reuse existing web permission helper |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
Nest CSRF middleware registration or local dashboard permission truth; proceed
with Vizora-native code.

## Drift Check

- `middleware/src/modules/common/middleware/csrf.middleware.ts` already sets a
  double-submit CSRF cookie/header and validates unsafe methods.
- `middleware/src/app/app.module.ts` does not register that middleware, so the
  runtime never applies it.
- `middleware/src/modules/displays/displays.controller.ts` protects normal
  display creation with role, subscription, and screen-quota decorators.
- `middleware/src/modules/displays/pairing.controller.ts` leaves
  `POST /devices/pairing/complete` authenticated but not role/subscription
  guarded; quota must be create-only in the service so same-org re-pairing is
  not blocked at quota.
- `web/src/app/dashboard/devices/page-client.tsx` still renders the top-level
  `Pair New Device` CTA and empty-state `Pair Device` action for viewers.
- `web/src/app/dashboard/devices/pair/page.tsx` submits pairing for any
  authenticated dashboard user.

## Implementation Plan

1. Add red coverage for AppModule CSRF wiring, pairing-controller decorators,
   and viewer dashboard pairing access.
2. Register `CsrfMiddleware` globally from `AppModule.configure()` while
   preserving its existing safe-method and public endpoint exemptions.
3. Decorate `PairingController.completePairing()` with admin/manager roles and
   active-subscription gating; enforce screen quota inside `PairingService`
   only when pairing creates a new display.
4. Add Redis completion claims: per-code for one-time completion, and
   org-scoped around new-display quota check/create so two different pairing
   codes cannot race past screen quota.
5. Add an explicit `canPairDevices` dashboard permission and use it for
   top-level device-pairing CTAs, empty states, and the standalone pair page.
6. Run focused middleware/web tests, dispatch multi-vector review, then run the
   relevant broader suites before PR/CI/merge.

## Deferred From This Pass

- Team/API-key admin-only UI truth.
- Settings admin-email read-only/copy cleanup.
- Content URL update SSRF validation.
- Realtime public health detail hardening.
- Dashboard duplicate refresh and `/analytics/summary` query consolidation.
- Upload quota preflight, short content-search gating, and deferred device-group
  fetch.
