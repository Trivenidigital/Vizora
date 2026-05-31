# Display Delivery Reliability Follow-up

Date: 2026-05-31
Branch: `feat/customer-performance-hardening-2`

## Source Findings

Read-only realtime/display and dashboard/customer reviewers found residual delivery risks after the customer dashboard performance push:

1. Negative ACKs queue playlist or command work, but a still-connected device only replays that queue on reconnect.
2. Fleet broadcast commands bypass `DeviceGateway.sendCommand`, so they do not use ACKs or the same queue semantics as single-device commands.
3. Electron display playback/cache paths receive protected `/device-content/:id/file` URLs without a device token query, while the browser display app already appends the device token.
4. Middleware single-display command callers send `{ displayId, command, payload }` to realtime, but realtime now validates `{ deviceId, command: { type, payload } }`.

## New Primitives Introduced

None. This pass tightens existing middleware display commands, realtime gateway delivery, and Electron display-client URL handling.

## Hermes-first Analysis

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Realtime command replay | none applicable | Build in the existing Socket.IO gateway because this is device transport behavior, not agent orchestration. |
| Fleet command broadcast | none applicable | Route through existing `DeviceGateway.sendCommand`. |
| Electron protected media URL handling | none applicable | Build in the existing Electron display client where the device JWT is already available. |
| Middleware display command DTOs | none applicable | Fix callers to match the existing realtime DTO contract. |

Awesome-Hermes-agent ecosystem check: not applicable; no business-agent, MCP, AI-provider, or spend path is introduced.

## Plan

- [x] Add failing focused tests for pending playlist/command replay from heartbeat without restoring heartbeat response command drains.
- [x] Route fleet broadcast commands through `DeviceGateway.sendCommand` and return delivered/queued/failed counts while preserving `devicesOnline`.
- [x] Append the current Electron device token to protected `/device-content/:id/file` URLs before renderer playback/cache and `push_content` loads.
- [x] Fix middleware display command calls to use realtime's validated nested command DTO.
- [x] Run focused tests for realtime, display, middleware, and web touched paths.
- [x] Run multi-review on the diff before broader tests.
- [x] Run broader service tests/builds proportional to touched packages.
- [ ] Open PR, wait for CI, merge if clean.

## Verification Targets

- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|app.controller|redis.service"` - pass, 4 suites / 112 tests.
- `pnpm --filter @vizora/display test -- --runInBand --testPathPattern="device-client"` - pass, 1 suite / 46 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|fleet.service"` - pass, 4 suites / 72 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="DeviceControls"` - pass, 1 suite / 6 tests.
- `git diff --check` - pass; line-ending warnings only.
- `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 242 tests.
- `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 115 tests; existing MaxListeners warning remains in full display suite.
- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2761 tests.
- `pnpm --filter @vizora/web test -- --runInBand` - pass, 82 suites / 882 tests; existing unrelated React `act(...)` warnings remain.
- `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- `npx nx build @vizora/realtime` - pass with existing source-map/optional `ws` warnings.
- `pnpm --filter @vizora/display build` - pass.
- `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` - pass with existing Next middleware/proxy and missing production API URL warnings.

## Review Results

- Internal API re-review: CLEAN.
- Display-client re-review: CLEAN.
- Realtime re-review: CLEAN after fixing in-flight stale playlist replay, command socket-handoff requeue semantics, and heartbeat replay backoff reset for newly queued work.
