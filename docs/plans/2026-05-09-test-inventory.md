# Vizora Test Inventory & Coverage Map

**Generated:** 2026-05-09 (auditor: Claude Opus 4.7, agent thread)
**Purpose:** Production-readiness assessment — first customer deployment in 4 days. This file is the testing-coverage half of the go/no-go decision.
**Scope:** All in-tree code, all tests, all evaluation reports. Excludes node_modules and the parked `feat/design-explorations` branch.
**Methodology:** File enumeration via `Glob` + `find`, doc reading via `Read`, no test execution (parallel agent owns runs).

---

## 0. Headline numbers

| Surface | Spec files | Status (most recent run on record) |
|---|---|---|
| Middleware unit (jest) | **124** spec files | 1,838 tests — all pass at last full run (2026-03-07 PR-readiness fix sprint, `docs/plans/2026-03-07-production-readiness-fixes.md`) |
| Middleware E2E (jest, real DB) | **6** `*.e2e-spec.ts` files in `middleware/test/` + 3 `*.e2e.spec.ts` in `middleware/src/__tests__/` | Requires `docker-compose.test.yml` up; not run since 2026-03-08 hardening session |
| Realtime unit (jest) | **10** spec files | 206 tests — all pass at last full run |
| Web unit (jest + jsdom + RTL) | **79** test files (`*.test.{ts,tsx}`) | 843 tests across 75 suites — all pass at last full run (post `b712211` admin-RSC fix) |
| Playwright E2E | **24** spec files in `e2e-tests/` | Requires all services + display device. Last full run referenced in `vizora-comprehensive-e2e-report.md` (2026-03-09); 62/76 passed at 88/100 score |
| Display (Electron) | **6** spec files (in tree but **non-functional** per `hardening-summary.md`) | "0% functional test coverage" — Electron framework not wired |
| Packages (database, shared) | 0 spec files | No coverage |
| **Aggregate** | **~250 spec files** | **~3,000+ tests on record (in mid-March 2026)** |

> The aggregate "all pass" line is from the 2026-03-08 hardening session (`hardening-summary.md` — "2042/2045 passing across middleware + realtime"). The numbers have grown since but no full re-run is on record after the lifecycle/Hermes work landed. **Re-run before launch.**

---

## 1. Modules

### 1.1 Middleware modules (`middleware/src/modules/`)

27 NestJS modules. Below: name → file count guide → test status.

