# Vizora Backend — Launch-Hardening Audit (in progress)

**Date:** 2026-07-02 · **Baseline:** HEAD `7f6a16f3`, branch `main` · **Auditor:** Claude Fable 5 (boundary-depth)
**Method:** code is truth; every claim cites file:line from a direct read. Five parallel investigation
agents are mapping tenancy, billing, tests, email/config, and device lifecycle; sections below marked
*(pending agent synthesis)* will be filled from their evidence and spot-verified.

---

## A. Pre-approved contract slice — current-state (VERIFIED by direct read)

Spec: `vizora-tv:docs/design/revocation-contract.md v1.1`. **The backend's tenant concept is
`organizationId`** (Prisma `Display.organizationId`, JWT `organizationId` claim) — the device
contract's `tenantId` maps to it. The device reads the literal field name `tenantId`, so the
server must emit `tenantId` (value = organizationId); this is the one place a rename would
silently re-break the fleet, so the alias is added at the wire boundary, not a model rename.

| Contract item | Current state (file:line) | Gap → work |
|---|---|---|
| **1. `tenantId` in pairing status** | `checkPairingStatus` returns `{status:'paired', deviceToken, deviceId, organizationId}` — **no `tenantId`** (`middleware/src/modules/displays/pairing.service.ts:501-506`) | Add `tenantId: display?.organizationId` to the paired response. ~1 line + DTO + test. |
| **2. Structured socket rejection codes** | Device auth runs in `handleConnection`→`authenticateConnection` **post-connection**, rejecting via `client.emit('error',{message})` + `client.disconnect()` with strings `device_not_found` / `device_disabled` / `device_token_stale` (`realtime/src/gateways/device.gateway.ts:757-806`). Socket.IO only populates `connect_error.data.code` when a **connection middleware** calls `next(err)` with `err.data`. The current mechanism **cannot** produce `connect_error.data.code`. | Move device-token verification into an `io.use()` handshake middleware that calls `next(err)` with `err.data.code ∈ {AUTH_EXPIRED, AUTH_INVALID, DEVICE_REVOKED, TENANT_SUSPENDED}`. Implementation requirement, **not** a contract conflict — the wire surface is unchanged; the server must produce it correctly. Map: expired JWT→`AUTH_EXPIRED`; bad signature/`verify` throw→`AUTH_INVALID`; disabled/deleted device→`DEVICE_REVOKED`; org suspended→`TENANT_SUSPENDED`. |
| **3. `device:revoked` / `tenant:suspended` / `tenant:resumed`** | **None emitted anywhere** (grep across middleware+realtime: zero hits). Delete/block uses `disconnectDevice()` → generic `error` event + disconnect (`device.gateway.ts:317-335`). | Emit `device:revoked {reason}` to the device room on delete/block; `tenant:suspended`/`resumed` on entitlement transitions; optional heartbeat-ack `revoked:true`. |
| **4. `GET /api/v1/devices/auth/check`** | **No such route** (grep: zero hits). `@nestjs/throttler` is configured globally (`middleware/src/app/app.module.ts:61,135`) and `@Throttle({default:{limit,ttl}})` is used per-route — the 1/30s+burst limit is expressible. | Build the route: Bearer device-JWT auth, statuses `200/401/403/410` with `{code}` bodies, `Cache-Control: no-store`, `@Throttle` 1/30s (burst 2)→`429`+`Retry-After`. **Sole authority for credential destruction — spurious/forged 410 = remote mass-unpair (S1).** |
| **5. Pairing-code security** | Code = 6 chars from 32-symbol unambiguous alphabet via `crypto.randomInt` (~1.07e9 space) (`pairing.service.ts:923-934`); 5-min Redis TTL; single-use (deleted on token retrieval, `:499`); completion guarded by Redis `SET NX` claim lock (`:250-286`). Rate limits: request 5/min, status 10/min, complete 5/min (`pairing.controller.ts:30,40,49`). | Entropy/single-use/rate-limit look **sound**; residual to confirm: status-poll 10/min over a ~1e9 space is not brute-forceable, but verify the code isn't logged (`pairing.service.ts:455-457` logs the code at info — minor). Provisional: hardened, one log-hygiene nit. |
| **Heartbeat `screenState`/`playbackSource`** | Not ingested (grep: zero hits in realtime heartbeat path). | Ingest + surface in dashboard fleet-health with a dark-screen alert. |

