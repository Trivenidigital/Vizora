# Dashboard Write Gates and Layout Create Pass 48

**Date:** 2026-06-02

**Branch:** `fix/dashboard-write-gates-layout-pass-48`

## Goal

Close two customer-visible dashboard/backend gaps found after the pairing-index
merge:

- Dashboard-adjacent write endpoints for folders, display groups, widgets,
  templates, bulk content operations, and layouts bypass the existing
  subscription-active guard used by the core content controller.
- The layouts page creates a layout from a preset by sending `name`,
  `layoutType`, and optional `description`; the backend DTO currently requires
  `zones`, so normal dashboard creation can fail validation with a 400.
- The real preset API returns `layoutType`, but the dashboard fallback shape
  uses `type`; the page must normalize both.
- The layout editor must open middleware responses where `layoutType` and
  `zones` are nested in `metadata`.
- The layout list must also normalize saved layout records where `layoutType`
  and `zones` are nested in `metadata`.

## Source-of-Truth Check

- `ContentController` already uses the existing `@RequiresSubscription()`
  decorator, which installs `SubscriptionActiveGuard`.
- `SubscriptionActiveGuard` allows `GET` and `HEAD` requests, then gates
  non-read methods by organization subscription status, active trial, and free
  tier.
- `DisplayGroupsController`, `FoldersController`,
  `BulkOperationsController`, `LayoutsController`, `TemplatesController`, and
  `WidgetsController` currently only use `RolesGuard`.
- `ContentModule` already imports `BillingModule`; `DisplayGroupsModule` and
  `FoldersModule` need the same provider wiring when using
  `@RequiresSubscription()`.
- Template preview/validation POSTs are stateless and should not be treated as
  customer data writes for this pass.
- `web/src/app/dashboard/layouts/page.tsx` creates layouts without `zones`;
  `CreateLayoutDto` currently requires `zones`.

## New Primitives Introduced

No new service, route, module, database model, migration, env var, PM2 process,
response shape, realtime path, MCP tool, Hermes skill, or AI/provider spend
path. This pass only reuses the existing billing guard and existing layout
preset table.

## Hermes-First Analysis

This is local NestJS dashboard authorization and DTO/service contract repair,
not a business-agent or MCP/Hermes task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard write gating | none applicable | reuse existing `@RequiresSubscription()` decorator |
| Layout preset materialization | none applicable | reuse existing `LAYOUT_PRESETS` in `ContentService` |

Awesome-Hermes ecosystem check: no applicable Hermes runtime or skill primitive
for NestJS controller guard metadata or layout DTO validation.

## Design

- Apply `@RequiresSubscription()` at method level to mutating dashboard-adjacent
  handlers:
  - display-group create/update/delete/member add/member remove
  - folder create/update/delete/content move
  - bulk content update/archive/restore/delete/tag/duration writes
  - layout create/update/delete
  - template create/update/refresh
  - widget create/update/refresh
- Keep read handlers and stateless preview/validation handlers undecorated so
  expired paid accounts retain read-only dashboard access and non-mutating
  diagnostics remain available.
- Import the existing `BillingModule` into `DisplayGroupsModule` and
  `FoldersModule` so Nest can resolve `SubscriptionActiveGuard` for those
  standalone controllers.
- Make `CreateLayoutDto.zones` optional.
- In `ContentService.createLayout()`, derive missing `zones` and
  `gridTemplate` from the matching preset. Preserve explicit zones for custom
  layouts and dashboard editor updates.
- Return a clear `BadRequestException` when a non-custom layout type has no
  preset and no explicit zones. `custom` can still default to a single-zone grid
  only if explicit zones are supplied.
- Normalize layout presets on the dashboard list page so both server and
  fallback preset shapes use a concrete `type` before create.
- Normalize layout editor responses so top-level fields and `metadata` fields
  both load into the editor model.
- Normalize saved layout list responses the same way before rendering preview
  and preset labels.

## Plan

