# Session invalidation on password change (M12 security follow-up)

**Date:** 2026-05-31
**Branch:** `fix/session-invalidation-on-password-change`
**Drift tag:** `Vizora-native` — reuses the existing Redis + `JwtStrategy.validate` revocation substrate. No new infra, **no schema migration**.

## Problem

`AuthService.changePassword` (auth.service.ts:606) updates the password hash and
clears the `user_auth:${userId}` cache, but does **not** invalidate existing JWTs.
Vizora revocation today is:

- `revoked_token:${jti}` — single-token (logout / refresh). `JwtStrategy.validate:84`.
- `user_revoked:${sub}` — **boolean** "kill ALL tokens for this user", written only by
  account deletion / admin deactivation. `JwtStrategy.validate:98`.

A 7-day-lived stolen/other-device session survives a password change until natural
expiry. A push security review (HIGH) flagged this on PR #110; the email copy was
corrected, with the real fix deferred to this PR.

**Why not the boolean `user_revoked:`** — `changePassword` returns no new token
(controller:81 returns only a message), so the user must re-login. A boolean
`user_revoked:${sub}` would also reject that fresh re-login (same `sub`, key still
present) — locking the user out until the 7-day TTL. The reviewer called this out.

## Design — Redis revoked-AT timestamp + `iat` comparison

Precise, not blunt: reject tokens minted *before* the change; allow any token minted
*after*.

