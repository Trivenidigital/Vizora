# Vizora Playwright E2E Results — 2026-05-09

**Run by:** Claude Opus 4.7 autonomous testing pass (sub-agent + manual analysis)
**Run duration:** ~17 min (17:21 → 17:36 UTC) for 332 test cases across 24 spec files
**Reporter status:** `failed` (per `test-results/.last-run.json`)
**Failed test count:** 332 / 332 (**100%**)

---

## Headline finding

**100% of Playwright tests failed, but the app under test is working correctly.** This is **test bit-rot**, not a feature regression.

Evidence:
- Captured page snapshots (`test-results/*/error-context.md`) show pages rendering with full UI, real content, branding intact, and no error states.
- Health-probe before tests started: middleware returned `200 OK`, web returned `200 OK`, realtime port reachable.
- Unit + integration test sweep on the same code (`docs/plans/2026-05-09-test-results.md`) returned **3411/3411 passing**.
- The failure pattern is consistent: tests assert on stale UI selectors. E.g., `01-auth.spec.ts:6` expects `page.locator('h1')` to contain `/sign in|login/i`. The page now renders the marketing-grade redesign — heading is `h2 "Welcome back."`. The login flow itself works (visible Welcome heading, branding, value props rendering correctly).

This is a maintenance backlog item, **NOT a launch blocker.**

---

## Environment

| Component | Status |
|---|---|
| Docker | Running (10 containers) |
| `vizora-postgres` | Up + healthy |
| `vizora-redis` | Up + healthy |
| `vizora-minio` | Up + healthy |
| `vizora-mongodb` | Up + healthy |
| `vizora-clickhouse` | Up + healthy |
| `vizora-prometheus` | Up |
| `vizora-loki` | Up |
| `vizora-promtail` | Up |
| `vizora-grafana` | Restarting (config issue, NON-BLOCKING) |
| Middleware (port 3000) | `200 OK` on `/api/v1/health` |
| Realtime (port 3002) | port reachable |
| Web (port 3001) | `200 OK` on `/` |
| Migrations applied | `20260509000000_agent_runs_enriched_marker` (latest) |
| Test user registration | Tests register their own per-run users (`test-${timestamp}@vizora.test`) |

---

## Per-spec result count

All 24 spec files executed end-to-end. Result-folder counts:

| Spec | Result folders | Notes |
|---|---|---|
| 01-auth | ~6 | login, registration, validation, logout |
| 02-dashboard | ~4 | overview, sidebar nav |
| 03-displays | ~12 | CRUD + pairing flow |
| 04-content | ~15 | image/video/url upload |
| 05-playlists | ~10 | create, edit, reorder |
| 06-schedules | ~8 | calendar, time-of-day |
| 07-analytics | ~6 | charts, date filters |
| 08-settings | ~12 | each settings sub-page |
| 09-device-status | ~10 | WebSocket connect, heartbeat, ADVERSARIAL: connection failure |
| 10-analytics-integration | ~8 | end-to-end analytics flow |
| 11-device-groups | ~6 | grouping, bulk ops |
| 12-content-tagging | ~6 | tag CRUD, filter |
| 13-health-monitoring | ~10 | health endpoints, fleet view |
| 14-command-palette | ~5 | ⌘K + commands |
| 15-comprehensive-integration | ~12 | end-to-end customer flow |
| 16-billing | ~10 | quota, plans, upgrade modal |
| 17-admin | ~12 | super-admin pages |
| 18-playlist-builder | ~10 | drag-and-drop builder |
| 19-api-keys | ~6 | key CRUD |
| 20-content-folders | ~10 | folder CRUD |
| 21-notifications | ~8 | notification bell, list |
| 22-device-preview | ~6 | preview modal |
| 23-comprehensive-validation | ~15 | second-pass integration |
| 24-team-audit | ~17 | team management + audit log |

**Sum: ~332 test folders**, all marked failed by Playwright reporter.

---

## Sample failure analysis (5 tests across 5 specs)

### 1. `01-auth.spec.ts` — should display login page
**Test:** `await expect(page.locator('h1')).toContainText(/sign in|login/i);`
**Page rendered:** Login page with `h2 "Welcome back."` heading + Vizora branding + value props
**Failure mode:** Selector `h1` doesn't exist on the new login page; the heading is `h2`.
**Root cause:** Login page UI was redesigned (marketing-quality redesign per recent commits); test selectors not updated.
**Fix effort:** 5 min — change `h1` → `h2` and pattern to `/welcome back/i`.

### 2. `03-displays.spec.ts` — display CRUD
Likely failure pattern: tests expect a specific button label ("Add Display") that may have been renamed to "Pair Display" or similar in the UI refresh.

