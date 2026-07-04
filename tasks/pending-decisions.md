# Pending decisions — awaiting operator

Items an autonomous session was explicitly barred from doing. Each has evidence + a
recommendation. Nothing here has been executed. (Session 2026-07-03/04.)

---

## HS-1 — Keystore move (standing, longest-outstanding)
`vizora-tv/android/vizora-release.jks` is still in the working tree. **Recommendation:** move it out
to a secrets location, update `keystore.properties` `storeFile=` to an absolute path, back up the
file + passwords, confirm a clean `gradlew assembleRelease`. ~10 min. The one standing live risk that
isn't waiting on hardware or a decision — close independent of everything else. *(Hard stop: secrets.)*

## HS-2 — Live PSP/SMTP keys
Insert live-mode Stripe/Razorpay + SMTP creds. **Recommendation:** run the PSP sandbox smoke against
live-MODE **test** keys first (a real webhook round-trip), then real keys. Do NOT insert without the
smoke. Code paths are real (rawBody/signature/idempotency); this is credential insertion. *(Hard stop:
live keys.)*

## HS-3 — Hardware sitting (the only source of genuinely new information)
One session, Onn 4K Pro + AOSP box, staging backend. Survivability stays 2.5 until it runs. Tests:
1. **Cold-reboot pulls content** — device reboots (power-pull ×5) and renders its last-assigned
   playlist without a manual re-trigger (F1 boot + the Finding-2 field version).
2. **Native crash recovery** — SIGSEGV → recovery via BootReceiver on next boot (F2 on real silicon).
3. **Socket-alive delivery failure self-heals** — induce a delivery failure while the socket STAYS UP
   (no reconnect) and confirm the device recovers its content. This is Finding-2 residual 1 — the one
   the emulator can't fake and the backend fix can't fully close; it needs the device-side
   pull-on-connect slice to pass.
4. **JWT-rotation joint test** — rotate staging `DEVICE_JWT_SECRET` with a paired device playing →
   keeps cached content, re-auths, zero credential wipe (F3-dead proof).
Runbooks: `vizora-tv/docs/p0-3-hardware-verification-protocol.md` + `vizora/docs/slice0-device-revocation-contract.md`.
*(Hard stop: hardware.)*

## HS-4 — TENANT_GUARD_MODE=enforce + the bare-id sweep
Do NOT flip enforce or run the enforce-mode bare-id `update`/`delete` sweep (~7 services) unattended.
Pre-enforce checklist in `docs/design/tenant-scoping-extension.md`. The log-mode warns are the go/no-go
signal — review them first. **Recommendation:** keep log-only; sequence the sweep + device-auth guard +
realtime trust-boundary as a reviewed slice before any enforce. *(Hard stop: enforce/sweep.)*

## PD-1 — Finding-2 fix: MERGE HELD pending a cross-repo TV-app change
Branch `fix/finding2-reconnect-rehydration` (backend, reviewed) fixes the connect-time strand and the
`'requeued'` short-circuit bug, with 123 green tests. But the adversarial review (HOLD) found the fix's
"idempotent client-side" claim FALSE: for a legacy device (whole fleet) with a pending item, the fix
emits `playlist:update` twice on reconnect (best-effort pending + authoritative DB re-send), and the
TV app's `updatePlaylist` (`vizora-tv/src/main.ts:1151-1187`) has **no identity check** — it resets
`currentIndex=0` and re-commits, so the second emit (separated by the DB round-trip) tears down the
first render → **template flash / video restart-to-0:00 + a DUPLICATE `content:impression`**. Never-black
absorbs the black-frame; not the flash/restart/duplicate. **Severity: NOT cosmetic** — the duplicate
impression corrupts **proof-of-play** (a billing-adjacent, customer-facing metric) on *every* reconnect;
the review prevented merging a fix that would have silently skewed play counts.

