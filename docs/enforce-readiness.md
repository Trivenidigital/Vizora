# TENANT_GUARD_MODE=enforce — readiness checklist (single source of truth)

**Status: GATED. Do not flip.** This is the complete, believed-final prerequisite set for flipping the
Prisma tenant-guard from `log` to `enforce`. Compiled 2026-07-04 after three blocks of enforce-prep.

## What enforce actually does
The guard is a Prisma `$use` hook (`middleware/src/modules/database/database.service.ts:59-78`) that reads
`getTenantContext()` (AsyncLocalStorage) per operation and, for a **guarded model** (`tenant-guard.ts`
`GUARDED_MODELS`) under a **concrete** (non-bypass) context, `evaluateTenantOp`:
- bypass context OR no context → **pass**
- write whose `where` already has a matching `organizationId` → **pass**
- write with a **missing** org in the where → **inject** the context org
- write with a **foreign** org, or a **bare unique-where** (`update`/`delete` on `{id}` alone) → **reject → throw**

So the danger under enforce is a **bare-id `update`/`delete` on a guarded model, executed under a concrete
tenant context** — it throws. In an async `@OnEvent` handler that throw becomes an unhandledRejection →
PM2 restart (EventEmitter2 runs `ignoreErrors:false`).

## The real surface: EVERY write under an inherited context
The audit originally mapped the CRUD (controller→service) layer. The true surface is **every guarded write
that executes under a context it inherited** — which includes async `@OnEvent` handlers and cross-app
(realtime) writes. Each block of enforce-prep flushed out more of this surface by *looking*, not by the
flip tripping in prod. **The inherited-context write surface is now believed fully enumerated** (see the
third-category finding below).

## Prerequisite set

