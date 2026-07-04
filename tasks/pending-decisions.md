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
first render → **template flash / video restart-to-0:00 + a DUPLICATE `content:impression`** (proof-of-play
defect). Never-black absorbs the black-frame; not the flash/restart/duplicate.

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
the backend branch. This idempotency change is a natural part of the pull-on-connect slice (see
`docs/pull-on-connect.md`). Backend branch is ready and waiting. *(Hard stop: cross-repo TV-app impl +
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

---
*(New items appended below as they arise.)*
