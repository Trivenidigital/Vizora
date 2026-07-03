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
| **B3** | Entitlement lapse no effect on live screens, no signal | **FIXED (full, merged)** — degrade ladder + guard + emission (backend) + React payment banner + per-rung deduped dunning email. |
| **B6** | No PSP idempotency keys | **FIXED (full, merged)** — webhook side + customer key + per-invocation checkout-session idempotency key. |
| **B7** | Password reset silently no-ops | **FIXED** (merged) — fail-loud in prod, sandbox smoke |
| **B8** | Grace clock resets on `updatedAt`; live-sig untested; $0 charge | **grace-reset FIXED** (B3 `entitlementStateSince`). *Live-sig integration test = P2; $0-charge = minor.* |
| **B9** | No structural tenant isolation; PlaylistsService bare-id writes | **FIXED** — writes org-scoped in-statement; contentId recheck already present. *No other reachable gap found (sweep); global Prisma-extension backstop = P2.* |
| **B10** | Non-expiring device token (`generatePairingToken`) | **FIXED (merged)** — 90d expiry, graceful via Slice 0 auth-degraded. *Classification: this is a revocation **defense-in-depth** layer (a non-expiring credential is a standing un-revocable key), not hygiene — it belongs to the same integrity axis as Slice 0, now asserted end-to-end by B12.* |
| **B12** | No pair→publish→playback→revoke E2E; no multi-tenant fixture | **FIXED (merged, 10/10 green)** — canonical two-tenant fixture + lifecycle E2E run against docker-compose.test.yml. Revocation leg asserts the full Slice 0 promise at integration level (410 only on genuine revoke/delete; expired→401 AUTH_EXPIRED and malformed→401 AUTH_INVALID never 410 = F3 non-behavior; zero cross-tenant bleed through playlist assembly). |
| **B13/B14** | Pairing code logged; dead `CurrentOrganization` decorator | **OPEN (P3)** — minor hygiene |
| **B16** | `JWT_EXPIRES_IN` unit footgun — a bare-number value (`3600`) is parsed by jsonwebtoken as **milliseconds** (3.6s), not seconds → near-instant token expiry / logout storm | **FIXED (merged)** — surfaced by investigating the B12 "late 401" (which was *not* a B15 entitlement lockout: a `past_due` tenant still pairs (201) and the banner is reachable (200), so the dashboard-first ladder holds). `coerceJwtExpiry()` coerces bare integers → seconds; `.env.test` → `1h`. Also fixed the local e2e bootstrap to regenerate the Prisma client (CI/Docker already did), closing the `--skip-generate` stale-client footgun. |
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
| 8 | Testing | 3 | **4** | Strong negative suites across contract/billing/entitlement/tenant-iso, plus the B12 two-tenant lifecycle E2E (10/10 green) asserting the revocation contract + zero cross-tenant bleed at integration level. Not 5: no cross-service socket-handshake E2E (realtime is a separate app; covered by realtime unit tests). |
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
- ✅ **Done since close-out (merged):** B3 payment banner + dunning dedup, B10 device-token expiry,
  B6 checkout-session idempotency key, **B12 two-tenant fixture + lifecycle E2E (10/10 green)**.
- **Remaining, ranked:**
  1. **Prisma tenant-scoping extension (TOP)** — a global `$extends` that stamps `organizationId` into
     every tenant-model `where` at the client layer. This is the **dimension-1 4→5 structural backstop**:
     today isolation is enforced per-service (B9 closed the reachable gap, B12 proves it end-to-end), but
     a *future* bare-id write could reopen it. The extension makes a cross-tenant write structurally
     impossible rather than review-dependent. Highest-leverage remaining item.
  2. Fleet-view dark-screen dashboard column (data ingested, UI pending).
  3. B8 live-signature integration test; B13/B14 hygiene.
- **Operational note (from the B12 live run):** the e2e setup (`db:test:push --skip-generate`) does not
  regenerate the Prisma client — after any schema change, run `prisma generate` before e2e or the stale
  client 400s on new columns (e.g. B3's `entitlementStateSince`). Unit tests mock the DB and won't catch it.

## Verdict revisited

The March "78–88% ready, config-only P0s" framing was **rejected** at Phase 0 and is now *earned*
back on the launch-critical paths: billing went from non-functional (webhooks 400) to real; device
revocation went from a fleet de-pair bomb to a confirmed, authenticated, non-forgeable protocol;
entitlement lapse went from no-op to a dashboard-first degrade ladder that never darkens a paying
storefront without two weeks of signposting. The honest launch story is now what the config-only
narrative *wanted* to be: **live keys + one hardware sitting.**
