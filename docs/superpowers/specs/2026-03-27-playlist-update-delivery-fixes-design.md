# Fix playlist:update Delivery Gaps

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Realtime service + Middleware

## Problem

Three server-side gaps cause devices to miss `playlist:update` events, resulting in black screens:

1. **Override suppresses playlist** — `sendInitialState()` skips playlist when content override is active. When override expires, device has no playlist to fall back to.
2. **No offline queue** — `sendPlaylistUpdate()` silently drops updates when device is offline. No Redis queue exists for playlist updates (commands have one).
3. **Fire-and-forget push** — Middleware's `notifyDisplaysOfPlaylistUpdate()` makes a single HTTP attempt with `Promise.allSettled()`. Transient failures are swallowed.

## Fixes

### Fix 1: Send playlist alongside content override

**File:** `realtime/src/gateways/device.gateway.ts` — `sendInitialState()`

Remove the early return at line 482. Send config (with override info) AND playlist. The TV app handles both events independently (config at line 739, playlist:update at line 746 — no race condition).

### Fix 2: Redis queue for offline playlist updates

**Files:**
- `realtime/src/services/redis.service.ts` — Add `setPendingPlaylist()` / `getPendingPlaylist()` methods
- `realtime/src/gateways/device.gateway.ts` — In `sendPlaylistUpdate()`, queue on delivery failure. In `sendInitialState()`, check pending queue (takes priority over DB since it's fresher).
- `realtime/src/app/app.controller.ts` — Queue when gateway returns `delivered: false`

**Redis key:** `device:pending-playlist:{deviceId}`, 30-min TTL.
**Priority:** Pending playlist from Redis > DB query in `sendInitialState()`.

### Fix 3: Retry in middleware notification

**File:** `middleware/src/modules/playlists/playlists.service.ts` — `notifyDisplaysOfPlaylistUpdate()`

Add 1 retry with 2s delay per device on HTTP failure. Keep `Promise.allSettled()` wrapper.

## Impact on TV App E2E Tests

| Test | Before | After |
|------|--------|-------|
| P-07 (restart) | Black screen | Playlist persisted, content renders from cache |
| S-06 (offline cache) | Inconclusive | Pending queue delivers playlist on reconnect |
| S-11 (reconnection) | Inconclusive | sendInitialState sends playlist on reconnect |

## Non-Goals

- No changes to the TV app (Android) — it's already correct.
- No changes to the web dashboard.
- No new WebSocket event types.
