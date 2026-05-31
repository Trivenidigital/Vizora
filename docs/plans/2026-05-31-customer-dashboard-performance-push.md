# Customer Dashboard + Performance Push

Date: 2026-05-31
Branch: `feat/customer-dashboard-performance-push`

## Subagent Findings

Read-only customer, middleware-performance, frontend-performance, and readiness passes found these highest-value issues:

1. Device content playback buffers full MinIO media files in middleware memory.
2. Display clients do not ACK `playlist:update`, so realtime can mark successful deliveries as failed.
3. Content library page-load can stampede thumbnail generation.
4. Device screenshot refresh can stay stuck if the display never emits `screenshot:ready`.
5. Dashboard health page uses fake random metrics.
6. Schedule UI allows multi-device selection but submits only the first device.
7. Visible device-group filter is not applied.
8. Template detail and card paths can load heavy editor/iframe previews before needed.
9. Critical-path E2E/smoke coverage is too permissive around actual playback.

## New primitives introduced

None. This pass uses existing NestJS controllers/services, StorageService, Socket.IO event flow, and existing web component/test patterns.

## Hermes-first analysis

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Device media streaming | none applicable | Build in existing middleware/storage path because this is runtime file delivery, not an agent workflow. |
| Realtime display ACK handling | none applicable | Build in existing display Socket.IO clients. |
| Dashboard troubleshooting UI | none applicable | Build in existing React component tests. |
| Content thumbnail fanout | none applicable | Build in existing content page/API ownership. |

Awesome-Hermes-agent ecosystem check: not applicable; no business-agent, MCP, AI-provider, or agent-spend path is introduced.

## First Buildable Slice

- [x] Replace full-buffer device-content responses with metadata-backed streaming and range support.
- [x] Keep device JWT org scoping before any file access.
- [x] Add StorageService range stream helper.
- [x] Update Electron and web display clients to ACK `playlist:update` after local application succeeds, and negative-ACK on failure.
- [x] ACK display commands only after local application succeeds; keep legacy no-capability sockets best-effort.
- [x] Remove heartbeat command drains so queued commands are delivered through the ACK-aware command path.
- [x] Remove page-load bulk thumbnail generation from content library.
- [x] Fix DevicePreviewModal refresh timeout with request-id/ref-backed cleanup.
- [x] Add focused tests for device media streaming/ranges, display ACKs, command ACKs, self-terminating commands, and screenshot timeout behavior.

## Implementation Notes

- `device-content` streaming now reads object metadata first, enforces the device JWT org boundary against the storage object key, supports normal and suffix byte ranges, and avoids caching unsatisfied range errors.
- `StorageService` exposes a range stream helper through the existing MinIO/circuit-breaker substrate.
- `AllExceptionsFilter` now handles errors after response headers are sent by ending/destroying the in-flight response instead of trying to serialize a second JSON error body.
- Realtime delivery uses ACKs only for sockets that advertise `deliveryAck`; old display clients remain best-effort to avoid breaking already-deployed players.
- Electron restart/reboot commands bypass the renderer path, ACK before local exit, and wait a 500ms flush window before relaunch/exit.
- The content library fetch path no longer pre-generates thumbnails for the entire page.
- The screenshot modal uses request epochs and timeout cleanup to avoid stale screenshot/error state after refresh, close, or device changes.

## Review Results

- Middleware/storage review: fixed stream-before-headers, object-key org scoping, circuit-breaker metadata coverage, and cached error-response concerns.
- Frontend review: fixed screenshot stale-request handling, added build-compatible shared Tailwind theme config, and added TS/CJS theme drift coverage.
- Realtime/display review: fixed capability-gated ACKs, pending command replay, renderer command ACKs, duplicate Electron client initialization, heartbeat command drains, and restart/reboot ACK timing.
- Final self-terminating command review: CLEAN. Residual risk is limited to using a bounded flush delay rather than a transport-level delivery receipt.

## Verification Commands

- `git diff --check` — pass; line-ending warnings only.
- `pnpm --filter @vizora/middleware test -- --runInBand` — pass, 141 suites / 2757 tests.
- `pnpm --filter @vizora/realtime test -- --runInBand` — pass, 11 suites / 235 tests.
- `pnpm --filter @vizora/display test -- --runInBand` — pass, 5 suites / 109 tests.
- `pnpm --filter @vizora/web test -- --runInBand` — pass, 82 suites / 881 tests. Existing unrelated React `act(...)` warnings remain in older test files; focused tests for touched modal/content files are clean.
- `npx nx build @vizora/middleware` — pass with existing webpack warnings.
- `npx nx build @vizora/realtime` — pass with existing source-map/optional `ws` warnings.
- `pnpm --filter @vizora/display build` — pass.
- `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` — pass with existing Next middleware/prod URL warnings.

## Deferred Follow-up Queue

- Replace fake health dashboard metrics with status-derived health.
- Fix schedule multi-device UI/backend mismatch.
- Wire device-group filtering.
- Add real multipart upload smoke coverage.
- Dynamic-load heavy template editor/card previews.
- Consolidate dashboard sockets/auth fetches.
- Add customer-1 Playwright shard to CI.
