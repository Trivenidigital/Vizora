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
| 4 | **Device-auth write paths set a concrete context** | ⬜ REMAINING | Device-JWT requests derive context via `req.deviceAuthPayload.organizationId` (`tenant-context.interceptor.ts`). Verify every device-authenticated *write* path populates it before the interceptor runs (else the write runs under bypass — safe but unenforced) AND that no device write is bare-id-foreign. |
| 5 | **Realtime trust boundary** | ✅ CHECKED CLEAN (formal gap, not a live leak) | Realtime's `DatabaseService` is a plain `PrismaClient` — NO `$use` guard, NO tenant context — so enforce never evaluates realtime writes. Full write audit + spot-verify: **tenant-safe by construction.** Every mutating write (`display.update*`) keys on the device's OWN authenticated `deviceId` (verified JWT + DB cross-check at handshake AND re-checked per-message by `WsDeviceGuard`); every create stamps org from the device-authenticated `client.data.organizationId`, never a client-supplied value. No write selects a foreign row by a socket-message id. **Nothing to fix before enforce is meaningful.** Disposition = optional defense-in-depth (see below). |
| 6 | **Nested creates** | ⬜ REMAINING | Prisma nested writes (`create`/`update` with nested relation writes) may not be intercepted per-nested-op by the `$use` hook. Verify guarded nested creates/updates carry org or are caught. |

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
Realtime's tenant-safety rests on a **convention** (every handler self-derives org from the authenticated
socket), not a structurally-enforced invariant — a *future* realtime handler could introduce an
update/create keyed on an unvalidated client-supplied id and nothing would catch it. Low-urgency hardening:
add a `$use` tenant-guard to `realtime/src/database/database.service.ts` mirroring the middleware (with a
device-derived concrete context), OR assert org-scoping at the realtime write sites — so a future regression
fails closed instead of silently opening a seam. Separately: `contentImpression.create` accepts unvalidated
`contentId`/`playlistId` — an OWN-tenant analytics-integrity / proof-of-play-quality concern (a device can
file impressions referencing ids it doesn't own, in its own org partition), NOT a cross-tenant leak. Backlog
note if impression analytics are trusted downstream for billing.

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
plus a few things," and the few things grew as each look revealed more inherited-context surface. Two
consecutive blocks have now **reversed that trend and confirmed enumeration**: #3 (@OnEvent) checked clean,
and #5 (realtime) — the one item that could still have surfaced a new write class — also checked clean
(safe-by-construction, no third category). **The enforce surface is enumerated.** The flip is gated on the
**mechanical** completion of #4 (device-auth paths) + #6 (nested creates) + a log-mode warn review — no
open discovery remains. That is a genuine "close," earned by the checks coming back negative, not asserted.
(Optional realtime defense-in-depth above is a hardening item, not a flip blocker.)
