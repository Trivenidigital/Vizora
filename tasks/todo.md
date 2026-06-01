# Vizora - Task Tracker

## Active: Analytics Truthfulness Pass 31 (2026-06-01)

**Branch:** `feat/analytics-truthfulness-pass-31`

**Why now:** Pass 30 is merged with green PR and post-merge `main` CI, but
production deploy remains blocked by dirty/diverged prod-local state. The next
highest customer-trust issue from dashboard review is the analytics page
presenting current-state or estimated metrics as real-time measured uptime and
bandwidth. Plan review also found a P1 analytics data-isolation gap: malformed
impression rows can carry the caller's `organizationId` while pointing at
another tenant's content, playlist, or display IDs, and current analytics
relation lookups resolve those related names by ID only.

**New primitives introduced:** none. This pass only adds optional provenance
metadata to existing analytics response shapes, tenant predicates to existing
relation lookups, and updates existing dashboard copy/labels. No migration,
route, module, queue, realtime path, notification path, MCP tool, Hermes skill,
provider spend path, or production process.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-analytics-truthfulness-pass-31.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch customer-copy/UX and API-contract/backcompat reviewers.
- [x] Capture plan-review findings before test edits.
- [x] Add failing middleware tests for analytics provenance.
- [x] Add failing middleware tests for analytics tenant-isolated relation lookups.
- [x] Add failing web tests for customer-facing truthfulness.
- [x] Implement analytics DTO provenance and dashboard copy/label updates.
- [x] Run multiple subagent diff reviews before broader verification.
- [x] Run focused middleware and web tests.
- [x] Run broader verification.
- [ ] PR, CI, merge if green.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far:**
- Drift evidence: `AnalyticsService.getDeviceMetrics` simulates category
  uptime from device inventory, `getBandwidthUsage` estimates transfer from
  content sizes and device count, while the dashboard labels the page as
  real-time performance metrics, shows a `System Uptime` KPI, and charts
  bandwidth as `MB/s`.
- Plan-review evidence: two read-only reviewers found misleading real-time,
  uptime, bandwidth, views/shares/unique-device/top-engagement copy; stale web
  analytics types; and analytics relation lookups that need organization
  predicates before returning related names.
- TDD red evidence: focused middleware analytics tests failed on missing
  provenance fields and cross-tenant content/playlist/proof-of-play name
  redaction; focused web analytics tests failed on `System Uptime`, `Device
  Uptime Timeline`, real-time analytics copy, `MB/s`, views/shares/unique-device
  CSV labels, and old chart titles.
- Focused green evidence: middleware analytics service/proof-of-play suites
  passed 55/55; web analytics page suite passed 12/12.
- Diff review findings fixed: usage-trends raw SQL now joins `Content` by both
  content ID and organization ID; proof-of-play relation sanitization fails
  closed when relation `organizationId` is absent; realtime device-status events
  no longer render a stale analytics `Updated Ns ago` freshness claim; frontend
  analytics types now expose honest required aliases with legacy fields optional
  for response compatibility; usage trends include an `other` bucket and clearer
  reported-content-type copy.
- Post-review focused green evidence: middleware analytics service/proof-of-play
  suites passed 57/57; web analytics page suite passed 13/13.
- Follow-up backend and frontend diff reviewers both returned CLEAN.
- Broader local verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/analytics/analytics.controller.spec.ts src/modules/analytics/analytics.service.spec.ts src/modules/analytics/proof-of-play.service.spec.ts` passed 70/70.
  - `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/analytics/__tests__/analytics-page.test.tsx src/lib/hooks/__tests__/useAnalyticsData.test.ts` passed 28/28.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` passed.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` passed.
  - `pnpm --filter @vizora/middleware test -- --runInBand` passed 146 suites / 2930 tests.
  - `pnpm --filter @vizora/web test -- --runInBand` passed 96 suites / 1045 tests with unrelated existing React `act()` warnings.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint ...changed analytics files...` passed with 0 errors / 0 warnings; only the ESLint config deprecation notice remains.
  - `pnpm security:no-hardcoded-jwts` passed.
  - `npx nx build @vizora/middleware --skip-nx-cache` passed with existing webpack dependency warnings.
  - `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web --skip-nx-cache` passed with existing Next middleware/proxy and TS project-reference warnings.
  - `git diff --check` passed with CRLF warnings only.

---

## Completed: Realtime Widget Secret Boundary Pass 30 (2026-06-01)

**Branch:** `feat/customer-readiness-pass-30`

**Why now:** Pass 29 fixed widget truthfulness and HTTP response redaction, but security review found the realtime/device path still builds playlist payloads from raw content metadata. A generic API widget can therefore leak saved API headers to display clients even though dashboard/API responses are redacted.

**New primitives introduced:** one realtime-local device payload sanitizer. No new database model, migration, route, queue, realtime room model, MCP tool, Hermes skill, provider spend path, or production process.

**Hermes-first analysis:** not applicable to runtime delivery code. Official Hermes bundled skills and the current awesome-Hermes ecosystem do not provide a reusable NestJS/Socket.IO payload sanitizer; this is an in-process Vizora secret-boundary concern and must stay in the realtime service.

**Plan/design:** `docs/plans/2026-06-01-realtime-widget-secret-boundary-pass-30.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch customer, performance, and architecture/security reviewers for the next pass.
- [x] Select the highest-risk bounded target from review: generic API widget header leakage through realtime/device payloads.
- [x] Add failing realtime tests for cached, primary, fallback, update, initial-state, and layout metadata redaction.
- [x] Implement realtime-side payload sanitizer and wire existing delivery paths.
- [x] Run focused tests.
- [x] Run multi-subagent review before broader verification.
- [x] Run broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Evidence so far:**
- Drift evidence: middleware HTTP responses redact generic API widget headers, but `realtime/src/services/playlist.service.ts` and `realtime/src/gateways/device.gateway.ts` still copy raw `item.content.metadata` into device-bound payloads.
- TDD red: focused realtime specs failed on raw `Bearer live-secret` / `live-api-key` values in cached playlists, DB playlists, fallback playlists, admin-updated playlists, initial-state payloads, direct `playlist:update` emissions, and layout metadata.
- Focused green after implementation: `pnpm --filter @vizora/realtime test -- --runInBand --runTestsByPath src/services/playlist.service.spec.ts src/gateways/device.gateway.spec.ts` passed 128/128.
- Review findings fixed: stale pending playlist replay now sanitizes Redis payloads on read/requeue, and generic API widget `widgetConfig` is stripped entirely from device-bound metadata so query-string secrets do not survive. Focused specs now pass 129/129.
- Final follow-up review: security and realtime/display reviewers both returned CLEAN.
- Broader local verification: full realtime Jest passed 12 suites / 285 tests; `npx nx build @vizora/realtime --skip-nx-cache` passed with existing third-party webpack warnings; `pnpm security:no-hardcoded-jwts` passed; changed-file ESLint exited 0 with existing warnings; `git diff --check` passed with CRLF warnings only.
- PR #159 merged as `47af00d11dfe026a701386215059d6b8a86dbe0f`. PR CI passed audit, build, lint, security, test, and e2e. Post-merge `main` CI run `26764596096` also passed build, test, security, lint, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy: `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main` is `47af00d11dfe026a701386215059d6b8a86dbe0f`, the checkout is 17 commits ahead / 109 behind with 72 dirty/untracked entries, and many ops/Hermes PM2 jobs are stopped. Core probes: middleware 200, web 200, realtime `/health` 404.

---

## Completed: Widget Truthfulness Pass 29 (2026-06-01)

**Branch:** `feat/widget-truthfulness-pass-29`

**Why now:** Pass 28 is merged with green PR and post-merge `main` CI, but production deploy remains blocked by dirty/diverged prod-local state. The next highest customer-trust issue from the dashboard review is widgets saving sample or stale data while reporting success.

**New primitives introduced:** one server-only optional strict-fetch mode on existing widget data sources, plus dashboard schema normalization for existing widget type metadata. No new database model, migration, process, queue, realtime path, MCP tool, Hermes skill, provider spend path, or deployment primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-06-01-widget-truthfulness-pass-29.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Drift-check widget create/update/runtime behavior.
- [x] Run plan review before implementation.
- [x] Add failing service/data-source tests for no sample/stale widget saves.
- [x] Add failing dashboard tests for schema normalization, disabled fallback types, and error toasts without false success.
- [x] Implement strict live-data fetch path for saved widgets.
- [x] Fix dashboard schema handling, fallback type behavior, and refresh pending state.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence so far:**
- TDD red: focused middleware widget/data-source suite failed because strict mode did not exist, data sources returned sample data, create/update saved fallback or stale HTML, and refresh wrapped provider failure as `BadRequestException`.
- TDD red: focused web widget page test failed because backend JSON schema rendered as raw `type/properties/required`, fallback catalog entries were creatable, refresh had no pending state, and create relied on a swallowed reload.
- Focused green after implementation: middleware widget/data-source suite 158/158; web widgets page 14/14.
- Review findings fixed: generic API widget headers are redacted from content responses while preserving stored secrets on redacted save-back; RSS strict mode now uses the shared SSRF guard with redirect and body-size checks; weather strict mode validates units; widget update/refresh writes are tenant-scoped; fallback widget types are disabled; refresh state is per-widget; required schema fields gate create/update.
- Final review: backend and frontend subagents both returned CLEAN.
- Final focused evidence: middleware widget/data-source suite passed 165/165; widgets page suite passed 16/16. Post-cleanup `content.service.spec.ts` passed 110/110.
- Broader evidence: middleware full Jest passed 146 suites / 2920 tests; web full Jest passed 96 suites / 1041 tests. Middleware and web `tsc --noEmit` passed. `pnpm security:no-hardcoded-jwts` passed. `pnpm build:middleware` passed with existing webpack warnings. `pnpm build:web` passed with local required `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, and memory env; the first web build without `NEXT_PUBLIC_SOCKET_URL` correctly failed the production CSP guard. Changed-file ESLint exited 0 with non-blocking existing `any` warnings in the widgets page. `git diff --check` passed with CRLF warnings only.
- PR #157 merged as `a52d3f4daa59c386cd85e58fee2c0351941fb707`. PR CI passed audit, build, lint, security, test, and e2e. Post-merge `main` CI run `26760099592` also passed lint, build, security, test, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy: `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main` is `a52d3f4daa59c386cd85e58fee2c0351941fb707`, the checkout is 105 commits behind / 17 ahead with 72 dirty/untracked entries, and many ops/Hermes PM2 jobs are stopped. Core probes: middleware 200, web 200, realtime `/health` 404.

---

## Completed: Content Tag Filter Trust Pass 28 (2026-06-01)

**Branch:** `feat/customer-readiness-pass-28`

**Why now:** Pass 27 is merged with green post-merge `main` CI, but production
deploy remains blocked by dirty/diverged prod-local state. The next bounded
customer-dashboard trust gap still present in current code is the content
library's tag filter: it shows hardcoded `Marketing`, `Seasonal`, `Featured`,
and `Archive` choices even though Vizora has tenant-scoped `Tag`/`ContentTag`
data and server-side `tagNames` filtering.

**New primitives introduced:** one content-module read endpoint,
`GET /api/v1/content/tags`, one web API client method, and a `tagIds`
content-list query filter. No new database model, migration, process, queue,
realtime path, MCP tool, Hermes skill, provider spend path, or deployment
primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan/design:**
`docs/plans/2026-06-01-content-tag-filter-trust-pass-28.md`

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Reconcile backlog/current state after Pass 27.
- [x] Add failing middleware tests for tenant-scoped content tag listing.
- [x] Add failing web tests for real content-tag filter options.
- [x] Implement the content tag list endpoint and web API client method.
- [x] Replace hardcoded dashboard tag filters with fetched real tags.
- [x] Run multi-subagent review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge if green.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence so far:**
- TDD red: middleware content tests failed on missing
  `ContentService.listContentTags` / `ContentController.listContentTags`; web
  content test failed because `apiClient.getContentTags` was never called.
- Implementation: added tenant-scoped `GET /api/v1/content/tags`, web API
  client support, and content-library tag filter loading/error/empty states.
  Removed the hardcoded `Marketing` / `Seasonal` / `Featured` / `Archive`
  filter source.
- Regression fix: initial tag metadata loading now keeps the empty selected
  tag-name value stable, so mounting the content page does not duplicate the
  first content fetch.
- Focused web evidence:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/content/__tests__/content-page.test.tsx`
  passed 43/43.
- Review findings fixed: content tag usage counts now filter the counted
  content relation by `organizationId`; dashboard tag filtering now sends
  `tagIds` so comma-bearing tenant tag names keep working; folder content
  queries now forward `tagIds` as well.
- Focused post-review evidence:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/content/content.service.spec.ts src/modules/content/content.controller.spec.ts src/modules/content/dto/content-query.dto.spec.ts src/modules/folders/folders.controller.spec.ts`
  passed 196/196.
- Focused post-review web evidence:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/content/__tests__/content-page.test.tsx src/lib/api/__tests__/content.test.ts`
  passed 45/45.
- Broader evidence: `pnpm --filter @vizora/web test -- --runInBand` passed
  96 suites / 1035 tests; `pnpm --filter @vizora/middleware test -- --runInBand`
  passed 143 suites / 2892 tests. `tsc --noEmit` passed for middleware and
  web. Changed-file ESLint exited 0 with existing warnings in touched files.
  `npx nx build @vizora/middleware --skip-nx-cache` passed with existing
  webpack warnings; `npx nx build @vizora/web --skip-nx-cache` passed with the
  existing Next middleware/proxy warning. `git diff --check` and
  `pnpm security:no-hardcoded-jwts` passed.
- PR #156 merged as `ef12326737cbbe8133148af97468607cc34528c4`. Post-merge
  `main` CI passed. Deployment was not performed because the same dirty/diverged
  prod checkout gate remained blocked.

---

## Completed: Playlist Publish Trust Pass 27 (2026-06-01)

**Branch:** `feat/playlist-publish-trust-pass-27` -> PR #154 -> `main`

**Why now:** Pass 26 is merged with green post-merge `main` CI, but production
deploy remains blocked by dirty/diverged prod-local state. The next
customer-trust blocker from the Pass 26 dashboard review is the playlist card's
`Publish` action claiming success even though it only PATCHes the playlist name
and does not put anything on a screen.

**New primitives introduced:** none. This pass reuses the playlists dashboard,
existing loaded display list, `apiClient.bulkAssignPlaylist`, middleware display
bulk assignment endpoint, and realtime display notification path.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Drift-check playlist publish action and existing display assignment path.
- [x] Write failing tests for fake publish removal and real device assignment.
- [x] Implement assignment modal and bulk assignment through existing APIs.
- [x] Run focused playlist tests.
- [x] Run multi-vector review before broader verification.
- [x] Run broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-playlist-publish-trust-pass-27.md`

**Local evidence:**
- TDD red: playlist tests failed because the card's `Publish` action called
  `updatePlaylist(playlist.id, { name: playlist.name })` immediately, never
  opened a device-targeting flow, and still claimed publish success when no
  display assignment happened.
- Implementation: playlist cards now use `Assign`; the modal selects target
  devices and calls `apiClient.bulkAssignPlaylist`. It blocks empty playlists,
  device-list loading, device-list load failure, and zero paired devices. The
  success toast reports the backend `{ updated }` assignment count and adds
  non-online device copy instead of implying live delivery. Already-assigned
  devices render read-only, and close/selection changes are guarded while an
  assignment is in flight.
- Status-model follow-up: frontend `DisplayStatus` now matches backend reality
  (`online | offline | pairing | error`), realtime event/device page types
  propagate it, and `DeviceStatusIndicator` renders `Pairing` explicitly.
- Review: customer-trust/UX reviewers initially found over-promising delivery
  copy, misleading already-assigned checkboxes, false no-device messaging while
  devices load/fail, in-flight close ambiguity, non-online status gaps, and
  in-flight selection drift. All were fixed and final UX review was CLEAN.
  Runtime/API reviewers were CLEAN throughout: assignment uses the existing
  `bulkAssignPlaylist` API, backend auth/tenant checks remain unchanged, and no
  parallel realtime/delivery path was added.
- Verification: focused playlist suite 22/22 pass; focused playlist +
  realtime-events + status-indicator suites 47/47 pass; status propagation
  reviewer also ran 4 focused suites / 64 tests pass; web `tsc --noEmit` pass;
  changed-file ESLint exits 0 with existing warnings only; full web Jest suite
  96 suites / 1033 tests pass; web production build pass with explicit local
  API/socket env and memory env; repo JWT secret guard pass; `git diff --check`
  pass with CRLF warnings only.
- Browser evidence: local Next production server on port 3001 with browser-
  mocked `/api/v1` responses opened `/dashboard/playlists`, showed the
  assignment modal and non-online copy, submitted `{ displayIds: ['display-2'],
  playlistId: 'playlist-1' }`, displayed the non-online assignment toast, and
  recorded zero page errors. Scratch screenshots were not committed.
- PR #154 merged as `cd1e7681d86f29ce89f0c7fe4d8828d477d81268`. PR CI passed
  audit, build, lint, security, test, and e2e. Remote feature branch was deleted
  manually because `gh pr merge` merged remotely but could not check out local
  `main` while `C:/projects/vizora` had `main` checked out.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  its local `origin/main` is stale at `84e572f2ee0c86230ef42b0817266a1a8a1f2e43`,
  and the checkout remains 17 commits ahead / 96 behind that stale ref with many
  tracked and untracked local changes. Core prod probes remain up: middleware
  200, web 200; realtime `/health` returns the known 404. Many ops/agent PM2
  jobs remain stopped; no services were restarted.

---

## Completed: Dashboard Bulk-Action Safety Pass 26 (2026-06-01)

**Branch:** `feat/customer-dashboard-pass-26`

**Why now:** After Pass 25 merged with green CI, the next customer-dashboard
analysis found multiple customer trust and performance gaps. The safest bounded
first build target is destructive device bulk-action safety: currently device
bulk delete fires immediately, bulk action toasts use selected row counts rather
than backend result counts, and the shared confirmation dialog closes before
async destructive actions finish.

