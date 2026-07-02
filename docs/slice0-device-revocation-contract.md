# Slice 0 — Device Revocation Contract v1.1 (server half) — Status & Rollout

**Branch:** `feat/slice0-device-revocation-contract` · **Spec:** `vizora-tv:docs/design/revocation-contract.md` v1.1
**Status:** all items implemented + unit-tested on the branch; awaiting staged rollout.

## Item status

| Item | What shipped | Files | Tests |
|---|---|---|---|
| **1. `tenantId` in pairing status** | Paired response returns `tenantId` (= `organizationId`, wire-boundary alias) | `middleware/.../pairing.service.ts:501` | pairing.service.spec (tenantId==organizationId) |
| **2. Structured socket codes** | Socket.IO handshake middleware (`afterInit`→`server.use`) → `connect_error.data.code`; single auth authority (stash consumed by `authenticateConnection`); legacy `error.message` preserved for Electron | `realtime/.../device-handshake-auth.ts`, `device.gateway.ts` | device-handshake-auth.spec (11: transport-split, expiry≠revoke, user-fallthrough) |
| **3. `device:revoked` / `tenant:*`** | `revokeDevice` (device room) on delete+block; `emitTenantEntitlement` (org room); internal routes `/api/internal/device-revoked`, `/tenant-entitlement` | `realtime/.../device.gateway.ts`, `app.controller.ts`, `middleware/.../displays.service.ts` | gateway revoke/tenant (+3); displays.service delete/block emit |
| **4. `auth/check` endpoint** | `GET /api/v1/devices/auth/check` → 200/401/403/410 `{code}`, `Cache-Control: no-store`, per-token throttle (1/30s burst 2); sole authority for credential destruction | `middleware/.../device-auth.controller.ts`, `device-auth-check.service.ts`, `device-auth-check.throttler.guard.ts` | device-auth-check.service.spec (11: false-410 impossible, transient≠terminal, cross-tenant, DB-propagation) |
| **B2. Heartbeat compat (S1)** | `HeartbeatMessageDto` accepts + ingests `screenState`/`playbackSource`; fixes the shipped device being rejected by `forbidNonWhitelisted` | `realtime/.../dto/index.ts`, `device.gateway.ts`, `types/index.ts` | ws-validation.pipe.spec (enriched accepted, legacy compat, whitelist tight); gateway ingestion |
| **5. Fleet-view dark-screen surface** | **Backend ingest done** (B2); the dashboard fleet-view UI (per-device state + dark-screen alert) is a `web/` change — see "Remaining" | — | — |

## Deploy order (HARD constraint — do not violate)

The device permanently latches `auth_check_seen` on `auth/check`'s first live response, disabling
its legacy-unpair carve-out. Therefore:

1. **Item 1** and **B2** — safe anytime; **B2 must reach prod before the enriched TV build reaches
   any device** (else updated devices look offline).
2. **Item 2** — safe anytime (standalone value: graceful key rotation). Keeps the legacy `error`
   emit, so the Electron client is unaffected.
3. **Item 3 (`device:revoked`)** — **must ship before or with item 4.**
4. **Item 4 (`auth/check`)** — **never before item 3.** Shipping 4 first strands operators with no
   unpair path during the gap.

Recommended single rollout: **1 + B2 → 2 → 3 → 4** (3 and 4 may go together). Each is behind its
own commit for independent revert.

## Scope boundary (checkpoint-respecting)

Item 3 delivers the **emission plumbing** for `tenant:suspended`/`resumed` and the auth/check `403`
branch, but the **billing trigger** (wiring entitlement lapse to emit + set `subscriptionStatus:
'suspended'`) is an entitlement state-machine change that needs checkpoint approval — it lands with
the approved entitlement slice (finding B3). Until then, `403 TENANT_SUSPENDED` never fires (the
`'suspended'` status doesn't exist in today's enum), so no tenant is falsely darkened.

## Remaining before staging joint test

- **Item 5 dashboard UI** (`web/`): fleet-view column for `screenState`/`playbackSource` + an alert
  when a device reports connected-but-not-`playing`/`live`. Backend data is already in Redis device
  status. (Frontend slice — not device-protocol; can proceed in parallel.)
- **Wire the middleware→realtime internal calls' env** (`REALTIME_URL`, `INTERNAL_API_SECRET`) on
  staging so `device:revoked` reaches the gateway.

## Staging runbook — pre-registered joint JWT-rotation test (F3 end-to-end)

Run once items 1–4 are on staging, folded into the TV-app P0-3 hardware sitting (one hardware
session). **Staging only — never the production fleet.**

1. **Setup:** pair a physical device (Onn 4K Pro) to staging; confirm it is playing a cached
   playlist and heartbeating (`screenState=playing`, `playbackSource=live` in the fleet view).
2. **Baseline:** note the device's current token and that `auth/check` returns `200` for it
   (`curl -H "Authorization: Bearer <token>" https://staging/api/v1/devices/auth/check` → `200 {status:'ok'}`).
3. **Rotate** the staging `DEVICE_JWT_SECRET` and restart the realtime service.
4. **Assert (the F3 scenario):**
   - The device's socket handshake now fails signature → `connect_error.data.code = AUTH_INVALID`.
   - The device **keeps playing cached content** (zero black frames) and enters auth-degraded.
   - It probes `auth/check`; with the rotated secret the old token is invalid → the device does
     **not** purge on `AUTH_INVALID` (transport-layer), it re-pairs only via the operator flow.
   - **Zero credential wipe on the rotation itself.** (Full graceful re-issue requires the
     `token:refresh` path — currently a device-side re-pair; note the result.)
5. **Revocation leg:** from the dashboard, delete the device → assert it receives `device:revoked`,
   calls `auth/check` → `410`, purges, and shows the pairing screen. Confirm a *different* device is
   unaffected (no cross-device 410).
6. **Record** results in the P0-3 hardware results doc.

## Test summary (this branch)

- realtime: 304 passed (incl. handshake-auth 11, gateway revoke/tenant +3, pipe enriched-heartbeat 3)
- middleware displays module: 147 passed (incl. auth-check 11, pairing tenantId, delete/block emit)
