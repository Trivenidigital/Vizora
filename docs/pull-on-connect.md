# Design: device pulls authoritative content on connect (push becomes an optimization)

**Status:** DESIGN ONLY. Cross-repo (backend + TV app). No implementation in this session.
**Closes structurally:** Finding-2 residual 1 (connected-flaky-no-reconnect), Finding-2 residual 2 /
C-7 (schedule-only content delivered by no path), and the review's client-idempotency requirement.

## The one root cause behind all three

The system is **push-only**: the device reacts to `playlist:update` pushes but never authoritatively
*pulls its own current truth*. Every symptom is a face of that:
- **Finding-2 (reconnect strand):** a missed/best-effort push isn't reconciled → dark with valid DB content.
- **Residual 1 (connected-flaky):** a push dropped while the socket stays up → no reconnect → never reconciled.
- **C-7 (schedules):** schedule-assigned content is never pushed and never pulled → renders on no path.

The durable fix is to invert the source of truth: **the device pulls its authoritative current content
on connect (and on a cheap periodic reconcile); push stays as a latency optimization, not the source of
truth.** This ends the whole class rather than patching each reachable instance.

## Components

### 1. Authoritative device-content resolver (backend)
One server-side function `resolveEffectiveContent(deviceId)` returning the content the device *should*
show right now, unifying BOTH assignment models:
```
activeSchedule(deviceId, now) by priority   // closes C-7
  ?? display.currentPlaylistId                // the direct-assign path
  ?? null                                     // → holding
```
`sendInitialState` calls this instead of reading only `currentPlaylistId` — so connect-time rehydration
covers schedules too.

**MANDATORY coupling (S1-2):** the schedule branch MUST apply the content-status/`expiresAt` filter that
`findActiveSchedules` (`schedules.service.ts:240-243`) currently lacks. That gap is harmless *only*
because C-7 means nothing calls it today; the instant this resolver routes real delivery through active
schedules, an unfiltered path would ship expired/unapproved content. Land the filter in the SAME slice.

### 2. Device-facing pull endpoint (backend)
`GET /api/v1/devices/me/content` (device-JWT auth; org from the token, never a path param) →
`{ playlist, source: 'schedule'|'currentPlaylist'|'none', version }` from the resolver. `version` is a
stable hash of (playlistId, itemIds+order+durations, scheduleId, window) so the client can cheaply detect
"same content." (The existing `GET /schedules/active/:displayId` has **no production consumer** — it is
dead outside tests — so this new device endpoint is the sole authoritative pull; org-scoped to the caller
via the device token, never a path param.)

### 3. Pull-on-connect + boundary re-pull (TV app)
- On every `connect` / `exitAuthDegraded`: call the pull endpoint; render if `version` differs from the
  current one. This makes delivery resilient to any single push's fate (closes Finding-2 + residual 1's
  reconnect case; makes push a pure optimization).
- Compute the next schedule boundary from the response and set a timer to re-pull at it (closes the
  time-boxed-schedule transition — C-7's dynamic half).

### 4. Heartbeat content-version reconciliation (closes residual 1's no-reconnect case)
The device already heartbeats (~15s). Carry the current `version` on the heartbeat; the server compares
against `resolveEffectiveContent` and, on mismatch, tells the device to re-pull (or pushes the fresh
content). This catches a push dropped while the socket stays up — no reconnect required — within one
heartbeat. This is the piece pull-on-connect alone doesn't cover.

### 5. Client playlist idempotency (the review-#1 blocker — REQUIRED regardless)
`updatePlaylist` becomes a no-op when the incoming `playlist.id` + item set (or `version`) already matches
the currently-playing one. This:
- absorbs the Finding-2 backend fix's intentional double-send (best-effort pending + DB re-send) with no
  flash / no video restart / no duplicate `content:impression`;
- makes pull-on-connect free of redundant re-renders (pull returns the same version → no-op);
- distinguishes "already rendered" (no-op) from "strand" (version differs → render) — the same elegance
  that makes the Finding-2 DB re-send safe.
This is the smallest slice and unblocks the Finding-2 branch merge (PD-1) on its own; land it first.

## Rollout (each reversible, no big-bang)
1. **Client idempotency** (§5) alone → unblocks PD-1 (Finding-2 backend merge). Smallest, highest-leverage.
2. **Resolver + pull endpoint** (§1, §2) → connect-time covers schedules (closes C-7 static half).
3. **Pull-on-connect + boundary timer** (§3) → push becomes optimization; closes residual 1 reconnect case.
4. **Heartbeat reconcile** (§4) → closes residual 1 no-reconnect case.
Push (`playlist:update`) is retained throughout as the low-latency fast-path; correctness no longer
depends on it.

## What each step closes
| Step | Finding-2 strand | Residual 1 (flaky-no-reconnect) | C-7 (schedules) | Review #1 (flash/dupe-impression) |
|---|---|---|---|---|
| §5 client idempotency | — (backend already) | — | — | ✅ |
| §1+§2 resolver+endpoint | hardens | — | ✅ (static) | — |
| §3 pull-on-connect | ✅ (belt) | ✅ (reconnect) | ✅ (boundary) | — |
| §4 heartbeat reconcile | — | ✅ (no-reconnect) | — | — |

## Test oracle (when built)
Extend the B12 two-tenant fixture: (a) schedule-only assignment → device pull renders it (C-7); (b)
assign → drop the push while socket stays up → next heartbeat reconciles → device renders (residual 1);
(c) same-version pull/push → `updatePlaylist` no-op, single `content:impression` (review #1).