**New primitives introduced:** none. This pass reuses existing dashboard client
pages, `ConfirmDialog`, display bulk endpoints, and API client methods.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch customer UX, frontend performance, and action-safety reviewers.
- [x] Record Pass 26 findings and choose a bounded first build target.
- [x] Write failing tests for async confirmation and device bulk-action safety.
- [x] Implement shared confirmation pending state.
- [x] Implement device bulk-delete confirmation and backend count toasts.
- [x] Run focused tests.
- [x] Run multi-vector review before broader verification.
- [x] Run broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-dashboard-bulk-action-safety-pass-26.md`

**Local evidence:**
- TDD red: shared confirmation test failed because `onClose` fired before an
  async confirm resolved; device tests failed because bulk delete called the API
  before confirmation and bulk action toasts used selected row counts instead of
  backend result counts.
- Implementation: `ConfirmDialog` now awaits async confirm handlers, disables
  actions while pending, keeps the dialog open until success, resets pending
  state before close so reopen is usable, and exposes `role="dialog"` with
  modal label/description semantics. Device bulk delete now opens a confirmation
  dialog, and device bulk delete/playlist/group toasts use `{ deleted }`,
  `{ updated }`, and `{ added }` counts returned by the backend.
- Review: initial destructive-action and runtime reviewers both found a real
  high issue where the shared dialog could reopen with buttons permanently
  disabled; fixed with a reopen regression test. Re-review from both vectors was
  CLEAN, with residual risk limited to no full browser/aXe focus-trap pass and
  existing fire-and-forget ConfirmDialog consumers outside this scope.
- Verification: focused `ConfirmDialog` suite 11/11 pass; focused devices page
  suite 17/17 pass; full web Jest suite 96 suites / 1023 tests pass; web
  `tsc --noEmit` pass; changed-file ESLint exits 0 with existing warnings only;
  web production build pass with explicit local `NEXT_PUBLIC_SOCKET_URL`,
  `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, and memory env; repo JWT secret guard
  pass; `git diff --check` pass with CRLF warnings only.
- PR #152 merged as `84e572f2ee0c86230ef42b0817266a1a8a1f2e43`. PR CI passed
  audit, build, lint, security, test, and e2e. Post-merge `main` CI run
  `26749346574` passed build, security, test, lint, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  `origin/main` is `84e572f2ee0c86230ef42b0817266a1a8a1f2e43`, and the
  checkout is 17 commits ahead / 96 behind with many tracked and untracked
  local changes. Core prod probes remain up: middleware 200, web 200; realtime
  `/health` returns the known 404.

---

## Completed: Realtime Status Catch-Up Performance Pass 25 (2026-06-01)

**Branch:** `feat/performance-readiness-pass-25`

**Why now:** Pass 24 is merged with green post-merge `main` CI, but production
deploy remains blocked by dirty/diverged prod-local state. The next
repo-side performance review found dashboard reconnect catch-up emits one socket
event per display even though the dashboard already handles batch status events.

**New primitives introduced:** none. This reuses the existing realtime gateway,
Socket.IO room model, and `device:status:batch` client event path.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch performance reviewers for upload, pairing/status,
  streaming/realtime, and dashboard bottlenecks.
- [x] Drift-check realtime catch-up code and dashboard batch handler.
- [x] Write focused failing realtime tests proving catch-up emits one batch.
- [x] Implement batched dashboard status catch-up.
- [x] Run multi-vector review before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence:**
- TDD red: realtime catch-up tests failed because large/small fleets still
  emitted one `device:status` socket event per display; web hook test failed
  because `useRealtimeEvents` ignored `device:status:batch`.
- Implementation: realtime dashboard catch-up now emits one capped
  `device:status:batch` payload with the same per-device fields; the dashboard
  hook subscribes to batch updates and fans them through the existing
  single-update handler so Devices page row state remains current.
- Review: realtime correctness/security reviewer CLEAN; dashboard
  compatibility reviewer initially found the missing `useRealtimeEvents` batch
  listener, then re-reviewed the fixed diff as CLEAN. Local Claude Code review
  was CLEAN before the web compatibility fix but the post-fix Claude rerun
  exited without usable output, so it is not counted as evidence.
- Verification: focused realtime catch-up test 4/4 pass; full gateway spec
  98/98 pass; full realtime suite 277/277 pass; focused web realtime hook suite
  18/18 pass; full web suite 1017/1017 pass; realtime production build pass;
  web production build pass with explicit local `NEXT_PUBLIC_SOCKET_URL`,
  `NEXT_PUBLIC_API_URL`, and `BACKEND_URL`; changed-file ESLint exits 0 with
  pre-existing warnings only; repo security JWT guard pass; `git diff --check`
  pass with CRLF warnings only.
- Known unrelated verification noise: existing React `act(...)` warnings in
  broader web suites; realtime/web builds show known package/source-map and
  Next middleware deprecation warnings. The first realtime build attempt failed
  with a Windows file-lock in `@vizora/database:build` while tests were running
  in parallel; sequential rerun passed.
- PR #150 merged as `327a642b426e02045d6e02d60439efa89d6f4755`. PR CI passed
  audit, build, lint, security, test, and e2e. Post-merge `main` CI run
  `26745939486` passed build, lint, security, test, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  `origin/main` is `327a642b426e02045d6e02d60439efa89d6f4755`, the checkout is
  17 commits ahead / 93 behind with many tracked and untracked local changes.
  Core prod probes remain up: middleware 200, web 200; realtime `/health`
  returns the known 404. PM2 shows middleware, realtime, and web online.

**Plan/design:**
`docs/plans/2026-06-01-realtime-status-catchup-performance-pass-25.md`

---

## Completed: Analytics Empty-State Trust Pass 24 (2026-06-01)

**Branch:** `feat/analytics-empty-state-trust-pass-24`

**Why now:** Pass 23 is merged and `main` CI is green, but production deploy
remains blocked by dirty/diverged prod-local state. The next bounded
customer-dashboard trust issue is analytics failures being presented as "No
Data Yet."

**New primitives introduced:** none. This uses the existing analytics API
client hooks and dashboard page.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from `origin/main`.
- [x] Drift-check analytics dashboard hooks, page states, and tests.
- [x] Write focused failing tests for analytics API failures vs true empty
  responses.
- [x] Implement explicit section/global analytics failure states.
- [x] Run reviewer pass before broader verification.
- [x] Run focused and broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Local evidence:**
- TDD red: analytics hook/page tests failed before implementation because rejected
  API calls were treated as empty/mock states and summary failure rendered "No
  Data Yet."
- Implementation: `useAnalyticsData` now preserves successful empty arrays as
  true empty state, reports rejected calls as errors, uses user-safe error
  messages, and ignores stale date-range responses. The analytics page now shows
  global and section-level unavailable states and suppresses "No Data Yet" on
  failed loads.
- Review: UX/accessibility/test reviewer CLEAN; hook/API-state reviewer CLEAN.
- Verification: focused hook tests 15/15 pass; focused analytics page tests 9/9
  pass; analytics sweep 34/34 pass; full web Jest 1016/1016 pass; web
  production build pass; changed-file ESLint pass; repo security JWT guard pass;
  `git diff --check` pass with CRLF warnings only.
- Known unrelated verification noise: existing React `act(...)` warnings in
  broader web suites; stale package lint scripts still fail on Next 16/Windows,
  so equivalent ESLint commands were run directly.
- PR #148 merged as `56ba589a2babc1cad4b5d4ce4518bb58266ef673`. PR CI passed
  audit, build, lint, security, test, and e2e. Post-merge `main` CI run
  `26742702487` passed build, lint, security, test, and e2e.
- Deployment was not performed. Read-only prod gate still blocks deploy:
  `/opt/vizora/app` is on `bb76aa1838740bff5b58623dfef7a906d44f46a6`,
  `origin/main` is `56ba589a2babc1cad4b5d4ce4518bb58266ef673`, the checkout is
  17 commits ahead / 91 behind with many tracked and untracked local changes.
  Core prod probes remain up: middleware 200, web 200; realtime `/health`
  returns the known 404.

**Plan/design:**
`docs/plans/2026-06-01-analytics-empty-state-trust-pass-24.md`

---

## Completed: Schedule Trust Polish Pass 23 (2026-06-01)

**Branch:** `feat/customer-dashboard-improvements-pass-23`

**Why now:** PR #145 merged with green post-merge `main` CI, but production
deployment remains blocked by dirty/diverged prod-local state. The next
customer-dashboard analysis found the schedules page is the highest-value
bounded customer-facing target: inactive schedules are shown as active and the
conflict-warning UI is never populated.

**New primitives introduced:** none. This uses the existing schedules page and
existing `apiClient.checkScheduleConflicts` endpoint.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #145 after PR CI green and confirm post-merge `main` CI.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Review current schedule UI/API/runtime evidence.
- [x] Write focused failing tests for inactive status badges and conflict
  warnings.
- [x] Implement schedule status and conflict-warning fixes.
- [x] Address first review pass: group-target conflict false negatives, missing
  candidate date range, overnight schedule conflict/active math, raw conflict
  times, silent conflict-check failures, and timezone test underfit.
- [x] Address second review pass: adjacent-day all-day false positives,
  duplicate already-verified device conflict checks, and missing live-region
  semantics for dynamic conflict states.
- [x] Run final multi-subagent code review before broader tests.
- [x] Run focused and broader verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-schedule-trust-polish-pass-23.md`

**Implementation notes**
- [x] Schedule list badges now render `Active`/`Inactive` from actual
  `isActive`/`active` state.
- [x] Create/edit modal now calls the existing conflict endpoint when target,
  days, and time are present; preview calls include candidate `startDate` and
  edit `endDate` when available.
- [x] Conflict warnings now format backend minute values as `HH:MM`, expose
  `role="status"`, and show `role="alert"` when conflicts cannot be verified.
- [x] Device-target conflict preview caches request/results per candidate so
  adding another selected device does not re-check already verified devices.
- [x] Middleware conflict detection now checks display-group schedules against
  direct-display and overlapping-group schedules under the same organization.
- [x] Middleware weekly time-window math now handles schedules crossing
  midnight and avoids adjacent-day all-day false positives.

**Focused verification**
- [x] Web schedule page test passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/schedules/__tests__/schedules-page.test.tsx`
  - 20 tests / 1 suite.
- [x] Middleware schedule service test passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/schedules/schedules.service.spec.ts`
  - 37 tests / 1 suite.

**Review gate**
- [x] Schedule/runtime reviewer final pass: clean after group overlap,
  overnight, and all-day-adjacency fixes.
- [x] Dashboard UX/test reviewer final pass: clean after formatted conflict
  times, explicit verification failure state, device-preview dedupe, and
  live-region semantics.

**Broader verification**
- [x] Middleware schedules sweep passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=schedules`
  - 2 suites / 55 tests.
- [x] Web schedules sweep passed:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=schedules`
  - 1 suite / 20 tests.
- [x] Full web Jest suite passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  - 96 suites / 1005 tests. Existing unrelated React `act(...)` warnings
    remain in other dashboard suites.
- [x] Full middleware Jest suite passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  - 143 suites / 2887 tests / 1 snapshot.
- [x] Middleware build passed:
  `npx nx build @vizora/middleware --skip-nx-cache`
  - Build completed with known webpack optional-dependency warnings.
- [x] Web production build passed with required local build env:
  `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web --skip-nx-cache`
  - Initial run without `NEXT_PUBLIC_SOCKET_URL` failed at the expected
    production CSP env precondition; rerun with env passed.
- [x] ESLint completed with no errors:
  `ESLINT_USE_FLAT_CONFIG=false npx eslint --ext .ts,.tsx middleware/src realtime/src`
  - 0 errors / 195 warnings. Warnings are pre-existing broad repo warnings.
- [x] JWT secret guard passed:
  `pnpm security:no-hardcoded-jwts`
  - No hardcoded JWT-looking tokens found.
- [x] Whitespace check passed:
  `git diff --check`
  - Exit 0; Windows CRLF conversion warnings only.

**Current merge/deploy state**
- [x] PR #146 merged at
  `b373760f373e31e0f0c3fb76f9b0ddef7c396e74`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI run `26739722438` completed successfully: security,
  lint, build, test, and e2e all green.
- [x] PR #145 merged at
  `89a33b99d15abe82d99d1f767e6d5475f320c155`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI run `26737775963` completed successfully: security,
  lint, build, test, and e2e all green.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, remote `main` is
  `b373760f373e31e0f0c3fb76f9b0ddef7c396e74`, and prod is
  `ahead 17, behind 89` with many tracked edits and untracked files. Core PM2
  services are online; middleware `/api/v1/health` and web `/` returned 200,
  while realtime `/health` remains 404. No
  production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

**Customer dashboard analysis**
- [x] Schedules page trust: inactive schedules shown as active.
- [x] Schedules page trust: conflict warning panel is dead.
- [x] Schedules page trust: timezone selector implies schedule timezone support,
  while runtime uses display timezone.
- [x] Analytics empty states can make fetch errors look like "No Data Yet".
- [x] Analytics labels need more signage-specific wording.
- [x] Content tag filters are hardcoded instead of metadata-driven.
- [x] AI Designer CTA can overpromise when backend capability is unavailable.
- [x] Performance backlog: dashboard org broadcasts inspect device sockets,
  playlist fan-out is unbounded, content impressions write synchronously,
  dashboard status fetches up to 1000 displays, response sanitization is
  CPU-heavy, upload has multiple full-file passes, and pairing active-list scans
  Redis keyspace.

---

## Completed: Security Token Guard Pass 22 (2026-06-01)

**Branch:** `feat/customer-dashboard-improvements-pass-22`

**Why now:** PR #144 merged with green PR checks and green post-merge `main`
CI, but production deployment remains blocked by a dirty/diverged checkout. The
next read-only customer/performance/release review found several valid targets;
the smallest high-severity repo-side gap is committed long-lived JWT-looking
tokens in manual verification scripts plus no blocking CI guard for that class.

**New primitives introduced:** one repository-local security scan script,
`scripts/security/check-no-hardcoded-jwts.js`. No new runtime service, route,
database model, migration, agent, MCP tool, Hermes skill, provider, or
infrastructure primitive.

**Hermes-first analysis:** not applicable. This pass does not add or modify
business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Dispatch read-only customer UX, backend/performance, and release/security
  reviewers after PR #144.
- [x] Select highest-value bounded target.
- [x] Add red hardcoded-JWT guard and confirm it catches existing committed
  tokens.
- [x] Replace manual-script committed JWTs with required environment variables.
- [x] Wire the guard into CI security workflows before advisory dependency
  audit.
- [x] Address first review pass: stage/include the new guard script at commit
  time, derive `test-content-delivery` playlist data from local API state or
  env, and make thumbnail device-token validation fail fast/nonzero.
- [x] Address re-review pass: support nested playlist list envelopes and
  document `VIZORA_TEST_*` variables in `.env.example` and `CLAUDE.md` (no
  tracked `AGENTS.md` exists in this worktree).
- [x] Address final manual-script review: use direct `/api/v1` middleware
  paths and make thumbnail/content verification failures exit nonzero.
- [x] Address final response-shape review: unwrap current response envelopes in
  older manual scripts and use the actual `/api/v1/displays` status source.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader verification.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-06-01-security-token-guard-pass-22.md`

**Reviewer target synthesis**
- [x] Customer UX reviewer found valid current dashboard issues: inactive
  schedules shown as active, dead schedule conflict warning UI, fictional
  schedule timezone selector, hardcoded content tag filters, synthetic
  analytics labels, and AI Designer CTA prominence while backend capability is
  unavailable.
- [x] Backend/performance reviewer found valid performance targets: dashboard
  org broadcasts still inspect device sockets, playlist fan-out can send
  unbounded per-display internal requests, content impressions write
  synchronously, dashboard status fetches up to 1000 displays, response
  sanitization is CPU-heavy, upload does multiple full-file passes, and pairing
  active-list scans Redis keyspace.
- [x] Release/security reviewer found valid launch-readiness targets: CI E2E is
  still thin for customer-1, dependency audit is advisory, long-lived JWTs were
  committed in manual scripts, prod deploy is unsafe until prod checkout is
  reconciled, and customer-1 operator gates remain open.
- [x] Selected first bounded target for this pass: committed JWT cleanup plus a
  blocking CI guard, because it is high-severity, repo-side, testable, and does
  not require operator credentials.

**Operator-only residual**
- [ ] If any removed token was ever valid in shared, staging, or production-like
  environments, revoke/rotate it outside the repo. This pass prevents future
  commits but cannot invalidate already-issued tokens.

**Review gate**
- [x] Security/CI reviewer CLEAN after staging follow-up. Confirmed the guard
  script is staged, package script is wired, both CI security workflows run it
  before advisory audit, `.env.example` / `CLAUDE.md` document the
  `VIZORA_TEST_*` inputs, no full JWT-shaped tracked tokens remain, and diff
  check passes.
- [x] Manual-script/runtime reviewer CLEAN after follow-ups. Confirmed direct
  middleware paths use `/api/v1`, `test-content-delivery` uses
  `/api/v1/displays` and nested playlist envelopes, `test-end-to-end-streaming`
  unwraps current auth/content/playlist response shapes, and
  `test-thumbnails-http` unwraps paginated content and exits nonzero on check
  failures.

**Verification**
- [x] Hardcoded JWT guard passed:
  `pnpm security:no-hardcoded-jwts`.
- [x] Syntax checks passed:
  `node --check scripts/security/check-no-hardcoded-jwts.js`,
  `node --check realtime/test-content-delivery.js`,
  `node --check realtime/test-device-realtime.js`,
  `node --check realtime/test-end-to-end-streaming.js`,
  `node --check scripts/test-thumbnails-http.js`.
- [x] Diff hygiene passed: `git diff --check` and `git diff --cached --check`.
- [x] Realtime unit suite passed:
  `pnpm --filter @vizora/realtime test -- --runInBand` - 12 suites / 275 tests.

---

## Completed: Display Response Projection Pass 21 (2026-06-01)

**Branch:** `feat/customer-dashboard-improvements-pass-21`

