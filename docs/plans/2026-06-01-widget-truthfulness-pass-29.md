# Widget Truthfulness Pass 29

**Branch:** `feat/widget-truthfulness-pass-29`

**Goal:** Stop customer widgets from being saved or updated with sample/stale data while the UI reports success.

**New primitives introduced:** one server-only optional strict-fetch mode on existing widget data sources, plus dashboard schema normalization for existing widget type metadata. No new database model, migration, process, queue, realtime path, MCP tool, Hermes skill, provider spend path, or deployment primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

## Current Evidence

- `ContentService.createWidget()` caught initial data-fetch failure, substituted `source.getSampleData()`, saved the widget, and the dashboard reported "Widget created successfully."
- `ContentService.updateWidget()` caught fetch/render failure, kept old `renderedHtml`, saved the config, and the dashboard reported "Widget updated successfully."
- Weather, RSS, generic API, and social data sources could return sample data from `fetchData()`, so create/update could save non-live data even if the service stopped catching thrown errors.
- The dashboard treated widget config schemas as flat field maps, but backend widget types return JSON-schema-style `{ type, properties, required }`, so real weather/RSS fields could be missed while tests passed against flat fixtures.
- Social widget sources are stubs that return sample data; strict save mode must reject them or the product will continue advertising widgets that cannot truthfully save.

## Plan

- [x] Add failing service tests proving widget create fails when live data fetch fails and does not insert content.
- [x] Add failing service tests proving widget create render failure fails and does not insert content.
- [x] Add failing service tests proving widget update fails when live data fetch/render fails and does not persist config changes.
- [x] Add failing service tests proving widget refresh uses strict mode and does not overwrite current rendered HTML with fallback sample data.
- [x] Add failing data-source tests proving strict mode throws intentional Nest HTTP exceptions instead of returning sample data for weather/RSS/generic/social fallback paths.
- [x] Add failing dashboard tests proving real backend JSON schemas render editable config fields.
- [x] Add failing dashboard tests proving create/update/refresh failures show error toasts, avoid success toasts, and disable in-flight refresh.
- [x] Add failing dashboard tests proving fallback widget types are visibly degraded and not creatable when type metadata fails to load.
- [x] Add optional server-only strict-fetch mode to `WidgetDataSource.fetchData`.
- [x] Call data sources in strict mode from create/update/refresh and map failures to intentional exceptions (`BadRequestException` for customer-fixable config, `BadGatewayException` / `ServiceUnavailableException` for upstream/circuit failures).
- [x] Preserve sample data for widget type metadata and non-saving preview paths.
- [x] Normalize JSON-schema `{ properties }` widget configs for the dashboard while preserving current flat schema support.
- [x] Keep mutation results visible locally or surface reload failures instead of reporting success and silently emptying the list.
- [x] Run multi-vector review before broader verification.
- [x] Run focused middleware/web tests, type checks, lint, builds, and relevant broader suites.
- [ ] PR, wait for CI, merge if green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

## Test Plan

- `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/content/content.service.spec.ts src/modules/content/widget-data-sources/weather.data-source.spec.ts src/modules/content/widget-data-sources/rss.data-source.spec.ts src/modules/content/widget-data-sources/generic-api.data-source.spec.ts src/modules/content/widget-data-sources/social.data-source.spec.ts`
- `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/widgets/__tests__/widgets-page.test.tsx`
- `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
- `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
- Changed-file ESLint and production builds for affected services.

## Verification Evidence

- Final reviewers: backend CLEAN, frontend CLEAN.
- Focused tests: middleware widget/data-source suite 165/165 pass; web widgets page suite 16/16 pass; post-cleanup `content.service.spec.ts` 110/110 pass.
- Broader tests: middleware full Jest 146 suites / 2920 tests pass; web full Jest 96 suites / 1041 tests pass.
- Type checks: middleware and web `tsc --noEmit` pass.
- Builds: middleware production build passes with existing webpack warnings; web production build passes when required production CSP env is set locally (`NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_API_URL`, `BACKEND_URL`).
- Security/diff: `pnpm security:no-hardcoded-jwts` and `git diff --check` pass. Changed-file ESLint exits 0 with non-blocking existing `any` warnings in the widgets page.
