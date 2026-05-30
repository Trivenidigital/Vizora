# Realtime WS mid-session teardown (session-invalidation follow-up)

**Date:** 2026-05-31
**Branch:** `feat/realtime-ws-session-teardown`
**Drift tag:** `Vizora-native` — extends the realtime gateway's existing auth checks + its existing periodic-cleanup-interval pattern. Reuses Redis keys already written by middleware. No new infra, no schema migration, **no middleware change**.

## Problem (the residual from PR #112)

PR #112 added **connect-time** session-invalidation checks to the dashboard WebSocket
handshake (`device.gateway.ts authenticateConnection`, user-JWT branch): it rejects a
handshake when `user_revoked:${sub}` exists or the token's `iat < pwd_changed:${sub}`.

But the gateway authenticates **only at handshake** — there is no per-message re-auth and
no teardown of *already-connected* sockets. So a dashboard socket that connected *before*
a password change / account deactivation keeps receiving its streams (`device:status`,
`notification:new`, `screenshot:ready`) until it naturally disconnects/reconnects (tab
close, refresh, network drop, server restart). Window = socket lifetime.

Severity: MEDIUM. Dashboard sockets are **read-only** (status/notifications); they cannot
issue commands. But a stolen/again-deactivated session keeping a live read stream is a
confidentiality gap the session-invalidation story should close.

## Verified ground truth

- Dashboard user connect: `handleConnection` (~240-248) joins `org:${orgId}`, stores
  `client.data.{userId, organizationId, isDashboard:true}`. The verified `userPayload`
  (incl. `iat`) is available in `authenticateConnection` (~412-465). **`iat` is NOT
  currently stored on `client.data`.**
- The two Redis keys already exist and are read at connect-time today:
  `user_revoked:${userId}` (boolean, `exists`) and `pwd_changed:${userId}`
  (epoch-seconds, `get`). Written by middleware: `pwd_changed:` via
  `auth.service.markPasswordChanged` (changePassword + resetPassword); `user_revoked:`
  via `auth.service.deleteAccount` (:928), `users.service.deactivate` (:215),
  `users-admin.service` (:339).