**Why now:** PR #143 merged the shared dashboard socket pass and post-merge
`main` CI is green, but deployment remains blocked by dirty/diverged prod-local
state. A fresh customer/performance/release review found several valid next
targets; local drift-check also found the authenticated display API still
returns full Prisma `Display` rows, which can include hashed device JWTs,
pairing-code fields, and transient socket IDs. This pass closes that sensitive
response surface and reduces display list/detail payloads.

**New primitives introduced:** one shared Prisma display response projection
module. No new runtime service, route, database model, migration, agent, or
infrastructure primitive.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #143 after PR CI green and confirm post-merge `main` CI.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch read-only customer UX, backend/performance, and test/release
  readiness reviewers.
- [x] Drift-check display response shape against current code.
- [x] Select highest-value bounded target.
- [x] Write scoped plan/design before code.
- [x] Add focused failing display response projection tests.
- [x] Implement safe display list/detail/update projections.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #143 merged at
  `384b584054446547ec3d64a37f7f6839dc10ac39`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI for `384b584054446547ec3d64a37f7f6839dc10ac39`
  completed successfully: build, test, lint, security, and e2e all green.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, while its stale local
  `origin/main` is `1618f31f9e151ca394f4e0471e457267805415a9`; prod is
  `ahead 17, behind 77` with many tracked edits and untracked files. No
  production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

**Plan/design:**
`docs/plans/2026-06-01-display-response-projection-pass-21.md`

**Implementation notes**
- [x] Added `middleware/src/modules/displays/display-response.select.ts` with
  shared safe list/detail/embedded/member projections.
- [x] Updated display create/list/detail/update response paths to use explicit
  safe Prisma `select`s.
- [x] Updated display-group nested display responses to reuse the safe embedded
  projection.
- [x] Changed QR overlay update/delete service contracts to return the saved
  overlay config / `void` instead of re-reading and returning the display row.
- [x] Tightened pairing-service internal queries to select only the fields each
  path needs: token-only paired check, id/org status lookup, existing id/location
  read, and safe result fields on create/update.

**Review gate**
- [x] Security/API reviewer CLEAN after pairing follow-up. Confirmed response
  paths omit `jwtToken`, `pairingCode`, `pairingCodeExpiresAt`, and `socketId`;
  tenant/API conventions remain intact; QR overlay return shape matches web/API.
- [x] Regression/dashboard reviewer CLEAN except for expected low staging note:
  new selector file must be staged before commit. This will be closed at commit
  staging.

**Verification so far**
- [x] Red focused projection tests reproduced missing explicit safe selectors
  before implementation.
- [x] Focused display/pairing run passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/pairing.service.spec.ts src/modules/displays/displays.service.spec.ts src/modules/displays/displays.controller.spec.ts src/modules/display-groups/display-groups.service.spec.ts src/modules/displays/displays.service.bulk.spec.ts`
  - 5 suites / 137 tests.
- [x] Broader display/display-group unit run passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/pairing.service.spec.ts src/modules/displays/pairing.controller.spec.ts src/modules/displays/displays.controller.spec.ts src/modules/displays/displays.service.spec.ts src/modules/displays/displays.service.bulk.spec.ts src/modules/displays/displays.service.tag-events.spec.ts src/modules/display-groups/display-groups.service.spec.ts src/modules/display-groups/display-groups.controller.spec.ts`
  - 8 suites / 166 tests.
- [x] Middleware typecheck passed:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`.
- [x] Changed-file ESLint passed with only the existing ESLintRC deprecation
  notice:
  `ESLINT_USE_FLAT_CONFIG=false npx eslint ...`.
- [x] Middleware build passed:
  `npx nx build @vizora/middleware`; existing webpack warnings remain.
- [x] Full middleware unit suite passed:
  `pnpm --filter @vizora/middleware test -- --runInBand` - 143 suites /
  2,884 tests.
- [x] `git diff --check` passed with Windows CRLF warnings only.
- [x] PR #144 merged at
  `929b95764a96dcca2786a5e36606be457207f47b`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI run `26735439846` completed successfully: audit,
  build, e2e, lint, security, and test all green.
- [x] Post-merge prod deploy gate re-checked and remains blocked:
  `/opt/vizora/app` is dirty/diverged (`ahead 17, behind 77`) with many tracked
  edits and untracked files. No production pull, reset, stash, env edit, service
  restart, DB mutation, or deploy performed.

**Reviewer target synthesis**
- [x] Customer UX reviewer found valid current dashboard issues: inactive
  schedules shown as active, dead schedule conflict warning UI, hardcoded
  content tag filters, and synthetic analytics labels.
- [x] Backend/performance reviewer found a valid next performance target:
  dashboard-only org broadcasts still iterate device sockets and can trigger
  per-device DB checks.
- [x] Test/release reviewer found a larger release-gate target: middleware E2E
  currently gates only the agents suite and older specs still use `/api`.
- [x] Selected first bounded target for this pass: safe display response
  projections, because it is a small high-severity security/payload fix in a
  customer-facing API and does not require operator action.

---

## Completed: Dashboard Customer Improvements Pass 20 (2026-06-01)

**Branch:** `feat/dashboard-customer-improvements-pass-20`

**Why now:** PR #142 merged the content-list payload pass with green PR checks,
but production deployment remains blocked by a dirty/diverged production
checkout. The next autonomous step is to review the dashboard as a customer,
pick the highest-value repo-side improvement that is small enough to build,
test, review, merge, and keep deployment gated until prod state is safe.

**New primitives introduced:** one dashboard-scoped `SocketProvider` in the
existing web `useSocket` module. No new transport, gateway, event type,
process, backend route, agent, or deployment primitive.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #142 after full PR CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Dispatch read-only customer UX, backend/performance, and test/release
  readiness reviewers.
- [x] Reconcile tracker/backlog stale state after recent merges.
- [x] Select the highest-value buildable repo-side target.
- [x] Write scoped plan/design before code.
- [x] Add focused failing shared-socket tests.
- [x] Implement dashboard shared Socket.IO provider.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [x] PR, CI, merge. PR #143 merged at
  `384b584054446547ec3d64a37f7f6839dc10ac39`.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #142 merged at
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`; PR checks green for audit,
  build, e2e, lint, security, and test.
- [x] Post-merge `main` CI for `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`
  completed successfully.
- [x] PR #143 merged at
  `384b584054446547ec3d64a37f7f6839dc10ac39`; PR CI green for audit, build,
  e2e, lint, security, and test. Post-merge `main` CI for `384b584054` also
  completed successfully.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, while `origin/main` is
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`; prod is `ahead 17, behind 77`
  with many tracked edits and untracked files. No production pull, reset,
  stash, env edit, service restart, DB mutation, or deploy performed.

**Plan/design:**
`docs/plans/2026-06-01-dashboard-shared-socket-pass-20.md`

**Selected target**
- [x] Current-branch drift check confirmed several stale UX findings are
  already fixed on `origin/main` (multi-file upload queue, filtered content
  empty state, health page mock telemetry, and multi-device schedule creation).
- [x] Remaining buildable customer/performance target: share one dashboard
  Socket.IO connection across notification bell, device status context,
  page-level realtime hooks, and device preview instead of creating one client
  per hook instance.

**Focused verification**
- [x] Red/green shared-socket hook test added. Initial focused run failed
  because `SocketProvider` did not exist.
- [x] Multi-vector code review CLEAN after two reviewer passes:
  architecture/tenant/listener-isolation review and UX/release/regression
  review. Initial findings added missing listener-isolation, layout
  integration, tenant fallback, and custom-option fallback coverage; all were
  fixed before broader tests.
- [x] Focused web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/lib/hooks/__tests__/useSocket.test.ts src/lib/hooks/__tests__/useRealtimeEvents.test.ts src/app/dashboard/__tests__/dashboard-page.test.tsx src/app/dashboard/__tests__/dashboard-layout.test.tsx`
  (4 suites / 47 tests).
- [x] Web TypeScript passed:
  `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`.
- [x] Changed-file ESLint passed with warnings only:
  `ESLINT_USE_FLAT_CONFIG=false npx eslint web/src/lib/hooks/useSocket.ts web/src/lib/hooks/__tests__/useSocket.test.ts web/src/app/dashboard/layout.tsx web/src/app/dashboard/__tests__/dashboard-layout.test.tsx`
  (legacy explicit-`any` / test `require()` warnings only).
- [x] Full web Jest passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (96 suites / 1001 tests). Existing unrelated React `act(...)` warnings
  remain in older suites.
- [x] Web build passed:
  `$env:NODE_OPTIONS='--max-old-space-size=4096'; $env:NEXT_PUBLIC_SOCKET_URL='http://localhost:3002'; $env:NEXT_PUBLIC_API_URL='http://localhost:3000/api/v1'; $env:BACKEND_URL='http://localhost:3000'; npx nx build @vizora/web`.
- [x] `git diff --check` passed with CRLF normalization warnings only.

---

## Completed: Content List Payload Performance Pass 19 (2026-06-01)

**Branch:** `feat/content-list-payload-pass-19`

**Why now:** PR #141 merged playlist-builder server-side content search and CI
is green, but production deployment remains blocked by dirty/diverged prod
state. The next customer-visible performance gap is list payload size: root and
folder content-list endpoints still fetch full content rows even though the
dashboard cards need only summary fields.

**New primitives introduced:** no new runtime primitives. This pass adds a
shared content-list projection and uses the existing `GET /content/:id` detail
endpoint for modal-only dashboard hydration.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #141 after full CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Write scoped plan/design for content-list payload slimming.
- [x] Add focused failing middleware and web tests.
- [x] Implement backend list projection and frontend detail hydration.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [x] PR, CI, merge. PR #142 merged at
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #141 merged at
  `6fcc39deb60634037be37758843aa638dcf1cb3d`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] PR #142 merged at
  `80463b2aaad1c041d14e4cfe55ffcdae627b7b09`; PR CI green for audit, build,
  e2e, lint, security, and test.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is dirty and
  ahead/behind stale prod `origin/main`; no production pull, reset, stash, env
  edit, service restart, DB mutation, or deploy performed.

**Plan/design:**
`docs/plans/2026-06-01-content-list-payload-performance-pass-19.md`

**Review**
- [x] Backend/API/data-contract reviewer CLEAN: list projection keeps tenant
  scoping, valid Prisma select shape, envelope-compatible paginated response,
  and full-detail paths still use `findOne` / device-specific fetches.
- [x] Frontend reviewer found stale detail races, edit hydration gap, and
  repeated-detail request fanout. Fixed with request invalidation, pending
  request dedupe, edit detail hydration, pagination invalidation, and regression
  tests. Follow-up frontend re-review CLEAN.
- [x] Test/CI reviewer found the untracked helper risk and stale tracker counts.
  The helper will be staged with the commit; verification counts below are
  updated after final focused/broad runs.

**Verification**
- [x] Focused middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="content.service|folders.service"`
  (2 suites / 140 tests).
- [x] Focused web content dashboard tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/content/__tests__/content-page.test.tsx`
  (1 suite / 42 tests).
- [x] Full middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  (143 suites / 2879 tests).
- [x] Full web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (95 suites / 994 tests; existing unrelated React `act(...)` and jsdom
  navigation warnings remain).
- [x] TypeScript checks passed:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` and
  `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`.
- [x] Changed-file ESLint passed with warnings only:
  `npx eslint middleware/src/modules/content/content.service.ts middleware/src/modules/content/content-list-select.ts middleware/src/modules/folders/folders.service.ts web/src/app/dashboard/content/page-client.tsx web/src/app/dashboard/content/__tests__/content-page.test.tsx`
  (legacy explicit-`any` warnings remain in `page-client.tsx`).
- [x] Builds passed:
  `npx nx build @vizora/middleware`,
  `npx nx build @vizora/realtime`, and
  `npx nx build @vizora/web` with local public URL env vars.
- [x] `git diff --check` passed with CRLF warnings only.
- [x] Targeted Playwright content/folder E2E attempted:
  `npx playwright test e2e-tests/04-content.spec.ts e2e-tests/20-content-folders.spec.ts --reporter=list`
  failed 14/14 at auth fixture setup with `ECONNREFUSED ::1:3000`
  (`POST http://localhost:3000/api/v1/auth/register`). Docker Desktop is not
  available and no services are listening on ports 3000/3001/3002, so this is
  an environment failure before the changed content flows are exercised.

---

## In Progress: Dashboard Summary Performance Pass 15 (2026-05-31)

**Branch:** `feat/customer-dashboard-pass-15`

**Why now:** PR #137 merged server-side content-library pagination/filtering,
but the dashboard overview still risks all-page content/playlist refreshes just
to compute top-level counts. A customer with a real media library should see the
overview hydrate from aggregate counters and tiny recent-activity samples.

**New primitives introduced:** two aggregate fields on the existing analytics
summary response: `processingContent` and `activePlaylists`.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #137 after CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Write scoped plan/design for dashboard summary performance.
- [x] Collect multi-subagent customer/performance/security/test review
  findings before test gate.
- [x] Add focused failing tests.
- [x] Implement analytics-summary-backed dashboard overview.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Plan/design:**
`docs/plans/2026-05-31-dashboard-summary-performance-pass-15.md`

**Current merge/deploy state**
- [x] PR #137 merged at
  `7d32929678162e60ad7560f7c3cc81db4c9fc019`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is on `main` at
  `bb76aa1838740bff5b58623dfef7a906d44f46a6`, ahead 17 and behind 77 from
  `origin/main`, with tracked edits across Hermes scripts, seed templates,
  thumbnails, landing UI, Tailwind config, plus untracked operator approvals,
  docs, and preview assets. No production pull, reset, stash, env edit,
  service restart, DB mutation, or deploy performed.

**Review**
- [x] Pre-implementation customer/performance/security/test review found the
  next high-value repo-side dashboard/performance slice: replace overview
  all-page refreshes with analytics aggregates and bounded activity samples.
- [x] Backend contract/security review CLEAN: `/analytics/summary` remains
  tenant-scoped, envelope-compatible, and safe for `viewer` read access.
- [x] Frontend/runtime review found two blockers: missing server activity
  samples were not retried, and late summary refreshes could overwrite fresher
  realtime device counts. Both were fixed and regression-tested.
- [x] Test/CI review found `AnalyticsSummary` should keep backend-required
  fields required in web types and that viewer role metadata needed a test.
  Both were fixed.
- [x] Follow-up review CLEAN after fixes.

**Verification**
- [x] Focused middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="analytics.(service|controller)"`
  (2 suites, 47 tests).
- [x] Focused dashboard tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --runTestsByPath src/app/dashboard/__tests__/dashboard-page.test.tsx src/app/dashboard/__tests__/dashboard-server-page.test.tsx`
  (2 suites, 20 tests).
- [x] Broader dashboard web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard"`
  (22 suites, 303 tests; pre-existing React `act(...)` warnings remain).
- [x] Full middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  (143 suites, 2874 tests).
- [x] Full web tests passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (95 suites, 982 tests; pre-existing React `act(...)` and jsdom navigation
  warnings remain).
- [x] TypeScript passed:
  `pnpm --filter @vizora/web exec tsc --noEmit` and
  `pnpm --filter @vizora/middleware exec tsc --noEmit`.
- [x] Builds passed:
  `npx nx build @vizora/middleware`, `npx nx build @vizora/realtime`, and
  `npx nx build @vizora/web` with the standard local public URL env vars.
  The first realtime build attempt failed only because it ran concurrently with
  middleware build and Windows locked `packages/database/dist/generated/prisma`;
  sequential rerun passed.
- [x] Changed-file ESLint passed with warnings only; `git diff --check` passed
  with CRLF warnings only.

---

## Completed: Content Library Performance Pass 14 (2026-05-31)

**Branch:** `feat/customer-performance-pass-14`

**Why now:** PR #136 merged the real dashboard health/storage trust pass and CI
was green, but production deployment remains blocked by dirty/diverged prod
state. The next buildable customer-performance gap is the content library:
it still loads all content rows and filters client-side, which can become slow
or hit the pagination safety cap for real customer libraries.

**New primitives introduced:** bounded `search`, `dateRange`, and `tagNames`
content-list query parameters plus paged content-library dashboard state.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Merge PR #136 after full CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Write scoped plan/design for content-library server filtering and
  pagination.
- [x] Run multi-subagent pre-implementation review/analysis.
- [x] Add focused failing tests.
- [x] Implement backend query filters and web paged loading.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader affected verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #136 merged at
  `35609734a185366f981efc47246e46229836f22d`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] PR #137 merged at
  `7d32929678162e60ad7560f7c3cc81db4c9fc019`; CI green for audit, build, e2e,
  lint, security, and test.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is dirty and
  ahead/behind stale prod `origin/main`, with many local template/web/script
  changes and untracked operator/docs assets. No production pull, reset, stash,
  env edit, service restart, DB mutation, or deploy performed.

**Plan/design:**
`docs/plans/2026-05-31-content-library-server-filter-pagination-pass-14.md`

**Selected fix bundle**
- [x] Added tenant-scoped server filters for content library lists:
  `search`, `dateRange`, and `tagNames` now share the middleware DTO and
  Prisma where-builder for root and folder-scoped content.
- [x] Added a folder/content list index:
  `Content(organizationId, folderId, createdAt DESC)`.
- [x] Updated the dashboard content library to request bounded pages instead
  of fetching every content row before client-side filtering.
- [x] Preserved modal-only lazy loading for push/add-to-playlist option data.

**Review**
- [x] Pre-implementation review:
  customer/UX and backend/API reviewers confirmed the highest-value small
  gap was content-library server-side filtering/pagination. The UX reviewer
  inspected the main checkout instead of this worktree, so its comments were
  treated as directional and reconciled against local code truth.
- [x] Backend/API/data code review CLEAN. Residual risk accepted:
  legacy `metadata.tags` JSON fallback is exact-case while relation-backed
  tag filtering is case-insensitive.
- [x] Dashboard UX/performance review found and fixes landed for an unstable
  toast dependency refetch loop, stale pagination after deleting the only item
  on a later page, stale page/search fetch sequencing, and mobile paginator
  wrapping.