**Deploy-order constraint (device latches `auth_check_seen` on first live auth/check response,
permanently disabling its legacy-unpair carve-out):** ship item 3 before or with item 4, never
4 before 3. Safe order 1→2→3→4. Item 2 has standalone value (graceful key rotation) and is
independently shippable. This gates the migration/release plan.

### Additional contract-relevant facts (verified)
- Device JWT: HS256, `DEVICE_JWT_SECRET` (≥32 chars enforced), 90-day expiry, payload
  `{sub, deviceIdentifier, organizationId, type:'device'}` — **no `jti`** (`pairing.service.ts:582-603`).
  The gateway's `revoked_token:${jti}` Redis check (`device.gateway.ts:776`) therefore does **not**
  cover device tokens (they carry no jti) — device revocation today relies solely on the DB
  `isDisabled` flag + token-hash staleness check, not the jti denylist. Relevant to item 3/4 design.
- Device token stored as SHA-256 hash in DB; staleness verified via `isCurrentDeviceToken(hash, presentedHash)`
  (`device.gateway.ts:804`, `ws-auth.guard.ts:57`) — a re-pair rotates the hash and correctly staleness-kills old sockets.
- There is already a `WsDeviceGuard` re-validating org + disabled + token-hash on each device
  message (`ws-auth.guard.ts:40-66`) — good defense-in-depth to build the `TENANT_SUSPENDED` gate near.

### ⚠ S1 CROSS-REPO COMPATIBILITY BREAK (verified by direct read) — heartbeat DTO rejects the shipped device

The already-merged Android TV app sends **top-level `screenState` and `playbackSource`** in its
`heartbeat` payload (device repo `src/main.ts`, P0-1). The backend's `HeartbeatMessageDto`
whitelists only `metrics / currentContent / uptime / appVersion`
(`realtime/src/gateways/dto/index.ts:63-81`), and `WsValidationPipe` runs with
`forbidNonWhitelisted: true` (`realtime/src/gateways/pipes/ws-validation.pipe.ts:53`). Result:
the enriched heartbeat fails validation → `WsException` thrown → `handleHeartbeat` body never
executes (`device.gateway.ts:1265-1344`) → `setDeviceStatus` / `heartbeatService.processHeartbeat`
never run. **Every updated device appears to stop heartbeating the instant it connects** →
backend sees it as stale/offline; fleet health goes blind for the entire updated fleet.

- **Not yet live** only because the device's Play submission is held. This is a **hard deploy
  gate**, not a latent bug: the backend MUST widen the heartbeat DTO to accept (and ingest)
  `screenState` + `playbackSource` **before** the enriched TV build reaches any device.
- This converts "surface screenState/playbackSource" from P1 dashboard polish into a **P0
  compatibility requirement bundled with the contract slice.** Ingest the two fields, persist
  them alongside device status, and drive the dark-screen alert (device reporting
  `screenState≠playing` / `playbackSource≠live` while it should be playing).

### Second-consumer caution (verified)
The Socket.IO gateway serves **two** device client types: the Android TV app (this contract's
subject) **and** an Electron `display/` client (`display/src/electron/device-client.ts`). The
Electron client listens for a dormant `token:refresh` event the server never emits
(`device.gateway.spec.ts:624`). Any structured-code / middleware change for contract item 2 must
not break the Electron client's existing `error`+`connect_error` handling
(`device-client.ts:314-319,408-415`). Keep the legacy `error` emit alongside the new
`connect_error.data.code` during migration; the TV app reads the code, the Electron client keeps
reading the message.

### Contract slice verdict
No genuine conflict with the wire surface. Item 2 needs a mechanism change (handshake middleware)
which is an implementation detail the device never sees. Slice is cleared to implement pending the
remaining Phase 0 sections; **stops at the checkpoint with the rest of the report for approval of the
non-contract slices.**

---

## A2. Verified severe findings (spot-checked by direct read; full register in §C)

