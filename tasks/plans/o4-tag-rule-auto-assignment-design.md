# O4 — Tag-Rule Auto-Assignment — Design

**Plan ref:** `tasks/plans/o4-tag-rule-auto-assignment-plan.md`
**Drift-check tag:** `extends-Hermes`
**Pattern reference:** O7 (PR #63) — `middleware/src/modules/notifications/alert-rules/*` is the canonical rule-driven-evaluator shape in this codebase. O4 mirrors it.

## Hermes-first capability checklist

All build steps are `[net-new]` against Hermes substrate. Same disposition as O7 (PR #63) — Vizora middleware/Prisma/NestJS work; Hermes agent runtime doesn't own NestJS event bus, Prisma schema, or display assignment.

| # | Step | Tag | Why |
|---|------|-----|-----|
| 1 | Add `TagAssignmentRule` Prisma model + migration | `[net-new]` | Vizora schema |
| 2 | `TagRulesService` CRUD + cross-org/tenant guards | `[net-new]` | NestJS DI + Prisma |
| 3 | `TagRuleEvaluator` `@OnEvent` handlers for `display.tags.changed` and `display.paired` | `[net-new]` | NestJS event bus |
| 4 | Atomic CAS via `updateMany` predicate on `currentPlaylistId IS NULL` | `[net-new]` | First-write-wins guarantee |
| 5 | Sweep-after-create with `REEVAL_TIMEOUT_MS` | `[net-new]` | Application logic in TS |
| 6 | `TagRulesController` 6 endpoints with `@Roles('admin')` on mutations | `[net-new]` | NestJS controllers |
| 7 | Emit new `display.tags.changed` event from `displays.service.ts` `addTags`/`removeTags` | `[net-new]` | Vizora source change |
| 8 | Subscribe to existing `display.paired` event (no new emission — `pairing.service.ts:294` already fires it) | `[net-new]` | Subscriber side; reuses existing event |
| 9 | DTO validation: `priority` clamped to [1, 999]; required tagId + playlistId strings | `[net-new]` | class-validator at DTO layer |
| 10 | Emit `display.playlist.assigned` event with `{ ..., source: 'tag_rule', ruleId }` for downstream listeners | `[net-new]` | Future audit/observability hook |
| 11 | Unit tests (~32 cases) as siblings of impl files | `[net-new]` | Jest config excludes `__tests__/` |

**Red-flag check:** 11/11 net-new is the correct disposition for Vizora middleware platform work, matching O7's verdict.

## Drift-rule self-checks

- ✅ Read `middleware/src/modules/notifications/alert-rules/alert-rules.service.ts` (full file — O7 service pattern: cross-org guards via `findFirst({where:{id, organizationId}})`, cross-tenant validation via `validateRecipient`, atomic CAS via `updateMany` with predicate. Mirror this for `validateRuleRefs(orgId, dto)` and `evaluateForDisplay(orgId, displayId)`).
- ✅ Read `middleware/src/modules/notifications/alert-rules/alert-rule.evaluator.ts` (full file — O7 evaluator pattern: top-level try/catch per `@OnEvent`, per-recipient try/catch on dispatch).
- ✅ Read `middleware/src/modules/notifications/alert-rules/alert-rules.controller.ts` (full file — RBAC pattern: `@UseGuards(RolesGuard)` at class level; `@Roles('admin')` on mutations including POST; `@CurrentUser('organizationId')` decorator; `ParseIdPipe` for path params).
- ✅ Read `middleware/src/modules/displays/displays.service.ts` lines 1-50 + 400-450 (`addTags`/`removeTags` are the hook points for event emission; both currently no events. Constructor already injects `EventEmitter2`).
- ✅ Read `middleware/src/modules/displays/pairing.service.ts` lines 285-308 (confirmed: emits `display.paired` with `{ organizationId, displayId }` at line 294 — exactly the payload shape my evaluator expects).

## File layout

```
middleware/src/modules/tag-rules/
├── tag-rules.module.ts                                  (NEW)
├── tag-rules.service.ts                                 (NEW)
├── tag-rules.service.spec.ts                            (NEW)
├── tag-rule.evaluator.ts                                (NEW)
├── tag-rule.evaluator.spec.ts                           (NEW)
├── tag-rules.controller.ts                              (NEW)
├── tag-rules.controller.spec.ts                         (NEW)
├── tag-rule.types.ts                                    (NEW)
└── dto/
    ├── create-tag-rule.dto.ts                           (NEW)
    ├── update-tag-rule.dto.ts                           (NEW)
    └── list-tag-rules-query.dto.ts                      (NEW)

middleware/src/modules/displays/displays.service.ts      (MODIFIED — emit display.tags.changed after addTags/removeTags)
middleware/src/modules/displays/displays.service.spec.ts (MODIFIED — assert emission)

middleware/src/app/app.module.ts                         (MODIFIED — register TagRulesModule)

packages/database/prisma/schema.prisma                   (MODIFIED — add TagAssignmentRule model + back-relations)
packages/database/prisma/migrations/<ts>_add_tag_assignment_rules/migration.sql (NEW)
```

All `*.spec.ts` files are SIBLINGS of impl files (NOT under `__tests__/` — Jest excludes that dir per `middleware/jest.config.js:5-7`).

## `tag-rule.types.ts` (literal)

```ts
/** Lower number = higher priority. 1 = highest, 100 = default, 999 = lowest. */
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 999;
export const PRIORITY_DEFAULT = 100;

/**
 * Synchronous re-evaluation sweep timeout. If an admin creates a rule that
 * matches 5000 displays, the sweep is sequential and could exceed this.
 * Beyond it, the controller returns 504; natural display.tags.changed events
 * will converge eventually.
 */
export const REEVAL_TIMEOUT_MS = 30 * 1000;
```

## Prisma schema additions (literal)

```prisma
model TagAssignmentRule {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  tagId          String
  playlistId     String?
  isActive       Boolean  @default(true)
  priority       Int      @default(100)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  tag          Tag          @relation(fields: [tagId],          references: [id], onDelete: Cascade)
  playlist     Playlist?    @relation(fields: [playlistId],     references: [id], onDelete: SetNull)

  @@unique([organizationId, name])
  @@index([organizationId, isActive])
  @@index([tagId])
  @@index([playlistId])
  @@map("tag_assignment_rules")
}
```

Back-relations added to `Organization`, `Tag`, `Playlist`.

## Service shape — key methods

`TagRulesService.evaluateForDisplay(orgId, displayId): Promise<boolean>`:

```ts
const display = await this.db.display.findFirst({
  where: { id: displayId, organizationId: orgId },
  include: { tags: { select: { tagId: true } } },
});
if (!display) return false;
if (display.currentPlaylistId !== null) return false;          // first-write-wins
if (display.tags.length === 0) return false;

const candidateRules = await this.db.tagAssignmentRule.findMany({
  where: {
    organizationId: orgId,
    isActive: true,
    tagId: { in: display.tags.map((t) => t.tagId) },
  },
  orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
});

for (const rule of candidateRules) {
  if (rule.playlistId === null) {
    this.logger.warn(`Rule ${rule.id} has playlistId=null (Playlist was deleted; SetNull cascade). Skipping.`);
    continue;
  }
  const updated = await this.db.display.updateMany({
    where: { id: displayId, organizationId: orgId, currentPlaylistId: null },
    data: { currentPlaylistId: rule.playlistId },
  });
  if (updated.count === 0) return false;                       // raced and lost
  this.events.emit('display.playlist.assigned', {
    organizationId: orgId,
    displayId,
    playlistId: rule.playlistId,
    ruleId: rule.id,
    source: 'tag_rule',
  });
  return true;
}
return false;
```

`TagRulesService.create(orgId, dto)`:

```ts
await this.validateRuleRefs(orgId, dto.tagId, dto.playlistId);
const rule = await this.db.tagAssignmentRule.create({ data: { organizationId: orgId, ...dto } });
try {
  if (rule.isActive) await this.sweepDisplaysForTag(orgId, rule.tagId);
} catch (err) {
  this.logger.warn(`Sweep after creating rule ${rule.id} failed: ${err}. Natural events will converge.`);
  if (err instanceof GatewayTimeoutException) throw err;     // surface 504
}
return rule;
```

`TagRulesService.update(orgId, id, dto)` — PR-review fix: re-sweep when ANY of `isActive`, `tagId`, `playlistId`, or `priority` changes. Priority matters because lowering a rule's priority can promote it past an existing rule for displays where both match:

```ts
const before = await this.findOne(orgId, id);                  // throws NotFound on cross-org
if (dto.tagId || dto.playlistId) await this.validateRuleRefs(orgId, dto.tagId, dto.playlistId);

const after = await this.db.tagAssignmentRule.update({
  where: { id },
  data: { ...dto },
});

// Trigger sweep if the change could affect WHICH rule wins for matched displays.
const sweepTriggers: Array<keyof typeof dto> = ['isActive', 'tagId', 'playlistId', 'priority'];
const changed = sweepTriggers.some((k) => dto[k] !== undefined && (dto[k] as unknown) !== (before as Record<string, unknown>)[k]);

if (changed && after.isActive) {
  // Sweep both the old tag (if tagId changed and old was active) and new tag,
  // so the new rule has a chance to win for newly-relevant displays.
  // Note: this never UNASSIGNS playlists set by the now-replaced rule — that's
  // intentional v1 behavior ("assignments persist").
  try {
    if (before.tagId !== after.tagId && before.isActive) await this.sweepDisplaysForTag(orgId, before.tagId);
    await this.sweepDisplaysForTag(orgId, after.tagId);
  } catch (err) {
    this.logger.warn(`Sweep after updating rule ${id} failed: ${err}. Natural events will converge.`);
    if (err instanceof GatewayTimeoutException) throw err;
  }
}

return after;
```

`TagRulesService.sweepDisplaysForTag(orgId, tagId)`: loops tagged displays with `currentPlaylistId=null`, calls `evaluateForDisplay` for each, respects `REEVAL_TIMEOUT_MS`, and on timeout throws `GatewayTimeoutException` whose `cause` carries `{ scanned, assigned, total }` so the controller can surface partial-progress counts to the caller.

```ts
// sweep timeout path
if (Date.now() - start > REEVAL_TIMEOUT_MS) {
  throw new GatewayTimeoutException({
    message: `Tag-rule re-evaluation sweep exceeded ${REEVAL_TIMEOUT_MS}ms for tag ${tagId} in org ${orgId}`,
    scanned: i,
    assigned,
    total: taggedDisplays.length,
    hint: 'Natural display.tags.changed events will converge over time. Optionally re-trigger via POST /:id/re-evaluate.',
  });
}
```

## Evaluator shape

```ts
@Injectable()
export class TagRuleEvaluator {
  private readonly logger = new Logger(TagRuleEvaluator.name);

  constructor(private readonly tagRulesService: TagRulesService) {}

  @OnEvent('display.tags.changed', { async: true })
  async onTagsChanged(payload: { organizationId: string; displayId: string }) {
    try {
      await this.tagRulesService.evaluateForDisplay(payload.organizationId, payload.displayId);
    } catch (err) {
      this.logger.error(
        `Tag-rule evaluation failed for display ${payload.displayId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @OnEvent('display.paired', { async: true })
  async onDisplayPaired(payload: { organizationId: string; displayId: string }) {
    try {
      await this.tagRulesService.evaluateForDisplay(payload.organizationId, payload.displayId);
    } catch (err) {
      this.logger.error(
        `Tag-rule evaluation failed for newly-paired display ${payload.displayId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
```

## Controller shape

```ts
@UseGuards(RolesGuard)
@Controller('tag-rules')
export class TagRulesController {
  constructor(private readonly service: TagRulesService) {}

  @Post()                          @Roles('admin')                                    create(...)
  @Get()                                                                              findAll(...)
  @Get(':id')                                                                         findOne(...)
  @Patch(':id')                    @Roles('admin')                                    update(...)
  @Delete(':id')                   @Roles('admin') @HttpCode(HttpStatus.NO_CONTENT)   remove(...)
  @Post(':id/re-evaluate')         @Roles('admin')                                    reEvaluate(...)
}
```

## DTOs

```ts
export class CreateTagRuleDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) tagId!: string;
  @IsString() @MinLength(1) playlistId!: string;
  @IsInt() @Min(PRIORITY_MIN) @Max(PRIORITY_MAX) @IsOptional() priority?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

export class UpdateTagRuleDto extends PartialType(CreateTagRuleDto) {}
```

## DisplaysService event-emission diff

```ts
// displays.service.ts:addTags — after `const results = await Promise.all(createPromises);`
this.eventEmitter.emit('display.tags.changed', { organizationId, displayId });
return results.map((dt) => dt.tag);

// displays.service.ts:removeTags — after `await this.db.displayTag.deleteMany(...)`
this.eventEmitter.emit('display.tags.changed', { organizationId, displayId });
return { success: true, removed: tagIds.length };
```

## Migration SQL skeleton

```sql
CREATE TABLE "tag_assignment_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "playlistId" TEXT,                                       -- nullable for SetNull cascade
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tag_assignment_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tag_assignment_rules_organizationId_name_key" ON "tag_assignment_rules"("organizationId", "name");
CREATE INDEX "tag_assignment_rules_organizationId_isActive_idx" ON "tag_assignment_rules"("organizationId", "isActive");
CREATE INDEX "tag_assignment_rules_tagId_idx" ON "tag_assignment_rules"("tagId");
CREATE INDEX "tag_assignment_rules_playlistId_idx" ON "tag_assignment_rules"("playlistId");

ALTER TABLE "tag_assignment_rules" ADD CONSTRAINT "tag_assignment_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tag_assignment_rules" ADD CONSTRAINT "tag_assignment_rules_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tag_assignment_rules" ADD CONSTRAINT "tag_assignment_rules_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Table-name convention: `organizations` and `playlists` are lowercase via `@@map`; `Tag` is PascalCase (no `@@map`). Verified against `prisma/migrations/20260127044226_init/migration.sql`.

## Test plan

### `tag-rules.service.spec.ts` (~17 cases)
- `create` happy path
- `create` with tagId from another org → ForbiddenException
- `create` with playlistId from another org → ForbiddenException
- `create` with priority below 1 or above 999 → DTO 400
- `findOne` / `update` / `remove` cross-org → NotFoundException (each)
- `update` of isActive false→true triggers sweep
- `update` of tagId triggers BOTH old-tag and new-tag sweeps
- `update` of `priority` ONLY (no other field changes) still triggers sweep — PR-review fix
- `update` of `name` ONLY does NOT trigger sweep (cosmetic)
- `evaluateForDisplay` skips when currentPlaylistId is already set
- `evaluateForDisplay` skips when display has no tags
- `evaluateForDisplay` picks lowest-priority rule (tie = oldest createdAt)
- `evaluateForDisplay` skips a rule whose playlistId is null with WARN; falls through to next-ranked rule
- `evaluateForDisplay` UPDATE returns count=0 (another writer won) → returns false without error
- `reEvaluateRule` throws GatewayTimeoutException with `{ scanned, assigned, total }` partial counts when sweep exceeds `REEVAL_TIMEOUT_MS` — uses jest fake timers to simulate (PR-review fix)
- `evaluateForDisplay` outer try/catch swallows FK violations (e.g. playlist deleted between findMany and updateMany) — defensive test pinned by the @OnEvent handler's try/catch

### `tag-rule.evaluator.spec.ts` (~7 cases)
- `display.tags.changed` triggers evaluateForDisplay with correct payload
- `display.paired` triggers evaluateForDisplay
- Top-level try/catch swallows DB failures (no unhandled rejection)
- Handlers crash-independently of each other
- Event payload missing displayId → service throws → caught + logged
- `display.playlist.assigned` event is emitted via the service (spy)
- evaluator does NOT consume `display.playlist.assigned` (no infinite loop) — explicit test: emit the event, assert neither `onTagsChanged` nor `onDisplayPaired` was called (mock the service to prove no call reached it)

### `tag-rules.controller.spec.ts` (~10 cases)
- Each of 6 endpoints forwards orgId correctly
- @Roles('admin') metadata present on POST, PATCH, DELETE, re-evaluate
- GET endpoints do NOT require admin
- POST with invalid priority → 400
- DELETE non-admin → 403

### `displays.service.spec.ts` additions (~1 case)
- `addTags` emits `display.tags.changed` after upsert (jest.spyOn on eventEmitter.emit)

## Risks summary (refined from plan + PR review)

| Risk | Mitigation |
|---|---|
| Event delivery loss on process crash | Accepted v1 — eventual consistency |
| Concurrent rule creates → priority inversion | Documented; operator uses POST re-evaluate to converge |
| Re-evaluation sweep blocks request for large fleets | 30s timeout → 504 with `{ scanned, assigned, total }` partial counts; natural events converge |
| Re-evaluate endpoint double-click → parallel sweeps | Idempotent (predicate-protected updates) |
| Playlist deleted → rule.playlistId becomes null | Evaluator detects, logs WARN, skips, tries next |
| O1 push vs O4 evaluator race | O1 always overwrites; O4 only sets when null |
| Priority-only update silently doesn't reorder rule precedence | PR-review fix: `update` triggers sweep when `priority` changes (in addition to `isActive`/`tagId`/`playlistId`) |

## Acceptance criteria

- [ ] Migration applies forward + reset cleanly
- [ ] All ~32 new tests pass; existing 2419 middleware tests pass with 0 regressions
- [ ] `tsc --noEmit` clean
- [ ] `addTags` emits `display.tags.changed` (test asserts)
- [ ] Display with non-null `currentPlaylistId` is never overwritten
- [ ] Cross-org tagId/playlistId rejected at create
- [ ] DELETE/PATCH/POST without admin → 403
- [ ] All test files are siblings, NOT under `__tests__/`