- [x] Targeted re-review CLEAN after the dashboard fixes.

**Verification**
- [x] Focused middleware tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="content-query.dto|content.service|content.controller|folders.service|folders.controller"`
  (10 suites / 352 tests).
- [x] Focused web content tests passed after final cleanup:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/content"`
  (1 suite / 35 tests).
- [x] Full middleware Jest passed:
  `pnpm --filter @vizora/middleware test -- --runInBand`
  (143 suites / 2873 tests).
- [x] Full web Jest passed:
  `pnpm --filter @vizora/web test -- --runInBand`
  (95 suites / 980 tests). Existing unrelated React `act(...)` and jsdom
  navigation warnings remain in the broader suite.
- [x] Prisma validate passed for `packages/database/prisma/schema.prisma`.
- [x] TypeScript checks passed for middleware and web.
- [x] Production builds passed with required local verification env:
  `NEXT_PUBLIC_SOCKET_URL=http://localhost:3002`,
  `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`,
  `BACKEND_URL=http://localhost:3000`.
- [x] `git diff --check` passed; Windows CRLF conversion warnings only.

**Residual risks / deploy gate**
- [x] CI green and PR #137 merged.
- [x] Production deploy still blocked by the dirty/diverged prod checkout.
  No production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

---

## Completed: Customer/Performance Readiness Pass 11 (2026-05-31)

**Branch:** `feat/performance-readiness-pass-11`

**Why now:** PR #133 merged the upload-memory-pressure fix and all checks are
green, but production deploy is still blocked by dirty/diverged prod-local
state. The next autonomous slice should use fresh customer-dashboard,
performance, and production-risk reviews to pick repo-side issues that are
small enough to build, test, review, merge, and safely defer deploy if the prod
checkout remains unsafe.

**New primitives introduced:** `GenericApiDataSource` bounded response reader
and local lazy-load guards for modal-only dashboard option data.

**Hermes-first analysis:** not applicable yet. This pass will avoid business
agent, MCP, Hermes skill, AI/provider, or spend paths unless a reviewer finds a
specific existing-agent gap that must use the Hermes/MCP substrate.

**Plan**
- [x] Merge PR #133 after full CI green.
- [x] Re-check production deploy gate after merge.
- [x] Start fresh branch from `origin/main`.
- [x] Run multi-subagent customer, performance, and production-risk scans before
  selecting a build target.
- [x] Reconcile reviewer findings with backlog/repo truth and select the
  smallest high-value buildable bundle.
- [x] Write/update a short design plan for selected fixes.
- [x] Add focused failing tests.
- [x] Implement scoped fixes.
- [x] Run focused red/green tests, then multi-subagent code review.
- [x] Run broader affected tests/builds/typecheck.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

**Current merge/deploy state**
- [x] PR #133 merged at
  `153091861732b5971e76cbff456763a8e2619ef6`; CI green for audit, build,
  e2e, lint, security, and test.
- [x] No open GitHub PRs after #133 merge.
- [x] Prod deploy remains blocked: `/opt/vizora/app` is `ahead 17, behind 73`
  from `origin/main=153091861732b5971e76cbff456763a8e2619ef6`, with many dirty
  template/web/script files and untracked operator-approval/docs assets.
- [x] Prod runtime probe: middleware/web/realtime PM2 processes are online and
  middleware health is OK; several ops/Hermes cron processes are stopped. No
  production pull, reset, stash, env edit, service restart, DB mutation, or
  deploy performed.

**Plan/design:** `docs/plans/2026-05-31-performance-readiness-pass-11.md`

**Selected fix bundle**
- [x] Cap Generic API widget response bodies before JSON parsing.
- [x] Lazy-load content push/add-to-playlist modal options instead of loading
  devices/playlists on content-page mount.
- [x] Skip redundant devices-page client refetches only when server pagination
  metadata proves the server props include the complete devices/playlists list.

**Focused verification and review**
- [x] Focused tests passed:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=generic-api.data-source`
  (35/35) and
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/(content|devices)"`
  (44/44).
- [x] Middleware reviewer re-review CLEAN after adding stream cancellation on
  oversized Generic API responses.
- [x] Dashboard reviewer re-review CLEAN after fixing incomplete first-page
  devices props, modal lazy-load error states, and playlist option refresh after
  add-to-playlist.
- [x] Broader verification passed:
  middleware full Jest (143 suites / 2846 tests), web full Jest (94 suites /
  969 tests after review fixes), middleware and web TypeScript checks,
  `git diff --check`, middleware build, web production build, realtime build,
  and CI-equivalent middleware/realtime lint. Full ad-hoc web-inclusive ESLint
  still has a pre-existing repo warning/error backlog outside this branch;
  changed-file lint exits 0 with warnings only.
- [x] Final multi-agent review: backend/security/resource review CLEAN; dashboard
  review low findings fixed and targeted re-review CLEAN.

**Reviewer findings deferred from this slice**
- [ ] Shared dashboard Socket.IO provider.
- [ ] Full server-side content-library pagination/search.
- [ ] Playlist index summary payload.
- [ ] Template refresh overlap guard and DB-side refresh-enabled scan.
- [ ] Real dashboard health/quota cards.
- [ ] API-key customer surface cleanup.

---

## Completed: Upload Pressure Readiness Pass 10 (2026-05-31)

**PR / merge commit:** #133 /
`153091861732b5971e76cbff456763a8e2619ef6`

**Branch:** `feat/performance-readiness-pass-10`

**Why now:** Pass 9 hardened content streaming and display recovery, but the
largest remaining customer-critical upload bottleneck is still the middleware
and dashboard accepting large files in ways that can drive avoidable memory and
concurrency pressure. This pass stays repo-side and does not require secrets,
live hardware, production env edits, or production state mutation.

**New primitives introduced:** small helpers in existing modules only:
`FileValidationService.validateFileAtPath`, `StorageService.uploadFileFromPath`,
and private `ContentController` upload-temp cleanup helpers.

**Hermes-first analysis:** not applicable. This pass does not add business
agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

**Plan**
- [x] Start fresh branch from merged `origin/main`.
- [x] Re-check pass-9 deploy gate and keep production deployment blocked until
  `/opt/vizora/app` is reconciled.
- [x] Write plan/design for disk-backed upload and dashboard backpressure fixes.
- [x] Run multi-subagent design review before tests.
- [x] Add focused failing tests for file-path validation, upload-from-path, temp
  cleanup, and dashboard upload backpressure.
- [x] Implement bounded middleware/dashboard upload-pressure fixes.
- [x] Run focused red/green tests.
- [x] Run multi-subagent code review before broader tests.
- [x] Run broader affected tests/builds/typecheck.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Deployment gate inherited from pass 9**
- [x] PR #132 merged at `4383c09b75f3cdbba0d0965ce477fe135d6439d6`; CI green
  for audit, lint, security, build, test, and e2e.
- [x] Prod deploy blocked after merge: `/opt/vizora/app` is still dirty and now
  `ahead 17, behind 70` from `origin/main=4383c09b75f3cdbba0d0965ce477fe135d6439d6`.
- [x] Prod core services health check is OK; no deploy, pull, reset, stash, or
  service restart performed.

**Plan/design:** `docs/plans/2026-05-31-upload-pressure-readiness-pass-10.md`

**Selected fix bundle**
- [x] Switch content upload and replace-file interceptors to disk-backed temp
  storage while preserving the 100MB HTTP limit.
- [x] Add file-path validation that hashes by stream, checks offset-aware RIFF
  signatures, scans full PDFs for active-content markers, and scans the first
  suspicious-content window for other media.
- [x] Add MinIO upload-from-path using a read stream and known size.
- [x] Preserve buffer-backed direct controller tests and local-dev fallback behavior.
- [x] Clean temp files on upload success/failure and after image thumbnail
  background generation.
- [x] Add dashboard upload guards: per-type max-size enforcement, bounded queue,
  and single-concurrency large uploads.

**Focused verification**
- [x] Red run:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|storage.service|content.controller"` -
  failed on missing `validateFileAtPath`, `uploadFileFromPath`, path-based
  thumbnailing, RIFF subtype checks, and late-PDF scanning.
- [x] Red run:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/content"` -
  failed on video concurrency, cumulative queue cap, rejected-file reporting,
  and partial-failure retry labels.
- [x] Green run:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|storage.service|content.controller"` -
  pass, 8 suites / 293 tests.
- [x] Green run:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/content"` -
  pass, 1 suite / 25 tests.

**Review gate**
- [x] Design review found thumbnail temp-file ownership, local fallback, temp
  root/cleanup, RIFF subtype, PDF full-scan, and dashboard backpressure gaps;
  all selected implementation gaps fixed except durable orphan-cleanup retry,
  which remains deferred.
- [x] Code review found web typecheck failure from `onDropRejected` typing;
  fixed by using `FileRejection`.
- [x] Code review found `react-dropzone` `maxFiles` rejected over-limit drops
  before manual queue truncation; fixed by removing `maxFiles` and asserting
  the manual queue cap owns truncation.
- [x] Final delta review after all fixes: middleware/upload and dashboard/upload
  reviewers both CLEAN.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `git diff --check` - pass with expected LF-to-CRLF warnings only.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2842 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 94 suites / 960 tests
  with pre-existing React `act(...)` and jsdom navigation warnings only.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/web` with local API/socket env and 4096MB heap - pass
  with existing Next middleware/proxy and TS project-reference warnings.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 12 suites / 273 tests.
- [x] `npx nx build @vizora/realtime` - pass when run serially; earlier parallel
  run failed on a Windows file lock in `@vizora/database:build`.
- [x] `pnpm test:ops` - pass, 5 tests.
- [x] Lint equivalent on Windows:
  `$env:ESLINT_USE_FLAT_CONFIG='false'; pnpm exec eslint --no-error-on-unmatched-pattern --ext .ts,.tsx "middleware/src/**/*.ts" "middleware/src/**/*.tsx" "realtime/src/**/*.ts" "realtime/src/**/*.tsx"` -
  pass with warnings only. The literal `pnpm lint` script is POSIX-env syntax
  and fails under PowerShell before ESLint starts.
- [x] `pnpm --dir display test:ci` - pass, 6 suites / 126 tests.
- [x] `pnpm --dir display typecheck` - pass.
- [x] `pnpm --dir display build` - pass.
- [x] `NODE_OPTIONS=--use-system-ca pnpm audit --audit-level=high` - fails with
  150 dependency advisories (1 critical, 56 high). CI marks audit
  continue-on-error; dependency upgrades are deferred to a dedicated security pass.
- [x] PR #133 opened. Initial CI build failed on Linux because `multer` was
  only available transitively in local installs; fixed by declaring
  `multer@2.1.1` in `@vizora/middleware` and updating the lockfile importer.
- [x] Post-CI-fix verification: `pnpm install --frozen-lockfile --offline
  --ignore-scripts`, `npx nx build @vizora/middleware`, `pnpm --filter
  @vizora/middleware exec tsc --noEmit --pretty false`, and `git diff --check`
  pass locally.

**Deferred follow-ups**
- [ ] True multipart/chunked resumable uploads with server-side session state.
- [ ] Background thumbnail queue instead of in-process fire-and-forget work.
- [ ] Server-backed content-library pagination/search plus thumbnail lazy/virtualized rendering.
- [ ] Shared dashboard realtime socket provider for status, notifications, and route events.

---

## Completed: Performance Readiness Review Pass 9 (2026-05-31)

**Branch:** `feat/performance-readiness-pass-9`
**PR / merge commit:** #132 / `4383c09b75f3cdbba0d0965ce477fe135d6439d6`

**Why now:** PR #131 merged the bounded dashboard contract fixes. The next
autonomous slice is a comprehensive repo-side performance/code-review pass over
customer-critical flows: content upload, pairing, content streaming/playback,
middleware hot paths, and dashboard workflows. Production deploy remains blocked
by dirty/diverged prod-local state, so this pass stays inside buildable,
testable repo work.

**New primitives introduced:** none planned. Prefer existing NestJS modules,
Prisma models, storage services, realtime gateway, web API client, and dashboard
patterns.

**Hermes-first analysis:** not applicable unless a selected fix touches
business agents, MCP tools, Hermes skills, or AI/provider spend paths.

**Plan**
- [x] Start fresh branch from merged `origin/main`.
- [x] Re-check production deploy gate after PR #131 merge.
- [x] Run multi-subagent performance/code-review analysis.
- [x] Write plan/design for selected buildable fixes.
- [x] Add focused failing tests/benchmarks where practical.
- [x] Implement bounded performance/readiness fixes.
- [x] Run multi-subagent code review before broader tests.
- [x] Run focused and broader tests/builds/browser checks.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Deployment gate after PR #131**
- [x] PR #131 merged at `58df1a276b8252dba7145c75705ae4deabde431f` with CI green.
- [x] Prod deploy blocked: `/opt/vizora/app` is still `ahead 17, behind 66`, has
  many modified/untracked prod-local files, and prod `origin/main` is stale while
  remote `main` is `58df1a276b8252dba7145c75705ae4deabde431f`.
- [x] Prod core services health check is OK; no deploy/restart performed.

**PR / CI / deployment**
- [x] PR #132 opened from `105f081ba8acb0b1f298d93dd53bdf9d68df74f3`.
- [x] GitHub CI green: audit, lint, security, build, test, and e2e.
- [x] PR #132 merged at `4383c09b75f3cdbba0d0965ce477fe135d6439d6`.
- [x] Deployment gate checked after merge: production health OK, core PM2
  services online, but `/opt/vizora/app` is dirty/diverged (`ahead 17, behind 70`),
  so deploy was not attempted.

**Analysis feed**
- [x] Middleware/storage reviewer prioritized streaming-upload memory pressure,
  unsupported multi-range playback behavior, missing authenticated media validators,
  unbounded template data-source fetches, and template refresh overlap risk.
- [x] Pairing/realtime reviewer prioritized false offline status from stale Postgres
  heartbeat writes, browser-display `clear_cache` deleting credentials, and display
  clients not recovering from stale-token socket errors.
- [x] Frontend/dashboard reviewer prioritized content-library all-fetch/render caps,
  bulk-upload pressure, duplicate dashboard sockets, playlist index eager builder load,
  dashboard overview list fan-out, and pairing help copy drift.

**Plan/design:** `docs/plans/2026-05-31-performance-readiness-pass-9.md`

**Selected fix bundle**
- [x] Reject unsupported device-content multi-range requests instead of streaming the
  full object.
- [x] Add authenticated `ETag` / `Last-Modified` validators and `304` revalidation
  path before MinIO stream acquisition.
- [x] Keep successful protected media cacheable only by revalidation (`private, no-cache`).
- [x] Refresh display `lastHeartbeat` in Postgres on a throttle and fix stale-status
  cleanup to use active device IDs.
- [x] Make browser-display `clear_cache` clear media cache without unpairing.
- [x] Reset browser/Electron displays on terminal stale-token / missing-device socket errors.

**Focused verification**
- [x] Red run: middleware device-content, realtime device gateway, web display, and
  Electron display-client suites failed on the expected missing behaviors.
- [x] Green run:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller` -
  pass, 1 suite / 37 tests after review fixes.
- [x] Green run:
  `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=device.gateway` -
  pass, 2 suites / 105 tests after review fixes.
- [x] Green run:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="display"` -
  pass, 6 suites / 20 tests.
- [x] Green run:
  `pnpm --filter @vizora/display test -- --runInBand device-client.spec.ts` -
  pass, 1 suite / 49 tests.

**Broader verification**
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 12 suites / 273 tests.
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 6 suites / 126 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2827 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 94 suites / 956 tests with
  existing React `act(...)` and jsdom navigation warnings only.
- [x] TypeScript: middleware, realtime, and web `tsc --noEmit --pretty false` pass;
  display `pnpm --filter @vizora/display run typecheck` passes.
- [x] Builds:
  `npx nx build @vizora/middleware` - pass with existing webpack warnings;
  `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings;
  `pnpm --filter @vizora/display run build` - pass;
  `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx nx build @vizora/web` - pass with
  existing Next middleware/proxy deprecation and TS project-reference warnings.
- [x] `git diff --check` - pass with expected LF-to-CRLF warnings only.

**Review gate**
- [x] Display-client reviewer: CLEAN.
- [x] Realtime reviewer found stale socket heartbeats could still write Redis/Postgres
  and cleanup trusted `deviceSockets` entries without checking live Socket.IO state;
  fixed with an active-socket guard before heartbeat persistence and live-socket pruning.
- [x] Middleware reviewer found weak ETags on `206`, `304` from cached stale validators,
  and missing validator cleanup on stream errors; fixed by omitting ETag on partial
  responses, limiting `304` to fresh-resolved media contexts, and clearing validators
  on pre-header stream failure.
- [x] Middleware/realtime re-review after fixes: both CLEAN.

**Deferred follow-ups**
- [ ] Disk-backed/streaming upload pipeline and per-type frontend upload caps
  (selected for pass 10).
- [ ] Server-backed content-library pagination/search plus thumbnail lazy/virtualized rendering.
- [ ] Shared dashboard realtime socket provider for status, notifications, and route events.
- [ ] Playlist index summary payload and removal of dead builder-modal code.
- [ ] Dashboard overview summary/read-model endpoint.
- [ ] Pairing help copy update.
- [ ] Template/widget data-source response caps and template refresh overlap guard.
- [ ] Single-display queued push response contract.
- [ ] Electron cache invalidation for replaced media.

---

## Completed: Dashboard Contract Readiness Pass 8 (2026-05-31)

**Branch:** `feat/customer-dashboard-improvements-8`
**PR / merge commit:** #131 / `58df1a276b8252dba7145c75705ae4deabde431f`

**Why now:** After PR #130 merged, the next highest-value repo-side customer
readiness work is a bounded set of dashboard contract defects found by the
customer UX, performance, and reliability reviews. These affect billing accuracy,
auth behavior, content rename, schedule load failure visibility, and dashboard
activity freshness without requiring secrets, live hardware, or production state
mutation.

**New primitives introduced:** none. Reuse the existing web `ApiClient`,
billing module, content API wrapper, schedules page, and dashboard overview.