1. **Write on change** — write the marker on **BOTH** password-change paths
   (plan-gate review finding — the forgot-password takeover is the higher-severity
   case and must not be skipped):
   - `changePassword` (logged-in user) — after the existing `user_auth:` cache clear.
   - `resetPassword` (forgot-password token flow, auth.service.ts:549) — after the
     transaction commits + the `login_attempts:` del (line 603). userId is
     `tokenRecord.userId`. **This is the primary attack-surface case:** an attacker who
     resets a stolen-email account must kill the legitimate user's live sessions.

   Both call a shared private helper to avoid drift:
   ```ts
   private async markPasswordChanged(userId: string): Promise<void> {
     try {
       await this.redisService.set(
         `pwd_changed:${userId}`,
         String(Math.floor(Date.now() / 1000)),
         AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS, // 7d — self-expiring; all pre-change tokens dead by then
       );
     } catch (err) {
       this.logger.warn(`Failed to write pwd_changed marker for user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
     }
   }
   ```
   New distinct key `pwd_changed:` — does NOT overload the boolean `user_revoked:`
   (different semantics: "kill ALL incl. new" vs "kill pre-timestamp only").

   **resetPassword lockout note:** like changePassword, resetPassword returns no
   token (controller:432 returns only a message) — the user logs in afterward, fresh
   `iat ≥ marker`, passes. No lockout.

2. **Check in `JwtStrategy.validate`** — add right after the existing
   `user_revoked` check (line ~101), BEFORE the `user_auth:` cache read (so a cached
   user can't skip it for 60s):
   ```ts
   if (payload.iat) {
     const pwdChangedAt = await this.redisService.get(`pwd_changed:${payload.sub}`);
     if (pwdChangedAt && payload.iat < Number(pwdChangedAt)) {
       throw new UnauthorizedException('Session expired — please log in again');
     }
   }
   ```
   Add `iat?: number` to the `JwtPayload` interface (present at runtime via
   jsonwebtoken; `signOptions` has no `noTimestamp`).

## Why it's precise (no lockout of the fresh login)

- User's current token: `iat < change_time` → **rejected** next request. Old session
  (incl. attacker / other device) killed. ✓
- Re-login after change: `login()` mints a new token whose `iat = login_time ≥ change_time`
  → `iat < stored` is false → **passes**. ✓ (login happens after the change, almost
  always a later second; even same-second `iat == stored` passes since comparison is `<`.)
- Refresh bypass: `/auth/refresh` is **not `@Public`** → global `APP_GUARD` runs
  `JwtStrategy.validate` on the OLD token first → rejected before refresh issues a new
  one. No bypass. ✓ (verified auth.controller.ts:refresh)

## Residual risks (documented, accepted)

- **1-second sliver:** an old token with `iat` in the *exact same second* as the change
  survives (`iat == stored`, not `<`). Negligible vs the current 7-day survival; using
  `<` is required to never reject the fresh login. Accepted.
- **Redis down on write:** if the `set` fails, old tokens survive (same failure mode as
  today). Wrap in try/catch + `logger.warn` so it never fails the password change
  (consistent with the existing non-blocking email). Not worse than status quo.
- **Redis down on read (validate):** `redisService.get` throwing would reject the
  request. Existing `revoked_token`/`user_revoked` checks already call Redis in validate
  with no catch, so this matches established behavior — not a new failure mode. (If we
  wanted fail-open we'd diverge from the existing pattern; keep consistent.)

## Files

- `middleware/src/modules/auth/auth.service.ts` — `markPasswordChanged()` helper; call it
  in BOTH `changePassword` and `resetPassword`.
- `middleware/src/modules/auth/strategies/jwt.strategy.ts` — `iat` on `JwtPayload` + the check
  (after `user_revoked`, before the `user_auth:` cache read).
- `middleware/src/modules/auth/auth.service.spec.ts` — assert the key is written on BOTH
  changePassword and resetPassword.
- `middleware/src/modules/auth/strategies/jwt.strategy.spec.ts` — assert: pre-change token
  rejected; post-change token passes; no-key passes; same-second passes; missing-`iat` passes
  (no crash).

## Plan-gate review note (addressed)

Independent review flagged that `resetPassword` (the forgot-password flow) was missing from
the original scope — it's the highest-severity case (attacker resets a stolen account → must
kill the legit user's sessions). Added above. Also confirmed: `iat` must be added to the
`JwtPayload` interface (else the check is a silent no-op); the check goes before the 60s
`user_auth:` cache early-return; `JwtAuthGuard` is the global `APP_GUARD` (auth.module.ts:49)
so `/auth/refresh` (guarded, not `@Public`) re-validates the old token first — no bypass.

## Known residual — realtime dashboard WebSocket (MEDIUM, documented, NOT fixed here)

Second (adversarial) review found: the realtime gateway authenticates **dashboard**
WebSocket clients independently (`realtime/src/gateways/device.gateway.ts:414-436`,
`JWT_SECRET`). It checks `revoked_token:${jti}` but **not** `user_revoked:` **nor**
`pwd_changed:`. So a dashboard socket connected with a pre-change token keeps its
**read-mostly** streams (device-status / notifications) alive after a password change
until it reconnects.

- **Not introduced by this PR** — pre-existing; the gateway already omits the
  `user_revoked:` deactivation kill-switch too, so its gap is broader than password
  change alone.
- **Not bolted in here** — it's a separate service + separate auth surface; folding a
  realtime-handshake change into a REST auth PR is exactly the scope-creep we avoid.
- **Scope of this PR's claim:** REST API sessions (the primary surface + every
  account-mutating path) are invalidated. Realtime dashboard streams are not, yet.
- **Follow-up (recorded in tasks/todo.md):** extend the realtime dashboard handshake to
  consult `pwd_changed:` (and ideally `user_revoked:`) — it already shares Redis. Its own
  PR + review.

## Out of scope (do NOT bolt on)

- DB `passwordChangedAt` column (heavier option a) — only if this Redis path proves brittle.
- M12 new-login / unrecognized-device alert (separate, needs device-history migration).

## Verification plan

- `jwt.strategy.spec.ts` + `auth.service.spec.ts` via `--runTestsByPath` (read output).
- `tsc --noEmit` exit 0.
- Two independent review passes (orthogonal vectors) before PR. No self-merge.
