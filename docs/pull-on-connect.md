# Design: device pulls authoritative content on connect (push becomes an optimization)

**Status:** DESIGN ONLY on the backend. Cross-repo (backend + TV app).
**Would close structurally (once implemented):** Finding-2 residual 1
(connected-flaky-no-reconnect), Finding-2 residual 2 / C-7 (schedule-only content delivered by no
path), and the review's client-idempotency requirement.

> **⚠️ Current reality (2026-08-01): the client ships, the server does not.**
> The TV app (`vizora-tv`) already calls `GET /api/v1/devices/me/content` on every reconnect and on
> heartbeat reconcile, but **no such route exists in the middleware** — the only `devices/*`
> controllers are `devices/pairing` and `devices/auth`. The call 404s on every device, and the
> client's fail-safe keeps last-known-good content.
>
> Consequence: **pull-on-connect does not work today.** Playback is unaffected (the client degrades
> safely), but none of the root causes below are actually closed, and nothing should be documented
> or reported as if they were. Tracked separately; deliberately out of scope for the device
> null-origin CORS change (see `docs/device-null-origin-cors.md`).

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

## Build status (2026-07-04)

**Built + held for merge:** §5 client idempotency (`computePlaylistSignature` no-op in `updatePlaylist`,
vizora-tv `b0a7aaa`) and the §1 S1-2 content-status/expiry filter in `findActiveSchedules` (vizora
`b624ca0c`). §5 unblocks the Finding-2 backend fix (PD-1).

**Not yet built (large cross-app slice; de-risked because T1 hides the schedules UI → no C-7 exposure):**
§1 resolver + §2 endpoint + §3 pull-on-connect + §4 heartbeat reconcile. The one real decision to make
first: **push↔pull coherence.** On connect a device would both pull `/devices/me/content` (schedule ??
currentPlaylist) AND receive realtime's `sendInitialState` push (currentPlaylist today). If a schedule is
active they disagree, and whichever `updatePlaylist` runs last wins. Resolve it ONE of two ways before
building:
- (A) route realtime's `sendInitialState` through the SAME resolver (schedule ?? currentPlaylist) so its
  push == the pull. Cost: realtime must resolve schedules — it doesn't today, and duplicating the
  timezone/day-window logic risks divergence from `findActiveSchedules`. Prefer extracting the
  schedule-active evaluation into a shared, pure, unit-tested helper both apps import.
- (B) make the device-pull authoritative on connect and have realtime NOT push on connect (device pulls
  instead); realtime keeps only LIVE currentPlaylist-change pushes, which the device reconciles against
  its pulled version (§4). Cleaner separation, but live currentPlaylist changes during an active schedule
  still need the resolver to avoid overriding the schedule — so (A)'s shared helper is needed regardless.
Recommended: extract the shared schedule-active helper first, then (A). Build order: resolver+filter →
endpoint → sendInitialState-via-resolver → client pull-on-connect → boundary re-pull → heartbeat reconcile.

## Test oracle (when built)
Extend the B12 two-tenant fixture: (a) schedule-only assignment → device pull renders it (C-7); (b)
assign → drop the push while socket stays up → next heartbeat reconciles → device renders (residual 1);
(c) same-version pull/push → `updatePlaylist` no-op, single `content:impression` (review #1).