**Hermes-first analysis:** not applicable; this pass does not add business-agent
behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-dashboard-contract-readiness-pass-8.md`

**Plan**
- [x] Reconcile post-PR #130 tracker state and create fresh branch from `origin/main`.
- [x] Run multi-subagent customer UX, performance, and reliability analysis.
- [x] Write plan/design and customer-dashboard improvement list.
- [x] Add failing focused tests for the selected contract defects.
- [x] Implement bounded fixes.
- [x] Run focused web/middleware tests.
- [x] Run multi-subagent code review before broader tests.
- [x] Run broader affected tests/builds/typecheck.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Analysis feed**
- [x] Customer UX review prioritized billing display/trial correctness, pairing guidance,
  first-run checklist, schedule prerequisites, advanced control exposure, filter-empty states,
  and overloaded settings.
- [x] Performance review prioritized duplicate dashboard sockets, full-list overview fetches,
  detail-sized list payloads, unbounded content library rendering, playlist/schedule reference
  fetch fan-out, and upload-memory pressure.
- [x] Reliability review prioritized 403 logout behavior, billing interval drift, trial status
  naming, content rename payload drift, schedule partial-load silence, and stale dashboard
  recent activity.

**Selected fix bundle**
- [x] Keep auth on `403`, redirect only on `401`, and throw status-bearing `ApiError` objects.
- [x] Pass billing interval through plans API and render backend minor-unit prices correctly.
- [x] Use `trial` consistently in billing page/status UI.
- [x] Map content rename payloads from web `title` to middleware `name`.
- [x] Surface schedule partial-load failures with an error banner.
- [x] Rebuild dashboard recent activity when device-status context initializes.

**Review / verification**
- [x] API/security reviewer initially found `GET /billing/plans?interval=` still bypassed validation;
  fixed by rejecting present-but-empty interval query values and adding controller coverage.
- [x] Customer/runtime reviewer: CLEAN after yearly-fetch failure, recent activity, and interval
  validation fixes.
- [x] API/security re-review: CLEAN after empty-interval fix.
- [x] Focused web suite:
  `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="api/__tests__/(client|billing|content)|billing|schedules-page|dashboard-page"` -
  pass, 9 suites / 113 tests.
- [x] Focused middleware billing controller:
  `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=billing.controller` -
  pass, 1 suite / 24 tests.
- [x] Full web Jest:
  `pnpm --filter @vizora/web test -- --runInBand` - pass, 94 suites / 953 tests
  (pre-existing React `act(...)` warnings still appear in several suites).
- [x] Full middleware Jest:
  `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2824 tests.
- [x] Type checks:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` and
  `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] Builds:
  `npx nx build @vizora/middleware` - pass with existing webpack warnings;
  `$env:NEXT_PUBLIC_SOCKET_URL='http://localhost:3002'; $env:NEXT_PUBLIC_API_URL='http://localhost:3000'; $env:BACKEND_URL='http://localhost:3000'; npx nx build @vizora/web` - pass.
- [x] Browser smoke: local production `next start` plus Playwright-mocked API verified desktop/mobile
  billing plan pricing, yearly refetch, no stale monthly cards after yearly failure, and schedules
  partial-load permission banner. Screenshots saved under `test-results/pass8-browser/`.

---

## Completed: Device Content Streaming Performance Pass 7 (2026-05-31)

**Branch:** `feat/content-streaming-performance-7`
**PR / merge commit:** #130 / `c617cef6cc6b44e29bb8ef19c04f3a7071532809`

**Why now:** Customer display playback is a hot path and the middleware device-content route repeats
device-token DB validation, content DB lookup, and MinIO metadata lookup for every video byte-range
request. This is repo-side, customer-visible performance work that does not require secrets,
production state mutation, or live hardware.

**New primitives introduced:** small in-process TTL caches inside `DeviceContentController` for
verified current device-token payloads, tenant-scoped content rows, and MinIO object metadata.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools,
Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-device-content-streaming-performance-pass-7.md`

**Plan**
- [x] Create fresh branch from merged `origin/main`.
- [x] Write plan/design and tracker section.
- [x] Run multi-subagent design review before tests.
- [x] Add failing focused tests for duplicate range-request work and cache headers.
- [x] Implement bounded short-TTL auth/content/metadata caches on the existing controller path.
- [x] Run focused middleware tests.
- [x] Run multi-subagent code review before broader tests.
- [x] Run broader affected tests/builds/typecheck.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Baseline evidence**
- [x] Code inspection: `DeviceContentController.serveFile` calls `verifyCurrentDeviceToken`,
  `contentService.findByIdForDevice`, and `storageService.getFileMetadata` on every request before
  selecting full/range streaming.
- [x] Existing response headers use `Cache-Control: private, no-store` on successful media responses,
  preventing short browser/device cache reuse.

**Design review gate**
- [x] Customer/performance reviewer found a blocking design problem with `private, max-age=30` on
  stable media URLs; revised design keeps successful media responses `private, no-store`.
- [x] Customer/performance reviewer found a stale-content replacement failure mode; revised design
  invalidates cached content/metadata and retries once on pre-header MinIO stream-acquisition failure.
- [x] Security/tenant reviewer found the same response-cache stale-auth risk and called out the
  pre-existing org-scoped content authorization model; revised docs make that boundary explicit.
- [x] Security/tenant reviewer accepted a 5s server-side auth cache if populated only after full
  current-token validation and capped by JWT `exp`.

**Focused verification**
- [x] Red run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller`
  failed on duplicate JWT/content/metadata calls and missing stale-object retry.
- [x] Green run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller`
  passed, 1 suite / 30 tests.
- [x] Code review found concurrent stale-object misses could poison the shared MinIO range circuit;
  fixed by serializing cached-object stream acquisition per old object key and re-resolving waiters
  after invalidation.
- [x] Code review found metadata-miss replacement could transiently 404 for the content-cache TTL;
  fixed by evicting cached content/metadata on metadata miss and retrying cached rows once.
- [x] Code review found the content cache stored full rows; fixed `findByIdForDevice` to select only
  `id`, `organizationId`, `url`, and `mimeType`.
- [x] Review-fix run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="device-content.controller|content.service"`
  passed, 2 suites / 130 tests.
- [x] Post-review low coverage fix: added direct same-request cached-row metadata-miss retry coverage.
- [x] Post-review focused run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="device-content.controller|content.service"`
  passed, 2 suites / 131 tests.

**Review gate**
- [x] Security/runtime re-review: CLEAN; verified metadata-miss retry, narrow content query, stale old-key lock,
  token-exp auth-cache cap, org cache keying, and no browser `max-age`.
- [x] Playback/performance re-review: CLEAN; verified pending-load coalescing, stale old-key retry/circuit fix,
  no-store behavior, and that only stream acquisition is serialized, not response body transfer.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2821 tests.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings; Nx reported
  `@vizora/database:build` as flaky after successful completion.
- [x] `git diff --check` - pass with expected LF-to-CRLF warnings only.

**PR / CI**
- [x] Branch commit created: `perf(middleware): cache device content streaming lookups`.
- [x] PR #130 opened and mergeable.
- [x] GitHub CI green at first pushed head: audit, lint, test, build, security, and e2e passed.
- [x] PR #130 merged after final CI green at head `7846dafa0c91ca9f804f4d62613127f67626ab9c`;
  merge commit `c617cef6cc6b44e29bb8ef19c04f3a7071532809`.
- [x] Deployment gate checked after merge: production health OK, core PM2 services online, but
  `/opt/vizora/app` is dirty and diverged (`ahead 17, behind 66`), so deploy was not attempted.

---

## Completed: Customer Contract, Security, and Performance Pass 6 (2026-05-31)

**Branch:** `feat/customer-performance-review-6`
**PR / merge commit:** #129 / `8805aa90ea2fb04df907c71ceb5a11d723e22bea`

**Why now:** PR #128 merged and CI is green, but deploy remains blocked by dirty/diverged prod-local work. The next repo-side slice should fix customer-visible contract failures and small performance/security defects that do not require secrets, customer credentials, live hardware, or production state mutation.

**New primitives introduced:** none. Reuse the existing `ApiClient`, Next `serverFetch`, display push path, realtime push response contract, shared SSRF guard, and display Cache API preload path.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-customer-contract-security-performance-pass-6.md`

**Selected fix bundle**
- [x] Billing checkout/portal responses normalize backend `{ checkoutUrl }` / `{ portalUrl }` to web `{ url }`.
- [x] `serverFetch` reads `vizora_auth_token`, forwards auth correctly, and unwraps response envelopes.
- [x] Middleware display push-content surfaces realtime `success:false` as failure instead of returning false success.
- [x] Bulk playlist assignment rejects mixed-organization display IDs before DB update or realtime notification.
- [x] Bulk group assignment rejects mixed-organization display IDs before membership creation.
- [x] RSS preview, template data sources, and URL-thumbnail fetches reject redirects after SSRF validation.
- [x] Display media preload uses authenticated `/device-content/...` URLs so cache warmup can actually succeed.
- [x] Run focused red/green tests.
- [x] Run multi-subagent review before broader tests.
- [x] Run post-fix re-review before broader tests.
- [x] Run broader affected tests/builds.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout is safe.

**Analysis feed**
- [x] Local drift check confirmed billing response mismatch, `serverFetch` cookie/envelope drift, push-content false success, RSS/thumbnail redirect gap, and unauthenticated display preload path still exist after PR #128.
- [x] Customer/dashboard subagent review returned and triaged. In-scope: billing response drift. Deferred: pairing UX canonicalization, content rename `title`/`name`, overnight schedules, 403 handling, conflict warnings, storage estimates, proof-of-play UI, notification pagination.
- [x] Performance subagent review returned and triaged. In-scope: authenticated display preload. Deferred: streaming upload/direct-to-storage design, dashboard summary endpoint, dashboard-only realtime rooms, media metadata cache, pairing-key index, summary list endpoints.
- [x] Security/reliability subagent review returned and triaged. In-scope: cross-tenant bulk playlist/group assignment and template data-source SSRF redirect/DNS guard. Deferred: active schedule playback path and REST heartbeat ID contract.

**Focused verification**
- [x] Red run: `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="billing|server-api|DisplayClient"` failed on backend-shaped billing responses, missing `serverFetch` auth/envelope unwrap, and unauthenticated display preload.
- [x] Red run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|widgets.controller|thumbnail.service|template-rendering.service"` failed on push-content false success, mixed-org bulk operations, and redirect-following SSRF surfaces.
- [x] Green run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|widgets.controller|thumbnail.service|template-rendering.service"` - pass, 6 suites / 170 tests.
- [x] Green run: `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="billing|server-api|DisplayClient"` - pass, 7 suites / 81 tests.
- [x] Review-fix run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|widgets.controller|thumbnail.service|template-rendering.service"` - pass, 6 suites / 171 tests.
- [x] Review-fix run: `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="billing|server-api|DisplayClient"` - pass, 7 suites / 83 tests.
- [x] Redirect follow-up run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="ssrf-guard|widgets.controller|thumbnail.service|template-rendering.service|displays.service"` - pass, 7 suites / 218 tests.
- [x] Template redirect-secret follow-up run: `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="ssrf-guard|widgets.controller|thumbnail.service|template-rendering.service|displays.service"` - pass, 7 suites / 220 tests.

**Review gate**
- [x] Security/tenant/SSRF reviewer: CLEAN for tenant checks and redirect SSRF guards.
- [x] Customer/performance reviewer: initial findings fixed by keeping realtime `success:false` outside circuit-failure accounting, rethrowing template redirect policy errors from fallback, failing fast on malformed billing redirect responses, and consolidating thumbnail URL validation to the shared SSRF guard.
- [x] Customer/performance post-fix reviewer found P2 customer breakage from blanket redirect rejection; fixed with bounded redirect following that validates every hop through the shared SSRF guard.
- [x] Security post-fix reviewer found P2 template redirect downgrade/header-leak risk; fixed by enforcing production HTTPS on redirected template URLs and dropping non-safe headers on cross-origin redirects.
- [x] Post-fix security re-review: CLEAN. Residual risks: documented DNS lookup-to-fetch TOCTOU remains, and billing redirect URLs still trust middleware/provider responses.
- [x] Post-fix customer/performance re-review: CLEAN. Residual risk: template APIs that require custom headers after cross-origin redirects must use the final URL directly or a same-origin redirect.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2813 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 92 suites / 942 tests; existing React `act(...)`, jsdom navigation, and intentional negative-path console warnings remain.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware/proxy deprecation and TS project-reference warnings.
- [x] `git diff --check origin/main...HEAD` - pass.

**Merge / CI / deployment gate**
- [x] PR #129 merged after GitHub checks passed: lint, audit, test, build, security, and e2e.
- [x] GitHub main after merge: `8805aa90ea2fb04df907c71ceb5a11d723e22bea`.
- [x] Open PRs after merge: none.
- [x] Production health probe returned `success: true`, database connected at `2026-05-31T15:33:14.762Z`.
- [x] Production deploy remains blocked: `/opt/vizora/app` is dirty and diverged
  (`HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main=8805aa90ea2fb04df907c71ceb5a11d723e22bea`,
  `ahead 17, behind 65`). Do not pull/reset/stash/restart services until prod-local work is
  reconciled.

---

## Completed: Device Token Current-Hash Enforcement (2026-05-31)

**Branch:** `feat/customer-performance-review-5`
**PR / merge commit:** #128 / `48e6a229d8cb0557f304629c54ed1b605eba7e2d`

**Why now:** PR #127 merged and CI is green, but deployment remains blocked by dirty/diverged prod-local work. A fresh realtime/display/code review found a P0 auth-boundary gap: signed display JWTs remain accepted after re-pairing or token rotation because middleware and realtime verify signature claims but do not compare the presented token to the current token hash stored on `Display.jwtToken`.

**New primitives introduced:** one shared middleware device-token helper and one realtime hash helper. Reuse the existing display `jwtToken` hash column, pairing token hash behavior, device JWT model, middleware controllers, realtime gateway, and WebSocket guards.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-device-token-current-hash-enforcement.md`

**Reviewer synthesis**
- [x] Customer/UX review: PR #127 fixed pairing-token rendering and bulk upload progress; remaining customer-visible issues include billing redirect shape, stale schedule conflict UI, push-to-device false success, and no-op playlist publish.
- [x] Performance review: larger follow-ups remain for memory-buffered uploads, authenticated media caching/preload, dashboard list payloads, and folder indexes.
- [x] Realtime/display review: P0 stale device JWT acceptance selected for this slice; other follow-ups include active-schedule playback, template display rendering, initial playlist ACKs, and direct-playlist clear semantics.
- [x] Adversarial review: SSRF redirect handling, server-side API cookie/envelope drift, and CSRF mounting remain queued after this auth-boundary slice.

**Plan**
- [x] Record PR #127 merge/CI/deploy evidence.
- [x] Drift-check device token storage and validation paths.
- [x] Write plan/design and checklist.
- [x] Add failing middleware tests for stale/missing `Display.jwtToken` rejection in device-content streaming.
- [x] Add failing realtime tests for stale/missing `Display.jwtToken` rejection and rotation persistence.
- [x] Implement current-hash validation in middleware and realtime.
- [x] Add connected-socket current-hash revalidation in `WsDeviceGuard`.
- [x] Add server-push current-hash revalidation for playlist, command, and QR-overlay delivery.
- [x] Add organization-room broadcast current-hash filtering for stale device sockets.
- [x] Exempt public device endpoints from subscription guard pre-emption before device JWT validation.
- [x] Disable unsafe realtime auto-rotation until a grace/ACK-backed rotation design exists.
- [x] Run focused verification.
- [x] Run multi-subagent review before broad verification.
- [x] Run broader affected tests/builds.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deploy only if prod checkout and runtime token state are safe.

**Runtime-state gate before deploy**
- [x] Query prod display token-hash coverage: 15 displays total, 15 with `jwtToken`, 0 missing `jwtToken`, 15 active non-pairing, 0 active non-pairing missing `jwtToken`.
- [x] Query prod malformed hash coverage: 0 malformed `jwtToken` hashes, 0 active non-pairing malformed hashes.
- [x] Reconcile any legacy displays without a current hash before deploying fail-closed enforcement: no legacy missing-token or malformed-token displays found in the read-only prod counts.
- [ ] Reconcile prod `/opt/vizora/app` dirty/diverged checkout before any pull/restart/deploy.

**Focused verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller` - red first on stale/missing token-hash acceptance, then pass, 26 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=device.gateway` - red first on stale-token acceptance and rotation-without-persist, then pass, 2 suites / 100 tests.
- [x] Review-fix red run: middleware heartbeat/active schedules and realtime guard tests failed before widening the implementation.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.controller|schedules.controller|device-content.controller"` - pass, 3 suites / 65 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|ws-auth.guard"` - pass, 3 suites / 102 tests.
- [x] Second review-fix run: realtime server-push stale-socket tests and subscription public-endpoint test added; `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="subscription-active.guard|displays.controller|schedules.controller|device-content.controller"` - pass, 4 suites / 88 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|ws-auth.guard"` - pass after server-push revalidation, 3 suites / 106 tests.
- [x] Final review-fix run: malformed-hash tests added, `WsDeviceGuard` cache removed, org-room broadcasts filtered. `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="subscription-active.guard|displays.controller|schedules.controller|device-content.controller"` - pass, 4 suites / 89 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|ws-auth.guard|app.controller"` - pass, 4 suites / 117 tests.

**Review gate**
- [x] Subagent code-path review: CLEAN for stale device-token enforcement across middleware REST routes, realtime handshakes, guarded socket messages, direct server-push delivery, and org-room broadcasts. Residual risk documented: guarded realtime messages and server-push fanout now hit the DB for current-hash checks.
- [x] Subagent verification/deploy review: initial gate was not clean until full suites/builds were run; requested broad verification completed below. Deployment remains blocked by prod-local dirty/diverged checkout.