- [x] Add guard metadata regression coverage for the newly-gated mutating
  handlers and for stateless template preview/validation remaining ungated.
- [x] Add executable guard-resolution coverage for display-group and folder
  modules.
- [x] Add service regression coverage proving preset-based layout creation
  succeeds without zones and persists preset zones/grid template.
- [x] Add dashboard regressions for server-shaped presets and metadata-backed
  saved/resolved layout loads.
- [x] Patch controllers, modules, DTO, layout creation service, and dashboard
  normalization.
- [x] Run focused controller/service/dashboard tests.
- [x] Run multi-vector diff reviews before broader tests.
- [x] Run TypeScript, broader middleware tests/build, lint/security checks.
- [ ] Open PR, wait for CI, merge if green.
- [ ] Re-check production deploy gate; deploy only if the dirty/diverged
  production checkout is made safe.

## Risks

- Over-gating stateless template preview/validation would make the template
  editor less useful for expired accounts. Method-level decoration avoids this.
- Materializing default zones server-side must not hide bad custom-layout input.
  The service only derives from known presets when zones are omitted.
- Adding subscription guards changes runtime behavior for inactive paid
  subscriptions on write paths. This aligns with the existing core content
  controller semantics and still permits free-tier write access through the
  existing guard.

## Verification

- Focused:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/content/controllers/layouts.controller.spec.ts src/modules/content/controllers/templates.controller.spec.ts src/modules/content/controllers/widgets.controller.spec.ts src/modules/content/controllers/bulk-operations.controller.spec.ts src/modules/display-groups/display-groups.controller.spec.ts src/modules/folders/folders.controller.spec.ts src/modules/content/content.service.spec.ts`
- Subscription/layout focused:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/billing/subscription-write-gates.spec.ts src/modules/content/content.service.spec.ts`
  => 2 suites / 151 tests passing.
- Controller slice:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/content/controllers/layouts.controller.spec.ts src/modules/content/controllers/templates.controller.spec.ts src/modules/content/controllers/widgets.controller.spec.ts src/modules/content/controllers/bulk-operations.controller.spec.ts src/modules/display-groups/display-groups.controller.spec.ts src/modules/folders/folders.controller.spec.ts src/modules/billing/subscription-write-gates.spec.ts`
  => 7 suites / 149 tests passing.
- Dashboard focused:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/layouts/__tests__/layouts-page.test.tsx src/app/dashboard/layouts/[id]/__tests__/layout-editor-page.test.tsx`
  => 2 suites / 13 tests passing; existing React `act()` warnings remain in
  older layout tests.
- TypeScript:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
  => passing.
- TypeScript:
  `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
  => passing.
- Broader middleware:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  => 148 suites / 3023 tests passing / 1 snapshot.
- Broader web:
  `pnpm --filter @vizora/web test -- --runInBand`
  => 104 suites / 1103 tests passing; existing React `act()` warnings remain
  in older unrelated tests.
- Build:
  `npx nx build @vizora/middleware`
  => passing, with existing webpack warnings.
- Build:
  `npx nx build @vizora/web`
  => passing with production env values, with existing Next middleware/proxy
  warning.
- Security:
  `pnpm security:no-hardcoded-jwts`
  => passing.
- Diff hygiene:
  changed-file ESLint => 0 errors / 19 warnings, mostly existing `any`
  warnings plus existing unused `idx` in the layout editor; `git diff --check`
  passes with CRLF normalization warnings.

## Review

- Plan/security reviewer found missing `BillingModule` imports for
  display-groups and folders; fixed and covered by executable guard-resolution
  tests.
- Plan/layout reviewer found backend `layoutType` and metadata shape drift
  against the dashboard list/editor; fixed with normalization and tests.
- Diff security/module reviewer returned CLEAN.
- Diff layout reviewer found saved-layout list normalization incomplete; fixed
  with metadata-backed saved-layout coverage.
- Follow-up layout reviewer returned CLEAN.