| # | Prerequisite | Status | Evidence / what remains |
|---|---|---|---|
| 1 | **CRUD bare-id sweep** (controller→service writes) | ✅ DONE | T4 merged `13f79b85` (folders/webhooks/tag-rules/provisioning). T4-2 held `7847fd88` (support/template-library/pairing + tag-rules/provisioning update) — 229 green. |
| 2 | **System writes under inherited context → bypass** | ✅ DONE | `11ced158` (+test `b7927b22`), reviewed SHIP. Webhook `recordAttempt` + template-library `clone` global counter wrapped in `BYPASS_TENANT_CONTEXT`, leak-proof (ALS teardown on resolve/reject). |
| 3 | **`@OnEvent` handler writes** (async, inherited context) | ✅ CHECKED CLEAN | Classify-then-fix sweep of all 6 handlers (onboarding, validation-monitor, alert-rule & tag-rule evaluators, notifications, playlists): **zero fixes needed** — every guarded write already carries explicit org, hits an unguarded model, or is read-only. No third category. Load-bearing invariants below. |
| 4 | **Device-auth write paths** | ✅ CHECKED CLEAN (safe-by-construction) | All `verifyCurrentDeviceToken` routes verify the token INSIDE the handler (`@Public`), so they run under **bypass** (`req.deviceAuthPayload` is read by `deriveTenantContext` but assigned NOWHERE — the concrete-device-context branch is dead for HTTP). Enumerated each: only ONE writes — heartbeat `updateHeartbeat` (`displays.service.ts:271`), whose WHERE embeds `organizationId: verifiedDevice.organizationId` (verified on the actual write, not by resemblance to #5) → a cross-tenant id affects zero rows. `device.online`→`notification.create` stamps server-read org. schedules/device-content/device-auth-check are read-only. No bare-id-foreign device write. |
| 5 | **Realtime trust boundary** | ✅ CHECKED CLEAN (formal gap, not a live leak) | Realtime's `DatabaseService` is a plain `PrismaClient` — NO `$use` guard, NO tenant context — so enforce never evaluates realtime writes. Full write audit + spot-verify: **tenant-safe by construction.** Every mutating write (`display.update*`) keys on the device's OWN authenticated `deviceId` (verified JWT + DB cross-check at handshake AND re-checked per-message by `WsDeviceGuard`); every create stamps org from the device-authenticated `client.data.organizationId`, never a client-supplied value. No write selects a foreign row by a socket-message id. **Nothing to fix before enforce is meaningful.** Disposition = optional defense-in-depth (see below). |
| 6 | **Nested creates** | ✅ CHECKED CLEAN (inheritance VERIFIED) | The `$use` hook fires once per top-level op, so nested relation writes aren't independently guarded. Full enumeration: the ONLY nested write targeting a **guarded** model is `support.service.ts:121` `messages.create` (SupportMessage) — and it carries explicit `organizationId` on every row. All other nested creates target **unguarded** child/join models (PlaylistItem, DisplayTag, AlertRuleRecipient, PromotionPlan). The load-bearing carve-out — unguarded children safe *only if* reachable exclusively via a guarded parent — is **verified, not assumed**: every child-item op (`playlists.updateItem/removeItem:313/334`, `displays.removeTags:510`) calls `findOne(org, parentId)` FIRST and scopes the child query by the parent id (`{id: itemId, playlistId}`). No query selects an unguarded child by its own id outside a guarded parent's org scope → no direct-read isolation hole. |

## THIRD-CATEGORY FINDING — ENUMERATION CONFIRMED (both the @OnEvent and realtime checks came back negative)
**No third category exists — verified from both directions.** Every inherited-context guarded write
classifies cleanly as **tenant** (→ org-scope) or **system/self-stamping trusted writer** (→ bypass / server-
stamped org). The two checks that could have falsified this both came back clean:
- **#3 @OnEvent** — hybrid case (`device.offline` → `notification.create` reached from a system cron) is
  still a *tenant* write, already safe (cron → no context → pass). No novel pattern.
- **#5 realtime** — could have surfaced a "device-socket context" as a new class. It did not: realtime is
  structurally an instance of the existing **"system / self-stamping trusted writer"** context, merely
  hosted in a process that doesn't load the guard. Its org-provenance is established exactly as a
  well-behaved system writer's (verified JWT → DB cross-check → server-stamped writes). The only distinction
  is that in realtime that context is **unenforced** (convention, not `$use`/ALS-backed).

**Implication:** the enforce mechanism's two-context model (concrete tenant / bypass) is **sufficient** — the
surface is now believed ENUMERATED, not still-discovering. The remaining distance to the flip is the
**known, bounded, mechanical** set #4 + #6 (plus a log-warn review), not open-ended discovery.

## Optional defense-in-depth (NOT a flip blocker)
### #7 — Realtime `$use` guard = the FINAL 4→5 item (NOT backlog, NOT a flip blocker)
Realtime's tenant-safety rests on a **convention** (every handler self-derives org from the authenticated
socket), not a structurally-enforced invariant — a *future* realtime handler could introduce an update/create
keyed on an unvalidated client-supplied id and nothing would catch it. **After the middleware flip the
guarantee is asymmetric: structural in middleware, conventional in realtime.** Asymmetric is not a structural
5. So this is ranked as the **terminus of the 4→5 path**, after #4/#6, before dimension-1 is called complete:
add a `$use` tenant-guard to `realtime/src/database/database.service.ts` mirroring the middleware (with a
device-derived concrete context), OR assert org-scoping at the realtime write sites — so a future regression
fails closed instead of silently opening a seam. It is NOT a flip blocker (realtime is safe today), but
**dimension-1 stays 4 until BOTH the flip AND this realtime guard land.**