- **S1 — Webhook ingestion is broken at the framework wiring (verified).** `main.ts:47` creates
  the app with **no `{ rawBody: true }`**; both handlers require `req.rawBody`
  (`webhooks.controller.ts:31,56`) and throw `BadRequestException('Raw body not available')`
  when it's absent. No `express.raw`/`bodyParser`/raw middleware exists in `middleware/src`
  (grep clean). Tests bypass the controller entirely, calling `billingService.handleWebhookEvent`
  with a hand-built buffer (`billing.service.spec.ts:534,549`), so the gap is invisible to CI.
  **Effect: every real Stripe/Razorpay webhook 400s before signature verification** → checkout
  never activates a subscription, payments never recorded, cancellations never processed —
  *with or without live keys*. This is the strongest single refutation of "config-only P0."
- **S1/S2 — Entitlement lapse has zero effect on live screens and emits no device signal
  (verified via billing + pairing agents).** past_due / trial-expiry / cancel / downgrade only
  mutate org fields; `screenQuota` is enforced **create-time only** (`quota.guard.ts:63`,
  `pairing.service.ts:879`), so a downgraded/suspended tenant keeps **all** existing screens
  playing indefinitely, device JWT stays valid (`device-token-auth.util.ts` never checks
  subscription), and **no `tenant:suspended` is emitted** (grep clean across billing). This is
  both the wiring point for contract item 3's `tenant:suspended`/`resumed` and a standalone
  entitlement-integrity finding.
- **S2 — Razorpay webhooks have zero replay protection.** `verifyWebhookSignature` returns
  `data = event.payload`, so `eventId = event.data?.id || event.data?.object?.id` is `undefined`
  (`billing.service.ts:592`) and the whole dedupe block is skipped → every replay re-runs
  handlers (duplicate receipt/failure emails). Stripe dedupe exists but is **mis-keyed on the
  object id, not the event id** (drops distinct same-object events) and is non-atomic + fail-open
  when Redis is down (`redis.service.ts:146-169`).
- **S2 — No idempotency keys on any PSP charge/checkout/customer creation**
  (`stripe.provider.ts:57-110`, `razorpay.provider.ts:63-118`).
- **S2 — Password reset is a silent hard-blocker.** Email is nodemailer/SMTP (not SendGrid),
  no-ops silently when unconfigured, `sendMail` never throws (`mail.service.ts:74-90`), reset URL
  only console-logged (`auth.service.ts:666`, `mail.service.ts:423-427`); SMTP keys aren't in the
  Zod env schema so prod boots green with dead email.
- **S2 — Stripe live webhook-signature branch is untested** (`constructEvent` mocked everywhere,
  `stripe.provider.spec.ts:420`); `amount || 0` fallback can persist a $0 charge
  (`billing.service.ts:787`); 7-day grace period keys on `updatedAt` so unrelated writes reset it
  (`billing-lifecycle.service.ts:173`).
- **S2 — Non-expiring device token.** Dashboard `generatePairingToken` signs a device JWT with
  no `exp` while returning a literal `expiresIn:'30d'` (`displays.service.ts:392-403,425`).

## B. Current-state map

**Stack:** Nx monorepo, pnpm. Middleware (NestJS 11, :3000), Web (Next.js, :3001), Realtime
(NestJS + Socket.IO, :3002), Prisma/Postgres, Redis, MinIO, ClickHouse. Tenant key is
`organizationId` throughout (no `tenantId`/`companyId`).

**Content → screen flow:** dashboard upload → MinIO (org-namespaced key `${orgId}/${hash}-${name}`,
presigned time-limited URLs) → playlist/schedule assembly (org-scoped services) → publish →
realtime gateway delivers over Socket.IO to `device:${id}` / `org:${id}` rooms with delivery-ack
+ pending-replay → device caches + renders. Heartbeat every 15s over WS.

