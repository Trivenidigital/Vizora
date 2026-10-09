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

---

# Part 2 — production-readiness remediation (same day, branch `fix/e2e-production-readiness`, PR #390)

Part 1 above is the audit. This part is what was done about it.

## Product defects fixed

These are defects in the product, not the tests. Each was found by a spec that was *correct* to fail, or by investigating one that was not.

1. **Team and Audit Log settings pages were unreachable from the UI.** `/dashboard/settings/team` and `/dashboard/settings/audit-log` both ship and work (15 passing tests in `24-team-audit.spec.ts` exercise them directly), but a grep of `web/src/app` and `web/src/components` found **no link to either**. They could be reached only by typing the URL. Added a "Team & Activity" card to the settings index. It is deliberately NOT titled "Organization" — the organization settings card already owns that `h3`, and the first attempt produced two cards sharing a heading, which `08-settings` caught immediately.
2. **`NewLookNotice` injected a competing `<h2>` on every dashboard page.** It is mounted in the dashboard *layout*, so its heading rendered above each page's own `<h2>` title. Every dashboard page had an ambiguous heading outline. It is a `role="status"` `aria-live` card and is announced without a heading, so the title is now a `<p>`.
3. **API-key create input had no `id`, no `name`, and an unassociated label.**
4. **Settings Region/Timezone selects had no `id`s** and their labels no `htmlFor`.
5. **`CookieConsent` advertised `role="dialog"` while `aria-hidden`** and translated off-screen, so `[role="dialog"]` matched it on every page in the app.
6. **`health/page.tsx` claimed the page auto-refreshes "every 10s"** against a `HEALTH_REFRESH_INTERVAL_MS` of 30s.

A `users` icon was added to the registry so "Team Members" is not labelled with a shield (the registry had no people glyph).

## CI now runs the browser suite

Previously **nothing in CI ran Playwright**. The `e2e` job is a middleware Jest subset plus a realtime suite marked `continue-on-error: true`. That is how a regression that broke two auth specs shipped through three green CI runs.

The new `playwright` job starts the stack the way the suite was written and verified against: `nx serve` for middleware and realtime, `next dev` for web. A production web build cannot be used — `next.config.security.js` refuses a localhost origin for `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SOCKET_URL` under `NODE_ENV=production`, and those are build-time inputs baked into the browser bundle, so a prod build could not be pointed at the CI services at all.

**MinIO is deliberately absent**, after two failed attempts to pull it (Docker Hub denies anonymous pulls from runners; the same RELEASE tag on quay.io answers "unauthorized"). Two things were checked rather than assumed before dropping it: no spec in `e2e-tests/` uploads a file (`setInputFiles` appears in none of them), and `StorageService` fails **open** outside production — it logs the connection failure, falls back to local storage and sets `available=false`, throwing only when `NODE_ENV=production`.

## Assertions that could not fail

The audit found **31 assertions** written `expect(x || true).toBeTruthy()` or `expect(true).toBeTruthy()` across 9 spec files. They pass no matter what the product does. This is the mechanism by which the 32 stale specs went unnoticed for months, and it matters more than any individual failure: a suite that reports green while a chunk of its assertions are inert is worse than no suite, because it is trusted.

Each was replaced with a real contract, a **pinned absence carrying a reach control** (a second assertion proving the scoped locator searches a region that really does contain comparable elements — a zero with no reach control proves nothing), or deleted where it guarded a feature that was never built.

## Further product gaps found while doing that

Found, reported, **not fixed** — each is unbuilt scope rather than a regression:

- **There is no way to create a content tag anywhere in the dashboard.** `ContentTagger` is mounted once, from `content/page-client.tsx`, and that call site does not pass `onCreateTag` — so the component's entire create branch (the add-tag button, the name input, the colour picker) never renders. Tags reach the UI only via `GET /content/tags`. Meanwhile the panel's own empty state instructs the operator to "add tags to content before using tag filters": advice with nothing on offer that performs it.
- **Nested device groups are dead code.** `DeviceGroupSelector.renderGroups` recurses on `parentGroupId`; `model DisplayGroup` has no parent column and `createDisplayGroup` accepts only `{ name, description }`, so every group renders flat at level 0.
- **Folder rename and delete have no UI.** `updateFolder` and `deleteFolder` exist on the API client with no call site in `web/src`.
- **The devices page has no periodic refresh.** Freshness arrives only over the realtime channel. The test that claimed to cover "auto-refresh status periodically" asserted the page heading.
- **The schedules page has no status filter and no search input**, and the create-schedule dialog has no timezone picker (each display applies its own zone). `formData.timezone` is still initialised and transmitted on create/update regardless.
- A11y: the Create-New-Folder modal's "Folder Name" label has no `htmlFor`, and `FolderTree` rows carry no `aria-current`/`aria-selected`, so folder selection is observable only through styling.

## `require('@vizora/database')` silently returns the wrong module — NOT fixed

The API smoke script's one real failure. In local dev (`nx serve @vizora/middleware`), `GET /schedules/active/:displayId` and `GET /devices/me/content` return 500 with `(0 , database_1.previousDay) is not a function`. **Production is unaffected** — the webpack build bundles the library from source, and prod logs show 200s.

Measured, not inferred — both resolve to the same `dist/index.js`:

| call | keys returned | `previousDay` |
|---|---|---|
| `require('@vizora/database')` | 74, all Prisma | `undefined` |
| `await import('@vizora/database')` | 25, no Prisma | `function` |

Cause: `dist/lib/database.js` ends with `export * from '../generated/prisma/index.js'`, and that generated client is **CommonJS**. A `require()` of an ESM barrel whose graph star-exports a CJS module returns only that module's exports and silently drops every other export in the barrel. Three probes pin it: order does not matter, and **explicit named re-exports do not survive either** — only removing the CJS star-export works.

Not fixed here because that change alters the public API of `@vizora/database` for every consumer importing Prisma types or enums from the barrel, and touches the production build path. Production is fine today, so it could not be justified without a verified prod build. The alternative is shipping a real CJS build and adding a `"require"` condition to the package `exports` map, which today has only `@vizora/source`, `types`, `import` and `default`.

Note the browser suite does **not** cover these two endpoints — they are device-facing. A green Playwright run says nothing about this; the API smoke script is what catches it.

## Known remaining weakness in the suite

Beyond the 31 literal tautologies, roughly **85 tests still have bodies wholly wrapped in `if (await element.isVisible())`**, plus about ten `toBeGreaterThanOrEqual(0)` assertions that also cannot fail. `12-content-tagging` is the worst case: nearly every remaining test is of that shape and most probe the tag-creation surface that does not exist. That file wants consolidation into a few real tests plus one pinned gap, not site-by-site repair. This was left out of scope and is recorded here rather than left implicit.