**Proof-of-play cluster (future focused pass, not now):** two findings that belong together — (a)
`contentImpression.create` accepts unvalidated `contentId`/`playlistId` (own-tenant analytics integrity; a
device can file impressions referencing ids it doesn't own, in its own partition), and (b) the duplicate
`content:impression` emit on reconnect double-render that PD-1/PD-7 fixed. Both touch proof-of-play
correctness; worth one deliberate pass when prioritized.

## FLIP-READINESS STATEMENT (2026-07-04)
**The enforce surface is fully enumerated and executed keyboard-side, verified on evidence.** Every inherited-
context guarded write across both apps has been classified and checked on its own code (not by resemblance):
- #1 CRUD sweep ✅ (T4 merged + T4-2 held) · #2 system-write bypass ✅ (reviewed SHIP) · #3 @OnEvent ✅
  (checked clean) · #4 device-auth ✅ (heartbeat org-scoped in WHERE) · #5 realtime ✅ (safe-by-construction)
  · #6 nested creates ✅ (guarded nested carries org; unguarded children reachable only via verified guarded
  parents).
- The pairing bare-unique-where update (`pairing.service.ts:620`) an auditor flagged is **already fixed on the
  T4-2 held branch** (`updateMany({id,organizationId})`+count) — covered by #1, not a new gap.
- **No third context class** — the two-context model (concrete-enforce | bypass/self-stamping-safe) is
  sufficient; both falsification checks (@OnEvent, realtime) came back negative.

**What the log-warn review should watch for** (run in `log` mode, review journalctl `[tenant-guard]` warns
before flipping): any `warn` on a write path NOT in the swept set — i.e. a bare-id `update`/`delete` or a
`create`/`data` without org on a guarded model under a concrete context. Zero such warns over a representative
window (a full dashboard-usage cycle + a device fleet's heartbeats + a webhook fan-out + an onboarding) is the
go signal. Any warn = an un-swept path; fix before flip.

**The two things between here and a STRUCTURAL 5:** (1) the flip itself (`TENANT_GUARD_MODE=enforce`, yours,
gated, after the log-warn review), and (2) the realtime `$use` guard (#7 — makes the guarantee structural in
both processes, not conventional in one). Until both land, dimension-1 is a legitimate 4, worded "structural
in middleware, convention-safe in realtime."

## Load-bearing enforce-safety invariants (from the @OnEvent sweep — protect these on refactor)
These handler writes are safe *by invariant*; a future refactor to a bare-id write would silently break
them under enforce. Documented so the invariant is explicit, not accidental:
- **`notifications` `device.online` → `notification.create`**: safe because the heartbeat route is
  `@Public` → `deriveTenantContext` yields **bypass** at interceptor time (device token verified inside the
  handler). If that route is ever changed to populate `req.deviceAuthPayload` pre-interceptor, the context
  becomes the device's concrete org — still a `match` (same org), still safe, but the reasoning shifts.
- **`alert-rule` `device.offline` → `notification.create`**: safe because `device.offline` is **cron-only**
  (`detectOfflineDevices`, `@Cron`) → no ambient context → pass. `AlertRuleFire` is intentionally unguarded.
- **`onboarding` upsert/updateMany** and **`tag-rule` `display.updateMany`**: carry explicit `organizationId`.

## The honest scorecard note
Dimension-1 (tenant isolation) 4→5 is gated on this set. For three blocks the flip was "gated on the sweep
plus a few things," and the few things grew as each look revealed more inherited-context surface. That trend
is now **reversed and enumeration confirmed** — #3 (@OnEvent), #5 (realtime), and #4/#6 all checked clean on
their own evidence, no third category. **The enforce surface is fully executed keyboard-side.** What remains
is not discovery and not more sweeping — it is exactly two structural items, both gated to the operator:
1. **The flip** (`TENANT_GUARD_MODE=enforce`) — after a log-warn review, yours.
2. **The realtime `$use` guard (#7)** — turns the guarantee from "structural in middleware, conventional in
   realtime" into structural in both processes.
**dimension-1 stays 4 until BOTH land** — asymmetric enforcement is not a structural 5. That is a genuine,
earned "close," not an asserted one.
