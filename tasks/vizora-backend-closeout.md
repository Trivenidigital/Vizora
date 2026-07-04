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
| **B16** | `JWT_EXPIRES_IN` unit footgun — a bare-number value (`3600`) is parsed by jsonwebtoken as **milliseconds** (3.6s), not seconds → near-instant token expiry / logout storm | **FIXED + HARDENED (merged)** — surfaced by investigating the B12 "late 401" (which was *not* a B15 entitlement lockout: a `past_due` tenant still pairs (201) and the banner is reachable (200), so the dashboard-first ladder holds). Went through adversarial security review, which found 3 more issues now closed: a single fail-safe `resolveAccessTokenTtlSeconds()` (bounded [60s, 7d], decimals/garbage → default, oversize clamps down — no ~19yr fat-finger token), response `expiresIn`/cookie `maxAge`/JWT `exp` now derive from ONE resolved value (closes the "ghost session" where the UI thinks it's logged in for 7d while the token dies early), and the TTL cap is pinned to the revocation-marker TTL so a token can never outlive its own `user_revoked` marker (closes a latent revocation-bypass). Also fixed the local e2e bootstrap to regenerate the Prisma client (CI/Docker already did), closing the `--skip-generate` stale-client footgun. |
| Contract items 1–5 | device revocation contract server half | **FIXED** (Slice 0, all merged) |

## Scorecard — re-scored (was → now)

| # | Dimension | Was | Now | Why not higher |
|---|---|---|---|---|
| 1 | Tenant isolation & content integrity | 3 | **4** (4→5 gated on `docs/enforce-readiness.md`) | Org-scoped in-statement writes across the CRUD services; B12 proves isolation e2e. The tenant-guard is **built + safe but log-only (never blocks)**. **The 4→5 completes only when enforce-mode ships** — and the honest status is that enforce was gated on a prerequisite set that was still being *discovered*, not just executed: three blocks of prep kept flushing out inherited-context write surfaces (webhook bypass, then the @OnEvent handlers). This block **stabilized it**: CRUD sweep DONE, system-write bypass DONE, @OnEvent surface CHECKED-CLEAN with **no third category** — so the surface is now believed enumerated. Remaining, KNOWN, bounded: device-auth write paths, the realtime trust boundary (a whole second app), nested creates. Single source of truth: `docs/enforce-readiness.md`. A legitimate 4; 5 lands when #4–#6 there clear + a log-warn review. |
| 2 | Publish-path safety | 3* | **3*** | Not deep-audited this engagement (flag stands); publish-lock guard added is adjacent. |
| 3 | Delivery reliability & socket layer | 3 | **4** | Structured codes + graceful key rotation + transport/app split at the middleware. Not 5: pending the hardware key-rotation proof. |
| 4 | Billing & entitlement integrity | 2 | **4** | Webhooks work; idempotency atomic + fail-closed + claim-window; Razorpay replay closed; entitlement ladder gates live screens. Not 5: live-key sandbox proof + checkout-session idempotency key outstanding. |
| 5 | Identity & security | 3 | **3 → 3.5 (T3 MERGED 2026-07-04); capped at 3.5 until PD-5+PD-6** | `auth/check` sole revocation authority; B10/B16 landed. Was revised DOWN to 3 for the dead throttles (PD-4). **T3 merged (`10e918f7`): the `'default'` throttler is registered, so per-route limits — incl. auth login/register — now FIRE → 3.5.** NOT higher yet, by discipline: (a) **PD-6** — PM2 cluster (2 instances) + in-memory `ThrottlerStorage` means the real ceiling is ~**2× nominal**, split per-worker; so the honest claim is "auth is rate-limited, at ~double the configured number pending Redis-backed storage," NOT "done." (b) **PD-5** — `checkPairingStatus` still hands the 90-day device JWT to any code-holder + a non-atomic concurrent-poll race. Reaches ~**4** only when PD-5 (JWT leak) and PD-6 (cluster storage) land. |
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
  1. **Prisma tenant-scoping backstop — BUILT & SAFE, log-only, NOT enforcing (merged).** The
     mechanism for the dimension-1 4→5 exists, is tested, and is proven to propagate — but the 4→5
     *only completes when enforce ships*. AsyncLocalStorage `TenantContext` + a pure `evaluateTenantOp`
     policy applied in-place via Prisma `$use` (Prisma 5), behind `TENANT_GUARD_MODE` (prod default
     `off`, non-prod `log`). **Log mode is strictly observe-only** (pass/warn, never throws — proved by
     a unit invariant). 40 tests (29 policy + 4 propagation e2e + 7 derivation). Zero behavior change
     with it active (B12 10/10 + customer-critical-path 3/3). **Both adversarial reviews addressed**
     (policy: upsert/createMany/operator/MCP blind spots closed; ALS: wiring verified correct,
     log-observe-only fixed). **Enforce is gated on the documented pre-enforce checklist** — the bare-id
     `update`/`delete` sweep across ~7 services (their log-warns = the go/no-go), the device-auth guard
     (`req.deviceAuthPayload` is dead code), the `realtime` per-process trust boundary, nested creates,
     and fail-closed-on-unresolved-context. Flipping the flag before that sweep is clean would enforce a
     policy we haven't verified every write survives. Design + checklist:
     `docs/design/tenant-scoping-extension.md`. `$extends` (vs in-place `$use`) is the target once
     `DatabaseService` is de-subclassed from `PrismaClient`.
  2. Fleet-view dark-screen dashboard column (data ingested, UI pending).
  3. B8 live-signature integration test; B13/B14 hygiene.
  4. **(P2, flagged — not dismissed) The older `.e2e-spec` suites (content/playlists/displays/auth)
     have ~15 failures that are NOT from this engagement** (verified: reproduce with
     `TENANT_GUARD_MODE=off`). They are two distinct latent issues worth their own line so they don't
     become silently load-bearing: (a) a "reject without auth → 403 (CSRF) vs 401 (auth)" expectation —
     possibly a real guard-ordering question in the middleware chain, not just a stale assertion; (b)
     `deviceIdentifier` unique-constraint collisions = test-hygiene (no per-run isolation / DB reset).
     And the meta-finding: **these specs aren't run in CI** (`ci.yml` runs only `agents` +
     `customer-critical-path`) — specs that don't run rot. Not blocking; wire them into CI or delete them.
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
