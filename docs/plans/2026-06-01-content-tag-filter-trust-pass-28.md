# Content Tag Filter Trust Pass 28

**Branch:** `feat/customer-readiness-pass-28`

**Goal:** Replace hardcoded content-library tag filter choices with real tenant-scoped content tags so customers do not filter by fake categories.

**New primitives introduced:** one content-module read endpoint, `GET /api/v1/content/tags`, one web API client method, and a `tagIds` content-list query filter. No new database model, migration, process, queue, realtime path, MCP tool, Hermes skill, provider spend path, or deployment primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

## Current Evidence

- `web/src/app/dashboard/content/page-client.tsx` initializes tag filters to hardcoded `Marketing`, `Seasonal`, `Featured`, and `Archive`.
- Middleware already has real tenant-scoped tags via `Tag` and `ContentTag`, and content list filtering already accepts legacy `tagNames`.
- There is no current tag-list endpoint for the dashboard, so the UI cannot populate real filter options.
- Review found that serializing selected tag names breaks valid comma-bearing tag names, so the dashboard must filter by tag id while leaving `tagNames` available for legacy callers.

## Plan

- [x] Add failing middleware tests for `ContentService.listContentTags()` and `GET /content/tags`.
- [x] Add failing web tests proving the content page fetches real tags, does not render hardcoded tags, and filters by `tagIds`.
- [x] Implement a tenant-scoped content tag list using the existing Prisma `Tag`/`ContentTag` relations.
- [x] Add `apiClient.getContentTags()` and replace hardcoded content-page tag state with fetched real tags.
- [x] Hide or message the tag filter panel when no content tags exist.
- [x] Run multi-vector review before broad tests.
- [x] Run focused middleware/web tests, type checks, lint, and builds.
- [ ] PR, wait for CI, merge if green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

## Test Plan

- `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/content/content.service.spec.ts src/modules/content/content.controller.spec.ts src/modules/content/dto/content-query.dto.spec.ts src/modules/folders/folders.controller.spec.ts`
- `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/content/__tests__/content-page.test.tsx src/lib/api/__tests__/content.test.ts`
- `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
- `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
- Changed-file ESLint and production builds for affected services.
- `pnpm --filter @vizora/web test -- --runInBand`
- `pnpm --filter @vizora/middleware test -- --runInBand`
