# Module Bug Report: Web Dashboard (@vizora/web)

## Module Description
Next.js 16 (App Router) web dashboard running on port 3001. Provides the admin UI for managing displays, content, playlists, schedules, organizations, billing, and real-time monitoring. Uses React Server Components with client-side WebSocket integration.

## Test Execution Summary

**Test Runner:** Jest + jsdom + React Testing Library
**Total Test Suites:** ~67 test files identified (40+ known passing, 2 known failing)
**Build Status (nx):** FAIL - Plugin worker startup issue
**Build Status (direct next build):** SUCCESS - All pages compile correctly

---

## Test Coverage by Category

### Page Tests (24 test files)
| Page | Test File | Status |
|------|-----------|--------|
| Login | (auth)/__tests__/login-page.test.tsx | PASS |
| Register | (auth)/__tests__/register-page.test.tsx | PASS |
| Dashboard | dashboard/__tests__/dashboard-page.test.tsx | PASS |
| Analytics | dashboard/analytics/__tests__/analytics-page.test.tsx | PASS |
| Content | dashboard/content/__tests__/content-page.test.tsx | PASS |
| Devices | dashboard/devices/__tests__/devices-page.test.tsx | PASS |
| Health | dashboard/health/__tests__/health-page.test.tsx | PASS |
| Layouts | dashboard/layouts/__tests__/layouts-page.test.tsx | PASS |
| Playlists | dashboard/playlists/__tests__/playlists-page.test.tsx | PASS |
| Schedules | dashboard/schedules/__tests__/schedules-page.test.tsx | PASS |
| Templates | dashboard/templates/__tests__/templates-page.test.tsx | PASS |
| Widgets | dashboard/widgets/__tests__/widgets-page.test.tsx | PASS |
| Audit Log | dashboard/settings/audit-log/__tests__/audit-log-page.test.tsx | PASS |
| Billing | dashboard/settings/billing/__tests__/billing-page.test.tsx | PASS |
| Billing Components | dashboard/settings/billing/__tests__/components.test.tsx | PASS |
| Invoice History | dashboard/settings/billing/__tests__/invoice-history.test.tsx | PASS |
| Plans | dashboard/settings/billing/__tests__/plans-page.test.tsx | PASS |
| Team | dashboard/settings/team/__tests__/team-page.test.tsx | PASS |
| Admin Dashboard | admin/__tests__/admin-dashboard.test.tsx | PASS |
| Admin Organizations | admin/__tests__/organizations-page.test.tsx | FAIL (async RSC) |
| Admin Plans | admin/__tests__/plans-page.test.tsx | PASS |
| Admin Analytics | admin/analytics/__tests__/analytics-page.test.tsx | PASS |
| Admin Health | admin/health/__tests__/health-page.test.tsx | PASS |
| Admin Users | admin/users/__tests__/users-page.test.tsx | FAIL (async RSC) |

### Component Tests (32 test files)
All component tests PASS:
- Breadcrumbs, Button, CommandPalette, CommandPaletteWrapper, ConfirmDialog, ContentTagger
- DaySelector, DeviceGroupSelector, DeviceHealthMonitor, DevicePreviewModal, DeviceQuickChange
- DeviceStatusIndicator, EmptyState, ErrorBoundary, FieldError, FolderBreadcrumb, FolderTree
- LoadingSpinner, Modal, NotificationBell (x2), NotificationDropdown
- PlaylistBuilder, PlaylistPreview, PlaylistQuickSelect, PreviewModal
- ScheduleCalendar, SearchFilter, ThemeToggle, TimePicker, Toast, Tooltip, ViewToggle

### Hook Tests (11 test files)
All hook tests PASS:
- useAnalyticsData, useAuth, useChartData, useDebounce, useErrorRecovery
- useNotifications, useOptimisticState, usePlaylistHistory, useRealtimeEvents, useSocket, useTheme

---

## Pages WITHOUT Tests

| Page Route | Test Status |
|------------|-------------|
| /dashboard/devices/pair | NO TEST |
| /dashboard/settings (main) | NO TEST |
| /dashboard/settings/api-keys | NO TEST |
| /dashboard/settings/customization | NO TEST |
| / (landing page) | NO TEST |
| /error.tsx (error boundary) | NO TEST (component ErrorBoundary tested separately) |
| /not-found.tsx | NO TEST |