**Tenancy:** per-request principal resolved by a global `JwtAuthGuard` (`auth.module.ts:48`);
`organizationId` is **DB-derived** in `JwtStrategy.validate` (`jwt.strategy.ts:150-188`), not trusted
from the JWT claim — sound. Devices/API-keys/MCP each derive org from their own verified credential,
never from request input. **But query-level isolation is discipline, not structure** — `DatabaseService`
has no `$use`/`$extends`/RLS (`database.service.ts`); every service adds `organizationId` to its own
where-clause. Correct in the sampled services (Content, Schedules) with defense-in-depth `updateMany`/
`deleteMany`; **fragile in Playlists** (`update`/`remove`/`reorder` write by bare `id` after a scoped
`findOne` — TOCTOU window — and playlist items embed request `contentId` with no ownership re-check,
`playlists.service.ts:242-268`).

**Device lifecycle:** pairing code (6 char, `crypto.randomInt`, 32-sym alphabet, 5-min single-use
Redis, rate-limited) → device JWT (HS256, `DEVICE_JWT_SECRET`, 90d, org claim, no `jti`) stored as
SHA-256 hash → socket auth in `handleConnection` (post-connection, custom `error` event, not
`connect_error.data.code`). Revocation today = DB `isDisabled` + token-hash staleness; delete emits
**nothing** to the device; org-cascade-delete bypasses even internal events.

**Billing:** Stripe + Razorpay, provider chosen by `org.paymentProvider`+country. Webhook signature
verification code exists (Stripe `constructEvent`; Razorpay real HMAC), quota enforcement is real and
atomic — **but** raw-body is not wired (webhooks 400 before signature), Razorpay has no replay dedupe,
no idempotency keys, and entitlement lapse never touches live screens.

**Email:** nodemailer/SMTP (not SendGrid), silent no-op when unconfigured, never throws.

## C. Findings register

Severity: **S1** = north-star violation or launch blocker; **S2** = integrity/reliability degradation;
**S3** = hygiene. ✓ = spot-verified by my own read; ○ = agent-cited.