**Why queued:** the required fix is CLIENT-side (`updatePlaylist` becomes a no-op when the incoming
`playlist.id` + item set already matches the currently-playing one). It's cross-repo (vizora-tv), which
an unattended session was barred from implementing. The backend cannot do it alone (it can't tell
whether a legacy best-effort emit rendered, so it can't skip the re-send).

**Also note:** my own analysis called the double-send "benign"; the review found it CRITICAL and
corrected me (the DB round-trip separates the emits enough to interrupt the first render). Per the
"review vs my analysis disagree → hard stop" rule, this is queued rather than merged even though I now
concede the review is right.

**Recommendation:** land the client idempotency change (`updatePlaylist` no-op on same-playlist) —
which is *elegant*: it distinguishes "pending rendered" (P already current → DB re-send is a no-op, no
flash) from "pending lost/strand" (P not current → DB re-send renders it, recovery works) — then merge
the backend branch. **PD-1 and the pull-on-connect slice are ONE decision, not two** — the client
idempotency change IS §5 of `docs/pull-on-connect.md`; approve/build them together (the backend branch
merges as part of that slice). Backend branch is ready and waiting. *(Hard stop: cross-repo TV-app impl +
review-vs-analysis disagreement.)*

## PD-2 — CI-excluded e2e specs: wire-in vs delete → RECOMMEND wire-in; one sub-question queued
`ci.yml` runs only `agents` + `customer-critical-path` e2e; `content`/`playlists`/`displays`/`auth`
`.e2e-spec.ts` (143 tests of real CRUD auth/validation coverage) never run → they've rotted (~15
failures). **Investigated:** the failures are NOT app bugs — (a) "expected 401, got 403" is the global
`CsrfMiddleware` (`app.module.ts:141` `forRoutes('*')`) rejecting CSRF-less mutating requests before the
JWT guard runs (middleware precedes guards); (b) `deviceIdentifier` unique collisions are missing
per-run test isolation. **Recommendation:** WIRE IN (the coverage is real and not duplicated by
customer-critical-path); do NOT delete. Fix = update stale assertions + add unique-per-run identifiers +
add to `ci.yml`, bringing each green locally BEFORE wiring so CI doesn't go red on other latent failures.

**QUEUED sub-question (operator/security call — do not let me ratify it unilaterally):** is
**CSRF-before-auth (403 before 401) the correct order**, or should an unauthenticated request 401 first?
403-at-the-edge is a defensible, common posture (reject CSRF-less mutations before auth work), but it
means a client can't distinguish "not authenticated" from "CSRF missing." If 403 is ratified → update the
specs' assertions to 403. If 401-first is wanted → it's a real (minor) guard/middleware-order change in
the code, and the specs' current 401 expectation is right. I did NOT change the assertions either way.
*(Hard stop: security-semantics decision + the operator flagged it as possibly-real.)*

## PD-3 — C-7 (schedule-only content delivered by NO path) is an S1-class defect — decide handling
**Confirmed independently (two agents + my analysis agree, no disagreement):** content assigned purely
via a Schedule reaches the device by no path — no writer sets `currentPlaylistId` from a schedule, no
cron/push bridges it, no client polls `/schedules/active` (that endpoint is dead outside tests). 100%
deterministic for any schedule-only display; silent (dashboard shows "active", screen blank, logs clean).
- **Severity: S1-class defect** (an entire content-assignment modality has zero delivery path — the
  "promised but never shown, no error surfaced" class). **Exposure today: latent/S2** — scheduling is
  lightly adopted (prod: 4 schedules vs 17 playlists / 20 devices), and direct `currentPlaylistId`
  assignment (the default) works. Converts to active S1 the moment a customer leans on scheduling.
- **Its OWN blocker, not a Finding-2 residual** — Finding-2's fix reads only `currentPlaylistId` and
  cannot help schedules by construction. Shared fix *direction* only: pull-on-connect resolving
  `activeSchedule(priority) ?? currentPlaylistId` (`docs/pull-on-connect.md`).
