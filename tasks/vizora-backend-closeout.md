# Vizora Backend — Launch-Hardening Close-Out

**Date:** 2026-07-02 · **Base:** `main` (baseline `7f6a16f3`) · Auditor: Claude Fable 5
**Merged this engagement:** Slice 0 (device revocation contract), B1+B6+B7 (webhooks/email),
B3 (entitlement ladder backend), tenant-isolation write-scoping.

## Findings disposition

| ID | Finding | Disposition |
|---|---|---|
| **B1** | Webhooks 400 before signature (no rawBody) — billing non-functional | **FIXED** (merged) — `{rawBody:true}` + controller-path coverage |
| **B2** | Enriched device heartbeat rejected by DTO | **FIXED** (Slice 0) — DTO widened + ingested |
| **B15** | `auth/check` absent — no safe revocation | **FIXED** (Slice 0 item 4) — sole authenticated authority, false-410 impossible (tested) |
| **B4** | No structured socket codes; key rotation = fleet de-auth | **FIXED** (Slice 0 item 2) — handshake middleware, graceful rotation, transport/app split |
| **B11** | `device:revoked`/`tenant:*` never emitted | **FIXED** (Slice 0 item 3) — emitted on delete/block + entitlement |
| **B5** | Razorpay zero replay protection; Stripe dedupe mis-keyed | **FIXED** (B1/B6) — event-id keyed, atomic SETNX, fail-closed, claim-window |
| **B3** | Entitlement lapse no effect on live screens, no signal | **FIXED (backend, merged)** — degrade ladder + guard + emission. *Remaining: React payment banner + dunning dedup (frontend).* |
| **B6** | No PSP idempotency keys | **FIXED** webhook side + customer key. *Checkout-session key deferred (needs request-scoped token; documented, not double-charge).* |
| **B7** | Password reset silently no-ops | **FIXED** (merged) — fail-loud in prod, sandbox smoke |
| **B8** | Grace clock resets on `updatedAt`; live-sig untested; $0 charge | **grace-reset FIXED** (B3 `entitlementStateSince`). *Live-sig integration test = P2; $0-charge = minor.* |
| **B9** | No structural tenant isolation; PlaylistsService bare-id writes | **FIXED** — writes org-scoped in-statement; contentId recheck already present. *No other reachable gap found (sweep); global Prisma-extension backstop = P2.* |
| **B10** | Non-expiring device token (`generatePairingToken`) | **OPEN (P1)** — not addressed this session |
| **B12** | No pair→publish→playback→revoke E2E; no multi-tenant fixture | **PARTIAL** — negative unit suites added throughout; full E2E fixture = P1 |
| **B13/B14** | Pairing code logged; dead `CurrentOrganization` decorator | **OPEN (P3)** — minor hygiene |
| Contract items 1–5 | device revocation contract server half | **FIXED** (Slice 0, all merged) |

## Scorecard — re-scored (was → now)

| # | Dimension | Was | Now | Why not higher |
|---|---|---|---|---|
| 1 | Tenant isolation & content integrity | 3 | **4** | PlaylistsService writes org-scoped in-statement; no reachable gap remains. Not 5: no *global* structural backstop (Prisma extension) — other services still per-handler (audit found them correct). |
| 2 | Publish-path safety | 3* | **3*** | Not deep-audited this engagement (flag stands); publish-lock guard added is adjacent. |
| 3 | Delivery reliability & socket layer | 3 | **4** | Structured codes + graceful key rotation + transport/app split at the middleware. Not 5: pending the hardware key-rotation proof. |
| 4 | Billing & entitlement integrity | 2 | **4** | Webhooks work; idempotency atomic + fail-closed + claim-window; Razorpay replay closed; entitlement ladder gates live screens. Not 5: live-key sandbox proof + checkout-session idempotency key outstanding. |
| 5 | Identity & security | 3 | **3.5** | `auth/check` = sole authenticated revocation authority (false-410 impossible). Not higher: B10 non-expiring token open; no device-token denylist. |
| 6 | Observability | 2 | **3** | `screenState`/`playbackSource` ingested; ladder staleness watchdog; revocation events. Not higher: dashboard fleet-view dark-screen UI (frontend) + crash reporting still to wire. |
| 7 | Economics | n/a | **n/a** | Cost-per-screen still not measured — out of engagement scope; do not claim a number. |
| 8 | Testing | 3 | **3.5** | Strong negative suites across contract/billing/entitlement/tenant-iso. Not higher: no E2E lifecycle/multi-tenant fixture (B12). |
| 9 | Code & ops quality | 3 | **3.5** | rawBody fixed, email fail-loud, migration + watchdog hygiene. |

## Remaining blockers to launch

**Launch-BLOCKING (screens play, billing works, isolation holds — these are the last two):**
1. **Live-key insertion, proven by sandbox smokes.** The code paths are now real (rawBody, signature
   verification, idempotency); going live is credential insertion + a PSP-sandbox smoke of a real
   webhook round-trip. Email fail-loud + smoke already landed (B7).
2. **One hardware sitting** — the Slice 0 staging joint JWT-rotation test (device survives a
   `DEVICE_JWT_SECRET` rotation with zero black frames / zero wipe), folded into the TV-app P0-3
   hardware session. Runbook: `docs/slice0-device-revocation-contract.md`.

**Not launch-blocking (post-launch-safe P1 tail):**
- B3 frontend: dashboard payment banner (endpoint `GET /billing/entitlement/banner` ready) + the
  fleet-view dark-screen surface (data ingested) + per-tenant/rung dunning dedup keys.
- B10 device-token expiry; B12 E2E + two-tenant fixture; checkout-session idempotency key; B8
  live-signature integration test; B13/B14 hygiene; a global Prisma tenant-scoping extension as a
  structural backstop (no reachable gap today).

## Verdict revisited

The March "78–88% ready, config-only P0s" framing was **rejected** at Phase 0 and is now *earned*
back on the launch-critical paths: billing went from non-functional (webhooks 400) to real; device
revocation went from a fleet de-pair bomb to a confirmed, authenticated, non-forgeable protocol;
entitlement lapse went from no-op to a dashboard-first degrade ladder that never darkens a paying
storefront without two weeks of signposting. The honest launch story is now what the config-only
narrative *wanted* to be: **live keys + one hardware sitting.**
