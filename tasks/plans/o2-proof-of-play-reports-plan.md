# O2 — Proof-of-Play Reports (MVP) — Plan

**Date:** 2026-05-19
**Audit ref:** P0 #4 (`docs/plans/2026-05-17-optsigns-vizora-feature-gap.md`)
**Branch:** `feat/o2-proof-of-play-reports`
**Effort:** S (1 dev-day; reduced from audit's M/3d via lean cut)
**Drift-check tag:** `extends-Hermes`

Lean cut: 2 new endpoints on the existing AnalyticsController. Saved-views, scheduled-email, Excel/PDF deferred.

## Hermes-first capability checklist

| # | Step | Tag | Why |
|---|------|-----|-----|
| 1 | New `GET /api/v1/analytics/proof-of-play` — paginated impressions query | `[net-new]` | NestJS controller |
| 2 | New `GET /api/v1/analytics/proof-of-play.csv` — same filters, CSV body | `[net-new]` | NestJS streaming response |
| 3 | New service methods on AnalyticsService: `getProofOfPlay`, `streamProofOfPlayCsv` | `[net-new]` | Prisma query against existing ContentImpression model |
| 4 | New DTO for filter validation: dateFrom, dateTo, contentId?, displayId?, displayTagId?, playlistId?, page, limit | `[net-new]` | class-validator |
| 5 | Hand-rolled CSV serialization (~15 LOC; no new dep) | `[net-new]` | Application logic |

## Drift-rule self-checks

- ✅ Read `middleware/src/modules/analytics/analytics.controller.ts` (lines 1-50 — existing endpoints use `@Roles('admin', 'manager')`, `@CurrentUser('organizationId')`, simple `@Query` params. Mirror this pattern.).
- ✅ Read `middleware/src/modules/analytics/analytics.service.ts` (lines 1-50 — `getDateRange` helper, DatabaseService injection, returns typed DTOs. Will add my methods following the same shape.).
- ✅ Read `packages/database/prisma/schema.prisma` (ContentImpression at line 284 — has `organizationId, contentId, displayId, playlistId?, duration?, completionPercentage?, timestamp, date, hour`. Indexes on `(organizationId, date)`, `(contentId, date)`, `(displayId, date)` — query patterns are already covered).

## Goals

1. `GET /analytics/proof-of-play?dateFrom&dateTo&contentId&displayId&displayTagId&playlistId&page&limit` returns `{ data: [...], meta: { page, limit, total } }`.
2. `GET /analytics/proof-of-play.csv?<same filters>` returns text/csv body with header row + N data rows.
3. Both endpoints scoped to `@CurrentUser('organizationId')` and `@Roles('admin', 'manager')` (matches existing analytics endpoints).
4. Filter by `displayTagId` joins through DisplayTag.

## Non-goals (deferred follow-ups)

- Saved report views (UI surface + new table)
- Scheduled email delivery (cron + email infra)
- Excel / PDF exports (CSV is the lingua franca; Excel/PDF need libs)
- Aggregations beyond raw rows (totals, averages — can land via existing analytics endpoints)

## Affected files

```
middleware/src/modules/analytics/analytics.controller.ts          (MODIFIED — 2 new endpoints)
middleware/src/modules/analytics/analytics.service.ts             (MODIFIED — 2 new methods)
middleware/src/modules/analytics/dto/proof-of-play-query.dto.ts   (NEW)
middleware/src/modules/analytics/analytics.controller.spec.ts     (MODIFIED — 2 new tests)
middleware/src/modules/analytics/analytics.service.spec.ts        (MODIFIED — 6 new tests)
```

## Implementation sketch

**Service:**
```ts
async getProofOfPlay(orgId: string, filters: ProofOfPlayQueryDto) {
  const where: Prisma.ContentImpressionWhereInput = {
    organizationId: orgId,
    ...(filters.dateFrom || filters.dateTo ? { date: { gte: filters.dateFrom, lte: filters.dateTo } } : {}),
    ...(filters.contentId ? { contentId: filters.contentId } : {}),
    ...(filters.displayId ? { displayId: filters.displayId } : {}),
    ...(filters.playlistId ? { playlistId: filters.playlistId } : {}),
    ...(filters.displayTagId
      ? { display: { tags: { some: { tagId: filters.displayTagId } } } }
      : {}),
  };

  const [data, total] = await Promise.all([
    this.db.contentImpression.findMany({
      where,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      orderBy: { timestamp: 'desc' },
      include: { content: { select: { name: true } }, display: { select: { nickname: true } } },
    }),
    this.db.contentImpression.count({ where }),
  ]);

  return { data, meta: { page, limit, total } };
}

async *streamProofOfPlayCsv(orgId: string, filters): AsyncIterable<string> {
  // Yield CSV header, then batches of 1000 rows
  yield 'timestamp,contentId,contentName,displayId,displayName,playlistId,duration,completionPercentage\n';
  let skip = 0;
  while (true) {
    const batch = await this.db.contentImpression.findMany({
      where, skip, take: 1000, orderBy: { timestamp: 'desc' },
      include: { content: { select: { name: true } }, display: { select: { nickname: true } } },
    });
    if (batch.length === 0) break;
    for (const r of batch) yield this.csvRow(r);
    skip += 1000;
    if (skip > 100_000) break; // safety cap
  }
}
```

**Controller:**
```ts
@Get('proof-of-play')
@Roles('admin', 'manager')
getProofOfPlay(@CurrentUser('organizationId') orgId, @Query() q: ProofOfPlayQueryDto) { ... }

@Get('proof-of-play.csv')
@Roles('admin', 'manager')
@Header('Content-Type', 'text/csv')
@Header('Content-Disposition', 'attachment; filename="proof-of-play.csv"')
async streamCsv(@CurrentUser('organizationId') orgId, @Query() q, @Res() res) {
  for await (const chunk of this.service.streamProofOfPlayCsv(orgId, q)) {
    res.write(chunk);
  }
  res.end();
}
```

**DTO:** dateFrom/dateTo `@IsDateString @IsOptional`; contentId/displayId/playlistId/displayTagId all `@IsString @IsOptional`; page/limit with defaults + bounds.

## Risks

| Risk | Mitigation |
|---|---|
| Cross-org leak via contentId/displayId from another org | The `organizationId: orgId` predicate covers it — ContentImpression's FKs are within the same org by construction |
| Huge CSV export blows memory | Stream in 1000-row batches; cap at 100k rows (configurable later) |
| CSV injection (`=cmd|...`) | Prefix cells starting with `=`, `+`, `-`, `@` with `'` to neutralize Excel formula execution |

## Tests

- Service: 6 cases — filter combinations, cross-org guard, pagination, CSV header presence, CSV injection escaping, empty result
- Controller: 2 cases — happy path, admin-only gate