- `realtime/src/services/redis.service.ts` exposes `get`/`exists` (used by #112).
- The gateway ALREADY runs periodic cleanup via `this.cleanupIntervals.push(setInterval(
  ..., 60000 / 5*60*1000))` in its constructor, cleared in `onModuleDestroy`.
- Socket.IO 4.8: `server.in(room).fetchSockets()` + `socket.disconnect(true)` available.

## Mechanism decision

Two options were named in the follow-up note: **(A) HTTP push on key-write** vs
**(B) realtime-side periodic sweep**. **Recommendation: B (sweep).**

### B — Periodic sweep (RECOMMENDED)

A new gateway interval (mirroring the existing cleanup loops) periodically re-applies the
same checks the handshake already does, to *connected* dashboard sockets:

```
every SWEEP_INTERVAL (default 60s):
  sockets = server.fetchSockets() filtered to client.data.isDashboard
  group by client.data.userId  (dedup Redis reads → one pair of reads per distinct user)
  for each userId:
    if exists(user_revoked:userId):            disconnect ALL that user's sockets
    else:
      pc = get(pwd_changed:userId)
      if pc: for each socket: if socket.data.tokenIat < Number(pc): disconnect that socket
  emit 'session:expired' to the socket just before disconnect(true) so the dashboard UI
  can show a "signed out" state instead of a silent drop.
```

Requires one extra field at connect: `client.data.tokenIat = userPayload.iat` (so the
per-socket `pwd_changed` comparison works; `user_revoked` needs only `userId`).

**Why B over A:**
1. **Zero middleware changes.** A would inject `HttpService` into `AuthService` (which has
   none today) + a new realtime endpoint + DTO + gateway method + a `user:${sub}` room,
   and to cover `user_revoked:` would wire HTTP calls into 3 separate services. B touches
   only `device.gateway.ts` (+ its spec).
2. **Covers BOTH keys (and any future one) uniformly** — it just re-runs the handshake
   checks. A would need wiring at every current and future key-write site.
3. **Reuses the gateway's existing `cleanupIntervals` pattern** — not a new substrate; one
   more `setInterval` alongside the rate-limit / stale-entry sweeps already there.
4. **Proportionate.** Read-only streams; a ≤60s teardown lag closes the "tab left open"
   residual, while #112's connect-time check already handles reconnect/refresh instantly.

**Cost & mitigations:** one `fetchSockets()` + ≤2 Redis reads per *distinct connected
dashboard user* per interval (dedup by userId, not per-socket). Devices excluded
(`isDashboard` filter). 60s interval. Negligible for realistic dashboard concurrency.

### A — HTTP push on key-write (rejected for this PR)

Immediate teardown, but: injects HTTP into auth (+3 services for user_revoked), new
endpoint/DTO/room, more files, more cross-service coupling. The immediacy isn't worth it
for read-only streams. (If a future requirement needs <1s teardown, A can be added on top
— the `user:` room + endpoint — without removing B.)

## Plan-gate review outcome (2026-05-31): BUILD Plan B + 4 refinements

Independent review verified all load-bearing facts (dashboard sockets read-only — every
mutating `@SubscribeMessage` is gated by `WsDeviceGuard` requiring `client.data.deviceId`;
`iat` not stored; `cleanupIntervals`/`onModuleDestroy` pattern; Redis `get`/`exists`;
single `markPasswordChanged` chokepoint; 3 `user_revoked:` sites; no HttpService in
AuthService). Verdict: Plan B correct, ≤60s lag acceptable (no write path for dashboards),
no correctness reason forces Plan A. Required refinements folded in below:

1. **Track dashboard sockets in an in-memory `Map<userId, Set<socketId>>`** (mirror the
   existing `deviceSockets` map) — populated on dashboard connect, cleaned on disconnect.
   The sweep iterates THIS map (only dashboard users), not `server.fetchSockets()` over the
   whole device fleet. Disconnect via the local `this.server.sockets.sockets.get(socketId)`
   (realtime is single-instance).
2. **`pwd_changed` decision is per-socket** (per-tab `client.data.tokenIat`), NOT collapsed
   to user level — two tabs (one pre-change, one post-change) must be handled independently:
   kill the old, keep the new.
3. **Reentrancy guard** (`if (this.sweepRunning) return;`) + **per-user try/catch** so a
   Redis throw skips that user, never crashes the interval.
4. **Hardcode 60s** as a module-level `const SESSION_SWEEP_INTERVAL_MS = 60_000;` — no new
   env var (consistent with the existing hardcoded cleanup intervals; avoids the
   .env/AGENTS/CLAUDE doc surface for a value nobody will tune).

## Files (Plan B, final)

- `realtime/src/gateways/device.gateway.ts`:
  - new field `dashboardSockets: Map<string, Set<string>>` (userId → socketIds).
  - dashboard connect branch (`handleConnection` user kind): store
    `client.data.tokenIat = authResult.payload.iat`; add socketId to `dashboardSockets`.
  - `handleDisconnect`: remove dashboard socketId from `dashboardSockets` (clean empty sets).
  - `private async sweepInvalidatedSessions()` with reentrancy guard + per-user try/catch:
    for each userId in `dashboardSockets`, read `user_revoked:` (exists) once + `pwd_changed:`
    (get) once; if revoked → disconnect all that user's sockets; else per socket, if
    `tokenIat < Number(pwd_changed)` → disconnect that socket. `emit('session:expired')`
    immediately before `socket.disconnect(true)`.
  - constructor: `this.cleanupIntervals.push(setInterval(() => this.sweepInvalidatedSessions(), SESSION_SWEEP_INTERVAL_MS))`.
  - `UserPayload.iat?: number` already added in #112 — confirm.
- `realtime/src/gateways/device.gateway.spec.ts`: tests —
  - sweep disconnects all sockets of a user whose `user_revoked:` is set;
  - sweep disconnects a socket whose `tokenIat < pwd_changed:`;
  - sweep does NOT disconnect a post-change socket (`tokenIat >= pwd_changed:`) — and with
    two sockets for one user (one pre-, one post-change) only the pre-change one drops;
  - device sockets are never in `dashboardSockets` → never swept;
  - dedup: one `exists` + one `get` per distinct user regardless of socket count;
  - emits `session:expired` before disconnect;
  - a Redis throw for one user doesn't prevent others being swept (per-user try/catch);
  - disconnect on dashboard removes the entry from `dashboardSockets`.

## Failure modes / residuals

- **Redis down during sweep:** `get`/`exists` throw → catch per-user, log, skip that user
  this cycle (don't crash the interval). Worst case: teardown deferred to next cycle or to
  the connect-time check on reconnect. Non-blocking, matches the gateway's resilient-loop
  posture.
- **iat-absent socket:** if a connected socket has no stored `tokenIat`, skip its
  `pwd_changed` check (fail-open, same as #112's connect-time guard). `user_revoked` still
  applies (no iat needed).
- **Up-to-60s lingering window** between key-write and sweep — accepted (read-only streams;
  connect-time check covers reconnect). Documented.
- **Same-second `iat == pwd_changed`** passes (strict `<`) — consistent with #112, never
  rejects the fresh post-change login's socket.

## Out of scope (do NOT bolt on)

- Per-message re-auth (heavier; not needed for read-only streams).
- HTTP-push immediacy (Plan A) — only if a sub-second requirement appears.
- M12 new-login/unrecognized-device alert (separate, needs schema migration).

## Verification plan

- `device.gateway.spec.ts` via `pnpm --filter @vizora/realtime test -- --runTestsByPath`
  (read JSON reporter output — text layer flaky this session).
- `tsc --noEmit` exit 0; middleware untouched (`git diff origin/main -- middleware` empty).
- Two independent reviews (plan-gate now; adversarial on the diff) before PR. No self-merge.