**Broader verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2796 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 12 suites / 271 tests.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/realtime` - pass with existing webpack/source-map/optional `ws` warnings.
- [x] Initial parallel `npx nx build @vizora/middleware` collided with simultaneous `@vizora/database:build` copying into `packages/database/dist/generated` on Windows (`EPIPE`, file in use). Serial rerun completed successfully.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `git diff --check origin/main...HEAD` - pass.

**Merge / CI / deployment gate**
- [x] PR #128 merged after GitHub checks passed: lint, audit, test, build, security, and e2e.
- [x] GitHub main after merge: `48e6a229d8cb0557f304629c54ed1b605eba7e2d`.
- [x] Open PRs after merge: none.
- [x] Production health probe returned `success: true`, database connected at `2026-05-31T14:28:38.620Z`.
- [x] Production deploy remains blocked: `/opt/vizora/app` is dirty and diverged (`HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main=48e6a229d8cb0557f304629c54ed1b605eba7e2d`, `ahead 17, behind 58`). Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Customer Dashboard UX Hotspots (2026-05-31)

**Branch:** `fix/customer-dashboard-ux-hotspots`
**PR / merge commit:** #127 / `c82b1521da7db94ba07caeced4339b8a1b17731a`

**Why now:** PR #126 merged and CI is green, but deployment is blocked by dirty/diverged prod-local work. The next customer-visible repo-side issues are small, testable dashboard defects in existing-device pairing and bulk content upload.

**New primitives introduced:** none. Reuse existing dashboard pages, `ApiClient`, `/content/upload`, XHR upload progress, and `/displays/:id/pair`.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-ux-hotspots.md`

**Plan**
- [x] Drift-check pairing and bulk upload against repo truth.
- [x] Write plan/design and checklist.
- [x] Add failing tests for pairing-token rendering and bulk-upload behavior.
- [x] Implement pairing contract and copy alignment.
- [x] Implement per-file upload type, progress, bounded concurrency, and upload-while-running locks.
- [x] Run focused verification.
- [x] Run multi-subagent review before broad verification.
- [x] Run broader web verification/build.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Focused verification**
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="devices-page|content-page"` - red first on missing `pairingToken` rendering and missing bulk `uploadContentWithProgress`, then pass, 2 suites / 30 tests.
- [x] Post-review regression run for hidden URL-mode queue and modal-close upload lock - red first, then pass, 2 suites / 32 tests.
- [x] Re-review regression for removed-file URL upload - red first, then pass, content page 21 tests; combined focused suite now 2 suites / 33 tests.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `git diff --check` - pass; line-ending warnings only.

**Broader verification**
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 89 suites / 934 tests; existing React `act(...)` and jsdom navigation warnings remain.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `git diff --check origin/main...HEAD` - pass.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware deprecation and TypeScript project-reference warnings.

**Review gate**
- [x] Customer/UX reviewer: initial P1 hidden queued files after switching to URL mode fixed with disabled URL option and guarded change handler; P2 modal-close upload state loss fixed by ignoring close while uploading.
- [x] Performance/concurrency reviewer: no P0/P1; P2 modal-close finding fixed and pairing response type tightened to required backend shape.
- [x] Post-fix re-review: initial P1 removed-file URL upload path fixed by clearing selected file state when queue items are removed/cleared and by requiring a file upload type before using the file branch.

**Merge / CI / deployment gate**
- [x] PR #127 merged after GitHub checks passed: lint, audit, test, build, security, and e2e.
- [x] Open PRs after merge: none.
- [x] GitHub main after merge: `c82b1521da7db94ba07caeced4339b8a1b17731a`.
- [x] Production health probe returned `success: true`, database connected at `2026-05-31T13:09:33.049Z`.
- [x] Production deploy remains blocked: `/opt/vizora/app` is dirty and diverged (`HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, `origin/main=c82b1521da7db94ba07caeced4339b8a1b17731a`, `ahead 17, behind 51`). Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Customer Dashboard + Performance Pass 4 (2026-05-31)

**Branch:** `feat/customer-dashboard-performance-pass`
**PR / merge commit:** #126 / `cd978e4d8474393c85e0e4342218b4cbd708585f`

**Why now:** PRs #123-#125 are merged and CI-green, but production deploy is blocked by dirty/diverged prod-local work. Fresh customer, performance, and adversarial scans found several repo-side issues that directly affect customer-1 readiness without requiring operator-only actions.

**New primitives introduced:** none. Reuse existing Electron display client, NestJS controllers/services, realtime gateway, display web components, response envelope, and critical smoke script.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-performance-pass-4.md`

**Selected fix bundle**
- [x] Electron pairing unwraps the middleware response envelope.
- [x] Active schedule endpoint rejects device JWTs whose subject does not match the requested display.
- [x] Active schedule lookup rejects missing/disabled displays before returning schedules.
- [x] Display content-error messages redact device JWT query params before UI, Redis, or Sentry.
- [x] Critical smoke pairing-complete parsing handles enveloped `data.display.id`.
- [x] Run multi-subagent review before broad verification.
- [x] Run focused/broad verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Review gate**
- [x] Subagent runtime/security review: CLEAN.
- [x] Subagent customer/performance review: initial untracked-helper CI-safety finding fixed by staging the full intended patch; re-review CLEAN.

**Local verification**
- [x] `pnpm exec prisma generate --schema prisma/schema.prisma` in `packages/database` - pass; generated local Prisma client needed before realtime tests in this worktree.
- [x] `npx nx build @vizora/database` - pass.
- [x] `pnpm --filter @vizora/display test -- --runInBand --testPathPattern=device-client` - pass, 47 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="schedules.controller|schedules.service"` - pass, 51 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=ContentRenderer` - pass, 3 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|heartbeat.service"` - pass, 3 suites / 124 tests.
- [x] `git diff --check --cached` - pass.
- [x] `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh` - pass.
- [x] `pnpm --filter @vizora/display test:ci` - pass, 6 suites / 124 tests.
- [x] `pnpm --filter @vizora/display typecheck` - pass.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2790 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 258 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 89 suites / 927 tests; existing React `act(...)` and jsdom navigation warnings remain.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware deprecation and TypeScript project-reference warnings.
- [x] `pnpm --filter @vizora/display build` - pass.

**Current deployment gate**
- GitHub main: `cd978e4d8474393c85e0e4342218b4cbd708585f` after PR #126.
- Open PRs: none after merging PR #126.
- Production health: `/api/v1/health` returned `success: true`, database connected at `2026-05-31T12:24:48.285Z`.
- Production deploy is blocked: `/opt/vizora/app` is dirty, local `HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, and after fetch is `ahead 17, behind 45` relative to `origin/main=cd978e4d8474393c85e0e4342218b4cbd708585f`. Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Display Runtime Reliability (2026-05-31)

**Branch:** `fix/display-runtime-reliability`
**PR / merge commit:** #125 / `0a509cb0c1ee03f2fda558a7be38247c19bc8f3a`

**Why now:** PR #124 merged critical upload/streaming smoke coverage, and production deploy remains blocked by dirty/diverged prod-local work. The next repo-side customer-1 reliability gap is unattended display runtime behavior: after reboot/screensaver/power policy changes, displays must come back and continue emitting reliable proof-of-play signals.

**New primitives introduced:** none. Reuse Electron lifecycle APIs, `powerSaveBlocker`, Linux desktop autostart files, existing renderer proof-of-play paths, and CI workflow patterns.

**Hermes-first analysis:** not applicable; this is display runtime/CI hardening, not a business-agent, MCP, Hermes, or AI/spend path.

**Plan/design:** `docs/plans/2026-05-31-display-runtime-reliability.md`

**Plan**
- [x] Drift-check K1/K2/K3/K4 and renderer proof-of-play ID paths.
- [x] Add packaged-display auto-start.
- [x] Add packaged-display sleep prevention.
- [x] Fix renderer proof-of-play/error IDs to prefer API `id` with `_id` fallback.
- [x] Gate display unit tests in CI.
- [x] Gate display renderer/main typecheck and display build in CI.
- [x] Run multi-subagent review before broad verification.
- [x] Run focused/broad verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Review gate**
- [x] Electron runtime reviewer: initial packaged-guard and process-listener findings fixed; final re-review CLEAN.
- [x] Customer-readiness/CI reviewer: initial cache ID, AppImage, and docs findings fixed; final re-review found only stale wording, now corrected.

**Local verification**
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 6 suites / 124 tests.
- [x] `pnpm --filter @vizora/display test:ci` - pass, 6 suites / 124 tests; validates the CI-safe Jest invocation after GitHub Actions exposed pnpm argument-forwarding drift.
- [x] `pnpm --filter @vizora/display typecheck` - pass.
- [x] `pnpm --filter @vizora/display build` - pass.
- [x] `git diff --check` - pass; line-ending warnings only.

---

## Completed: Critical Smoke Upload + Streaming Coverage (2026-05-31)

**Branch:** `feat/customer-readiness-next`
**PR / merge commit:** #124 / `81e5cd25da6c2030d339b3d48866f40bba15a4c7`

**Why now:** PR #123 merged the customer-readiness hot-path hardening, but the operator smoke still proves URL content creation rather than real multipart upload and authenticated media streaming. Customer-1 go-live needs the smoke to exercise the path displays actually use for uploaded assets.

**New primitives introduced:** none. Reuse the existing smoke script, upload endpoint, device JWT pairing flow, and device-content streaming route.

**Hermes-first analysis:** not applicable; this is API smoke coverage in existing middleware/display paths, not a business-agent, MCP, Hermes, or AI/spend path.

**Plan/design:** `docs/plans/2026-05-31-critical-smoke-upload-streaming.md`

**Plan**
- [x] Re-check current branch/CI/prod deploy gate after PR #123 merge.
- [x] Drift-check smoke coverage for upload and device-content streaming.
- [x] Add generated tiny PDF multipart upload to the critical-path smoke.
- [x] Add authenticated device-content byte-range streaming verification.
- [x] Add uploaded-object cleanup so production smoke runs do not leave MinIO objects behind.
- [x] Run subagent review before broad verification.
- [x] Run focused verification; full smoke blocked because Docker/local services are unavailable.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Review gate**
- [x] Bash/operator-safety reviewer: initial run-ID, range-validation, and interrupt-handling notes fixed; final re-review CLEAN.
- [x] Customer-readiness/operator-state reviewer: initial persistent-artifact finding fixed with PDF fixture + uploaded-content delete; final re-review CLEAN.

**Local verification**
- [x] `pnpm install --frozen-lockfile` - pass.
- [x] `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh` - pass.
- [x] `git diff --check` - pass; line-ending warnings only.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|content.controller|device-content.controller"` - pass, 7 suites / 190 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2787 tests.
- [x] `pnpm --dir packages/database exec prisma validate --schema prisma/schema.prisma` with `NODE_OPTIONS=--use-system-ca` - pass.
- [x] Full local smoke not run: Docker Desktop is not running and local 3000/3001/3002 services are unavailable. Production smoke is intentionally not used as a substitute while prod deploy gate is blocked.

---

## Completed: Customer Performance Readiness Pass 3 (2026-05-31)

**Branch:** `feat/customer-performance-readiness-3`
**PR / merge commit:** #123 / `0c45c468243b5271eb3afee24284dc16ecce370f`

**Why now:** PRs #120-#122 closed the first display delivery, dashboard readiness, and stale PR #34 residual slices. The next repo-side push is a fresh customer-perspective review plus performance/code-review pass focused on content upload, pairing, content streaming, middleware hot paths, and any remaining production-readiness issues that are buildable and testable without operator-only actions.

**New primitives introduced:** none planned. Prefer existing Next dashboard pages/components, NestJS modules/controllers/services/DTOs, Prisma models/indexes, realtime gateway/Socket.IO paths, display clients, ops scripts, and the existing response envelope.

**Hermes-first analysis:** not applicable unless a selected fix involves business agents, MCP tools, Hermes skills, or AI/provider spend. This pass is dashboard UX, middleware/content performance, realtime/display reliability, and code-review hardening.

**Plan/design:** `docs/plans/2026-05-31-customer-performance-readiness-3.md`

**Plan**
- [x] Merge PR #122 and close stale PR #34.
- [x] Re-check production deploy gate.
- [x] Run independent dashboard/customer UX analysis.
- [x] Run independent middleware/content performance analysis.
- [x] Run independent pairing/realtime/display reliability analysis.
- [x] Run independent code-review/security/readiness analysis.
- [x] Synthesize a ranked customer-facing issue list.
- [x] Select a scoped buildable bundle with file/line evidence.
- [x] Implement fixes with focused tests.
- [x] Run multi-subagent review before broad tests.
- [x] Run focused/broad local verification.
- [x] PR, CI, merge.
- [x] Re-check deployment gate; deployment remains blocked by dirty/diverged prod checkout.

**Selected fix bundle**
- [x] Reject disabled/deleted display tokens in realtime and device-content paths.
- [x] Filter command/playlist delivery to active device sockets, not dashboard sockets in `device:{id}` rooms.
- [x] Prevent web display token leakage to attacker-origin device-content lookalikes.
- [x] Persist browser display `token:refresh` and move Electron pairing requests to `/api/v1`.
- [x] Execute Electron main-process override commands even when the renderer path is unavailable.
- [x] Preserve back-online notifications after offline notifications have already fired.
- [x] Reserve upload quota atomically and release reservations on upload/DB failure.
- [x] Fail closed for production MinIO upload failures instead of creating unreachable `/uploads` content.
- [x] Keep DB rows when storage delete fails; avoid silent bucket/accounting drift.
- [x] Add query-shaped database indexes for hot customer list and active schedule paths.
- [x] Fix dashboard API-key scopes, device group filter, schedule group round-trip / multi-device targeting, active playlist KPI, and customization save durability.

**Review gate**
- [x] Backend/runtime reviewer: initial storage quota/delete/realtime findings fixed; final re-review CLEAN.
- [x] Frontend/customer UX reviewer: initial schedule/customization/display-token findings fixed; final re-review CLEAN.

**Local verification**
- [x] `git diff --check` - pass; line-ending warnings only.
- [x] `pnpm --filter @vizora/middleware test -- content.service.spec.ts --runInBand` - pass, 96 tests.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2787 tests.
- [x] `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- [x] `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vizora pnpm --filter @vizora/database exec prisma validate` - pass.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 256 tests.
- [x] Post-PR E2E fixture follow-up: `pnpm --filter @vizora/realtime test -- device.gateway.spec.ts --runInBand` - pass, 1 suite / 85 tests. Local realtime E2E run is blocked in this worktree by generated `realtime/dist/package.json` Jest haste collision plus missing local E2E `DATABASE_URL`/Redis setup; GitHub CI is the authoritative E2E verifier.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 89 suites / 925 tests; existing React `act(...)` and jsdom navigation warnings remain.
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 116 tests; expected negative-path logs and existing MaxListeners warning remain.
- [x] `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 npx nx build @vizora/web` - pass with existing Next middleware deprecation and TypeScript project-reference warnings.

**Current deployment gate**
- GitHub main: `0c45c468243b5271eb3afee24284dc16ecce370f` after PR #123.
- Open PRs: none after merging PR #123.
- Production health: `/api/v1/health` returned `success: true`, database connected at `2026-05-31T10:16:01.382Z`.
- Production deploy is blocked: `/opt/vizora/app` is dirty, local `HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, and after fetch is `ahead 17, behind 39` relative to `origin/main=0c45c468243b5271eb3afee24284dc16ecce370f`. Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: PR #34 Readiness Residuals (2026-05-31)

**Branch:** `fix/readiness-pr34-residual`
**PR / merge commit:** #122 / `48affb3e0ff6163ae5babf6bbe74d702c67e5348`

**Why now:** PR #34 is the only remaining open PR, but it is stale, dirty against main, and has failing April checks. Current main already absorbed part of it (`TRUST_PROXY_HOPS`), while web CSP hardening, realtime orphan notification cleanup, and content lifecycle archive endpoint fixes still have residual gaps.

**New primitives introduced:** none. This ports stale PR behavior into existing Vizora modules/scripts.

**Hermes-first analysis:** not applicable. This task is repository runtime hardening in existing web/middleware/realtime/ops paths, not a business-agent workflow, MCP tool, or AI/provider spend path.

**Plan/design:** `docs/plans/2026-05-31-pr34-readiness-residuals.md`

**Plan**
- [x] Classify PR #34 diff against current `origin/main`.
- [x] Port only residual web security header/CSP fixes.
- [x] Port middleware unhandled-rejection and bind-error diagnostics without replacing current `TRUST_PROXY_HOPS`.
- [x] Port realtime orphan Redis notification cleanup with tests.
- [x] Port content-lifecycle archive endpoint and failure-classification fixes while preserving current inline operator alerts.
- [x] Update env/docs for `TRUST_PROXY_HOPS` and CI web build env.
- [x] Run focused tests/builds, review, PR, CI, merge.
- [x] Close or supersede stale PR #34 after replacement is merged.

**Evidence**
- Replacement PR branch: `fix/readiness-pr34-residual`; stale PR #34 is not mergeable on current main and is superseded by this branch.
- PR #122 CI passed: audit, build, e2e, lint, security, test.
- Stale PR #34 closed as superseded.
- Security/runtime reviewer: initial CSP and external image findings fixed; final re-review CLEAN.
- Ops/realtime reviewer: initial lock-scope, CI wiring, overlap, and archive-error findings fixed; final re-review CLEAN.
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=notification.service` - pass, 24 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=next.config.security` - pass, 4 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="ContentRenderer|next.config.security"` - pass, 2 suites / 5 tests.
- `pnpm test:ops` - pass, 5 tests.
- `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 248 tests.
- `pnpm --filter @vizora/web test -- --runInBand` - pass, 88 suites / 910 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2763 tests.
- `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` - pass with existing Next middleware/proxy deprecation and TypeScript reference warnings.
- Direct ESLint equivalent (`ESLINT_USE_FLAT_CONFIG=false eslint "middleware/src/**/*.ts" "realtime/src/**/*.ts"`) - exit 0, 186 warnings, no errors. Local `pnpm lint` wrapper is Windows-incompatible because the script uses Unix-style env assignment.
- Ops TypeScript check (`tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --types node scripts/ops/content-lifecycle.ts scripts/ops/lib/archive-error.ts`) - pass.
- `git diff --check` - pass; line-ending warnings only.

---

