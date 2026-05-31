# Performance Readiness Pass 11

**Date:** 2026-05-31
**Branch:** `feat/performance-readiness-pass-11`

## Goal

Reduce customer-visible and middleware performance risk with small repo-side
changes that are buildable, testable, and safe to merge while production deploy
remains blocked by dirty/diverged prod-local state.

## New primitives introduced

- `GenericApiDataSource` bounded JSON response reader.
- Local lazy-load guards for content-page modal-only device/playlist data.

## Hermes-first analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, or spend paths.

## Reviewer Input

Three read-only reviewers converged on two small, high-value targets:

- Generic API widgets call `res.json()` on arbitrary customer-configured URLs,
  so a large JSON response can spike middleware memory.
- Dashboard pages still issue unnecessary first-paint requests: content loads
  devices/playlists before the related modals open, and devices refetches
  server-hydrated devices/playlists on mount.

Larger findings are valid but deferred from this slice: shared dashboard
Socket.IO provider, full server-side content library pagination/search,
playlist summary payloads, template refresh locking, dashboard real health and
quota, and API-key surface cleanup.

## Design

### Generic API Widget Body Cap

Add a 1 MiB response cap to `GenericApiDataSource`.

- Reject oversized `Content-Length` before reading the body.
- Read `Response.body` as a stream and stop once the cap is exceeded.
- Cancel the body/reader when rejecting an oversized response so the remote
  transfer is not left running.
- Parse JSON from the bounded text payload instead of calling `res.json()`.
- Preserve the existing circuit-breaker fallback behavior.
- Preserve existing SSRF guard, GET-only restriction, fixed User-Agent/Accept,
  manual redirect handling, and responseRoot dot-path behavior.

### Dashboard First-Paint Request Reduction

Content dashboard:

- Keep content and folders loading on mount.
- Lazy-load devices only when the user opens the push-content modal.
- Lazy-load playlists only when the user opens the add-to-playlist modal.
- Show a small loading state inside those modals while options are loading.
- Refresh options on each explicit modal open so long-lived dashboard sessions
  do not show stale device status or playlist inventory.
- Show retryable error states inside those modals if option loading fails.

Devices dashboard:

- Keep using server-rendered initial devices and playlists.
- Skip client refetches only when server pagination metadata proves the initial
  devices/playlists include the complete first result set.
- Continue fetching when initial props are empty and after mutating actions.

## Tests

- Middleware unit tests for Generic API oversized `Content-Length`, chunked
  over-limit body, stream cancellation, valid under-limit JSON, and fallback on
  body-cap failures.
- Web content-page tests proving `getDisplays`/`getPlaylists` are not called on
  mount and are called only when opening the relevant modals.
- Web content-page tests covering option-load retry recovery and refresh on
  each modal open.
- Web devices-page tests proving complete server props do not refetch devices or
  playlists on mount, while empty/incomplete props still trigger client fetches,
  including page-2 pagination.

## Non-Goals

- No production deploy or prod-state mutation.
- No generic data-source POST/OAuth support.
- No resumable uploads, thumbnail queue, shared realtime socket provider, or
  full content-library server pagination in this slice.
