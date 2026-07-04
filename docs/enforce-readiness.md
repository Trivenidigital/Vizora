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
| 5 | **Realtime trust boundary** | ⬜ REMAINING | Realtime is a separate app using `@vizora/database` Prisma directly. Confirm whether its writes run the `$use` guard at all; if not, every realtime write (`display.updateMany`, etc.) must be independently verified org-scoped or system. This is a whole second app's write surface. |
| 6 | **Nested creates** | ⬜ REMAINING | Prisma nested writes (`create`/`update` with nested relation writes) may not be intercepted per-nested-op by the `$use` hook. Verify guarded nested creates/updates carry org or are caught. |

## THIRD-CATEGORY FINDING (the question that decides "close" vs "harder look")
**No third category exists.** Every inherited-context guarded write classifies cleanly as **tenant**
(→ org-scope) or **system/cross-tenant-aggregate** (→ bypass). The one hybrid-shaped case — a tenant-row
write (`device.offline` → `notification.create`) reached from a system cron — is still a *tenant* write
that happens to already be safe (the cron establishes no context → pass). It needs no novel pattern.

**Implication:** the enforce mechanism's two-context model (concrete tenant / bypass) is sufficient — the
surface needs *enumerating and checking*, not a redesign. With #3 checked clean, the remaining distance to
the flip is the **known, bounded** set #4–#6, not an open-ended discovery.

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
Dimension-1 (tenant isolation) 4→5 is gated on this set. Three blocks running, the flip has been "gated on
the sweep plus a few things," and the few things grew as each look revealed more inherited-context surface.
This block **reverses that trend**: the @OnEvent surface was flagged, checked, and found already-safe, and
the third-category question came back negative — so the surface is now believed enumerated. The flip is
gated on the **known** #4–#6, not on continued discovery. If a future check of #5 (realtime) surfaces a new
write class, revisit; absent that, the flip is genuinely close once #4–#6 land + a log-mode warn review.
