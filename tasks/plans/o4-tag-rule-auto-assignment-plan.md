# O4 — Tag-Rule Auto-Assignment — Plan

**Date:** 2026-05-19
**Audit ref:** P0 #2 (`docs/plans/2026-05-17-optsigns-vizora-feature-gap.md`) — supports the unified push from O1
**Backlog ref:** `backlog.md` → "OptiSigns Parity Roadmap" → O4
**Branch:** `feat/o4-tag-rule-auto-assignment`
**Effort:** M (2 dev-days)
**Drift-check tag:** `extends-Hermes`

Tag-rule auto-assignment engine: declarative rule says "every Display tagged X gets Playlist Y auto-assigned." Same domain Hermes doesn't own — this is Vizora middleware/Prisma/NestJS work. Pattern mirrors O7 (PR #63): new Prisma table, CRUD service with cross-org + cross-tenant guards, `@OnEvent` evaluator, RBAC-gated controller.

## Hermes-first capability checklist

All 11 steps are `[net-new]` against the Hermes capability list — Vizora runtime infrastructure, not agent work.

| # | Step | Tag | Why |
|---|------|-----|-----|
| 1 | Display gains/loses a tag via `addTags`/`removeTags` (existing at `displays.service.ts:406-436`) | `[net-new]` | Existing Vizora middleware mutation |
| 2 | DisplaysService emits `display.tags.changed` event | `[net-new]` | EventEmitter2 in-process bus (currently NOT emitted on tag changes — new event) |
| 3 | Display becomes paired (existing `display.paired` event at `pairing.service.ts:294`) → evaluator also fires on it (re-uses existing event, no new emission needed) | `[net-new]` | Subscribe to existing event; do NOT invent a parallel `display.created` (verified by grep) |
| 4 | TagAssignmentRule is created/updated/deleted → service re-evaluates all currently-tagged displays in the affected scope | `[net-new]` | Service-internal sweep, not Hermes |
| 5 | `TagAssignmentRuleEvaluator` `@OnEvent('display.tags.changed')` handler runs | `[net-new]` | NestJS decorator |
| 6 | Evaluator queries active rules for the org with matching tagId | `[net-new]` | Prisma query |
| 7 | Evaluator picks the winning rule (lowest priority number; tie = oldest createdAt) | `[net-new]` | Application logic |
| 8 | Evaluator writes `Display.currentPlaylistId` ONLY if it's null (no overwrite of manual assignment) | `[net-new]` | Prisma updateMany with predicate |
| 9 | Evaluator emits `display.playlist.assigned` event for downstream listeners | `[net-new]` | Domain event |
| 10 | REST CRUD endpoints under `/api/v1/tag-rules` | `[net-new]` | NestJS controllers |
| 11 | Cross-org + cross-tenant guards: tagId and playlistId both validated to belong to caller's org | `[net-new]` | Service-layer validation |

**Red-flag check:** 11/11 net-new is the correct disposition for Vizora middleware platform work, consistent with O7's verdict. Hermes orthogonal.

## Drift-rule self-checks