- **CRITICAL coupling (S1-2):** `findActiveSchedules` (`schedules.service.ts:240-243`) has a content
  status/`expiresAt` filter gap that is currently *unreachable* only because nothing calls it. Any C-7
  fix routing delivery through `findActiveSchedules` MUST land that status/expiry filter simultaneously,
  or the newly-live path ships expired/unapproved content.

**DECISIONS for the operator:**
1. **Interim mitigation (recommended now):** hide/disable the schedules UI (`web/src/app/dashboard/
   schedules/*`) so customers aren't led to assign content down a dead path. Shipping a visible,
   functional-looking feature that silently never renders is the worst option. *(This is disabling a
   shipped customer-facing feature — operator's call. Hard stop.)*
2. **Durable fix:** the pull-on-connect slice (`docs/pull-on-connect.md`) + the S1-2 filter. Cross-repo,
   own slice.
3. **Launch-gating:** does C-7 block launch? Recommendation: NOT a hard blocker at current adoption IF
   the schedules UI is hidden (removes the silent-failure surface); a hard blocker if scheduling ships
   visible. *(Launch-blocking severity call = operator's.)*

## PD-4 — Fleet-wide `@Throttle({ default })` is DEAD (per-route rate limits silently unenforced) + 429 misdiagnosed
**Verified (me + adversarial review, empirically reproduced):** `ThrottlerModule.forRoot` registers only
NAMED throttlers `short`/`medium`/`long` (`app.module.ts:61-99`) — there is **no `default` throttler**.
`@nestjs/throttler` v6 only reads metadata for registered names, so every `@Throttle({ default: {...} })`
in the tree (pairing, **auth/login**, content, users, device-auth) writes metadata that is **never read**.
The review reproduced this: 429 starts at request #11 = the global `'short'` 10/1s ceiling, regardless of
the route annotation.

**Consequences:**
1. **My pairing-status throttle fix (`fix/pairing-status-throttle`, 10→40) is a NO-OP — ABANDONED, not
   merged, branch deleted.** Merging it would create false "429 fixed" confidence. The commit's rationale
   ("still under global medium") was backwards — short/medium are the ONLY things that bound the route.
2. **The 429 was misdiagnosed.** A steady 2s poll (30/min = 0.5/s) can't trip `'short'` (>10/s) or
   `'medium'` (>1.67/s sustained). The observed "429 after ~20s" was almost certainly bursty/back-to-back
   retries (no backoff) hitting `'short'`, or test-env concurrency — NOT the steady poll. Real fix
   candidates: (a) TV-app poll backoff/jitter; (b) a per-CODE guard for pairing-status (mirror
   `DeviceAuthCheckThrottlerGuard`'s per-token pattern) — more correct than per-IP anyway.
3. **SECURITY (the bigger finding):** intended stricter-than-global limits on sensitive endpoints —
   **auth/login especially** — are silently running at the generous global ceiling (prod short 10/1s /
   medium 100/60s / long 1000/hr). Brute-force/abuse limits are weaker than the code implies.
4. **Pre-existing (flag, not made worse):** `checkPairingStatus` returns the device's 90-day JWT
   (`deviceToken`) to ANY unauthenticated caller holding the code (`pairing.service.ts:501-511`) — a
   race-the-legitimate-device credential-theft window, gated only by the 32^6 code keyspace + 5–15min TTL.

**DECISIONS/RECOMMENDATIONS for the operator:**
- Open the throttle-wiring as its OWN ticket (fleet-wide security-config bug, not a pairing issue). Fix =
  register a `'default'` named throttler OR rewrite decorators to target named throttlers — but **audit
  first**: making the dead overrides live will suddenly TIGHTEN dozens of endpoints (incl. auth/login),
  which needs its own review, not a drive-by. *(Hard stop: security-config change with broad blast radius
  + review-vs-analysis disagreement — queued.)*
- Pairing 429 specifically: fix the burst source (TV-app backoff) and/or add a per-code guard.
- Consider binding the pairing-status `deviceToken` return to the requesting device, or not returning the
  token until a device-authenticated exchange.

---

# Keyboard-track build session (2026-07-04) — slice status + new items

**Held branches (all reviewed, awaiting your merge):**
- **T1 `feat/schedules-ui-interim-hide`** (cdf6aae0) — schedules UI hidden (nav + server-page gate +
  command palette + overview quick-action), reversible flag, 17/17 green. **Review: SHIP.** Closes PD-3's
  interim mitigation (stops C-7 exposure). *Ready to merge.*
- **T2 `feat/pull-on-connect-backend`** (S1-2 filter) + **`fix/pd1-updateplaylist-idempotent`** (PD-1).
  S1-2 filter **review: SHIP**. **PD-1 `fix/pd1-updateplaylist-idempotent` has a REGRESSION — DO NOT MERGE
  as-is (see PD-7).**
- **T3 `fix/pd4-throttle-and-auth-limits`** (591caf2d + e61f8503) — throttle wiring + auth limits now fire +
  content-upload 30/min. **Review: SHIP.** *Ready to merge* (see PD-6/PD-8 follow-ups).
- **T4 `fix/tenant-guard-enforce-prereqs`** (f6b7ce65) — bare-id org-scoping for folders/webhooks/tag-rules/
  provisioning (4 suites green). PARTIAL — remaining sweep + guard/realtime/nested/fail-closed documented in
  the commit. Enforce flip STILL QUEUED (HS-4).
- **`fix/finding2-reconnect-rehydration`** (backend Finding-2 fix) — now UNBLOCKED by PD-1 *once PD-7 lands*.

## PD-7 — PD-1 (updatePlaylist no-op) has a REGRESSION; branch must not merge as-is
The T2 review (deep, well-evidenced) found `computePlaylistSignature` uses only contentId+order+duration —
it OMITS `content.updatedAt`/`renderedHtml`, so an **in-place template/file edit** (same id/order/duration)
collides to the same signature and is wrongly absorbed as a no-op. Because `content.updated` does NOT push
to devices (only `playlist.updated` does), the reconnect `sendInitialState` re-push is the PRIMARY delivery
path for edits — PD-1 would make "edit the sign → device updates" **never heal** (and it skips the
Preferences persist, so a restart restores the old playlist too). My analysis said the signature was
sufficient; the review disproved it → hard-stop + queued. **Fix (before merging PD-1 or Finding-2):** add
`content.updatedAt` (or a version) to the signature AND to the device payload from every `playlist:update`
emitter (`realtime/.../device.gateway.ts` sendInitialState transform + the emits at ~1644/1779/2128).
Cross-repo. Until then both PD-1 and the Finding-2 branch stay held.

## PD-5 (was noted under PD-4) — checkPairingStatus hands the 90-day device JWT to any code-holder
The T3 review confirmed AND found a second race: the read-then-delete is NOT atomic (Redis GET at
`pairing.service.ts:469` → `display.findUnique` at :489 → delete at :499), so two concurrent `/status/:code`
polls can BOTH receive the token. The 40/min per-IP throttle does NOT mitigate this (one well-timed poll from
another IP suffices). **Minimal fix (RFC 8628 device-grant):** at `POST /pairing/request` return a separate
high-entropy poll-secret (NOT shown in the code/QR) required on `/status/:code` before `deviceToken` is
included; + atomic get-and-delete (Redis GETDEL / Lua). Cross-repo (device carries the secret). *(Hard stop:
security-protocol change.)*

## PD-6 — throttle limits are ~2x nominal in prod (PM2 cluster + in-memory ThrottlerStorage)
`ecosystem.config.js` runs middleware `instances: 2` cluster; `ThrottlerModule.forRoot` uses the default
**in-memory per-process** storage (no Redis), and nginx has no session affinity for middleware. So every
now-live per-route limit (incl. login/register) has a real ceiling of ~2x nominal, split non-deterministically.
Undercuts the "real brute-force limits" claim. **Fix:** Redis-backed `ThrottlerStorage` (RedisService already
wired). Track with similar urgency to PD-5.

## PD-8 — content-upload throttle is per-IP; shared-NAT admins collide. Follow-up: key per-org/user (the
`DeviceAuthCheckThrottlerGuard` custom-tracker pattern exists). Non-blocking.

## Dimension-5 (identity/security) score note
Revised DOWN to 3 earlier (dead throttles). T3 (held) makes them FIRE → **→ 3.5 once T3 merges**, minus the
residual JWT leak (PD-5) + the PM2/Redis 2x ceiling (PD-6). Net when T3+PD-5+PD-6 land: ~4.

---

# Build block (2026-07-04) — PD-7/PD-5 built; PD-6 spec; new findings

**PD-7 (BUILT, cross-repo, reviewed) — fixes the PD-1 regression → unblocks PD-1 + Finding-2.**
- vizora `fix/pd7-content-version-payload` (0233d5cf): realtime emits `content.updatedAt` in the
  playlist:update payloads.
- vizora-tv: signature includes `content.updatedAt` — committed on `fix/pd1-updateplaylist-idempotent`
  (9fec12f, on top of the PD-1 no-op b0a7aaa).
- Review verdict: **field-complete for standard content (image/video/html/url) on all paths — no
  flip-flop, idempotency preserved.** Two action items:
  - **MERGE CONSTRAINT (do together):** the PD-7 backend branch and the PD-1/PD-7 TV branch are INERT
    alone — TV-only makes every signature `~empty` (edits still never propagate); backend-only has no
    reader. Merge `fix/pd7-content-version-payload` (vizora) AND `fix/pd1-updateplaylist-idempotent`
    (vizora-tv) in the SAME release, and merge the Finding-2 branch only after/with them.
  - **PD-9 (queued): layout zone-edit gap.** The signature reads top-level `items[].content.updatedAt`
    only; it does not descend into `content.metadata.zones[]`. Editing content INSIDE a layout zone (a
    different Content row) doesn't bump the layout row's updatedAt → the zone edit is absorbed as a no-op
    on reconnect and never reaches the screen. Fix option (a): descend the signature into
    `zones[].resolved{Playlist,Content}.…updatedAt` + add `updatedAt` at `device.gateway.ts:2174-2182`
    (the zone single-content transform currently omits it). Option (b): bump the parent layout row's
    updatedAt on any zone-referenced content edit. **Your scope ruling:** are dynamically-edited layout
    zones a supported "edit the sign → it updates" use case? If yes → build option (a); if layouts are
    static compositions → negligible, close PD-9.

**PD-5 (BUILT + REVIEWED SHIP, cross-repo) — pairing poll-secret + atomic release.** vizora
`fix/pd5-pairing-pollsecret` (1d8d7328 + review-fix 0cdedc60) + vizora-tv `fix/pd5-pairing-pollsecret`
(68bdfd1). Security review: **SHIP — leak fully closed, atomicity exactly-once, no other leak path, secret
not logged/QR'd, timingSafeEqual sound.** Review residual FIXED (0cdedc60): resolve `display` BEFORE the
SET-NX claim so a transient DB error in the winning poll can't strand the claim + brick re-pairing; added a
deterministic claim-loss test (60/60). **MERGE CONSTRAINT (do together):** new backend requires the secret;
old device app can't pair → merge both `fix/pd5-pairing-pollsecret` branches (middleware + vizora-tv) in the
SAME release. Until 1d8d7328 is an ancestor of middleware `main`, `main` STILL leaks the JWT to any
code-holder — the fix is on the branch, not yet merged.

**PD-6 (NOT built — needs a dependency decision).** Redis-backed ThrottlerStorage so PD-4's limits mean
their numbers under PM2 cluster (currently ~2× nominal). `npm install` FAILS here — the repo is a pnpm
workspace (`workspace:*`). Two paths, your call:
- (a) `pnpm add @nest-lab/throttler-storage-redis --filter @vizora/middleware` (the maintained standard
  for @nestjs/throttler v6; pass `new ThrottlerStorageRedisService(process.env.REDIS_URL)` as `storage`
  in forRoot). Adds a dep + touches the pnpm lockfile. **Recommended** — battle-tested, low-risk.
- (b) hand-roll a custom `ThrottlerStorage` on the existing ioredis client (increment via a Lua
  INCR+PEXPIRE). No dep, but rate-limiting correctness is security-critical — a subtly-wrong storage is
  exactly the "one-field-short" failure mode; warrants its own focused build + review, not a tail-of-
  session rush. Deferred pending your (a)-vs-(b) ruling.

---

# Enforce prereqs — bypass fix done; @OnEvent surface surfaced (2026-07-04)

**BYPASS-CONTEXT SYSTEM WRITES (BUILT + REVIEWED SHIP) — closes the fail-closed prereq.** vizora
`fix/enforce-bypass-system-writes` (11ced158 + review-test b7927b22), held. `webhooks.recordAttempt` (via a
thin `persistDeliveryAttempt` delegation) and template-library `clone`'s global `useCount` update now run
under `runWithTenantContext(BYPASS_TENANT_CONTEXT, …)`. Review: **leak-proof** (ALS restores the caller's
context at the first await, independent of resolve/reject — the fanOut loop's next delivery runs under the
concrete context, never a leaked bypass), **narrowly scoped** (clone `create` stays guarded), **complete for
the delivery path** (every guarded write incl. auto-disable is inside the wrap; `deliver` has no other write;
no retry/cron path). Negative tests prove no-leak on return AND on a throw-after-await, tied to the guard
decision. 5/5 context + 102/102 across the touched suites.

**⚠ HS-4 — NEW enforce prereq the review flagged (broader @OnEvent surface).** The bypass fix covers the
webhook delivery path. But **12 other files carry `@OnEvent` handlers** (playlists, notifications, content,
tag-rule.evaluator, alert-rule.evaluator, onboarding, validation-monitor, …) that do TENANT writes on the
org's own rows under the INHERITED emitter context. They pass/inject correctly under enforce **iff** they
carry `organizationId` or use `updateMany`/`deleteMany` with an org filter — but any **bare-id `update`/
`delete`** in those handlers would REJECT under enforce (async-handler throw → unhandledRejection → PM2
restart). This is the async-handler analogue of the T4 CRUD sweep and MUST be swept before the enforce flip.
Distinct from the bypass fix (those were system/cross-org writes → bypass; these are tenant writes → org-scope
or `updateMany`). **Add to the HS-4 checklist:** @OnEvent bare-id sweep (12 files) + the still-open
device-auth guard + realtime trust boundary + nested creates. Enforce stays gated until all clear.

---

# @OnEvent enforce sweep — CHECKED CLEAN, no third category (2026-07-04)

The classify-then-fix sweep of all 6 `@OnEvent` handlers (onboarding, validation-monitor, alert-rule &
tag-rule evaluators, notifications, playlists) returned **zero fixes needed** — every guarded write already
carries explicit org, hits an unguarded model, or is read-only. **No third category** of inherited-context
write: everything classifies cleanly as tenant or system. Spot-verified the two load-bearing non-obvious
claims (device.online heartbeat → bypass; device.offline cron-only → no context). No branch created (a
no-op commit would misrepresent).

**Consequence:** the enforce surface is now believed ENUMERATED, not still-growing. The complete, single-
source enforce prerequisite list is **`docs/enforce-readiness.md`** — CRUD sweep ✅, system-write bypass ✅,
@OnEvent ✅ checked-clean; REMAINING (known, bounded): device-auth write paths, realtime trust boundary,
nested creates. HS-4 enforce-flip stays gated until those clear + a log-warn review. dimension-1 4→5 tracks
that doc.

---
*(New items appended below as they arise.)*
