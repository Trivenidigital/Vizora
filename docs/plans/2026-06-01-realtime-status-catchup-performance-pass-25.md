# Realtime Status Catch-Up Performance Pass 25

**Date:** 2026-06-01
**Branch:** `feat/performance-readiness-pass-25`

## Why Now

The customer/performance review after Pass 24 identified dashboard reconnect
status catch-up as a bounded hot path. Every dashboard connection currently
joins the org room and receives up to 500 individual `device:status` events from
the realtime gateway, while the dashboard provider already supports
`device:status:batch`.

## New Primitives Introduced

None. This uses the existing realtime gateway, Socket.IO room model, and
existing dashboard `device:status:batch` event handler.

## Hermes-First Analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

## Scope

- Keep the existing tenant-scoped dashboard connection and organization-room
  authorization behavior.
- Keep the existing catch-up query cap of 500 devices plus one peek row.
- Replace per-device dashboard catch-up emits with a single
  `device:status:batch` emit containing the same status records.
- Preserve truncation logging when more than 500 displays exist for the org.
- Do not change live incremental `device:status` broadcasts for actual device
  online/offline changes.
- Ensure dashboard consumers that use `useRealtimeEvents` receive the catch-up
  batch, not only the global `DeviceStatusProvider`.

## TDD Plan

- Update the large-fleet catch-up test to expect one `device:status:batch` emit
  with 500 records instead of 500 individual emits.
- Update the small-fleet catch-up test to expect one batch with all devices.
- Keep assertions on the database query cap and truncation warning.
- Add hook coverage proving `useRealtimeEvents` fans out
  `device:status:batch` updates to existing `onDeviceStatusChange` consumers.
- Add gateway coverage for cached status precedence, payload shape, and empty
  fleet no-emit behavior.

## Review Notes

- Realtime correctness/security reviewer: CLEAN.
- Dashboard compatibility reviewer: initially found that `useRealtimeEvents`
  still subscribed only to `device:status`, which would leave Devices page row
  state stale after reconnect catch-up. Fixed by adding `device:status:batch`
  handling in the hook, then re-reviewed CLEAN.
- Local Claude Code review: CLEAN before the web compatibility fix; the post-fix
  rerun exited without usable output and is not counted as final evidence.

## Verification Plan

- Focused realtime catch-up test: 4/4 pass.
- Full realtime gateway spec: 98/98 pass.
- Full realtime suite: 277/277 pass.
- Focused web realtime hook suite: 18/18 pass.
- Full web suite: 1017/1017 pass.
- Realtime production build: pass.
- Web production build: pass with explicit local `NEXT_PUBLIC_SOCKET_URL`,
  `NEXT_PUBLIC_API_URL`, and `BACKEND_URL`.
- Changed-file ESLint: exit 0 with pre-existing warnings only.
- Security JWT guard: pass.
- `git diff --check`: pass with CRLF warnings only.

## Residual Risks

- The dashboard provider and hook both handle `device:status:batch`. The hook
  still fans out the capped batch as per-device callbacks to preserve existing
  page contracts, so local client CPU work is reduced less than socket fan-out.
- Dashboard still also performs REST status initialization on mount. This pass
  reduces socket fan-out but does not remove the duplicate REST fetch.
- No Devices page integration test proves status sorting/last-seen columns from
  a batch event; hook-level batch fan-out is covered.