- ✅ Read `packages/database/prisma/schema.prisma` (Display at line 118 with `currentPlaylistId String?` field and `currentPlaylist Playlist? @relation("DisplayCurrentPlaylist")`; Tag at line 352; DisplayTag at line 383; Playlist) — confirmed the `currentPlaylistId` is the right write target; FK to Playlist already exists.
- ✅ Read `middleware/src/modules/displays/displays.service.ts` (lines 1-50 + lines 400-450 — `addTags()` upserts to `DisplayTag` table at line 411; `removeTags()` deleteMany at line 428; `pushContent()` at line 438; neither currently emits domain events for tag changes).
- ✅ Read `middleware/src/modules/notifications/alert-rules/alert-rules.service.ts` (from O7 PR #63 — established pattern: cross-org guards via `findFirst({where:{id, organizationId}})`, atomic CAS via `updateMany`/`upsert`+`P2002` catch, idempotent seed helpers, validation in service layer).
- ✅ Read `middleware/src/app/app.module.ts` (lines 36-56 — `EventEmitterModule.forRoot({ ignoreErrors: false })` INVARIANT: async `@OnEvent` handlers MUST wrap body in try/catch).

## Problem

Today, assigning a Playlist to a Display is purely manual:
- Direct write: `PATCH /displays/{id}` sets `currentPlaylistId` → one playlist on one screen at a time
- Bulk write: `POST /displays/bulk-assign-playlist` → one playlist applied to a list of selected displays
- Schedule: a `Schedule` row with `playlistId` and `displayId`/`displayGroupId` → time-based playback

What's missing: **declarative auto-assignment based on tag membership**. OptiSigns and competitors ship this as standard — operators tag displays by purpose (`lobby`, `cafeteria`, `lobby-tv-7`, `digital-menu`) and the system handles playlist routing automatically. Without it, customers with growing fleets manage playlists per-display, which doesn't scale.

## Goals

1. New `TagAssignmentRule` model: per-org, `tagId + playlistId + isActive + priority`.
2. New `@OnEvent` evaluator listens for `display.tags.changed` and writes `Display.currentPlaylistId` based on matching rule.
3. **First-write-wins semantics:** evaluator only sets `currentPlaylistId` if currently null. Manual assignments are NEVER overwritten by the evaluator.
4. Multiple rules matching the same display → resolve by `priority` field (lower = higher priority); tie-break by `createdAt` (older wins).
5. CRUD API admin-gated on mutations (per O7 pattern).

## Non-goals (out of scope for this PR)

- **Bulk overwrite of existing manual assignments.** A separate "reset to rule-engine assignment" endpoint can land later; for v1 the evaluator never overwrites a non-null `currentPlaylistId`.
- **Per-display priority overrides** (e.g. "ignore tag rule for this one display") — defer; can be added via a `Display.ignoreTagRules` boolean later if real demand.
- **Cross-tag composition** ("if has tag A AND tag B → playlist C"). v1 is one-tag-one-rule. Composite rules would need a different schema shape.
- **Rule scheduling** (only apply between 9am-5pm). Schedules are a different model; cross-pollination is a future enhancement.
- **Rule conditions beyond tag membership** (status, location, OS version, etc.). Tag is the v1 lever.

## Affected files (predicted)

```
packages/database/prisma/schema.prisma                                          (add TagAssignmentRule + indexes + back-relations on Tag, Playlist, Organization)
packages/database/prisma/migrations/<ts>_add_tag_assignment_rules/migration.sql (create table + FKs + indexes)
middleware/src/modules/displays/displays.service.ts                             (emit display.tags.changed event after add/remove + after pairing)
middleware/src/modules/playlists/playlists.module.ts                            (import new TagRules module if needed for cross-org guard)
middleware/src/modules/tag-rules/tag-rules.module.ts                            (NEW)
middleware/src/modules/tag-rules/tag-rules.service.ts                           (NEW — CRUD + cross-org/tenant guards + rule-change re-evaluation)
middleware/src/modules/tag-rules/tag-rules.controller.ts                        (NEW — RBAC-gated mutations)
middleware/src/modules/tag-rules/tag-rule.evaluator.ts                          (NEW — @OnEvent handler, never overwrites non-null currentPlaylistId)
middleware/src/modules/tag-rules/tag-rule.types.ts                              (NEW — constants for priority bounds)
middleware/src/modules/tag-rules/dto/*.ts                                       (NEW)
middleware/src/modules/tag-rules/*.spec.ts                                      (NEW — sibling spec files per Jest config)
middleware/src/app/app.module.ts                                                (register TagRulesModule)
```

## Schema (Prisma)

```prisma
model TagAssignmentRule {
  id             String   @id @default(cuid())
  organizationId String
  name           String                          // user-facing label
  tagId          String                          // when a Display has this tag...
  playlistId     String?                         // ...auto-assign this playlist. Nullable for SetNull cascade on playlist delete (PR-review fix)
  isActive       Boolean  @default(true)
  priority       Int      @default(100)          // lower = higher priority; ties broken by createdAt (older wins)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  tag          Tag          @relation(fields: [tagId],          references: [id], onDelete: Cascade)
  playlist     Playlist     @relation(fields: [playlistId],     references: [id], onDelete: SetNull)
  //                                                                              ^^^^^^^
  //  PR-review fix: SetNull instead of Cascade, matches O7's philosophy for
  //  non-core FK targets. Playlist deletion is a routine operation; silently
  //  removing all rules pointing at it would surprise admins who manage many
  //  rules. With SetNull, the rule survives in a broken state and the
  //  evaluator logs a WARN on encountering playlistId=null (zombie rule —
  //  admin must fix). Note this requires `playlistId String?` (nullable).

  @@unique([organizationId, name])               // UI uniqueness
  @@index([organizationId, isActive])
  @@index([tagId])
  @@index([playlistId])
  @@map("tag_assignment_rules")
}
```

**FK cascade choice:**
- `tagId`: `Cascade` — when a Tag is deleted, rules pointing at it are removed. A rule without a tag has no trigger; nothing to preserve.
- `playlistId`: `SetNull` (PR-review fix) — playlist deletion is a routine admin op. Silently removing N rules would surprise the admin. With `SetNull`, the rule survives with `playlistId=null`; the evaluator detects this at evaluate time and logs a `WARN` (zombie rule — admin must fix). Same philosophy as O7's `SetNull` on scope FKs.
- `organizationId`: `Cascade` — org delete is a major action that cascades everything; aligned with every other model.

**`priority` semantics:** lower number = higher priority (1 = highest, 100 = default, 999 = lowest). DTO clamps to `[1, 999]`. Ties resolved by `createdAt` ascending (older wins). UI can surface this; the field defaults to 100.

## Service shape

`TagRulesService`:
- `create(orgId, dto)` — validates tagId + playlistId belong to org; creates rule; **triggers re-evaluation of all displays with the matched tag**
- `findAll(orgId, { isActive?, tagId?, playlistId? })`
- `findOne(orgId, id)` — cross-org guard via compound where
- `update(orgId, id, dto)` — also triggers re-evaluation if `isActive`/`tagId`/`playlistId` changed
- `remove(orgId, id)` — deletes rule (cascade removes any auto-assigned playlists? NO — assigned playlists stay; only the *rule* is removed)
- `evaluateForDisplay(orgId, displayId)` — entry point called by the evaluator; loads the display's tags + active rules, picks the winner, writes `currentPlaylistId` IF currently null

`TagRuleEvaluator`:
- `@OnEvent('display.tags.changed', { async: true })` — payload: `{ organizationId, displayId }`. Calls `evaluateForDisplay`.
- `@OnEvent('display.paired', { async: true })` — payload `{ organizationId, displayId }` per `pairing.service.ts:294` (already emitted — we subscribe; do NOT invent a parallel `display.created`). Triggers evaluation for newly-paired devices that may already carry tags.
- Top-level try/catch in each handler (per `app.module.ts:42-54` INVARIANT)

## Evaluator algorithm (literal)

```
1. Load Display with id=displayId in organizationId; include tags (DisplayTag[]).
   If display.currentPlaylistId IS NOT NULL → return (do not overwrite manual assignment).

2. If display.tags is empty → return.

3. Load active TagAssignmentRules for this org with tagId IN display.tags.tagId,
   ordered by priority ASC, createdAt ASC.

4. If no rules → return.

5. Pick the FIRST rule (lowest priority, oldest creation date).

6. If rule.playlistId IS NULL (its playlist was deleted; SetNull triggered) →
   log WARN ("rule X has playlistId=null — referenced Playlist was deleted;
   admin must fix") and try the NEXT-ranked rule. If all rules have null
   playlistId → return.

7. UPDATE Display SET currentPlaylistId = rule.playlistId WHERE id = displayId
      AND currentPlaylistId IS NULL.
   If update count === 0, another writer set it first — log INFO + return.

8. Emit `display.playlist.assigned` event with { organizationId, displayId,
   playlistId, source: 'tag_rule', ruleId } so downstream (e.g. future audit
   log, future Slack notification, O1's push tracking) can react.
```

**The "IF currently NULL" predicate at step 7 is the key safety guarantee:** under PM2 cluster mode, two evaluator instances racing on the same display can both pass step 1's null-check but the `updateMany` predicate ensures only one write lands. The loser sees `count === 0` and backs off.

## Controller / API

```
POST   /api/v1/tag-rules                 — create rule           [admin only]
GET    /api/v1/tag-rules                 — list (filters: isActive, tagId, playlistId)
GET    /api/v1/tag-rules/:id             — detail
PATCH  /api/v1/tag-rules/:id             — update                [admin only]
DELETE /api/v1/tag-rules/:id             — delete                [admin only]
POST   /api/v1/tag-rules/:id/re-evaluate — re-run rule against all matched displays [admin only — ops button for "I just changed the playlist content"]
```

POST + PATCH + DELETE + re-evaluate are `@Roles('admin')`. GET endpoints open to any org user (matches O7's PR-review fix).

## Migration / behavior change

**Before:** no auto-assignment exists; every playlist assignment is manual.
**After:** when an admin creates a TagAssignmentRule, displays with the matching tag whose `currentPlaylistId` is null get auto-assigned. Existing manual assignments are NEVER touched.

This is purely additive. No data migration required. Migration is just `CREATE TABLE`.

## Tests

Unit (Jest, mocked DB):
- `tag-rules.service.spec.ts` (~14 cases)
  - `create` happy path + cross-org tagId rejected + cross-org playlistId rejected
  - `priority` clamped to [1, 999] at DTO layer
  - `findOne`/`update`/`remove` cross-org → NotFound
  - rule create triggers re-evaluation for displays with the matched tag
  - rule deactivate does NOT roll back already-assigned playlists (intentional v1)
- `tag-rule.evaluator.spec.ts` (~16 cases)
  - display with non-null `currentPlaylistId` → skip (no overwrite)
  - display with null `currentPlaylistId` + matching active rule → assign
  - two matching rules → lowest priority wins; tie → older createdAt wins
  - no matching rules → no-op
  - rule's playlist was deleted (shouldn't happen due to cascade, but defense in depth) → log warn + skip
  - `display.paired` event triggers evaluation just like `display.tags.changed`
  - PM2-cluster race: predicate-protected updateMany ensures only one wins
  - top-level try/catch swallows DB failure → no unhandled rejection
- `tag-rules.controller.spec.ts` (~10 cases)
  - all 6 endpoints forward orgId correctly
  - POST/PATCH/DELETE/re-evaluate carry `@Roles('admin')` metadata
  - GET endpoints do not require admin

New event emission in `displays.service.ts`:
- After `addTags()` and `removeTags()` (at `displays.service.ts:406-436`): emit `display.tags.changed` with `{ organizationId, displayId }`. **NEW event** — verified via grep that nothing else uses this name.
- `display.paired` is already emitted by `pairing.service.ts:294` — we just subscribe to it; no new emission code on the pairing path.

Existing displays.service.spec.ts gets ~1 new test case pinning the `display.tags.changed` emission.

## Risks

| Risk | Mitigation |
|---|---|
| Cross-org leak: rule references tagId/playlistId from another org | Service-layer validation: load tag + playlist with `findFirst({where:{id, organizationId}})`; throw ForbiddenException on miss (same pattern as O7's `validateRecipient`) |
| Existing manual assignments silently overwritten | Evaluator's `WHERE currentPlaylistId IS NULL` predicate. Tested. |
| Two rules match same display, infinite loop | No loop possible — evaluator is reactive, not iterative. Multiple rules → priority order picks one and writes. Done. |
| PM2 cluster race on first assignment | `UPDATE ... WHERE currentPlaylistId IS NULL` returns count=0 for the loser → backs off |
| Tag deleted with N rules pointing at it | `onDelete: Cascade` on `tagId` FK — rules are removed |
| Playlist deleted with N rules pointing at it | `onDelete: Cascade` on `playlistId` FK — rules are removed |
| Rule deletion → currently-assigned playlists stay | Intentional v1 behavior. A separate "clear all rule-assignments" endpoint can land later if requested. Documented in the API response shape. |
| Rule re-evaluation sweep is expensive for a large fleet | For each affected display in scope, the evaluator's per-display SQL is one query. For an org with 10,000 displays and a rule scoped to a tag covering 500 → 500 sequential queries. Acceptable for v1; batched if it becomes a hot path. |
| O1 (unified push) sets `currentPlaylistId` directly → would race with rule evaluator | O1 is push-on-demand (operator action); O4's evaluator triggers reactively on tag-change. They don't race — but both write to the same field. O1 SHOULD overwrite (push wins); O4 respects the IS-NULL predicate (rule defers to manual). Documented contract enforced by the evaluator's WHERE clause. |
| Concurrent rule creates with same tagId can produce priority inversion under cluster mode | Rule A (priority=50) committed at T1; rule B (priority=30, higher priority) committed at T2 by a parallel admin. A's post-create sweep runs at T1.5, finds only A's rule, assigns to all `lobby`-tagged displays with null `currentPlaylistId`. B's later sweep finds both rules, picks B as winner, but UPDATE WHERE IS NULL fails — A's playlist stays. Mitigation: admins use `POST /:id/re-evaluate` after B to force re-sweep. Documented in OpenAPI as v1 limitation. |
| Re-evaluation sweep on rule create can block the request for an org with 10k+ displays | Plan §"Open questions 1": acceptable for v1 (synchronous, single-threaded loop). The controller wraps the sweep in a 30s timeout — if it exceeds, return 504 and rely on natural `display.tags.changed` events to converge. Batched queue is a future enhancement. |
| Double-clicked re-evaluate endpoint spawns parallel sweeps | Accepted for v1 (idempotent — duplicate work, no incorrect outcome). A Redis lock per-rule can be added later if ops sees real load. |
| `playlistId` becomes null via SetNull cascade → silent broken rule | Evaluator logs WARN at evaluate time (step 6 above). Admin sees the warn in logs; rule list endpoint includes `playlistId: null` so UI can flag it. |

## Acceptance criteria

- [ ] Migration applies forward + reset cleanly
- [ ] All ~40 new test cases pass; existing middleware suite has zero regressions
- [ ] `tsc --noEmit` clean
- [ ] Tag-add on a display with a matching active rule → display's `currentPlaylistId` updates (verified via integration test or manual REPL)
- [ ] Tag-add on a display whose `currentPlaylistId` is already set → NO change (manual assignment preserved)
- [ ] Cross-org isolation: rule in org A with tagId/playlistId from org B is rejected at create
- [ ] DELETE/PATCH/POST without admin role → 403
- [ ] `display.paired` event emission + handler verified

## Open questions

1. **Re-evaluation scope on rule create/update — how much work?** When admin creates a rule for `tagId=lobby`, the service finds all displays with that tag and calls `evaluateForDisplay` for each. For an org with 10,000 displays and a tag covering 500, that's 500 sequential evaluator calls. Acceptable for v1 (with 30s timeout); needs a batched fast-path if customer fleets grow past ~5k.
2. **Should the API return a preview of what will change before the create commits?** Useful UX but adds another endpoint. Defer to follow-up unless asked.
3. **Should `priority` allow negatives?** Lean: no. Clamp to [1, 999]. Simpler mental model.
4. **Should there be an audit table (`TagRuleAssignment` like O7's `AlertRuleFire`)?** Reviewer flagged this — useful for "why does display X have playlist Y" debugging. Hook already exists via the `display.playlist.assigned` event in step 8. Defer building the consumer until ops asks for it; the event is the durable contract.
