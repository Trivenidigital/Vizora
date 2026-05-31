# Device Token Current-Hash Enforcement Plan

Date: 2026-05-31
Branch: `feat/customer-performance-review-5`

## Goal

Reject stale display JWTs after re-pairing or token rotation by enforcing that the presented raw device token hashes to the current `Display.jwtToken` value in both authenticated device-content streaming and realtime Socket.IO handshakes.

## New primitives introduced

None. This reuses the existing `Display.jwtToken` hash column, existing pairing-token SHA-256 storage, the dual device JWT model, middleware device-content controller, and realtime gateway.

## Hermes-first analysis

This pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Device JWT authentication | none applicable | Use existing middleware/realtime auth paths and `Display.jwtToken`. |
| Token rotation persistence | none applicable | Use existing Prisma display update path. |

Awesome-hermes-agent ecosystem check: not applicable; this is a local auth-boundary hardening task, not agent orchestration.

## Evidence

- Pairing already stores a SHA-256 hash, not plaintext, on `Display.jwtToken` in `middleware/src/modules/displays/pairing.service.ts`.
- Existing-device pairing also stores the hash in `middleware/src/modules/displays/displays.service.ts`.
- `GET /api/v1/device-content/:id/file` verifies the token signature and display/org/disabled state, but does not compare the raw token hash to `Display.jwtToken`.
- Realtime `authenticateConnection()` verifies the token signature and display/org/disabled state, but does not compare the raw token hash to `Display.jwtToken`.
- Realtime token rotation emits `token:refresh` but does not persist the new token hash, leaving the old token as the DB-current token.

## Design

1. Middleware device-content
   - Extract both the verified payload and raw token from the request.
   - Hash the raw token with SHA-256.
   - Select `jwtToken` with the display row.
   - Reject if the display is missing, org mismatched, disabled, has no stored token hash, or has a stored hash that differs from the presented token hash.
   - Keep all content lookup and streaming behavior unchanged after authorization succeeds.

2. Realtime gateway
   - Select `jwtToken` during device handshake.
   - Reject device sockets when the stored hash is missing or differs from the presented raw token hash.
   - Preserve user-token handshake behavior.
   - During near-expiry rotation, update `Display.jwtToken` to the new token hash only when the row still has the old current hash, then emit `token:refresh` only after the update succeeds.
   - If rotation persistence fails or races, keep the existing authenticated socket connected but do not emit an unusable replacement token.

3. Tests
   - Middleware: stale signed device token is rejected before content lookup; missing stored token hash is rejected; matching hash still streams.
   - Realtime: stale signed device token is rejected before room join/status update; matching hash connects; rotation writes the new hash before emitting the refresh event; failed rotation update does not emit a refresh token.

## Runtime-State Verification

Before any deployment of fail-closed token-hash enforcement:

- Query prod display token-hash coverage: total displays, active paired displays, and displays where `jwtToken IS NULL`.
- Reconcile any legacy active displays missing `jwtToken` through an operator-approved re-pair/migration plan.
- Reconcile prod `/opt/vizora/app` dirty/diverged checkout before any pull/restart/deploy.

## Verification

- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller`
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=device.gateway`
- `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
- `npx nx build @vizora/realtime`
- Multi-agent review before broader affected tests.

## Deploy Gate

Deployment remains blocked until production checkout state and display token-hash runtime state are safe. This branch must not pull/reset/stash/restart production services.
