# Customer Readiness Hot-Path Pass 41

**Branch:** `feat/customer-dashboard-performance-pass-41`

**Why now:** Customer and performance review lanes found multiple repo-side
production-readiness issues. This pass targets the highest-impact hot-path
items that are small, testable, and safe to merge independently.

**New primitives introduced:** one logging skip metadata decorator on the
existing LoggingInterceptor. No schema, env var, runtime process, notification
path, realtime substrate, MCP tool, Hermes skill, provider spend path, or
parallel infrastructure.

**Hermes-first analysis:** checked per project convention. The Hermes Agent
Skills Hub currently reports no listed skills, and the awesome-hermes-agent
community index is an informational catalog rather than a runtime primitive for
these in-repo hot-path fixes.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Display playback cache policy | none found | build in Vizora display client; this is browser media behavior |
| Middleware health/readiness | none found | build in existing NestJS health module |
| HTTP media-stream logging | none found | build in existing LoggingInterceptor |
| Playlist realtime fanout tenant scope | none found | build in existing playlist/realtime path |

Awesome-hermes-agent ecosystem check: no applicable runtime/library primitive
for display media caching, NestJS readiness, HTTP logging, or tenant-scoped
playlist fanout; proceed with Vizora-native code.

## Scope

1. Display playback should not prefetch/cache videos before playback. The
   display client may still preload images, but videos should rely on normal
   `<video>` range streaming.
2. Successful device media streaming requests should not emit normal HTTP logs
   or slow-request warnings. Errors must still be logged, and request IDs must
   still be attached for tracing.
3. Public readiness should fail closed when storage/MinIO is unhealthy, because
   content upload, download, and playback are customer-visible core paths.
   Public readiness should expose only self-test status, not detailed
   self-test failure messages.
4. Playlist update fanout should only notify displays in the playlist's
   organization.

## Out Of Scope

- Dashboard role-truth fixes for schedules, pairing CTAs, landing quick
  actions, team/API key settings, and settings email. These are queued as the
  next customer-dashboard pass.
- Large API-shape changes for dashboard all-page overfetch and playlist
  summary/detail split.
- Database indexing migrations for content search.
- Operator-only prod deploy or checkout cleanup.

## Verification Plan

- Red/green focused tests:
  - `web/src/app/display/__tests__/DisplayClient.test.tsx`
  - `middleware/src/modules/common/interceptors/logging.interceptor.spec.ts`
  - `middleware/src/modules/health/health.controller.spec.ts`
  - `middleware/src/modules/health/health.service.spec.ts`
  - `middleware/src/modules/playlists/playlists.service.spec.ts`
- Broader tests:
  - `pnpm --filter @vizora/web test -- DisplayClient.test.tsx`
  - `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/common/interceptors/logging.interceptor.spec.ts middleware/src/modules/health/health.controller.spec.ts middleware/src/modules/health/health.service.spec.ts middleware/src/modules/playlists/playlists.service.spec.ts`
  - relevant builds and CI after PR.

## Customer Improvement Backlog Captured

- Viewer schedule create/edit/delete controls.
- Support chat failed-message visibility and retry.
- Viewer pairing CTAs and pair-page access.
- Dashboard quick actions that ignore role permissions.
- Settings admin email field that looks editable but is not saved.
- Team/API key admin-only controls shown to lower roles.
- Offline-device push semantics.
- Strict browser upload/pairing/playlist/schedule/support/fleet smoke gaps.
- Dashboard overfetch, playlist payload bloat, output sanitization cost, content
  search indexes, and pairing Redis scan performance follow-ups.