| Module | Path | Spec files | Coverage | Notes |
|---|---|---|---|---|
| **admin** | `middleware/src/modules/admin/` | 9 spec files (controller + 7 services + super-admin guard) | **Strong** | platform-stats, platform-health, system-config, organizations-admin, users-admin, security-admin, plans, promotions, announcements, audit |
| **agents** | `middleware/src/modules/agents/` | 7 spec files (controller, ai/heuristic, customer-incident, agent-state.schema, agent-state.service, onboarding, agent-runs.service) + ecosystem-hermes-args spec | **Strong** | PR #32, #38 hardening |
| **analytics** | `middleware/src/modules/analytics/` | 2 (controller + service) | **Adequate** | |
| **api-keys** | `middleware/src/modules/api-keys/` | 3 (controller + service + guard) | **Strong** | |
| **auth** | `middleware/src/modules/auth/` | 9 spec files (controller, service, jwt strategy, jwt-auth.guard, roles.guard, current-user/public/roles decorators) | **Strong** | 1028 LoC service. C4/C5 fixes verified via specs. |
| **billing** | `middleware/src/modules/billing/` | 6 spec files (controller, service, webhooks.controller, stripe.provider, razorpay.provider, quota.guard, subscription-active.guard) | **Strong** | 900 LoC service; `billing-test-report.md` (2026-03-25) — 14/25 PASS, 11 BLOCKED on missing Stripe/Razorpay keys in prod |
| **common** | `middleware/src/modules/common/` | 8 spec files (csrf.guard, all-exceptions.filter, response-envelope.interceptor, sanitize.interceptor, logging.interceptor, parse-id.pipe, organization decorator, geo.service, circuit-breaker.service, data-retention.service) | **Strong** | |
| **config** | `middleware/src/modules/config/` | 1 (env.validation) | Minimal but adequate | |
| **content** | `middleware/src/modules/content/` | 11 spec files (content.controller, content.service, device-content.controller, file-validation.service, template-rendering.service, template-refresh.service, thumbnail.service, rss-parser, controllers/templates, controllers/widgets, controllers/layouts, controllers/bulk-operations) | **Very strong** | 1576 LoC service; `content-lifecycle-test-report.md` (2026-03-24) — 9/9 pass, 1 bug fixed (CUID vs UUID) |
| **database** | `middleware/src/modules/database/` | 0 | None (Prisma client wrapper) | acceptable |
| **display-groups** | `middleware/src/modules/display-groups/` | 2 (controller + service) | **Adequate** | |
| **displays** | `middleware/src/modules/displays/` | 5 spec files (displays.controller, displays.service, displays.service.bulk, pairing.controller, pairing.service) | **Strong** | 808 LoC service. Pairing is core flow — test footprint matches risk. |
| **fleet** | `middleware/src/modules/fleet/` | 2 (controller + service) | **Adequate** | Emergency override + push-to-group. `realtime-test-report.md` flagged a build-staleness bug here. |
| **folders** | `middleware/src/modules/folders/` | 2 (controller + service) | **Adequate** | |
| **health** | `middleware/src/modules/health/` | 5 spec files (controller, service, continuous-health-monitor, regression-guards, startup-self-test) + endpoint-smoke E2E | **Very strong** | Health-infrastructure feature shipped 2026-03-10 |
| **mail** | `middleware/src/modules/mail/` | 0 spec files | **GAP** | Mail service has no specs in tree (verify by reading directory) |
| **mcp** | `middleware/src/modules/mcp/` | 3 spec files (mcp.service, mcp-controller-paths, mcp-exception.filter) + tools/admin/audit/auth subdirs | **Adequate-to-strong** | New module (PR #42 +). Tool-level specs live in `tools/` subdir. |
| **metrics** | `middleware/src/modules/metrics/` | 3 spec files (controller, service, interceptor) | **Strong** | |
| **notifications** | `middleware/src/modules/notifications/` | 2 (controller + service) | **Adequate** | Historical 400 bug from comprehensive-e2e-report fixed in `feat/week1-unblocked-tasks` |
| **organizations** | `middleware/src/modules/organizations/` | 3 spec files (controller, service, feature-flags.service) | **Strong** | |
| **playlists** | `middleware/src/modules/playlists/` | 2 (controller + service) | **Adequate** | 498 LoC service |
| **redis** | `middleware/src/modules/redis/` | 1 (service) | **Adequate** | |
| **schedules** | `middleware/src/modules/schedules/` | 2 (controller + service) | **Adequate** | |
| **storage** | `middleware/src/modules/storage/` | 1 (service) + storage-quota.service.ts (no spec) | **Partial** | `storage-quota.service.ts` has no spec. |
| **support** | `middleware/src/modules/support/` | 4 spec files (controller, service, support-classifier, support-knowledge) | **Strong** | |
| **template-library** | `middleware/src/modules/template-library/` | 2 (controller + service) | **Adequate** | seed/ subdir for catalog |
| **users** | `middleware/src/modules/users/` | 4 spec files (controller, service, audit-log.controller, audit-log.service) | **Strong** | C5 (Math.random → crypto) verified |

App-level: `app.controller.spec.ts`, `app.service.spec.ts` (2 specs).

**Module-by-module verdict:** Coverage is broad and deep. Two named gaps: **mail** (no specs visible — outbound email is the B5/B6/B7 launch blocker), **storage-quota.service.ts** (no spec).

### 1.2 Realtime modules (`realtime/src/`)

| Layer | Path | Spec files | Coverage | Notes |
|---|---|---|---|---|
| Gateways | `realtime/src/gateways/` | 2 (`device.gateway.spec.ts`, `pipes/ws-validation.pipe.spec.ts`) | **Strong for surface area** | 1441 LoC main gateway. Has `WsAllExceptionsFilter` (PR fix for H10). |
| Services | `realtime/src/services/` | 4 (heartbeat, notification, playlist, redis) | **Adequate** | |
| Storage | `realtime/src/storage/` | 1 (storage.service) | Adequate | |
| Adapters | `realtime/src/adapters/` | 1 (redis-io.adapter) | Adequate | Pub/sub for cluster |
| Metrics | `realtime/src/metrics/` | 1 (service) | Adequate | |
| App | `realtime/src/app/` | 1 (app.controller) | Adequate | |
| Guards / Interceptors / Config / DTOs / Storage / Types | various | 0 | None | Mostly thin wrappers; lower test priority |

### 1.3 Web modules (`web/src/`)

App Router routes (`web/src/app/`):

| Top-level route | Has page tests? | Notes |
|---|---|---|
| `(auth)/` (login, register, forgot-password) | ✓ login + register | forgot-password page has no test on file |
| `dashboard/` (overview) | ✓ `dashboard-page.test.tsx` | |
| `dashboard/analytics` | ✓ | |
| `dashboard/content` | ✓ | |
| `dashboard/devices` | ✓ | |
| `dashboard/health` | ✓ | |
| `dashboard/help` | ✗ | static help page |
| `dashboard/layouts` | ✓ | |
| `dashboard/ops` | ✗ | new admin ops dashboard — **GAP** |
| `dashboard/playlists` | ✓ | |
| `dashboard/schedules` | ✓ | |
| `dashboard/settings/*` | ✓ for: api-keys, audit-log, billing (3 specs), customization, feature-flags, team. Profile/Account UI = no top-level test on file. | |
| `dashboard/templates` | ✓ | |
| `dashboard/widgets` | ✓ | |
| `admin/*` | ✓ for: admin-dashboard, organizations-page, plans-page, support, analytics, health, users | Historical RSC failures fixed in `b712211`. |
| `display/` (sub-route) | ✗ | small page, low risk |
| `backlog/`, `privacy/`, `refund/`, `sla/`, `terms/`, `not-found.tsx`, `error.tsx`, `global-error.tsx` | ✗ | static legal/marketing/error pages — low test priority |

Components: 33 component test files in `web/src/components/__tests__/` covering Toast, Modal, ErrorBoundary, NotificationBell, ConfirmDialog, PlaylistBuilder, ScheduleCalendar, DeviceQuickChange, FleetCommandDropdown, EmergencyOverrideModal, ActiveOverrideBanner, etc.

Hooks/utils: 12 hook tests in `web/src/lib/hooks/__tests__/` (useAuth, useSocket, useRealtimeEvents, useDebounce, useNotifications, useOptimisticState, useErrorRecovery, usePlaylistHistory, useTheme, useChartData, useAnalyticsData) + 3 utility tests (error-handler, retry, validation).

### 1.4 Display (Electron) — `display/`

| Path | Spec files | Status |
|---|---|---|
| `display/src/electron/` | 4 (cache-manager, device-client, main, preload) | Spec files exist — **but `hardening-summary.md` and `production-readiness-report.md` L3 both confirm 0% functional coverage** (Electron testing framework not wired). Test runner does not execute these. |
| `display/src/app/` | 1 (app.element.spec.ts) | Same status as above |
| `display/e2e-tests/` | 1 (display-app.spec.ts) | Same status |

**Treat Electron as untested for production-readiness purposes.** Re-pairing on each release is the operational mitigation.

### 1.5 Packages

| Package | Path | Spec files | Coverage |
|---|---|---|---|
| `@vizora/database` | `packages/database/` | 0 | Acceptable — Prisma client wrapper. Schema validity is checked at build time. |
| `@vizora/shared` | `packages/shared/` | 0 | Acceptable — pure types/util. |

### 1.6 Scripts (ops + business agents)

| Path | Files | Spec files | Coverage |
|---|---|---|---|
| `scripts/ops/` | 7 ops agents + lib/ | 0 in tree | Lib has manual integration verification only. Production observed via Slack/health-guardian. |
| `scripts/agents/` | 6 business-agent scaffolds + lib/ + hermes/ | 0 in tree | The 2 live agents (support-triage, customer-lifecycle) are observed in shadow mode via JSONL logs. **No automated coverage of the cron logic itself.** |

---

## 2. Customer-facing features → test surface map

The "feature" rows are what a customer-#1 user actually exercises. Coverage columns map to the test surfaces above.

| Feature | Module(s) | Unit | Integration / E2E middleware | Web component | Playwright E2E | Manual reports on record |
|---|---|---|---|---|---|---|
| **Register / signup** | `auth`, `organizations` (org auto-create) | ✓ auth.service, organizations.service | ✓ `auth.e2e-spec.ts` | ✓ `register-page.test.tsx` | ✓ `01-auth.spec.ts` | `frontend-test-report.md` 10/10 |
| **Login / logout** | `auth` | ✓ auth.controller, auth.service | ✓ `auth.e2e-spec.ts` | ✓ `login-page.test.tsx` | ✓ `01-auth.spec.ts` | `frontend-test-report.md` 12/12, `security-test-report.md` 5/5 |
| **Forgot / reset password** | `auth` | ✓ included in auth.service | ✓ partial in `auth.e2e-spec.ts` | ✗ no UI test | (covered in 01-auth) | `frontend-test-report.md` 5/5 |
| **Account deletion (GDPR)** | `auth` (DELETE /auth/account), `organizations` | ✓ auth.controller (verified `day5-6-verification.md`) | ✓ via auth.e2e | ✗ | ✗ | `day5-6-verification.md` 12/12 |
| **Cookie consent** | web component | n/a | n/a | ✗ no dedicated test | (passive presence in 01-auth) | `day5-6-verification.md` 10/10 |
| **Pair display device** | `displays/pairing.*`, `realtime/gateways/device.gateway` | ✓ pairing.controller, pairing.service, device.gateway | ✓ `displays.e2e-spec.ts` | ✓ via DevicePreviewModal etc. | ✓ `03-displays.spec.ts`, `22-device-preview.spec.ts` | `vizora-comprehensive-e2e-report.md` 6/6, `vizora-e2e-retest-report.md` (real-device) |
| **Device WebSocket connect / heartbeat** | realtime gateway, `displays` heartbeat | ✓ device.gateway, heartbeat.service, ws-validation.pipe | (no explicit middleware E2E) | ✓ useSocket, useRealtimeEvents | ✓ `09-device-status.spec.ts`, `13-health-monitoring.spec.ts` | `realtime-test-report.md` 26/28 (2 blocked = need physical device) |
| **Upload content** (image/video/url/html) | `content`, `content/file-validation`, `storage` | ✓ content.service, file-validation.service | ✓ `content.e2e-spec.ts` | ✓ content-page test | ✓ `04-content.spec.ts`, `20-content-folders.spec.ts` | `content-lifecycle-test-report.md` 3/3 |
| **Template library / seeded templates** | `template-library`, `content/template-rendering` | ✓ template-library.service + template-rendering.service | (no E2E spec dedicated) | ✓ templates-page test | (covered in 04 / 20 / dashboard nav) | `frontend-test-report.md` 12/12 templates |
| **Template editor** | client-side, `content/controllers/templates` | ✓ templates.controller | (no E2E) | ✗ no editor unit test | ✗ none dedicated | `vizora-comprehensive-e2e-report.md` 5/7 (2 skipped — needs deeper probe) |
| **Create / edit playlist** | `playlists` | ✓ playlists.controller, playlists.service | ✓ `playlists.e2e-spec.ts` | ✓ playlists-page, PlaylistBuilder, PlaylistPreview, PlaylistQuickSelect | ✓ `05-playlists.spec.ts`, `18-playlist-builder.spec.ts` | `content-lifecycle-test-report.md` 5/5 (1 critical CUID-vs-UUID bug found + fixed in `432c876`) |
| **Schedule a playlist** | `schedules` | ✓ schedules.controller, schedules.service | (no dedicated E2E spec) | ✓ schedules-page, ScheduleCalendar, DaySelector, TimePicker | ✓ `06-schedules.spec.ts` | `content-lifecycle-test-report.md` 1/1 |
| **Push content to device (live)** | `fleet`, realtime gateway | ✓ fleet.controller, fleet.service, device.gateway | (no dedicated E2E) | ✓ FleetCommandDropdown, EmergencyOverrideModal, ActiveOverrideBanner | (covered in 03 / 09) | `realtime-test-report.md` — fleet command rebuild bug fixed 2026-03-25 |
| **Device health / fleet view** | `fleet`, `displays`, `health` | ✓ fleet.service, displays.service, continuous-health-monitor | (none) | ✓ DeviceHealthMonitor, DeviceStatusIndicator | ✓ `09-device-status.spec.ts`, `13-health-monitoring.spec.ts` | `realtime-test-report.md` 3/3 heartbeat |
| **Display groups** | `display-groups` | ✓ controller, service | (none) | ✓ DeviceGroupSelector | ✓ `11-device-groups.spec.ts` | |
| **Folders** | `folders` | ✓ controller, service | (none) | ✓ FolderTree, FolderBreadcrumb | ✓ `20-content-folders.spec.ts` | |
| **Tags / content tagging** | `content` (tags inside) | (covered in content.controller) | ✓ part of `content.e2e-spec.ts` | ✓ ContentTagger | ✓ `12-content-tagging.spec.ts` | |
| **Notifications (in-app)** | `notifications` | ✓ controller, service | (none dedicated) | ✓ NotificationBell, NotificationDropdown, useNotifications | ✓ `21-notifications.spec.ts` | Historical 400 bug fixed; `frontend-test-report.md` 8/8 |
| **Realtime dashboard updates** | realtime gateway → org room | ✓ gateway suite | (none) | ✓ useSocket, useRealtimeEvents | (passive in 09 / 13) | `realtime-test-report.md` 3/3 dashboard |
| **Analytics (charts)** | `analytics`, `content/ContentImpression` | ✓ analytics.controller, service | (none) | ✓ analytics-page, useChartData, useAnalyticsData | ✓ `07-analytics.spec.ts`, `10-analytics-integration.spec.ts` | `frontend-test-report.md` covered |
| **Billing — show plans** | `billing` | ✓ billing.service, billing.controller | (none dedicated) | ✓ billing/plans-page test | ✓ `16-billing.spec.ts` | `billing-test-report.md` 5/5 plans display |
| **Billing — checkout (Stripe)** | `billing/providers/stripe` | ✓ stripe.provider | (none — no test mode keys) | (none) | (16-billing covers UI flow) | `billing-test-report.md` 0/3 BLOCKED on missing keys |
| **Billing — checkout (Razorpay)** | `billing/providers/razorpay` | ✓ razorpay.provider | (none) | (none) | (none) | `billing-test-report.md` 0/4 BLOCKED on missing keys |
| **Billing webhooks** | `billing/webhooks.controller` | ✓ webhooks.controller (post-`acbbb01` fix) | (none) | (none) | (none) | `billing-test-report.md` 4/4 |
| **Quota enforcement (screen limit)** | `billing/guards/quota.guard`, `displays.service` | ✓ quota.guard | ✓ `displays.e2e-spec.ts` exercises path | (none) | (passive in 03) | `billing-test-report.md` 2/2 |
| **API keys** | `api-keys` | ✓ controller, service, guard | (none) | ✓ api-keys page | ✓ `19-api-keys.spec.ts` | |
| **Audit log** | `users/audit-log.*`, `admin/admin-audit.service` | ✓ both services | (none dedicated) | ✓ audit-log page | ✓ `24-team-audit.spec.ts` | |
| **Team / multi-user invite** | `users`, `auth` | ✓ users.controller, service | ✓ `auth.e2e-spec.ts` | ✓ team page | ✓ `24-team-audit.spec.ts` | |
| **Support chat (in-app)** | `support` | ✓ support.controller, service, classifier, knowledge | (none) | ✓ SupportChat | ✓ `17-admin.spec.ts` (admin support view) | |
| **Settings — profile, customization, feature flags** | `users`, `organizations` | ✓ users.service, organizations.service, feature-flags.service | (none) | ✓ each `__tests__/` page | (covered in 08-settings) | |
| **Admin panel (super-admin)** | `admin` | ✓ all 7 services | (none) | ✓ admin pages | ✓ `17-admin.spec.ts` | `frontend-test-report.md` admin not deeply tested |
| **Health / startup self-test** | `health` | ✓ all 5 specs | ✓ `endpoint-smoke.e2e.spec.ts`, `health.e2e.spec.ts` | ✓ health page | ✓ `13-health-monitoring.spec.ts` | Verified ops `health-guardian` running |
| **Comprehensive nav / cross-feature integration** | n/a | n/a | n/a | n/a | ✓ `15-comprehensive-integration.spec.ts`, `23-comprehensive-validation.spec.ts` | `vizora-comprehensive-e2e-report.md` 76 tests |
| **Command palette (cmd-K)** | web component | n/a | n/a | ✓ CommandPalette, Wrapper | ✓ `14-command-palette.spec.ts` | |
| **Dashboard overview** | n/a | n/a | n/a | ✓ dashboard-page | ✓ `02-dashboard.spec.ts` | `frontend-test-report.md` 18/18 |
| **MCP server (agents-only)** | `mcp` | ✓ service, exception filter, controller paths, tools/* | (none) | n/a | n/a | Not customer-facing in v1 |
| **Hermes business agents (shadow)** | `scripts/agents/hermes/`, `scripts/agents/customer-lifecycle.ts`, `scripts/agents/support-triage.ts` | 0 — observed via JSONL logs | n/a | n/a | n/a | `tasks/feature-backlog.md` shadow data gate pending (≥7 days) |
| **Email outbound (transactional)** | `mail` (and lifecycle agent) | **0 visible specs** | (none) | n/a | n/a | `backlog.md` B1-B7: SMTP not configured on prod. Customer-lifecycle is dry-run (`LIFECYCLE_LIVE` unset). **GAP.** |

---

## 3. Test surface counts (precise)

| Surface | Count | Source command |
|---|---|---|
| Middleware unit specs | **124** | `find middleware/src -name '*.spec.ts'` |
| Middleware E2E specs | **6** in `middleware/test/` (`agents`, `auth`, `content`, `displays`, `playlists`, `rate-limit`) + **3** `*.e2e.spec.ts` files in `middleware/src/__tests__/` (`auth`, `health`, `endpoint-smoke`) | `Glob middleware/test/**/*.e2e-spec.ts` |
| Realtime unit specs | **10** | `find realtime/src -name '*.spec.ts'` |
| Web unit/component/hook tests | **79** | `find web/src -name '*.test.ts*'` |
| Playwright E2E specs | **24** (`01-auth` … `24-team-audit`) | `Glob e2e-tests/*.spec.ts` |
| Display Electron specs (in tree, **not run**) | 6 | `find display/src display/e2e-tests -name '*.spec.ts'` |
| Packages specs | **0** | `find packages -name '*.spec.ts' -not -path '*/node_modules/*'` |

### Tests-per-suite estimates (last full runs on record)

| Service | Suites (≈) | Tests (≈) | Last run on record |
|---|---|---|---|
| Middleware | 89 | 1,838 | 2026-03-07 (`production-readiness-fixes.md` Execution Summary) |
| Realtime | 9 | 206 | same |
| Web | 75 | 843 | same |
| Display | 0 functional | 0 | 2026-03-08 hardening summary |
| Playwright | 24 specs | (per-spec varies; comprehensive run: 76 scenarios) | 2026-03-09 (`vizora-comprehensive-e2e-report.md`) |
| **Aggregate** | **173+** | **~2,890+ functional** | |

The README and `CLAUDE.md` both quote slightly different numbers (1,700+ / 1,917 / 2,042 — see `backlog.md` 2026-03-18 + `hardening-summary.md` 2026-03-08). All are within the same order of magnitude. **Treat any single number as approximate; verify with a fresh run before making the launch claim.**

---

## 4. Risk areas with NO test coverage (or thin coverage)

Ranked by customer-facing blast radius for the upcoming first-customer launch.

### 4.1 SHIP-BLOCKING (must verify before customer #1)

1. **Outbound email path (transactional + lifecycle).** `middleware/src/modules/mail/` — no spec files visible. `backlog.md` items B1-B7 are open: SMTP not configured on prod, no E2E test of any of the 8 existing email types. Customer-lifecycle agent is in dry-run on prod (`LIFECYCLE_LIVE` unset). **A new customer who never receives the welcome email will think Vizora is broken.**
2. **Stripe / Razorpay live checkout.** `middleware/src/modules/billing/providers/{stripe,razorpay}.provider.ts` are unit-tested but `billing-test-report.md` documents 11/25 tests BLOCKED on prod because no live API keys. **Customer #1 cannot pay.** Mitigation: launch on free tier; gate payment behind manual ops outreach until B8-B15 close.
3. **Display (Electron) client.** Zero functional test coverage in the tree (specs exist but framework not wired — `hardening-summary.md` deferred item #1, `production-readiness-report.md` L3, `backlog.md` K4). vizora-tv (Android TV — extracted to standalone repo) has its own coverage gap (`MEMORY.md`: "vizora-tv tests broken — Vitest not configured for `globals: true`"). **The display app is what the customer's actual screen runs.** Mitigation: 2026-03-06 manual E2E walkthrough on real device (`vizora-e2e-retest-report.md`) — do that again on customer hardware before go-live.
4. **`web/src/app/dashboard/ops/page.tsx` admin ops dashboard.** Newer route — no `__tests__` folder. Operationally important for staff but not customer-blocking.
5. **`storage-quota.service.ts`** in `middleware/src/modules/storage/` — no spec. Quota enforcement on file uploads has indirect coverage via `quota.guard.spec.ts` (screen quota) and `file-validation.service.spec.ts`, but the storage-quota service itself is untested.
6. **MCP cross-tenant scope guards (per-org tokens).** `requireOrgScope` helper has been added (`CLAUDE.md` mentions it under "MCP Server / Token shapes"); the `mcp/auth/` subdir has specs. Verify before exposing MCP to a real customer agent. Lower priority for customer #1 since MCP isn't customer-facing in v1.

### 4.2 SHOULD-VERIFY (likely fine, low-cost to confirm)

7. **Playwright suites that depend on running services.** All 24 Playwright specs need full stack up. The last comprehensive run is from 2026-03-09; the codebase has churned heavily since (Hermes shadow agents, MCP server PRs #42/58/59/60). **Re-run all 24 against the prod-like env Phase D will bring up.**
8. **Middleware E2E** (`middleware/test/*.e2e-spec.ts`) — requires `docker-compose.test.yml` up. Not run since 2026-03-08. Phase C should re-run.
9. **Pre-existing failures from the baseline.** `tasks/lessons.md` documents 3 historical middleware failures (auth.controller, pairing.service) and 2 web admin RSC failures. The latter were fixed in commit `b712211` (per `production-readiness-fixes.md`). **Verify no regressions.**
10. **Rate limiting in production-like config.** `middleware/test/rate-limit.e2e-spec.ts` is a "skeleton" per the production readiness plan (M5). Real prod rate limits never end-to-end tested — `production-readiness-report.md` calls this out: "Rate limits are 100x relaxed in dev/test. Production limits never tested."
11. **Forgot-password UI flow.** No `web/src/app/(auth)/forgot-password/__tests__/` folder. Backend covered in `auth.e2e-spec.ts`. Manual `frontend-test-report.md` checked it (5/5) — but no automated regression guard.

### 4.3 KNOWN-WEAK BUT NON-BLOCKING

12. **Admin pages.** `web/src/app/admin/` historical RSC failures fixed; less-trafficked code than dashboard. `frontend-test-report.md` flagged "Admin Dashboard not deeply tested" — that's the admin SuperAdminGuard surface, not customer-visible.
13. **Static legal pages** (privacy, refund, sla, terms): no tests. Accept.
14. **Static error pages** (`not-found.tsx`, `error.tsx`, `global-error.tsx`): no tests. Accept.
15. **Backlog page** (`web/src/app/backlog/`): public-facing roadmap; not test-critical.
16. **Onboarding nudge templates and email content.** Customer-lifecycle agent picks template by heuristic, server renders. Templates themselves are in code (per `CLAUDE.md` "send_lifecycle_nudge_email") but template-content snapshot tests not visible.

---

## 5. Production readiness criteria from existing docs

Pulled from `CLAUDE.md`, `backlog.md`, `production-readiness-report.md`, `hardening-summary.md`, `docs/plans/2026-03-07-production-readiness-fixes.md`, and the various test reports.

### 5.1 Hard gates (CLAUDE.md + backlog.md P0)

- **B1-B3:** Configure SMTP on prod (SendGrid). SPF/DKIM/DMARC. Set SMTP env vars. *(`backlog.md` lines 37-39)*
- **B4:** Test all 8 existing email types end-to-end.
- **B5:** Build email verification flow (token + endpoint + template + soft enforcement).
- **B6:** Wire team-invite email to mail service.
- **B7:** Add unsubscribe link to non-transactional emails.
- **B8-B15:** Stripe + Razorpay accounts, products, prices, webhook endpoints, env vars, real price IDs, live checkout test, failure-scenario test.
- **B16:** Full go-live smoke test (60-step user journey).

> **3 P0 blockers remain at last `backlog.md` update (2026-03-18):** "SMTP setup, Stripe/Razorpay keys, final smoke test." All other P0s closed.

### 5.2 Service-port and env-var invariants (`CLAUDE.md`)

- Middleware **must** validate port at startup and exit if misconfigured (3000).
- Realtime **must** validate port at startup (3002).
- Required env vars (validated at startup): `JWT_SECRET` (≥32), `DEVICE_JWT_SECRET` (≥32), `INTERNAL_API_SECRET` (prod), `DATABASE_URL`, `REDIS_URL`. Per `production-readiness-fixes.md` task 6.3, `INTERNAL_API_SECRET` is now in the required list.
- `MINIO_*`, `RAZORPAY_*`, `GRAFANA_ADMIN_USER`/`_PASSWORD` (no insecure default), `MCP_TOKEN_TTL_DAYS`, `MCP_RATE_LIMIT_PER_MIN/_DAY` — all explicit.

### 5.3 Test pass-rate targets (from `backlog.md` METRICS table)

| Metric | Current (2026-03-18) | Target (Launch) |
|---|---|---|
| Test suites | 93 | 95+ |
| Total tests | 1,917 | 2,000+ |
| Test pass rate | 100% | 100% |
| P0 blockers | 3 | 0 |
| Console errors (dashboard) | ~0 | 0 |
| API endpoints returning 400 | 0 | 0 |
| Health check layers | 5 | 5 |
| Production readiness | ~85% | 95%+ |

### 5.4 Operational dead-man triad (`CLAUDE.md` Autonomous Operations)

- **Internal:** `health-guardian` every 5 min, `ops-watchdog` every 15 min — both verified live.
- **External:** `HEALTHCHECKS_HEALTH_GUARDIAN_URL` heartbeat — env var unset on prod (`tasks/feature-backlog.md` "Enable external healthchecks.io heartbeat"). **Activate before launch.**
- **Reporter:** `ops-reporter` every 30 min — Slack/email aggregated alerts.

### 5.5 Security baseline (`security-test-report.md` 2026-03-24)

- 26/26 security tests pass: auth, multi-tenancy isolation (11/11), input validation, rate limiting, security headers (6/6).
- 6 CRITICAL issues from `production-readiness-report.md` all resolved (verified in `production-readiness-fixes.md` Issue-to-Task Mapping: C1-C6 all `Done`).
- All 14 HIGH and all 14 MEDIUM are `Done` per the same table. Score moved from 72/100 → estimated 96/100.

### 5.6 Hardening invariants from `hardening-summary.md` (2026-03-08)

- 6 TOCTOU race conditions fixed (`updateMany` with org-scoped where).
- `INTERNAL_API_SECRET` empty-string fallback removed (`getInternalApiHeaders()` returns null + warns/errors).
- Realtime test secret meets 32-char minimum.
- Production readiness score 97/100 at that snapshot.

### 5.7 Known historical failures NOT to chase (`tasks/lessons.md`)

- Middleware `auth.controller`, `pairing.service` — predate the sprint; verify locally if you see a fail.
- Realtime: 1 suite historically fails on a Prisma generate issue in test env.
- Web admin RSC tests — fixed in `b712211`. Re-verify they're green.

---

## 6. Known issues / open bugs

Compiled from `backlog.md` K* table, `tasks/lessons.md`, recent reports, and `tasks/feature-backlog.md`.

### 6.1 Open from `backlog.md` KNOWN ISSUES (K-table)

| # | Issue | Severity | Status |
|---|---|---|---|
| K1 | Electron auto-start on boot not configured | Low | TODO |
| K2 | Electron powerSaveBlocker not enabled | Low | TODO |
| K3 | Electron auto-update not configured | Low | TODO |
| K4 | Display client has 0 test coverage | Medium | TODO (re-asserted by every report since 2026-02) |
| K5 | 3 pre-existing RSC admin test failures | Low | TODO (likely fixed by `b712211` — verify) |
| K6 | AI Designer returns "launching soon" stub | Info | Intentional — needs API budget |
| K7 | Push-to-group iterates client-side | Low | TODO |
| K8 | Playlist loop UI not fully wired | Low | **FIXED** in unblocked tasks sprint |

### 6.2 Backlog parking-lot items (`tasks/feature-backlog.md`)

- **Schema-tolerant comparison reader** for Hermes shadow JSONL — **blocking** the customer-lifecycle and support-triage live cutover. Not customer-launch-blocking (those agents stay in shadow).
- **`hermes-cron` vs `hermes -z`** — operational workaround shipped (PR #60); root cause investigation deferred.
- **support-triage gpt-4o-mini "cannot proceed" false alarm** — non-blocking; cosmetic.
- **healthchecks.io heartbeat** — env var unset on prod (see §5.4).
- **PR #38 deferred review polish** — sub-80 score nits.
- **Dispatcher accuracy metric** — gap; deferred to first-quality-incident.
- **Atelier homepage redesign** — parked from prod (`feat/design-explorations`). **DO NOT MERGE** per `MEMORY.md` hard rule.
- **Synchronized video walls** — deferred until pilot ask.

### 6.3 Bugs found in recent test passes

- `BUG-1` notifications API 400 (`vizora-comprehensive-e2e-report.md` Critical) — fixed in `feat/week1-unblocked-tasks`.
- `BUG-2` support requests API 400 — fixed same.
- `BUG-3` widgets API — fixed in `feat/day5-6-api-deletion-consent` (`day5-6-verification.md`).
- `BUG-4` layouts API — fixed same.
- Playlist-item UUID-vs-CUID 400 — fixed in `432c876` (`content-lifecycle-test-report.md`).
- Webhook controller 500 → 401/400/503 — fixed in `acbbb01` (`billing-test-report.md`).
- Realtime fleet-commands 503 (build staleness) — fixed in `realtime-test-report.md` rebuild on 2026-03-25.
- BUG #6 www/non-www origin mismatch on prod — fixed in vizora-tv `transformContentUrl()` (per `MEMORY.md`).

### 6.4 Active deployment-time risks (from `MEMORY.md`)

- **Prod nginx is host-installed, not Docker.** TLS terminates at `/etc/nginx/sites-enabled/vizora` (Certbot-managed). Repo's `docker/nginx/nginx.conf` security headers **are not in effect**. Verify Helmet headers from middleware are reaching the wire in prod.
- **`nx build` skips prisma `dist/generated/` copy** — `@nx/js/typescript` runs tsc directly; `postbuild` in package.json never fires. Workaround in `packages/database/project.json`. Rebuild after any prisma generate on the server.
- **SSH KEX algorithm fix** required for prod VPS (89.167.55.176) — operational, not customer-blocking.
- **Git push hangs on Windows** when system-level credential helper triggers GUI popup — operational.

---

## 7. Critical paths for first-customer deployment

The minimum set of features customer-#1 must exercise without failure. If any of these breaks, the customer churns within day-one.

### 7.1 The "must work" core (8 paths)

1. **Sign up.** `POST /auth/register` → org auto-create + user + 30-day trial. Welcome email sent (B5 path). User reaches `/dashboard`.
2. **Login.** Email + password → httpOnly cookie + `/dashboard` redirect. Wrong creds → generic "Invalid email or password" (no enumeration).
3. **Pair a screen.** `/dashboard/devices` → "Pair New Device" → 6-char code → enter on display device → display joins `device:{deviceId}` and `org:{orgId}` rooms → green "Online" within ≤5 s. Device JWT issued (90-day expiry, auto-rotate at 14 days).
4. **Upload content.** `/dashboard/content` → drop image/video/PDF → magic-number validated → uploaded to MinIO with org-scoped key → thumbnail generated → appears in grid as "active." File ≤ plan quota.
5. **Build a playlist.** `/dashboard/playlists` → create → drag content into items → save. (CUID-vs-UUID bug already fixed in `432c876`.)
6. **Schedule the playlist.** `/dashboard/schedules` → create schedule with time-of-day + day-of-week + assigned displays/groups → save. Active schedule pushes to device.
7. **Verify content actually plays on the screen.** Display fetches signed/scoped URL via device JWT → renders → heartbeat reports `currentlyPlayingContentId` → dashboard shows "Currently playing" matches. (BUG #6 origin mismatch already fixed.)
8. **Change something while live.** Edit playlist item duration → save → playlist:update event fires → display reloads within seconds (M14 ack now in place).

### 7.2 The "must not break" cross-cutters (5 paths)

A. **Multi-tenancy isolation** — at every step above, customer-#1 must NEVER see another org's data, never have their data visible to other orgs (verified by `security-test-report.md` 11/11).

B. **Trial banner / quota guard** — customer-#1 sees correct trial remaining, screens-used / quota count is correct, hitting the screen quota produces a clear "upgrade" message (not 500).

C. **Notifications & realtime status** — bell icon works, dropdown shows actual notifications (not 400). Device offline → online transitions visible in dashboard within seconds.

D. **Logout / re-login.** Cookie cleared, JWT no longer accepted (Redis JTI blacklist behavior).

E. **Account deletion.** If customer-#1 hates Vizora and wants out: `DELETE /auth/account` with password + "DELETE MY ACCOUNT" string → cascade clean-up runs to completion (`day5-6-verification.md` 12/12).

### 7.3 The "explicit out-of-scope for customer #1"

These are **OK to ship without**, given the customer profile (one small-business pilot):

- **Live billing checkout** — customer-#1 launches on free tier; payment flow gates on B8-B15.
- **Hermes/MCP-side agents** — internal-only; shadow mode.
- **AI Designer** — labeled "launching soon" stub.
- **Custom branding per org** — Q1 (P3) item.
- **Mobile companion app** — extracted repo; not blocking display side.
- **2FA / SSO** — F1/F2 (P4).

---

## 8. Recommended testing scope for the 4-day window

A blunt time-boxing of where to spend the next 96 hours.

### 8.1 Day 1 — re-baseline + re-run the suites we trust (Phase C in your task list)

Goal: confirm the headline numbers are still real on `main` HEAD.

| Run | Why | Expected outcome |
|---|---|---|
| `pnpm --filter @vizora/middleware test` | Confirm 1,838+ pass; flag any new regressions from the recent Hermes/MCP PRs (#58/#59/#60) | All pass, ≤ 3 known historical fails |
| `pnpm --filter @vizora/realtime test` | Confirm 206+ pass; the Prisma-test-env failure may resurface | All pass + 1 known env fail |
| `pnpm --filter @vizora/web test` | Confirm 843+ pass; the historical RSC admin failures are supposed to be fixed (`b712211`) | All pass |
| `pnpm --filter @vizora/middleware test:e2e:full` | Confirm middleware E2E with real DB still green | All pass |
| `pnpm audit --audit-level=high` | Confirm 0 critical/high (was 6/0 after `b52db56`) | 0 critical, 0 high |
| `npx tsc --noEmit` per service | Type compilation is its own gate | Clean |

**If any of the above is red, that's the day-1 fix list.** Do not move on with a known-red baseline.

### 8.2 Day 2 — Playwright on a prod-like local stack (Phase D)

Goal: end-to-end behavior of the 8 customer-#1 critical paths.

- Bring up local stack via `docker-compose -f docker/docker-compose.yml up -d`. Run all 24 Playwright specs sequentially (1 worker per `playwright.config.ts`). Expect ~30-90 minutes wall time.
- **Required to pass for launch:** `01-auth`, `02-dashboard`, `03-displays`, `04-content`, `05-playlists`, `06-schedules`, `09-device-status`, `13-health-monitoring`, `15-comprehensive-integration`, `21-notifications`, `23-comprehensive-validation`. (11 specs covering §7.1 + §7.2.)
- **Nice to have green:** the remaining 13 (analytics, settings, admin, command palette, billing UI, api-keys, folders, tagging, device groups, audit, playlist-builder, device-preview, integration variants).
- **Acceptable to skip / defer:** `16-billing.spec.ts` payment paths (gated on §7.3 keys not being live).

### 8.3 Day 3 — manual real-device walkthrough + email verification

Goal: cover the gaps the test suite cannot — the actual screen and the actual inbox.

- **Real Electron walkthrough on customer's actual hardware.** Run §7.1 paths 1-8 manually with the deployed binary. Record screenshots, just like `vizora-e2e-retest-report.md` did 2026-03-06.
- **Email path proving.** P0 gate B4 — verify the 8 transactional emails actually land in inbox: registration confirm, password reset, account deletion confirm, team invite, billing receipt (if billing config exists), security-alert (new login), system announcement, lifecycle nudges (day-1/3/7). If SMTP isn't configured (B1-B3 still open per `backlog.md`), this is the day to close that.
- **Activate `HEALTHCHECKS_HEALTH_GUARDIAN_URL` heartbeat** on prod — the third dead-man leg. ~10 minutes of work per `tasks/feature-backlog.md`.

### 8.4 Day 4 — production smoke + go/no-go

Goal: the launch decision artifact.

- **B16 60-step go-live smoke test** per `backlog.md` `week1-day7-8-smoke-test-task.md`. This is THE script.
- **Multi-vector readiness review** per `~/.claude/CLAUDE.md` §8: dispatch reviewers along orthogonal vectors (statistical = test-pass-rate trends; structural = critical-path traces; strategy = scope vs customer ask; prod-state = env vars + migration status).
- **§9 runtime-state checklist** for every assumption the launch depends on:
  - `prisma migrate status` on prod = clean.
  - `mcp_tokens` table reflects intended scope (no platform-scope tokens leaking).
  - `LIFECYCLE_LIVE` is unset (lifecycle stays dry-run for customer #1; explicit gate per `CLAUDE.md` cutover playbook).
  - `pm2 status` — middleware × 2, realtime × 1, web × 1, all 7 ops-* + 2 hermes-vizora-* alive.
  - Resend / SMTP creds verified.
  - Razorpay live-vs-test key state confirmed (free-tier launch, but verify mode is not surprise-live).

### 8.5 What to explicitly SKIP

In the 4-day window, do NOT spend cycles on:

- **Display Electron unit-test framework wiring** (K4 / L3) — 8+ hours, low ROI vs manual walkthrough.
- **Hermes shadow-comparison reader** — blocks shadow→live cutover, not customer-#1 launch.
- **Atelier homepage merge** — explicitly parked.
- **Refactor work** (H3 `any` cleanup, M6 landing-page split) — already deferred multiple times.
- **Stripe/Razorpay live keys** unless customer #1 needs to pay on day-one (assumption: free-tier pilot).
- **2FA / SSO / proof-of-play / weather widget / Google Sheets** — P1-P4 backlog.

### 8.6 Ship-or-die vs nice-to-have

| Status | Items |
|---|---|
| **SHIP-OR-DIE** (no launch if red) | Middleware unit + E2E green; Realtime green; Web green; Playwright `01`/`03`/`04`/`05`/`06`/`09`/`13`/`15`/`21`/`23` green on prod-like; manual real-device walkthrough green on customer hardware; SMTP works for at least registration confirm + password reset; security-test-report 26/26 still green; multi-tenancy isolation verified by spot-check on prod with two test orgs; INTERNAL_API_SECRET, JWT_SECRET, DEVICE_JWT_SECRET all set on prod (no fallbacks); pm2 status all-green; `health-guardian` pinging successfully. |
| **NICE-TO-HAVE** (launch with caveats if red) | Remaining 13 Playwright specs; admin pages deep coverage; full email-type matrix (B4 all-8); `HEALTHCHECKS_HEALTH_GUARDIAN_URL` external dead-man; billing live keys; Hermes shadow comparison; Electron unit tests. |

### 8.7 Definition of "ready to launch"

Customer-#1 ships **only if** all SHIP-OR-DIE items above are green AND:

- Production-readiness score is ≥95% (matches `backlog.md` target).
- 0 P0 blockers OR explicit customer-side waiver per remaining P0.
- All KNOWN ISSUES K* in `backlog.md` are either resolved or accepted-as-known by the customer.
- Rollback plan documented (per-feature kill-switches + DB backup verified per L8 fix in db-maintainer).

If any one of those fails, slip the launch by 1-2 weeks and close the gap, not 4 days. Customer #1 is the foundation of the next 50; a botched launch costs more than a slipped one.

---

## Appendix A — File-path index of every spec found

### A.1 Middleware unit specs (124)

(Full list in `find` output during audit; selected highlights below.)

- `middleware/src/app/{app.controller,app.service}.spec.ts`
- `middleware/src/__tests__/{auth,health,endpoint-smoke}.e2e.spec.ts` (E2E-style under src — note location)
- `middleware/src/modules/admin/{admin.controller,guards/super-admin.guard,services/{admin-audit,organizations-admin,platform-health,platform-stats,users-admin,announcements,plans,promotions,security-admin,system-config}.service}.spec.ts` (12)
- `middleware/src/modules/agents/{agents.controller,agent-runs.service,agent-state.schema,agent-state.service,customer-incident.service,onboarding.service,ai/heuristic-agent-ai,ecosystem-hermes-args}.spec.ts` (8)
- `middleware/src/modules/analytics/{analytics.controller,analytics.service}.spec.ts`
- `middleware/src/modules/api-keys/{api-keys.controller,api-keys.service,guards/api-key.guard}.spec.ts`
- `middleware/src/modules/auth/{auth.controller,auth.service,strategies/jwt.strategy,guards/{jwt-auth,roles}.guard,decorators/{current-user,public,roles}.decorator}.spec.ts` (8)
- `middleware/src/modules/billing/{billing.controller,billing.service,webhooks.controller,providers/{stripe,razorpay}.provider,guards/{quota,subscription-active}.guard}.spec.ts` (7)
- `middleware/src/modules/common/{decorators/organization,filters/all-exceptions.filter,guards/csrf.guard,interceptors/{response-envelope,logging,sanitize}.interceptor,pipes/parse-id.pipe,services/{circuit-breaker,geo}.service,data-retention.service}.spec.ts` (9)
- `middleware/src/modules/config/env.validation.spec.ts`
- `middleware/src/modules/content/{content.controller,content.service,device-content.controller,file-validation.service,template-rendering.service,template-refresh.service,thumbnail.service,rss-parser,controllers/{templates,widgets,layouts,bulk-operations}.controller}.spec.ts` (12)
- `middleware/src/modules/display-groups/{display-groups.controller,display-groups.service}.spec.ts`
- `middleware/src/modules/displays/{displays.controller,displays.service,displays.service.bulk,pairing.controller,pairing.service}.spec.ts` (5)
- `middleware/src/modules/fleet/{fleet.controller,fleet.service}.spec.ts`
- `middleware/src/modules/folders/{folders.controller,folders.service}.spec.ts`
- `middleware/src/modules/health/{health.controller,health.service,continuous-health-monitor.service,startup-self-test.service,regression-guards}.spec.ts` (5)
- `middleware/src/modules/mcp/{mcp.service,mcp-controller-paths,mcp-exception.filter}.spec.ts` plus tools/admin/audit/auth subdirs
- `middleware/src/modules/metrics/{metrics.controller,metrics.service,metrics.interceptor}.spec.ts`
- `middleware/src/modules/notifications/{notifications.controller,notifications.service}.spec.ts`
- `middleware/src/modules/organizations/{organizations.controller,organizations.service,feature-flags.service}.spec.ts`
- `middleware/src/modules/playlists/{playlists.controller,playlists.service}.spec.ts`
- `middleware/src/modules/redis/redis.service.spec.ts`
- `middleware/src/modules/schedules/{schedules.controller,schedules.service}.spec.ts`
- `middleware/src/modules/storage/storage.service.spec.ts`
- `middleware/src/modules/support/{support.controller,support.service,support-classifier.service,support-knowledge.service}.spec.ts`
- `middleware/src/modules/template-library/{template-library.controller,template-library.service}.spec.ts`
- `middleware/src/modules/users/{users.controller,users.service,audit-log.controller,audit-log.service}.spec.ts`

### A.2 Middleware E2E specs (6)

- `middleware/test/agents.e2e-spec.ts`
- `middleware/test/auth.e2e-spec.ts`
- `middleware/test/content.e2e-spec.ts`
- `middleware/test/displays.e2e-spec.ts`
- `middleware/test/playlists.e2e-spec.ts`
- `middleware/test/rate-limit.e2e-spec.ts`

### A.3 Realtime specs (10)

- `realtime/src/adapters/redis-io.adapter.spec.ts`
- `realtime/src/app/app.controller.spec.ts`
- `realtime/src/gateways/device.gateway.spec.ts`
- `realtime/src/gateways/pipes/ws-validation.pipe.spec.ts`
- `realtime/src/metrics/metrics.service.spec.ts`
- `realtime/src/services/{heartbeat,notification,playlist,redis}.service.spec.ts`
- `realtime/src/storage/storage.service.spec.ts`

### A.4 Web tests (79) — selected highlights

- Pages: `(auth)/{login,register}-page.test.tsx`; `dashboard/{dashboard,analytics,content,devices,health,layouts,playlists,schedules,templates,widgets}-page.test.tsx`; `dashboard/settings/{api-keys,audit-log,billing/{billing,components,plans,invoice-history},customization,feature-flags,team}/page.test.tsx`; `admin/{admin-dashboard,organizations-page,plans-page}.test.tsx`; `admin/{analytics,health,users,support}/page.test.tsx`
- Components (33): Toast, Modal, ErrorBoundary, NotificationBell (×2), NotificationDropdown, ConfirmDialog, Breadcrumbs, CommandPalette + Wrapper, ContentTagger, DaySelector, DeviceGroupSelector, DeviceHealthMonitor, DevicePreviewModal, DeviceQuickChange, DeviceStatusIndicator, FieldError, FolderBreadcrumb, FolderTree, LoadingSpinner, PlaylistBuilder, PlaylistPreview, PlaylistQuickSelect, PreviewModal, ScheduleCalendar, SearchFilter, ThemeToggle, TimePicker, Tooltip, Button, EmptyState, ViewToggle, fleet/{ActiveOverrideBanner,EmergencyOverrideModal,FleetCommandDropdown}, support/SupportChat
- Hooks (12): useAuth, useChartData, useDebounce, useErrorRecovery, useNotifications, useOptimisticState, usePlaylistHistory, useSocket, useTheme, useRealtimeEvents, useAnalyticsData (+ NotificationBell.test.tsx duplicate)
- Lib (3): error-handler, retry, validation

### A.5 Playwright E2E (24)

- `e2e-tests/01-auth.spec.ts` through `e2e-tests/24-team-audit.spec.ts` (named per the §1.3 table)

### A.6 Display Electron specs (6, in tree but not run)

- `display/e2e-tests/display-app.spec.ts`
- `display/src/app/app.element.spec.ts`
- `display/src/electron/{cache-manager,device-client,main,preload}.spec.ts`

---

## Appendix B — Source-file footprint of largest services

| Service | LoC | Spec status | Notes |
|---|---|---|---|
| `middleware/src/modules/content/content.service.ts` | 1,576 | covered | Largest service. Cron `checkExpiredContent` org-validation fix is live (C6). |
| `realtime/src/gateways/device.gateway.ts` | 1,441 | covered | 1,226 LoC at audit time; grown. WsExceptionFilter added (H10). |
| `middleware/src/modules/auth/auth.service.ts` | 1,028 | covered | Redis fail-closed (C4). |
| `middleware/src/modules/billing/billing.service.ts` | 900 | covered | Webhook controller fix `acbbb01`. |
| `middleware/src/modules/displays/displays.service.ts` | 808 | covered | Pairing service is separate file. |
| `middleware/src/modules/playlists/playlists.service.ts` | 498 | covered | |

### Largest frontend files (per `production-readiness-report.md`)

- `web/src/app/page.tsx` — 2,077 lines (now ~120 lines per `production-readiness-fixes.md` M6 split into 16 section components, commit `c64d211`).
- `web/src/lib/api.ts` — 1,555 lines (now split into 15 domain modules with barrel re-export, commit `acc48a6`).

---

## Appendix C — How to verify "current" numbers

The numbers in this inventory are **drawn from documents**. Before relying on any of them for the launch claim:

```bash
# Spec-file counts
find middleware/src -name '*.spec.ts' | wc -l            # expect 124
find middleware/test -name '*.e2e-spec.ts' | wc -l       # expect 6
find realtime/src -name '*.spec.ts' | wc -l              # expect 10
find web/src -name '*.test.ts*' | wc -l                  # expect 79
ls e2e-tests/*.spec.ts | wc -l                           # expect 24

# Test-pass numbers (run, don't read)
pnpm --filter @vizora/middleware test 2>&1 | tail -20
pnpm --filter @vizora/realtime test   2>&1 | tail -20
pnpm --filter @vizora/web test        2>&1 | tail -20

# Audit drift
pnpm audit --audit-level=high

# Prisma migration drift
cd packages/database && npx prisma migrate status

# Build green
npx nx build @vizora/middleware
npx nx build @vizora/realtime
NODE_OPTIONS="--max-old-space-size=4096" npx nx build @vizora/web
```

If any of those returns a different number than this document expects, **trust the live command, not this document**. This file is a snapshot.
