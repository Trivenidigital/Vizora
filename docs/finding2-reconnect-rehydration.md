# Finding-2 — reconnect content-delivery rehydration

**Source:** live emulator E2E (2026-07-03) — a device whose playlist was assigned while its
backend link was flaky did not render its already-assigned playlist on reconnect/restart; it
only appeared after a manual re-trigger, though `currentPlaylistId` was set server-side.

## Root cause (deep-validated)

The realtime gateway's `emitWithDeliveryAck` has a **legacy best-effort path**: if the socket
doesn't advertise the `deliveryAck` capability it fires `socket.emit(...)` and returns
`{delivered: true, legacy: true}` with **no proof of receipt**. The current TV app is entirely
in this path (it sends no ack). In `deliverPendingPlaylist` the pending item is **atomically
consumed** from Redis *before* that best-effort emit, and `sendInitialState` then early-returned
on the `'delivered'` status — **skipping the authoritative `currentPlaylistId` DB re-send**. So a
dropped best-effort frame → pending destroyed + DB backstop skipped → holding screen with valid
content sitting in the DB.

## Fix (shipped, commit on `fix/finding2-reconnect-rehydration`)

Distinguish a best-effort delivery from a confirmed one:
- `deliverPendingPlaylist` returns `'delivered-unconfirmed'` for a legacy no-ack emit, `'delivered'`
  only for an acknowledged one.
- `sendInitialState` short-circuits **only** on confirmed `'delivered'` (and `'requeued'`/`'deferred'`,
  where the socket is stale); `'none'`/`'skipped'`/`'delivered-unconfirmed'` fall through to the
  authoritative DB re-send.

**Safety invariant (holds):** DB `currentPlaylistId` is always ≥ the pending item in freshness —
every `setPendingPlaylist` caller writes `currentPlaylistId` first, and reconnect always re-reads the
DB live — so re-sending from the DB can never regress content. (Confirmed by the adversarial review,
which found it stronger than claimed — robust even to fire-and-forget notify reordering.)

## Adversarial review verdict: HOLD — merge gated on a CLIENT-side change

The backend status-plumbing is sound, but the "idempotent client-side" claim was **FALSE** (verified
against `vizora-tv/src/main.ts`). Two required changes before merge:

1. **CRITICAL — the double-send is not client-idempotent.** For a legacy device (the whole fleet) with
   a pending item, the fix emits `playlist:update` twice on reconnect: the best-effort pending emit,
   then the authoritative DB emit. `updatePlaylist` (`main.ts:1151-1187`) has no identity check — it
   unconditionally resets `currentIndex=0`, bumps `playbackGeneration`, and re-commits. Because the DB
   round-trip separates the two emits by real latency, the client commits the first render then tears
   it down and rebuilds — a template DOM flash / video restart-to-0:00, **plus a duplicated
   `content:impression`** (proof-of-play analytics defect). Never-black (F9) absorbs the black-frame,
   but not the flash/restart/duplicate-impression.
   **Required fix (CLIENT, cross-repo → gates merge):** make `updatePlaylist` a no-op when the incoming
   `playlist.id` + item set already matches the currently-playing one. This is *elegant* — it also
   distinguishes "pending rendered" (P already current → DB re-send is a no-op, no flash) from "pending
   lost / strand" (P not current → DB re-send renders it, recovery works). The backend cannot do this
   alone: it can't tell whether a legacy best-effort emit actually rendered, so it can't safely skip
   the re-send. **This is the TV-app change an unattended session was barred from making — queued.**
2. **FIXED here (backend, review #2)** — `'requeued'` (emit failed via ack-timeout/negative-ack while
   the socket is still live) was short-circuited like `'deferred'` (a superseded socket). That silently
   reproduced Finding-2 for future ack-capable devices. Now only `'delivered'`/`'deferred'`
   short-circuit; `'requeued'` falls through to the DB re-send.

Tests (`device.gateway.spec.ts`, 123 green): fall-through on `'delivered-unconfirmed'` (the regression —
fails on main), short-circuit on `'delivered'`/`'deferred'`, **fall-through on `'requeued'`** (review #2),
legacy→`'delivered-unconfirmed'` vs acked→`'delivered'`.

## Tracked residuals (NOT closed by this fix — do not let the green E2E imply otherwise)

1. **Connected-flaky-no-reconnect.** If a device stays connected but drops the assign-time frame
   without a socket disconnect, `sendPlaylistUpdate` clears pending + reports success, and no
   reconnect fires `sendInitialState` — so the DB backstop never runs. The robust close is a
   **device-side pull on connect** (TV app calls an authoritative "current content" endpoint on
   every connect, not only reacting to pushes) and/or, in `sendPlaylistUpdate`, queue pending for
   legacy devices even when a socket is present so the next reconnect self-heals. The device-side
   pull also closes RC1 as defense-in-depth.
2. **Schedule-only content is never delivered (pre-existing C-7).** `findActiveSchedules` is a
   read-only query exposed only at `GET /schedules/active/:displayId`; it never writes
   `currentPlaylistId`, never pushes, and the TV app never polls it. `sendInitialState` only reads
   `currentPlaylistId`. So content assigned purely via a Schedule renders on no path at all. Fix:
   either `sendInitialState` resolves `activeSchedule(priority) ?? currentPlaylistId`, or the TV app
   polls `/schedules/active/:displayId` on connect + at schedule boundaries. Tracked in
   `tasks/vizora-launch-review.md` (C-7).

Both residuals point at the same durable answer: **the device should pull its authoritative current
content on connect**, making delivery resilient to any single push's fate.
