# Full-stack E2E results — 2026-10-09 (main `20c8debd`, local stack)

Stack: middleware :3000, web :3001 (`NEXT_PUBLIC_SCHEDULES_ENABLED=true`), realtime :3002,
Postgres/Redis/MinIO in Docker. Playwright run spec-by-spec (fresh process per file, video/trace
off) because the monolithic run was OOM-killed at 110/332 on 2026-10-02.

## Totals

| Layer | Result |
|---|---|
| Middleware / realtime / web / ops unit suites | all green (2026-10-02 run, unchanged tree) |
| API smoke (`scripts/smoke/api-critical-path.sh`) | 22/27 — 5 failures are harness/dev-only (Windows path artifact on PDF upload; `@vizora/database` ESM/CJS interop under `nx serve` → 500 on `/schedules/active/:id` and `/devices/me/content`; prod logs show 200s) |
| Device pairing + content streaming (direct script) | pass |
| Playwright, 24 specs / 332 tests | **293 passed, 32 failed, 7 skipped** |

## The 32 Playwright failures, attributed

**Pre-existing before the redesign (9)** — identical in the pre-redesign baseline:
08-settings ×3, 19-api-keys ×4, 24-team-audit ×2.

**Stale test expectations, no product defect (18)** — the test asserts copy or features that
left the product months before the redesign, or a selector that hits the wrong element:
- 07-analytics ×5 — expects mock-era copy ("Content Served", "366", "Device Uptime Timeline"); gone since `b2b81b9b` (2026-02-05).
- 16-billing — expects `$29|$99`; plan prices come from the DB plans since `0f7ff3aa` / `0a763653`.
- 23 nav links — expects a "Dashboard" link; the sidebar item has been "Overview" since `40d66953` (2026-01-26). `<aside><nav>` landmarks are present.
- 23 email validation — `fill()` on the read-only account-email field waits forever (`readOnly` is correct behaviour).
- 23 404 — the 404 page renders ("404" + "Page Not Found"); the test's `isVisible()` on a multi-match text locator throws strict-mode and is caught as `false`.
- 22 view toggle — a grid/list toggle on Devices never existed in `web/src`; only the spec mentions `view-toggle`.
- 18 create playlist, 20 folders ×3 — `input[type="text"]` first matches the page search box, so the modal name stays empty and the submit button is correctly disabled (`!newFolderName.trim()`); the click waits for enabled and times out.
- 06 required-fields — the schedule modal validates on submit (`validateForm`) instead of disabling the button; the test demands `toBeDisabled()`. Design choice, not a defect.
- 06 status filter — `/active|inactive|all/i` matches the cookie-consent "Accept All" button, which is rendered invisible until its 1s timer.
- 06 timezone — `select.first()` resolved a hidden select.
- 09 ×3 — fresh per-test orgs have zero devices ("No devices yet"), so no online/offline text; the other two pick hidden/classless elements.

**Caused by the redesign (2)** — `NewLookNotice` title became an `<h2>`, so `locator('h2')`
in 01-auth (register at :72, logout at :189) is a strict-mode violation. Selector fix only
(scope to the page heading); registration and logout themselves work. Intermittent: the logout
test passed on the targeted rerun because the notice mounts after the assertion's first poll.

**Unresolved / intermittent (3)**
- 01-auth register: `#firstName` resolved to 2 identical inputs — seen twice (both as the first spec after the dev server sat idle), not reproduced in 6 fresh loads nor in the targeted rerun. Server HTML has exactly one. Suspected dev-server hydration/HMR artifact; unverified.
- 06 open-create-modal and 19 create-key modal: `[role="dialog"]` resolved to 3 — the modal, the cookie bar (present in DOM, `aria-hidden`), and the **Next.js dev error overlay** (`data-nextjs-dialog`), with a blank screenshot. Not reproduced by a direct probe (2 dialogs, no overlay, no page errors). Dev-only by construction; the triggering error was not captured.
- 2 targeted-rerun failures were the auth fixture failing to register (not product); the full-run results above are the ones used.

## Findings outside the pass/fail list
- **CI never runs Playwright.** `.github/workflows/ci.yml` `e2e` job runs a middleware Jest subset plus realtime e2e with `continue-on-error: true`. This is why the `<h2>` regression shipped through three green CI runs.
- Local-only: every dashboard page logs `[Socket] Error: join:organization Not authenticated`. Prod realtime (last 3000 log lines) has **zero** `Unauthenticated message attempt` and shows dashboard users joining org rooms — local env issue, not shipped.
- Local-only: dev CSP blocks React's `eval()` in development mode (console error on every page). Prod React does not eval.

## Suggested follow-ups (not done)
1. Fix the two 01-auth selectors (mine): `page.getByRole('heading', { name: /dashboard overview/i })`.
2. Decide whether to refresh or delete the 18 stale specs; most predate the redesign by 6+ months.
3. Add a Playwright job to CI (needs the full stack in the runner, or a tagged smoke subset).
