# Device Token Current-Hash Enforcement Plan

Date: 2026-05-31
Branch: `feat/customer-performance-review-5`

## Goal

Reject stale display JWTs after re-pairing by enforcing that the presented raw device token hashes to the current `Display.jwtToken` value across display-facing REST and realtime paths.

## New primitives introduced

One small shared middleware auth helper and one realtime hash helper. They reuse the existing `Display.jwtToken` hash column, existing pairing-token SHA-256 storage, the dual device JWT model, middleware controllers, and realtime gateway/guards.

## Hermes-first analysis

This pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Device JWT authentication | none applicable | Use existing middleware/realtime auth paths and `Display.jwtToken`. |
| Token rotation | none applicable | Disable unsafe auto-rotation until a grace/ACK-backed design exists. |

Awesome-hermes-agent ecosystem check: not applicable; this is a local auth-boundary hardening task, not agent orchestration.

## Evidence

- Pairing already stores a SHA-256 hash, not plaintext, on `Display.jwtToken` in `middleware/src/modules/displays/pairing.service.ts`.
- Existing-device pairing also stores the hash in `middleware/src/modules/displays/displays.service.ts`.
- `GET /api/v1/device-content/:id/file` verified the token signature and display/org/disabled state, but did not compare the raw token hash to `Display.jwtToken`.
- `POST /api/v1/displays/:deviceId/heartbeat` and `GET /api/v1/schedules/active/:displayId` also verified only signed JWT claims.
- Realtime `authenticateConnection()` verified the token signature and display/org/disabled state, but did not compare the raw token hash to `Display.jwtToken`.
- Realtime message guards trusted `client.data.deviceId`, so an already-connected socket could keep operating after a re-pair changed the DB-current token hash.
- Realtime auto-rotation cannot be made reliable with a single current-token hash because either update-before-emit or emit-before-update can strand displays if delivery, persistence, or ACK is lost.

## Design

1. Middleware device JWT helper
   - Extract the token from the Authorization header, with query-token support only for media streaming.
   - Verify HS256 device JWT claims.
   - Hash the raw token with SHA-256.
   - Select `jwtToken` with the display row.
   - Reject if the display is missing, org mismatched, disabled, has no stored token hash, has a malformed/non-hex hash, or has a stored hash that differs from the presented token hash.
   - Reuse the helper in device-content streaming, display heartbeat, and active schedules.

2. Realtime gateway and guards
   - Select `jwtToken` during device handshake.
   - Reject device sockets when the stored hash is missing or differs from the presented raw token hash.
   - Preserve user-token handshake behavior.
   - Store the authenticated token hash on `client.data`.
   - Revalidate `client.data.deviceTokenHash` against the DB-current `Display.jwtToken` in `WsDeviceGuard` so already-connected sockets fail closed after re-pair.
   - Disable automatic token rotation until a future design supports grace tokens or an ACK-backed two-phase rotation flow.

3. Tests
   - Middleware: stale signed device token is rejected before content lookup, heartbeat write, or schedule lookup; missing stored token hash is rejected; matching hash still streams.
   - Realtime: stale signed device token is rejected before room join/status update; matching hash connects; connected device sockets are rejected by guard if their token hash is no longer current; near-expiry tokens do not auto-rotate.

## Runtime-State Verification

Before any deployment of fail-closed token-hash enforcement:

- Query prod display token-hash coverage: total displays, active paired displays, displays where `jwtToken IS NULL`, and malformed/non-SHA256 hashes.
- Reconcile any legacy active displays missing `jwtToken` through an operator-approved re-pair/migration plan.
- Reconcile prod `/opt/vizora/app` dirty/diverged checkout before any pull/restart/deploy.

## Verification

- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.controller|schedules.controller|device-content.controller"`
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|ws-auth.guard"`
- `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
- `npx nx build @vizora/realtime`
- Multi-agent review before broader affected tests.

## Deploy Gate

Deployment remains blocked until production checkout state and display token-hash runtime state are safe. This branch must not pull/reset/stash/restart production services.