## Completed: Customer Dashboard Quality + Performance Pass (2026-05-31)

**Branch:** `feat/customer-dashboard-quality-pass`
**PR / merge commit:** #121 / `043c82a18b0480a646be1c8b90f06e20fae7d5bb`

**Why now:** After PR #120 closed the display-delivery reliability slice, the next customer-facing gaps are dashboard quality and middleware/display performance bottlenecks that are repo-side, testable, and do not need production secrets or hardware.

**New primitives introduced:** small web formatting/pagination helpers only. Prefer existing Next dashboard components/API clients, NestJS modules/services/DTOs, Prisma query patterns, and the existing `/api/v1` response envelope.

**Hermes-first analysis:** not applicable unless the selected fix involves business agents, MCP tools, or AI/provider spend. This pass is dashboard UX, middleware performance, content upload/pairing/streaming, and critical-path reliability.
**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-quality-performance-pass.md`

**Plan**
- [x] Merge PR #120 after CI green.
- [x] Re-check deploy gate after merge.
- [x] Run parallel customer-dashboard, middleware-performance, and customer-1 readiness analyses.
- [x] Select the highest-value buildable repo-side fixes with file/line evidence.
- [x] Write/update a short plan/design before code.
- [x] Implement fixes with focused tests.
- [x] Run multi-subagent review before broader tests.
- [x] Run focused and broader verification.
- [x] Open PR, wait for CI, merge if clean.

**First scoped bundle selected from subagent reviews**
- [x] SMTP env parity: `MailService` must accept `SMTP_PASS` as documented/health-checked.
- [x] Display layout zones: emit/read `resolvedPlaylist` / `resolvedContent` so layout content renders.
- [x] Realtime command replay: preserve FIFO order for queued offline commands.
- [x] Fleet push content: map Prisma `Content.name` / `thumbnail`, not non-existent `title` / `thumbnailUrl`.
- [x] Fleet UI command results: report delivered/queued/failed honestly.
- [x] Health dashboard: remove random/fabricated metrics and derive stable health from real display status/heartbeat.
- [x] Content library: clear tag filters with Clear all and stop duplicate post-upload thumbnail generation.
- [x] Pairing clients: slow polling enough to respect the current status endpoint throttle, with basic 429 handling where feasible.
- [x] Dashboard list/picker pagination: fetch all pages for content, devices, playlists, schedules, health, status context, overview stats, and emergency override picker instead of truncating at the backend default page.

**Focused verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="mail.service|fleet.service|content.service"` - pass, 3 suites / 126 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="redis.service|device.gateway"` - pass, 3 suites / 107 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/health|FleetCommandDropdown|EmergencyOverrideModal|content-page|usePairing|DeviceHealthMonitor"` - pass, 6 suites / 49 tests; existing React `act(...)` warnings remain in `EmergencyOverrideModal` tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="pagination|dashboard/content|dashboard/devices|dashboard/playlists|dashboard/schedules|dashboard/health|dashboard/__tests__|EmergencyOverrideModal|FleetCommandDropdown|usePairing|DeviceHealthMonitor"` - pass, 11 suites / 93 tests; existing React `act(...)` warnings remain in schedule, emergency modal, and upgrade banner tests.
- [x] Review follow-up `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="pagination|dashboard/__tests__|dashboard/health"` - pass, 3 suites / 25 tests; existing React `act(...)` warnings remain in dashboard/upgrade banner tests.
- [x] Review follow-up `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="pagination|dashboard/content|dashboard/devices|dashboard/playlists|dashboard/schedules|dashboard/health|dashboard/__tests__|EmergencyOverrideModal|FleetCommandDropdown|commandResultMessage|useDeviceConnection|usePlaylistPlayer|usePairing|DeviceHealthMonitor"` - pass, 14 suites / 106 tests; existing React `act(...)` warnings and intentional negative-path console errors remain.
- [x] `git diff --check` - pass; line-ending warnings only.

**Broad verification**
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2763 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 245 tests.
- [x] `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 115 tests; known MaxListeners warning and expected negative-path logs remain.
- [x] `pnpm --filter @vizora/web test -- --runInBand` - pass, 86 suites / 905 tests; existing React `act(...)` warnings and expected negative-path logs remain.
- [x] `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- [x] `pnpm --filter @vizora/display build` - pass.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` - pass with existing Next middleware/proxy and missing production API URL warnings.
- [x] Direct ESLint equivalent (`ESLINT_USE_FLAT_CONFIG=false eslint "middleware/src/**/*.ts" "realtime/src/**/*.ts"`) - exit 0, 187 warnings, no errors. Local `pnpm lint` wrapper is Windows-incompatible because the script uses Unix-style env assignment.
- [x] Final `git diff --check` - pass; line-ending warnings only.

**Review gate**
- [x] Backend/realtime reviewer: initial high/medium findings fixed; final re-review CLEAN.
- [x] Frontend/customer UX reviewer: initial and follow-up findings fixed; final re-review CLEAN.
- [x] Performance/readiness reviewer: initial and follow-up findings fixed; final re-review CLEAN.

**Current deployment gate**
- GitHub main: `70285350105ba46e457fdf702ea9fe33279efc19` after PR #120.
- Production runtime health: `/api/v1/health` returned `success: true`, database connected at 2026-05-31T06:11:55Z.
- Production deploy is blocked: `/opt/vizora/app` is dirty, local `HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`, and after fetch is `ahead 17, behind 36` relative to `origin/main=70285350105ba46e457fdf702ea9fe33279efc19`. Do not pull/reset/stash/restart services until prod-local work is reconciled.

---

## Completed: Display Delivery Reliability Follow-up (2026-05-31)

**Branch:** `feat/customer-performance-hardening-2`
**PR / merge commit:** #120 / `70285350105ba46e457fdf702ea9fe33279efc19`

**Plan/design:** `docs/plans/2026-05-31-display-delivery-reliability-follow-up.md`

**Why now:** The post-merge customer/realtime review found customer-visible playback and remote-control reliability gaps that are repo-side, testable, and do not need operator secrets or production state changes.

**New primitives introduced:** none. Use existing middleware display command callers, realtime `DeviceGateway`, Redis pending-delivery queues, and Electron display client.

**Hermes-first analysis:** not applicable. This is realtime/device transport and Electron display playback reliability; it does not introduce business agents, MCP tools, AI provider calls, or spend paths.

**Plan**
- [x] Add failing focused tests for heartbeat-triggered pending playlist/command replay without returning queued commands in the heartbeat response.
- [x] Route realtime fleet broadcast commands through `DeviceGateway.sendCommand`.
- [x] Append Electron device JWT query tokens to protected `/device-content/:id/file` URLs before playback/cache and `push_content`.
- [x] Fix middleware display command callers to send realtime's nested `{ deviceId, command: { type, payload } }` shape.
- [x] Run focused realtime/display/middleware tests.
- [x] Run multi-review on the diff before broader tests.
- [x] Run broader package tests/builds proportional to touched packages.
- [x] Open PR, wait for CI, merge if clean.

**Verification so far**
- `NODE_OPTIONS=--use-system-ca pnpm --dir packages/database exec prisma generate` - pass; needed in fresh worktree before realtime tests could import `@vizora/database`.
- `npx nx build @vizora/database` - pass.
- `git diff --check` - pass; line-ending warnings only.
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="device.gateway|app.controller|redis.service"` - pass, 4 suites / 112 tests.
- `pnpm --filter @vizora/display test -- --runInBand --testPathPattern="device-client"` - pass, 1 suite / 46 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|fleet.service"` - pass, 4 suites / 72 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="DeviceControls"` - pass, 1 suite / 6 tests.
- `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 242 tests.
- `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 115 tests; existing MaxListeners warning remains in full display suite.
- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2761 tests.
- `pnpm --filter @vizora/web test -- --runInBand` - pass, 82 suites / 882 tests; existing unrelated React `act(...)` warnings remain.
- `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- `npx nx build @vizora/realtime` - pass with existing source-map/optional `ws` warnings.
- `pnpm --filter @vizora/display build` - pass.
- `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` - pass with existing Next middleware/proxy and missing production API URL warnings.
- PR #120 CI - pass: audit, build, lint, security, test, and e2e.
- Deploy status - not deployed; blocked by dirty/diverged production checkout.

**Review inputs**
- Realtime/display reviewer: high findings on negative-ACK replay, broadcast bypassing ACK/queue path, Electron protected media URLs, and middleware single-device command DTO drift.
- Customer dashboard reviewer: high findings on paginated dashboard datasets, duplicate sockets, and analytics error masking; these are queued after this delivery reliability slice.
- Middleware performance reviewer: high findings on template/content list payloads and buffered uploads; these are queued after this delivery reliability slice.
- Deployment/backlog reviewer: prod deployment is blocked by dirty/diverged production checkout; do not pull/reset/deploy until prod-only work is reconciled.
- Internal API final re-review: CLEAN after preserving `devicesOnline`, whitelisting `commandId`, and checking screenshot gateway `success: false`.
- Display-client final re-review: CLEAN after refreshing live Socket.IO `auth.token` alongside persisted device token.
- Realtime final re-review: CLEAN after generation-guarded pending playlist replay, active-socket command replay rechecks, and non-poisoning socket-handoff requeues.

---

## In Progress: Customer Dashboard + Playback Performance Push (2026-05-31)

**Branch:** `feat/customer-dashboard-performance-push`

**Plan/design:** `docs/plans/2026-05-31-customer-dashboard-performance-push.md`

**Why now:** Multiple read-only subagents found customer-visible playback and troubleshooting gaps. The first buildable slice focuses on production hot paths that are repo-side, testable, and do not require secrets, live payment setup, DNS, SMTP, or real hardware.

**New primitives introduced:** none. Use existing StorageService, `device-content` controller, Socket.IO display event path, and dashboard component patterns.

**Hermes-first analysis:** not applicable. This is runtime media delivery, display-client ACK handling, and dashboard UI reliability; it does not introduce business agents, MCP tools, AI provider calls, or spend paths.

**Plan**
- [x] Run parallel customer, middleware-performance, frontend-performance, and readiness analyses.
- [x] Stream MinIO-backed device media with Content-Length and Range support instead of buffering whole files in middleware memory.
- [x] Preserve device JWT org scoping before storage access.
- [x] ACK `playlist:update` and display commands in web and Electron display clients.
- [x] Remove content-library page-load thumbnail fanout.
- [x] Fix screenshot refresh timeout state.
- [x] Run multi-subagent review before tests.
- [x] Run focused tests, service builds, and broader regression checks.
- [ ] Open PR, wait for CI, merge if clean, then deploy approved main.

**Implemented slice**
- Device media playback now streams from storage with single-range/suffix-range support, `Content-Range`, `Accept-Ranges`, bounded object size, and device-JWT/org-prefix checks before object access.
- Storage metadata/range reads now use the existing MinIO circuit-breaker path and distinguish not-found from unexpected storage errors.
- The global exception filter no longer hangs requests whose stream has already sent headers.
- Realtime display delivery now uses capability-aware ACKs for playlist updates and commands, preserving legacy best-effort behavior for older clients.
- Electron and browser display clients advertise `deliveryAck`, ACK only after local application succeeds, negative-ACK on failures, and avoid heartbeat command drains.
- Electron restart/reboot commands ACK before self-termination and wait a short flush window before relaunch/exit.
- Content library no longer triggers thumbnail generation for every item on initial page load.
- Device screenshot modal now guards stale request responses and cleans timeout state on close/device changes.
- Web Tailwind config now shares CJS theme tokens for Next build compatibility and has a drift test against TS theme exports.

**Review gates**
- Middleware/storage reviewer found early streaming/header/org-scope issues; fixed before full tests.
- Frontend reviewer found screenshot stale-request and build config drift risks; fixed with request epochs and theme drift test.
- Realtime/display reviewers found ACK capability, pending-command replay, renderer command ACK, duplicate Electron client, heartbeat-drain, and self-terminating command risks; fixed with regression tests.
- Final self-terminating command reviewer result: CLEAN. Residual note: the 500ms ACK flush is a pragmatic timing guard, not a transport-level receipt.

**Verification plan**
- [x] `git diff --check` — pass; line-ending warnings only.
- [x] `pnpm --filter @vizora/middleware test -- --runInBand` — pass, 141 suites / 2757 tests.
- [x] `pnpm --filter @vizora/realtime test -- --runInBand` — pass, 11 suites / 235 tests.
- [x] `pnpm --filter @vizora/display test -- --runInBand` — pass, 5 suites / 109 tests.
- [x] `pnpm --filter @vizora/web test -- --runInBand` — pass, 82 suites / 881 tests. Existing unrelated React `act(...)` warnings remain in older test files; touched modal/content tests now run clean on focused paths.
- [x] `npx nx build @vizora/middleware` — pass with existing webpack warnings.
- [x] `npx nx build @vizora/realtime` — pass with existing source-map/optional `ws` warnings.
- [x] `pnpm --filter @vizora/display build` — pass.
- [x] `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` — pass with existing Next middleware/prod URL warnings.

**Customer improvement backlog from analysis**
- [ ] Replace fake random health metrics with real status-derived health.
- [ ] Fix schedule multi-device selection mismatch.
- [ ] Wire device-group filter.
- [ ] Replace misleading playlist publish action with assignment/push workflow.
- [ ] Use real storage quota in dashboard.
- [ ] Replace fake content tag filters with real tag data or hide them.
- [ ] Use backend bulk content operations from the UI.
- [ ] Convert getting-started panel into a real onboarding checklist.
- [ ] Consolidate dashboard auth/socket fetches.
- [ ] Add real multipart upload to smoke/E2E coverage.

---

## Completed: M12 Unrecognized Login Alert (2026-05-31)

**Branch:** `feat/m12-unrecognized-login-alert`
**PR / merge commit:** #117 / `1b28608`

**Why now:** `backlog.md` marks M12 partial. Password-changed alerts shipped, but the remaining new-login/unrecognized-device alert is deferred. This is a repo-side P2 security/readiness item and does not require operator credentials.

**New primitives introduced:** none planned. Use existing `AuditLog.ipAddress` + `AuditLog.userAgent` fields as login history instead of adding a parallel device-history table.

**Hermes-first analysis:** not applicable. This is a synchronous auth/mail security notification path, not a business-agent, MCP, or AI/provider-spend workflow.

**Plan**
- [x] Drift-check existing auth/mail/audit support for login metadata.
- [x] Add request IP/User-Agent propagation from `AuthController.login` to `AuthService.login`.
- [x] Log `ipAddress` and `userAgent` on `user_login` audit rows.
- [x] Send a non-blocking security email only when a successful password/Google login has prior metadata-bearing login history but no prior matching IP/User-Agent pair.
- [x] Seed metadata-bearing login audit rows on password and Google registration so the first later different-context login can alert.
- [x] Add MailService template and tests for HTML escaping.
- [x] Add focused AuthService/AuthController tests for metadata propagation, audit writes, first-login suppression, recognized-login suppression, normalized browser-version matching, unrecognized-login email, and mail-failure non-blocking.
- [x] Run focused tests and final review.
- [x] Open PR, wait for CI, and merge if clean.

