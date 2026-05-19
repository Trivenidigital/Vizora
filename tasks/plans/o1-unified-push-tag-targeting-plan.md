# O1 — Unified Push to Screens (Tag-Based Targeting MVP) — Plan

**Date:** 2026-05-19
**Audit ref:** P0 #2 (`docs/plans/2026-05-17-optsigns-vizora-feature-gap.md`)
**Backlog ref:** `backlog.md` → "OptiSigns Parity Roadmap" → O1
**Branch:** `feat/o1-unified-push-tag-targeting` (built on top of `feat/o4-tag-rule-auto-assignment`)
**Effort:** S (1 dev-day; reduced from audit's M/3d via lean-MVP scoping)
**Drift-check tag:** `extends-Hermes`

Deliberate **lean MVP cut**. The full audit description (push from content/templates/layouts/widgets/playlists × tag/group/display/tag-rule targeting × append-to-playlist × scheduled-revert × temporary takeover) is a 3-day feature. The single piece that closes the most-referenced audit gap is **tag-based targeting** — push to "all displays tagged `lobby`" from one API call instead of N per-display calls. That's the focus here.

## Hermes-first capability checklist

| # | Step | Tag | Why |
|---|------|-----|-----|
| 1 | Extend `FleetService.resolveTargetDevices` switch to handle `target.type === 'tag'` | `[net-new]` | Vizora middleware service |
| 2 | Resolve tag → list of displayIds via `DisplayTag.findMany({ tagId, display: { organizationId } })` | `[net-new]` | Prisma query against existing schema |
| 3 | Cross-org guard: tagId MUST belong to caller's org (else NotFound) | `[net-new]` | Service-layer validation |
| 4 | Extend `SendCommandDto.target.type` `@IsIn` allowlist to include `'tag'` | `[net-new]` | class-validator DTO |
| 5 | Existing fleet command path (broadcast to realtime gateway) reused unchanged | `[net-new]` | No change — just routing more deviceIds through it |
| 6 | Tests: fleet.service.spec for the new switch branch + cross-org guard | `[net-new]` | Jest |
| 7 | Empty result-set behavior: tag with zero tagged displays returns `{ devicesQueued: 0 }` without 4xx | `[net-new]` | Application logic |
| 8 | Cross-tenant double check: the `DisplayTag.findMany` query filters `display.organizationId` too (belt-and-braces) | `[net-new]` | Defense in depth |

**Red-flag check:** 8/8 `[net-new]` is correct — pure Vizora middleware work.

## Drift-rule self-checks

- ✅ Read `middleware/src/modules/fleet/fleet.service.ts` (lines 155-206 — confirmed `resolveTargetDevices` is the right extension point; the switch already handles `device`/`group`/`organization`; adding `'tag'` is one new case).
- ✅ Read `middleware/src/modules/tag-rules/tag-rules.service.ts` (lines 228-249 — `validateRuleRefs` shows the canonical Tag cross-org lookup: `db.tag.findFirst({where:{id, organizationId}})` + ForbiddenException). O1 uses the same pattern but throws NotFound to match the existing `resolveTargetDevices` branches.
- ✅ Read `middleware/src/modules/notifications/alert-rules/alert-rules.service.ts` (from O7) — cross-org guard pattern reference (same `findFirst({where:{id, organizationId}})` shape).
- ✅ Read `packages/database/prisma/schema.prisma` (Tag at line 352, DisplayTag at line 384) — `DisplayTag.findMany({where:{tagId}})` returns the join rows; `.displayId` field is the FK.

## Problem

Today `POST /fleet/commands` accepts `target = { type: 'device' | 'group' | 'organization', id }`. To push to "all displays tagged `lobby`," an operator must either:

1. Manually query the API, get the list of tagged displays, and issue N device-targeted commands (slow + race-prone), OR
2. Pre-create a DisplayGroup mirroring the tag membership (duplication; tags evolve faster than groups).

OptiSigns ships tag-based push as a single API call. So should we.

## Goals

1. Extend `FleetService.resolveTargetDevices` to accept `target.type === 'tag'`.
2. Resolve via `DisplayTag.findMany({ tagId, display: { organizationId } })` — cross-org-safe by construction.
3. Add cross-org guard on tagId existence.
4. Empty result is acceptable (zero devicesQueued) — caller may audit later.

## Non-goals

- Push-from-templates / layouts / widgets / playlists endpoints (UI-side bundling; backend already exposes `/displays/{id}/push-content`).
- Append-to-playlist mode (separate feature; PR scope creep).
- Scheduled push with auto-revert / temporary takeover (overlaps with fleet emergency-override which already tracks active overrides in Redis with 24h TTL — see `fleet.service.ts:285-290`).
- Tag-rule-based push (different beast — that's O4's auto-assignment, not a push).

These are reasonable follow-ups; not blockers for the audit's headline gap.

## Affected files

```
middleware/src/modules/fleet/fleet.service.ts         (MODIFIED — add 'tag' case to resolveTargetDevices)
middleware/src/modules/fleet/dto/send-command.dto.ts  (MODIFIED — extend target.type @IsIn to include 'tag')
middleware/src/modules/fleet/fleet.service.spec.ts    (MODIFIED — add 3-4 tests for the new branch)
```

Three files. No new schema, no new module, no migration.

## Service-layer change (literal)

```ts
// fleet.service.ts:resolveTargetDevices — new case BEFORE the default

case 'tag': {
  // Cross-org guard: the tag must belong to the caller's org. Use findFirst
  // (not findUnique) so a tag id from another org returns null → NotFound,
  // never leaking existence.
  const tag = await this.db.tag.findFirst({
    where: { id: target.id, organizationId: orgId },
  });
  if (!tag) {
    throw new NotFoundException(`Tag ${target.id} not found in organization`);
  }

  // Resolve the tagged displays in this org. The compound `display.organizationId`
  // predicate is belt-and-braces — DisplayTag → Tag → org would catch it via
  // the tag check above, but explicit is safer if a DisplayTag row ever points
  // at a Display in a different org (shouldn't happen via Vizora APIs, but
  // a hand-crafted DB write could).
  const tagged = await this.db.displayTag.findMany({
    where: {
      tagId: target.id,
      display: { organizationId: orgId },
    },
    select: { displayId: true },
  });

  return {
    deviceIds: tagged.map((t) => t.displayId),
    targetName: `tag: ${tag.name}`,
  };
}
```

## DTO change

Existing `SendCommandDto.target.type` validator is `@IsIn(['device', 'group', 'organization'])`. Change to include `'tag'`.

## Tests

`fleet.service.spec.ts` additions (~4 cases):
- `resolveTargetDevices` with `{ type: 'tag', id: tagId }` returns all displays in the org tagged with `tagId`
- Cross-org guard: tag from another org → NotFoundException, no fleet broadcast
- Empty result: tag with zero tagged displays → returns `{ deviceIds: [], targetName }` without throwing
- Cross-tenant double-check: a DisplayTag pointing at a display from another org (hostile hand-crafted row) is filtered out by the `display.organizationId` predicate

## Acceptance criteria

- [ ] `tsc --noEmit` clean
- [ ] All new fleet.service.spec tests pass; existing fleet tests pass unchanged
- [ ] Full middleware suite: 0 regressions
- [ ] `POST /api/v1/fleet/commands` with body `{ command: 'push_content', target: { type: 'tag', id: <tagId> }, payload: { contentId } }` fans out to every display in the caller's org with that tag
- [ ] Cross-org tagId → 404 NotFound (no information leak)

## Risks

| Risk | Mitigation |
|---|---|
| `DisplayTag.findMany` for a popular tag (5000 displays) — does the existing broadcast path handle that? | The current `device`/`group`/`organization` cases already return arbitrary-size deviceIds lists. The existing `callGatewayBroadcast` accepts the array. Same path, more elements. Acceptable. |
| Cross-org leak via cleverly-crafted target.id | Tag verified to belong to org; even if it somehow passed, the `display.organizationId` predicate in the DisplayTag query blocks cross-tenant displays |
| Conflicts with O4 — O4 writes `currentPlaylistId` based on tag; O1 pushes content based on tag | Different surfaces. O4 = persistent assignment via DB column. O1 = ephemeral push via realtime gateway. They coexist. Documented in code via the O1-contract comment O4 added (`tag-rules.service.ts:202`). |

## Open questions

None — the scope is intentionally small. Documented v1 limitations cover the deferred items.