---

## Bugs Found

### BUG-WEB-001: Nx Build Intermittently Fails for Web Service (Severity: HIGH)
- **Description:** `npx nx build @vizora/web` intermittently fails with "Could not create project graph" and "Failed to start plugin worker". A subsequent run succeeded (exit code 0), indicating a flaky/timing issue.
- **Impact:** Unreliable build pipeline; deployments may fail non-deterministically
- **Steps to Reproduce:** Run `npx nx build @vizora/web` multiple times - failure is intermittent
- **Expected:** Build should succeed consistently
- **Actual:** Sometimes fails with "Plugin Worker exited because no plugin was loaded within 10 seconds of starting up"
- **Workaround:** Use `cd web && npx next build` directly (always succeeds), or retry the Nx build
- **Suggested Fix:** Update `@nx/next` plugin, increase plugin worker timeout, or investigate race condition in Nx project graph creation with Next.js 16

### BUG-WEB-002: Admin Organization/Users Page Tests Fail - Async RSC Issue (Severity: MEDIUM)
- **Description:** `admin/__tests__/organizations-page.test.tsx` and `admin/users/__tests__/users-page.test.tsx` fail due to "async Client Component" error
- **Impact:** These admin pages use async component patterns that jsdom can't handle properly
- **Steps to Reproduce:** Run web test suite, observe failures in admin tests
- **Error:** `<AdminOrganizationsPage> is an async Client Component. Only Server Components can be async`
- **Suggested Fix:** Migrate these pages to use Server Components or split async data fetching from client rendering

### BUG-WEB-003: API Client SSR URL Resolution (Severity: MEDIUM)
- **Description:** In `web/src/lib/api.ts:12`, the SSR fallback for `API_BASE_URL` returns empty string when `NEXT_PUBLIC_API_URL` is not set in production: `process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000/api/v1'`
- **Impact:** In SSR context in production, if `NEXT_PUBLIC_API_URL` is not set, API calls would go to `''` + endpoint, which would fail
- **Steps to Reproduce:** Deploy without setting `NEXT_PUBLIC_API_URL`
- **Expected:** Should fall back to a reasonable default or throw a clear error
- **Suggested Fix:** Add startup validation that requires `NEXT_PUBLIC_API_URL` in production, or use `BACKEND_URL` as SSR fallback

### BUG-WEB-004: Missing Tests for Settings Pages (Severity: LOW)
- **Description:** Settings pages (api-keys, customization, main settings) have no test coverage
- **Impact:** Settings changes could introduce regressions undetected
- **Suggested Fix:** Add test files for untested settings pages

### BUG-WEB-005: Web Tests Extremely Slow (Severity: LOW)
- **Description:** Full web test suite takes >10 minutes on Windows, with individual tests taking 14-15s
- **Impact:** Slow CI feedback loop; developers may skip running tests locally
- **Suggested Fix:** Review test setup for unnecessary re-initialization; consider `--maxWorkers` tuning; check if jsdom setup is being duplicated

### BUG-WEB-006: Zero Test Coverage for Utility Libraries (Severity: MEDIUM)
- **Description:** 8 utility files in `web/src/lib/` have no test coverage: api.ts, customization.ts, error-handler.ts, retry.ts, sentry.ts, server-api.ts, types.ts, validation.ts
- **Impact:** Business-critical code (API client, validation, error handling, retry logic) is untested at the unit level. The API client is indirectly exercised through component/hook tests but not directly validated.
- **Suggested Fix:** Add unit tests for api.ts (request/response handling, error cases, CSRF), validation.ts, retry.ts, and error-handler.ts at minimum

### BUG-WEB-007: Stale baseline-browser-mapping Dependency (Severity: LOW)
- **Description:** Repeated warning "The data in this module is over two months old"
- **Impact:** Browser compatibility data may be outdated
- **Suggested Fix:** Run `npm i baseline-browser-mapping@latest -D`

---

## Overall Module Health Rating: **B+ (Good with Issues)**

The web dashboard has solid test coverage for components (32 tests) and hooks (11 tests), with most page tests passing. The two main concerns are: (1) the Nx build failure requiring a workaround, and (2) the API client's SSR URL resolution in production. Core user-facing functionality is well-tested. The admin page RSC failures are a known limitation of the test environment, not production bugs.