**Verification so far**
- `pnpm install --frozen-lockfile` in isolated worktree (needed because worktree had no `node_modules`).
- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="auth.service|auth.controller|mail.service"`: PASS, 3 suites / 90 tests.
- `NODE_OPTIONS=--use-system-ca pnpm --dir packages/database exec prisma generate`: PASS. Needed only for the fresh isolated worktree because generated Prisma client was absent.
- `npx nx build @vizora/middleware`: PASS with existing webpack warnings.
- `pnpm --filter @vizora/middleware test -- --runInBand`: PASS, 141 suites / 2739 tests.
- PR #117 CI: PASS — audit, build, lint, security, test, and e2e.

**Review notes**
- Local `claude -p` review is blocked by operator auth (`Not logged in - Please run /login`). Fallback reviewers used via local subagent tool.
- Reviewer findings fixed: mail send and alert-history lookup now run after audit write in a fail-open background task; same-IP history lookup is bounded; prior rows are constrained to `createdAt < currentAuditLog.createdAt`; existing Google OAuth logins now pass IP/User-Agent through the same audit/alert path; password and Google registration now seed metadata-bearing login rows without sending an alert; Firefox `rv:` and mobile Edge UA version normalization are covered by tests.
- Final reviewer gate: CLEAN.

**Deploy status:** not deployed. No env/secrets/schema changes.

---

## Completed: Customer-1 Smoke Hardening (2026-05-31)

**Branch:** `feat/customer1-smoke-hardening`

**Why now:** `backlog.md` still gates customer-1 on C4/B16 smoke evidence. The existing `scripts/smoke/api-critical-path.sh` is useful, but it stops at auth, pairing-code generation, and list endpoints; it does not prove pair-complete, playlist creation, schedule assignment, or the device-side active-schedule read path.

**New primitives introduced:** none. This extends the existing smoke script/runbook only.

**Hermes-first analysis:** not applicable. This task is a repo-local launch-readiness smoke harness, not a business-agent/Hermes workflow, MCP tool, or AI/provider spend path.

**Plan**
- [x] Drift-check existing smoke/runbook coverage against current controllers.
- [x] Extend `scripts/smoke/api-critical-path.sh` with full customer path probes.
- [x] Update runbook wording so operators know the script now creates disposable smoke content/playlist/schedule/display rows.
- [x] Verify shell syntax and focused script behavior where local runtime permits.
- [x] Run Claude Code review before PR/merge decision.
- [x] Record tests, CI, residual runtime/operator risks.

**Review notes**
- Local Claude Code CLI hung/returned empty output twice; fallback subagent reviewer found three issues.
- Fixed blocking temp-file issue by using `umask 077` + private `mktemp -d` directory for cookie/token-bearing JSON and headers.
- Fixed prod-ingress runbook false-negative by removing direct public `:3002` HTTPS guidance. Realtime script health remains local to the VPS; public WebSocket ingress remains a real-device/manual walkthrough item.
- Residual: full real-stack smoke not run locally because Docker/services are unavailable in this environment, and prod smoke writes timestamped rows so it needs operator approval.

**Verification so far**
- `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh` — pass.
- Strict mocked success path with cookie + CSRF + device-token enforcement — pass, `ALL 23 CRITICAL-PATH CHECKS PASSED`.
- Unreachable-service failure-mode run — expected fail, 23 numbered failures, no missing temp-file noise.
- `git diff --check` — pass; line-ending warnings only.
- `shellcheck` unavailable in this environment.

---

## Current Status: Pilot Readiness Sprint COMPLETE (2026-02-09)

69/69 findings fixed + 32/32 remaining items addressed. 13 items intentionally deferred. All builds verified, all critical tests passing.

---

## Verification Checklist (Post-Fix)

- [x] `pnpm --filter @vizora/middleware test` — all 1460 tests pass
- [~] `pnpm --filter @vizora/realtime test` — 28 pass, 1 suite fails (pre-existing Prisma generate issue)
- [~] `pnpm --filter @vizora/web test` — 40+ suites pass, 2 admin test suites fail (pre-existing async Client Component issue tied to RSC migration deferral)
- [x] `npx nx build @vizora/middleware` — builds successfully
- [x] `npx nx build @vizora/realtime` — builds successfully
- [x] `npx nx build @vizora/web` — compiles successfully, all 35 routes generated
- [x] `docker-compose -f docker/docker-compose.yml config` — validates (requires GRAFANA_ADMIN_USER/PASSWORD env vars)
- [x] Spot-check: webhook endpoints have @Public() decorator
- [x] Spot-check: device JWT expiry is 90 days
- [x] Spot-check: loading.tsx files exist in all dashboard routes
- [x] Spot-check: `as any` eliminated from non-test middleware files

---

## Remaining Items — COMPLETED (2026-02-09)

### Database/Schema Suggestions
- [x] **PromotionRedemption Organization relation** — Added `@relation` with cascade delete, migration created
- [x] **ContentImpression retention script** — `scripts/cleanup-impressions.ts` with 90-day default, `scripts/setup-cron.sh` for daily job
- [~] **Display.jwtToken stored as full text** — DEFERRED: @db.Text is appropriate for JWTs
- [~] **Schedule.startTime/endTime as String** — DEFERRED: Data migration risk for existing records
- [~] **PlaylistItem unique constraint reordering** — DEFERRED: @@unique is correct, acceptable as-is

### Frontend Architecture
- [~] **Nearly all pages are client components** — DEFERRED: RSC migration of 49 pages is a separate project
- [x] **useAuth client-side flash** — Next.js middleware (`web/src/middleware.ts`) already handles server-side auth checks
- [x] **Duplicate `<main id="main-content">`** — Removed from root layout, kept in dashboard layout
- [x] **Inconsistent response envelope** — Created `ResponseEnvelopeInterceptor` applied globally, with `@SkipEnvelope()` decorator

### Code Quality
- [x] **ESLint configuration** — Created `.eslintrc.js` with TypeScript rules, added lint script to package.json
- [x] **Remove deprecated `csurf` devDependency** — Removed from middleware/package.json
- [x] **Remove unused `optional` package** — Removed from root package.json
- [x] **Synchronous file operations** — Replaced with `fs.promises` in content.controller.ts
- [x] **SanitizeInterceptor strips ALL HTML** — Added skip list for template fields (templateHtml, htmlContent, customCss)
- [x] **API versioning** — Changed to `/api/v1` prefix, nginx backwards-compat rewrite for `/api/`
- [x] **AllExceptionsFilter WebSocket guard** — Added `host.getType() === 'ws'` guard at top

### Remaining TODOs in Codebase
- [x] `billing/constants/plans.ts:21` — Documentation comment, not a TODO to fix. Left as-is.
- [x] `web/src/app/dashboard/content/page.tsx` — Implemented tag filter UI with chip/button toggles
- [x] `web/src/lib/error-handler.ts` — Added Sentry integration stub with `captureException`
- [x] `web/src/components/ErrorBoundary.tsx` — Connected to error-handler for error tracking
- [x] `ecosystem.config.js` — Already uses `GIT_REPO_URL` env var, added to `.env.example`

### Realtime / WebSocket Improvements
- [x] **Device DB existence check on connect** — Queries database after JWT verify, disconnects if device not found
- [x] **handleConnection decomposed** — Split into 5 methods: validateConnectionRate, authenticateConnection, setupDeviceRooms, sendInitialState, broadcastDeviceOnline
- [x] **leave:room authorization check** — Verifies `client.rooms.has(data.room)` before leaving
- [x] **Screenshot PNG/JPEG magic number validation** — Checks first bytes against PNG/JPEG signatures
- [x] **Screenshot base64 format validation** — Regex validates base64 format before Buffer.from()
- [x] **Realtime health endpoint** — Already exists (`/health`, `/health/live`, `/health/ready` in app.controller.ts)
- [x] **join:organization/join:room/leave:room DTOs** — Created JoinOrganizationDto, JoinRoomDto, LeaveRoomDto with class-validator
- [~] **Dashboard auth model** — Verified auth token passing in useRealtimeEvents; device-only auth is by design
- [~] **CPU usage calculation** — DEFERRED: Needs device firmware changes
- [~] **Android TV WebSocket integration** — DEFERRED: Separate feature

### Deployment / Infrastructure
- [x] **Grafana health check** — Added healthcheck to docker-compose (wget /api/health)
- [x] **Nginx health check** — Added healthcheck to docker-compose (curl /health), /health endpoint in nginx.conf
- [~] **Single Nginx instance (no HA)** — DEFERRED: Infrastructure architecture decision
- [~] **No service mesh / circuit breaker** — DEFERRED: Requires Consul/Istio
- [x] **Grafana admin credentials** — Changed to required env vars (no insecure defaults)
- [x] **Off-site backup** — Added optional S3 upload to backup-db.sh when BACKUP_S3_BUCKET is set
- [x] **API_PORT → MIDDLEWARE_PORT mismatch** — Fixed in env.validation.ts
- [x] **Missing BCRYPT_ROUNDS in Zod schema** — Added with min(10).max(15).default(12)
- [x] **Rotate dev secrets enhancement** — Added BCRYPT_ROUNDS and MinIO/PostgreSQL rotation instructions

### Test Coverage Gaps — DEFERRED (Separate Sprint)
- [~] Web dashboard at 23% coverage
- [~] Middleware branch coverage at 58%
- [~] Display client has zero test coverage
- [~] React act() warnings in Toast tests
- [~] Increase realtime test coverage

---

## Completed Workstreams

### Phase 1: Pilot Readiness Fixes (2026-02-09)
| WS | Description | Agent | Items |
|----|-------------|-------|-------|
| WS1 | Security Hardening | security-fixer | 11 fixes |
| WS2 | Realtime Hardening | realtime-fixer | 12 fixes + 47 tests |
| WS3 | Architecture Refactor | arch-fixer | 5 refactors |
| WS4 | Test Fixes | arch-fixer | 84+34 tests fixed + rate limit E2E |
| WS5 | Frontend Polish | frontend-fixer | 13 loading states + console cleanup |
| WS6 | Deployment Infrastructure | infra-fixer | 16 infra items |
| WS7 | Code Quality | infra-fixer | 4 quality items |
| WS8 | Documentation | frontend-fixer | 3 docs |

### Phase 2: Remaining Items (2026-02-09)
| WS | Description | Agent | Items |
|----|-------------|-------|-------|
| WS-A | Database & Deployment | schema-deploy-fixer | 9 items |
| WS-B | Realtime Hardening | realtime-hardener | 7 items |
| WS-C | Code Quality | code-quality-fixer | 7 items |
| WS-D | Frontend & TODOs | frontend-fixer | 9 items |

### Deferred Items (13)
| Item | Reason |
|------|--------|
| RSC migration (49 client pages) | Separate project |
| Nginx HA (redundancy) | Infrastructure decision |
| Service mesh / circuit breaker | Infrastructure decision |
| Android TV WebSocket integration | Separate feature |
| Web test coverage 23% → higher | Separate test sprint |
| Middleware branch coverage 58% → 80% | Separate test sprint |
| Display client test coverage (0%) | Separate test sprint |
| Toast act() warnings | Low priority |
| More realtime edge case tests | Separate test sprint |
| Schedule startTime/endTime to Int | Data migration risk |
| PlaylistItem reorder friction | Acceptable as-is |
| Display.jwtToken optimization | Acceptable as-is |
| CPU delta measurement | Needs firmware changes |

---

## Active Workstream: Customer Performance Pass 12 (2026-05-31)

Branch: `feat/customer-performance-pass-12`
Plan: `docs/plans/2026-05-31-customer-performance-pass-12.md`

- [x] Collect customer-dashboard and performance read-only reviews.
- [x] Pick a small backend performance slice that is repo-side and testable.
- [x] Document pass 12 design and test plan.
- [x] Share bounded JSON response reader between Generic API widgets and legacy template data sources.
- [x] Return cached media 304s without opening MinIO object streams while preserving stale-object recovery.
- [x] Skip realtime impression display lookup when authenticated socket organization context is available.
- [x] Run multiple subagent diff reviews before tests.
- [x] Run focused middleware/realtime tests.
- [x] Run relevant broader builds/tests and changed-file lint.
- [x] Open PR, wait for CI, merge if green. PR #135 merged to `origin/main` at `1618f31f9e151ca394f4e0471e457267805415a9`.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

## Active Workstream: Customer Dashboard Trust Pass 13 (2026-05-31)

Branch: `feat/customer-dashboard-trust-pass-13`
Plan: `docs/plans/2026-05-31-customer-dashboard-trust-pass-13.md`

- [x] Document pass 13 design and test plan.
- [x] Add dashboard storage API client method for the existing organization storage endpoint.
- [x] Pass server-fetched pagination completeness, storage, and readiness data into the dashboard client.
- [x] Replace hardcoded dashboard system/storage indicators with real readiness and storage state.
- [x] Skip redundant mount-time content/playlist fetches when SSR pagination proves the data is complete.
- [x] Run multiple subagent diff reviews before tests. UI/trust reviewer CLEAN; API/data/performance reviewer CLEAN. Follow-up UI review for the dashboard layout hydration fix CLEAN.
- [x] Run focused dashboard tests and broader web verification:
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard-(page|server-page)"` — 2 suites / 18 tests pass.
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=server-api` — 1 suite / 3 tests pass.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` — pass.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint ...changed web files...` — 0 errors, 19 existing `any` warnings.
  - `npx nx build @vizora/web` — pass.
  - `pnpm --filter @vizora/web test -- --runInBand` — 95 suites / 977 tests pass; unrelated existing act warnings remain in non-dashboard suites.
  - Playwright browser smoke against `next start` on `localhost:3001`: desktop and mobile dashboard render with no page errors after the layout hydration fix; screenshots in `logs/dashboard-pass13-{desktop,mobile}.png`.
- [x] Open PR, wait for CI, merge if green. PR #139 opened; CI passed audit, lint, security, build, test, and e2e.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

## Next Up (Not Started)

Continue the ranked customer/performance findings after pass 13: shared dashboard
Socket.IO provider, server-side content-library search, playlist summary payloads,
org broadcast scaling, and template refresh scheduling.

---

## Active Workstream: Pairing Active List Performance Pass 16 (2026-05-31)

Branch: `feat/device-content-streaming-pass-16`
Plan: `docs/plans/2026-05-31-pairing-active-list-performance-pass-16.md`

- [x] Drift-check old device streaming bottleneck against current code.
- [x] Identify residual pairing-dashboard serial Redis/DB work.
- [x] Document pass 16 design and test plan.
- [x] Add failing unit tests for batched active-pairing Redis reads and display ownership lookup.
- [x] Implement batched Redis `MGET` parsing and one-query display ownership lookup in existing `PairingService`.
- [x] Run multiple subagent reviews before broader tests.
- [x] Run focused pairing/display middleware tests.
- [x] Run broader middleware verification and build.
- [x] Open PR, wait for CI, merge if green. PR #139 merged to `origin/main` at `f9a3df8ad802caaa4a9a7e737e4fd6ff2b4dce60`.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

**Pass 16 verification**
- Red/green TDD:
  - Initial `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=pairing.service` failed on the new batching assertions before implementation.
  - Post-fix focused run passed: 1 suite / 32 tests.
- Reviewer gate:
  - Security/tenant/architecture reviewer: CLEAN; focused pairing suite passed.
  - Redis/performance/test-safety reviewer: CLEAN; focused pairing suite, middleware build, and `git diff --check` passed.
- Local verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/displays/pairing.service.spec.ts src/modules/displays/pairing.controller.spec.ts src/modules/displays/displays.service.spec.ts src/modules/displays/displays.controller.spec.ts` — 4 suites / 103 tests passed.
  - `pnpm --filter @vizora/middleware test -- --runInBand` — 143 suites / 2876 tests passed.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` — passed.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint middleware/src/modules/displays/pairing.service.ts middleware/src/modules/displays/pairing.service.spec.ts` — 0 errors, 1 pre-existing warning in `pairing.service.spec.ts`.
  - `npx nx build @vizora/middleware` — passed with existing webpack warnings.
  - `git diff --check` — passed with CRLF warnings only.
- CI verification:
  - PR #139 passed audit, lint, security, build, test, and e2e before merge.

## Active Workstream: Playlist List Payload Performance Pass 17 (2026-06-01)

Branch: `feat/playlist-list-payload-pass-17`
Plan: `docs/plans/2026-06-01-playlist-list-payload-performance-pass-17.md`

- [x] Drift-check playlist list/detail split and dashboard consumers.
- [x] Document pass 17 design and test plan.
- [x] Add failing unit test for nested content projection on playlist lists.
- [x] Implement minimal content projection in existing `PlaylistsService.findAll`.
- [x] Run multiple subagent reviews before broader tests.
- [x] Run focused playlist middleware tests.
- [x] Run broader middleware verification and build.
- [x] Open PR, wait for CI, merge if green. PR #140 merged to `origin/main` at `a3b4380ebbb5a6196ac66db8971060120471b663`.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

**Pass 17 verification**
- Red/green TDD:
  - Initial `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=playlists.service` failed on the new projection assertion while `findAll` still used `content: true`.
  - Post-fix focused run passed: playlist service suite 30 tests.
- Reviewer gate:
  - Backend correctness/Prisma/tenant reviewer: CLEAN.
  - API/frontend contract reviewer first found a medium summary-type contract gap; fixed with `PlaylistSummary` typing and consumer updates.
  - Follow-up backend reviewer: CLEAN.
  - Follow-up API/frontend contract reviewer: CLEAN.
- Local verification:
  - `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/playlists/playlists.service.spec.ts src/modules/playlists/playlists.controller.spec.ts` — 2 suites / 42 tests passed.
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="playlists-page|content-page|devices-page|schedules-page|PlaylistPreview|DeviceQuickChange"` — 6 suites / 100 tests passed, with pre-existing React `act()` warnings.
  - `pnpm --filter @vizora/middleware test -- --runInBand` — 143 suites / 2877 tests passed.
  - `pnpm --filter @vizora/web test -- --runInBand` — 95 suites / 982 tests passed, with pre-existing React `act()`/jsdom navigation warnings.
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` — passed.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` — passed.
  - `ESLINT_USE_FLAT_CONFIG=false npx eslint ...changed files...` — 0 errors, existing warnings remain in touched web files.
  - `npx nx build @vizora/middleware` — passed after killing abandoned local e2e Jest processes that held the generated Prisma directory; existing webpack warnings remain.
  - `NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web` — passed.
  - `git diff --check` — passed with CRLF warnings only.
- Local e2e status:
  - `pnpm --filter @vizora/middleware test:e2e -- --runInBand --testPathPattern=playlists` timed out locally because Docker Desktop is unavailable and test DB/Redis ports `5433`/`6380` are closed. CI e2e must verify the added playlist list contract test.
- CI verification:
  - PR #140 passed audit, lint, security, build, test, and e2e before merge.

## Active Workstream: Content Library Search Performance Pass 18 (2026-06-01)

Branch: `feat/content-library-search-pass-18`
Plan: `docs/plans/2026-06-01-content-library-search-performance-pass-18.md`

- [x] Drift-check content API search and dashboard content consumers.
- [x] Document pass 18 design and test plan.
- [x] Add failing ContentLibraryPanel test for server-side search.
- [x] Implement debounced server-side search and pagination reset.
- [x] Run multiple subagent reviews before broader tests.
- [x] Run focused playlist-builder web tests.
- [x] Run broader web verification and build.
- [ ] Open PR, wait for CI, merge if green.
- [ ] Deploy status: blocked unless production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

**Pass 18 verification**
- Red/green TDD:
  - Initial `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=PlaylistBuilder` failed on the new server-search assertion while `ContentLibraryPanel` only filtered the current page locally.
  - Reviewer-driven red cases reproduced stale response ordering, debounce-window stale response, whitespace-only page reset/refetch, and stale pagination during pending search before the final fixes.
  - Post-fix focused run passed: `PlaylistBuilder` suite 29 tests.
- Reviewer gate:
  - Initial API/performance reviewer: NOT CLEAN; found stale response race and whitespace-only excess fetch.
  - Initial React/UX/test reviewer: NOT CLEAN; found stale response race and missing pagination/filter coverage.
  - Follow-up API reviewer: NOT CLEAN; found whitespace-only edit reset/refetch from page 2.
  - Follow-up React reviewer: NOT CLEAN; found debounce-window stale response.
  - Final clean-gate reviewers after request invalidation and pagination guard: CLEAN / CLEAN.
- Local verification:
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=PlaylistBuilder` - 1 suite / 29 tests passed, with existing React `act()` warnings.
  - `pnpm --filter @vizora/web test -- --runInBand` - 95 suites / 987 tests passed, with existing React `act()`/console warnings.
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - passed.
  - `$env:ESLINT_USE_FLAT_CONFIG='false'; npx eslint web/src/components/playlist/ContentLibraryPanel.tsx web/src/components/__tests__/PlaylistBuilder.test.tsx` - 0 errors, 0 warnings in touched files.
  - `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 pnpm --filter @vizora/web build` - passed with existing Next middleware/proxy and TS project-reference warnings.
  - `git diff --check` - passed with CRLF warnings only.