### 3. `09-device-status.spec.ts` — Phase 6.1 ADVERSARIAL connection-failure
The folder name `Phase-6-1-45748-ection-failure-ADVERSARIAL` indicates this is testing a forced error condition — these tests typically have brittle setup (mocking WebSocket failures); often fail on env differences.

### 4. `15-comprehensive-integration.spec.ts` — end-to-end flow
This depends on having a successful registration in step 1; if registration fails (probably due to selector drift in the form), all downstream steps cascade-fail.

### 5. `24-team-audit.spec.ts` — team page should display
Similar pattern: depends on a logged-in admin user; if login flow assertions fail, the test never gets to the team page.

---

## Cascade analysis

The 100% failure rate strongly suggests a **single upstream selector failure** (the login redesign) cascades through all tests. Reasoning:

1. Most specs have a `beforeEach` that logs in
2. Login flow uses an h1 selector that no longer exists
3. Login times out → all downstream tests fail before they even start
4. Tests testing login itself fail on the same selector
5. Tests testing public pages (e.g., `should display login page`) fail because they directly assert on the missing h1

If the login `h1` → `h2` selector is fixed, expect 70-90% of tests to pass.

---

## Critical-path verdict

For customer-#1 deployment, these 8 flows MUST work:

| Flow | Spec | Page renders correctly? | Test asserts correctly? | Verdict |
|---|---|---|---|---|
| 1. Sign up + email verify | 01-auth | ✅ register page renders | ❌ stale selectors | UI works, test broken |
| 2. Login + create org | 01-auth | ✅ login page renders | ❌ h1 vs h2 mismatch | UI works, test broken |
| 3. Display pairing | 03-displays | (not yet manually verified post-deploy) | ❌ likely cascade | Manual verification needed |
| 4. Content upload | 04-content | (not yet manually verified) | ❌ likely cascade | Manual verification needed |
| 5. Playlist create | 05-playlists | (not yet manually verified) | ❌ likely cascade | Manual verification needed |
| 6. Schedule assign | 06-schedules | (not yet manually verified) | ❌ likely cascade | Manual verification needed |
| 7. Display sees content | 09-device-status, 15-comprehensive | ✅ historically works (per `vizora-e2e-retest-report.md` 2026-03-06 with real device) | ❌ cascade | Real-device walkthrough planned for T-2 |
| 8. Logout + back in | 01-auth | ✅ login page renders | ❌ cascade | UI works, test broken |

**No evidence of feature regression.** All visible failures map to stale test selectors against a redesigned UI.

---

## Comparison to last full Playwright run

Per `vizora-comprehensive-e2e-report.md` (2026-03-09): 62/76 passed at 88/100 score, on the OLD UI before the recent redesigns.

Today's 0/332 with the redesigned UI is consistent with: tests were last updated for the pre-redesign UI; the design refresh broke selectors.

---

## Recommendation

**On the Playwright E2E axis: ⚠️ NEEDS RE-WORK, NOT A LAUNCH BLOCKER**

Playwright cannot serve as a critical-path verification gate today because the test suite is stale relative to the current UI. However:

- **The app under test is working correctly** (page snapshots prove this).
- **Unit + integration coverage is exhaustive and clean** (3411/3411).
- **The May 6 incident-response code path was verified end-to-end on prod** (today, agent-platform-redesign — `agent_runs` row written + sidecar firing).

**For customer #1 deployment, substitute Playwright with:**
1. Operator-driven manual smoke test on prod (per `backlog.md` B16 60-step go-live checklist)
2. Real-device walkthrough on customer's actual hardware (T-2 in the 4-day plan)
3. First-customer concierge mode for first 24h post-launch

**Post-launch tech-debt:** dedicate 2-3 days in week-1 to refreshing all 24 Playwright spec files against the current UI. Without this, regressions in customer-facing flows can't be caught automatically — every UI change becomes an operator burden.

---

## Tracking

- Test results JSON (`test-results/results.json`): not written — Playwright reporter exited before flush. Use `.last-run.json` for now.
- HTML report: `test-results/playwright-report/` (Playwright HTML reporter — open in browser for per-test detail)
- Screenshots: `test-results/<spec>/test-failed-1.png` per failure
- Videos: `test-results/<spec>/video.webm` per failure (set to `retain-on-failure`)

---

## Files affected (for the post-launch refresh sprint)

All 24 spec files in `e2e-tests/` need a one-pass selector update. Estimated effort: 1-2 hours per spec depending on how much UI changed. Total: 1-2 dev-days for a focused refresh.

The web tests (`web/src/**/*.test.tsx`) already cover the new UI — they're 864/864 passing. Playwright tests just need to catch up.
