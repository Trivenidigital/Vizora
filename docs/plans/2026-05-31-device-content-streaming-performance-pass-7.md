# Device Content Streaming Performance Pass 7

## Context

Customer display playback is a hot path. The current `GET /api/v1/device-content/:id/file`
handler performs device-token verification, a display current-token DB lookup, a content DB
lookup, and a MinIO metadata lookup on every full-object or byte-range request. Video playback
typically emits clusters of range requests for the same token/content/object, so the path repeats
auth and metadata work inside the same playback burst.

Production deploy remains blocked by dirty/diverged prod-local work, so this pass is repo-side
only until the deployment gate is safe.

## New primitives introduced

Small in-process TTL caches inside `DeviceContentController` only:

- verified current device-token payload cache keyed by SHA-256 token hash
- tenant-scoped content row cache keyed by `organizationId:contentId`
- MinIO object metadata cache keyed by object key

No schema, env vars, external cache, queue, storage topology, or parallel streaming substrate.

## Hermes-first analysis

Not applicable. This pass does not add business-agent behavior, MCP tools, Hermes skills,
AI/provider calls, spend paths, or customer-lifecycle/support automation.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Device media streaming | none applicable | Use existing NestJS controller/storage path; Hermes is not in request serving. |
| Middleware request caching | none applicable | Build locally as bounded in-process cache around existing controller calls. |

Awesome-Hermes ecosystem check: no relevant runtime serving/cache primitive applies to this
middleware hot path.

## Design

1. Keep the existing device JWT and tenant boundaries. The auth cache only stores a result after
   `verifyCurrentDeviceToken` has validated signature, token shape, display org, disabled state,
   and current stored token hash.
2. Keep TTLs short to bound stale-token and stale-content exposure:
   - device auth cache: 5 seconds, capped by JWT `exp` when present
   - content row cache: 10 seconds
   - object metadata cache: 10 seconds
3. Keep MinIO availability checked on every request before opening a stream. Cached metadata must
   not mask a storage outage.
4. Do not cache misses or errors. Disabled/stale/missing tokens, missing content, missing metadata,
   oversized files, and stream failures remain uncached.
5. Keep successful full/range media responses `Cache-Control: private, no-store`. The media URL is
   stable (`/device-content/:id/file?token=...`), so browser/device `max-age` could bypass server
   auth and content checks after token rotation, display disable, or content replacement. Versioned
   media URLs or validator-based 304 handling are deferred to a separate design.
6. If a cached content row or cached object metadata leads to a pre-header MinIO stream-acquisition
   failure, invalidate the relevant content/metadata cache entries and retry once with fresh DB and
   metadata lookups. This prevents a normal file replacement from becoming a transient playback
   failure when the old object was deleted after being cached.
7. Add max-entry limits and opportunistic pruning so one process cannot grow caches without bound.

## Verification plan

- Add focused unit tests that first fail on repeated range requests doing duplicate auth/content/
  metadata work.
- Assert cache expiry rechecks the display token hash before accepting a rotated/stale token.
- Assert successful full/range responses remain `private, no-store` and 416 remains `no-store`.
- Assert stale cached object keys are invalidated and retried once before response headers are sent.
- Add a concurrent same-token/same-content range-request test if the implementation includes
  in-flight request coalescing.
- Run focused middleware tests for `device-content.controller`.
- Run at least two subagent reviews before broader tests.
- Run broader middleware tests/build/typecheck if reviews are clean or after fixes.

## Residual risks

- A token revoked or display disabled immediately after a successful request may remain accepted by
  that middleware worker for up to 5 seconds.
- Content URL or object metadata replacement may remain stale for up to 10 seconds on the worker
  that cached it, unless the old object disappears before stream acquisition, in which case the
  controller retries after invalidating the cached row/metadata.
- The route's authorization model remains the pre-existing org-scoped device-token model: a current
  device token can request content by ID within its organization. This pass does not add playlist,
  schedule, active-status, or assignment-level authorization.
- Caches are per-process; this improves burst behavior without introducing cross-process coherence
  or new infrastructure.