| ID | Sev | Finding | Evidence | Blast |
|---|---|---|---|---|
| **B1** ✓ | S1 | Webhook ingestion broken: no `{rawBody:true}`, handlers 400 before signature verify; tests bypass the controller so CI is green | `main.ts:47`, `webhooks.controller.ts:31,56`, `billing.service.spec.ts:534` | All revenue — no subscription activates, live or test |
| **B2** ✓ | S1 | Enriched device heartbeat (`screenState`/`playbackSource`) rejected by `forbidNonWhitelisted` DTO → updated fleet appears offline | `dto/index.ts:63-81`, `ws-validation.pipe.ts:53` vs device `main.ts` | Entire updated fleet, on connect |
| **B15** ✓ | S1 | `GET /devices/auth/check` absent — the device purges only on a `410` from it, so **no device can be safely revoked today** (device won't wipe without it); when built, a forged/uncacheable `410` = remote mass-unpair | grep clean; contract §3.4 | Fleet (revocability + forge risk) |
| **B4** ✓ | S2 | No structured socket rejection codes; `DEVICE_JWT_SECRET` rotation de-auths the whole fleet at once (no graceful path) | `device.gateway.ts:757-806`; `token:refresh` stubbed only | Fleet on any key rotation |
| **B3** ✓ | S2 | Entitlement lapse (past_due/trial/cancel/downgrade) has no effect on live screens and emits no device signal; `screenQuota` enforced create-time only | `billing-lifecycle.service.ts:162-202`, `quota.guard.ts:63`, `pairing.service.ts:879` | Revenue leak per lapsed tenant |
| **B11** ✓ | S2 | `device:revoked`/`tenant:*` emitted nowhere; delete + org-cascade-delete notify the device with nothing (silent 401 on next call) | `displays.service.ts:431-442`, `schema.prisma:126`; grep clean | Per-device + fleet observability |
| **B5** ○ | S2 | Razorpay zero webhook replay protection (`eventId` always undefined); Stripe dedupe mis-keyed on object-id + non-atomic, fail-open on Redis down | `billing.service.ts:592-593`, `stripe.provider.ts:210-213`, `redis.service.ts:146-169` | Duplicate emails/side-effects |
| **B6** ○ | S2 | No idempotency keys on any PSP charge/checkout/customer create | `stripe.provider.ts:57-110`, `razorpay.provider.ts:63-118` | Double-provision risk under retry |
| **B7** ✓ | S2 | Password reset silent hard-blocker: email no-ops, never throws, reset URL only console-logged; SMTP not in env validation | `mail.service.ts:74-90,423-427`, `auth.service.ts:666` | Every locked-out user, silently |
| **B8** ○ | S2 | Stripe live signature branch untested (mocked); `amount\|\|0` can persist $0 charge; 7-day grace keys on `updatedAt` (resets on unrelated writes) | `stripe.provider.spec.ts:420`, `billing.service.ts:787`, `billing-lifecycle.service.ts:173` | Money correctness |
| **B9** ✓ | S2 | No structural tenant isolation (no RLS/extension); Playlists writes by bare `id` (TOCTOU) + playlist items don't re-check `contentId` ownership | `database.service.ts`, `playlists.service.ts:242-268` | Cross-tenant if a clause is dropped |
| **B10** ○ | S2 | Non-expiring device token: dashboard `generatePairingToken` signs with no `exp`, returns literal `expiresIn:'30d'` | `displays.service.ts:392-403,425` | Never-expiring credential |
| **B12** ○ | S3 | No pairing→publish→playback→revoke E2E; no multi-tenant fixture (seed = 1 org) | `e2e-tests/03-displays.spec.ts`, `seed.ts:30` | Isolation testbed missing |
| **B13** ○ | S3 | Pairing code logged at info level | `pairing.service.ts:455-457` | Minor log hygiene |
| **B14** ✓ | S3 | `CurrentOrganization` decorator returns undefined under JWT auth (dead code) | `organization.decorator.ts:3-8` | Latent trap |

Contract-slice work items C1–C5 and the heartbeat-ingest requirement are specified in §A.

## D. Scorecard (1–5; 5 = structural enforcement)

| # | Dimension | Score | Basis |
|---|---|---|---|
| 1 | Tenant isolation & content integrity | **3** | Identity DB-derived (never client-supplied), raw queries org-scoped, media presigned+namespaced — but discipline-only (no RLS/extension), Playlists TOCTOU write + no `contentId` ownership recheck (B9). |
| 2 | Publish-path safety | **3 (provisional)** | Not deep-audited this pass — the 5 agents didn't map the approval/draft-vs-live gate end-to-end. Flag for a dedicated publish-path investigation before trusting this number. |
| 3 | Delivery reliability & socket layer | **3** | Solid rooms, delivery-ack + pending-replay, per-message re-validation guards; but key-rotation = fleet de-auth (B4), no structured codes, second client type to preserve. |
| 4 | Billing & entitlement integrity | **2** | Webhook ingestion broken (B1), Razorpay no replay (B5), no idempotency keys (B6), lapse doesn't gate live screens (B3), grace reset bug (B8). Real signature code + atomic quota keep it off 1. |
| 5 | Identity & security | **3** | Pairing codes sound; JWT identity DB-derived; but non-expiring device token (B10), no token denylist (no jti), auth/check absent so no confirmed-revocation authority (B15). |
| 6 | Observability | **2** | Heartbeat ingested but the enriched fields are *rejected* (B2) so dark-screen detection is impossible today; no `device:revoked` events (B11); metrics/health/Sentry exist. |
| 7 | Economics | **not assessed** | No cost-per-screen telemetry gathered this pass; requires infra measurement — out of scope of the investigation agents. Do not claim a number. |
| 8 | Testing | **3** | Genuinely behavioral (~2.2% smoke), real cross-tenant/security tests; but no lifecycle E2E, no multi-tenant fixture, webhook signature + rawBody path untested (masked by service-level tests). |
| 9 | Code & ops quality | **3** | Zod env validation, migrations, typing reasonable; but rawBody bug shipped, silent email, several "boots green while broken" masks (self-test only warns). |

## E. Verdict on "78–88% ready, config-only P0s"

**REJECTED.** All three "config-only" P0s are mischaracterized, and one is a factual error about the
stack:

- **"SendGrid SMTP"** — there is no SendGrid; it's nodemailer/raw SMTP that **fails silently by
  design** and gates password reset (B7). Not "add a key" — the failure mode is invisible and the
  env isn't validated.
- **"Stripe/Razorpay live keys"** — webhook ingestion is **structurally broken at the framework
  wiring** (B1): no webhook processes regardless of keys. Plus untested live signature branch,
  Razorpay no replay protection, no idempotency keys. Billing is not config-away from working.
- **"TV store approval"** — separate (device session), but the enriched device is **actively
  rejected** by the current heartbeat DTO (B2) — a hard cross-repo deploy gate that no amount of
  store approval fixes.

**Real readiness is materially lower than 78–88% on the launch-critical paths** (billing ~40%,
observability/revocation ~30%), even though peripheral quality (test discipline, tenant identity,
media scoping, quota enforcement) is genuinely good. The gap between the two is exactly what the
"config-only" narrative hides.

**Real P0 blocker list:** B1 (webhooks), B2 (heartbeat compat), B15+B4+B11 (device revocation +
key rotation = the pre-approved contract slice), B7 (email/password-reset), B5+B6 (webhook
idempotency).

## F. Roadmap

### P0 — blocks charging real customers / serving real devices
1. **Contract slice (pre-approved, implement now):** items **1 → 2 → 3 → 4** + **widen & ingest the
   heartbeat DTO** (fixes B2, unblocks B15/B4/B11). Deploy-order constraint (item 3 before item 4;
   never 4 before 3) is a hard gate in the migration plan below. Ships with the negative tests from
   the slice exit condition (transient≠410, forged/uncached 410 impossible, cross-tenant tenantId
   rejected) plus a heartbeat-accepts-enriched-fields test.
2. **B1 — raw-body webhook fix:** `NestFactory.create(AppModule, { rawBody: true })` + a controller-
   level test that exercises the real `req.rawBody` path (not the service shortcut), for both PSPs.
3. **B7 — email fail-loud:** add SMTP to env validation, make `sendMail` surface failures on the
   password-reset path (or block boot in prod if unconfigured), so a dead mailer is not silent.
4. **B5/B6 — webhook idempotency:** `SETNX` dedupe keyed on the true event id for both PSPs;
   idempotency keys on charge/checkout/customer creation.

### P1 — integrity hardening (requires approval per checkpoint)
- **B3/B11 — entitlement → live-screen enforcement + `tenant:suspended`/`resumed` wiring** into the
  billing state transitions (composes with contract item 3's emission).
- **B9 — structural tenant isolation:** a Prisma client extension enforcing `organizationId` on
  tenant-scoped models; fix Playlists writes to carry `organizationId`; re-check `contentId`
  ownership on playlist item create.
- **B10 device-token expiry; B12 multi-tenant fixture + pairing→publish→playback→revoke E2E.**

### P2 — hygiene & measurement
- B13 log hygiene, B14 dead decorator, publish-path deep audit (dimension 2), economics/cost-per-
  screen measurement (dimension 7), Stripe live-signature integration test.

### Migration / deploy-order plan (contract slice)
- Item 1 (`tenantId` in pairing) and item 2 (structured codes + handshake middleware) are
  independently safe; item 2 keeps the legacy `error` emit alongside the new `connect_error.data.code`
  for the Electron client. **Item 3 (`device:revoked`/`tenant:*`) must ship before or with item 4
  (`auth/check`)** — the device latches `auth_check_seen` on item 4's first live response, permanently
  disabling its legacy-unpair carve-out; shipping 4 before 3 strands operators with no unpair path.
- The heartbeat DTO widen (B2) must reach prod **before** the enriched TV build reaches any device.

---

## CHECKPOINT
Phase 0 complete; report presented. **Awaiting approval for the non-contract slices (billing,
auth, publish-path, tenant-isolation, email changes all require sign-off per the ground rules).**
The pre-approved contract slice is cleared to implement — no wire-surface conflict found; item 2 is
a mechanism change (handshake middleware) the device never sees, and the one genuine surprise (B2,
the heartbeat DTO rejecting the shipped device) is folded into the slice as a P0 compatibility fix
rather than a deviation. Recommend the contract slice + B1 + B7 proceed first as the true launch-
gating set.
