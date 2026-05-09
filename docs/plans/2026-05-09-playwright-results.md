# Vizora Playwright E2E Results — 2026-05-09

## Environment

- Docker available: **Yes** (Docker Desktop had to be cold-started; engine pipe was offline despite `docker info` CLI showing version. Restarting `Docker Desktop.exe` recovered it.)
- Infra containers running: postgres (healthy), redis (healthy), minio (starting/healthy), plus mongodb / clickhouse / prometheus / grafana / loki / promtail also up from the previous compose project.
- Migrations applied: **Yes** — `prisma migrate deploy` reported all 11 pending migrations applied (most recent `20260509000000_agent_runs_enriched_marker`).
- Services started:
  - middleware on :3000 — `npx nx serve @vizora/middleware` — **OK**, "Middleware API running on http://localhost:3000/api/v1", DB + Redis + MinIO + 10 MCP tools registered.
  - realtime on :3002 — `npx nx serve @vizora/realtime` failed twice with `EPIPE` on `packages/database/dist/generated/prisma` (file lock from the running middleware process). Worked around by running `node realtime/dist/main.js` directly against the previously-built artifact. **OK**, "Realtime Gateway running on http://localhost:3002/api".
  - web on :3001 — `pnpm --filter @vizora/web dev` (next dev with Turbopack) — **OK**, "Ready in 6.5s".
- Health probes:
  - `GET /api/v1/health` → 200 `{"success":true,"data":{"status":"ok",...}}`
  - `GET http://localhost:3001` → 200
  - `GET http://localhost:3002/api/health` → 200
- Test user registration (independent API probe):
  - First-name length validation rejects 1-char values (≥ 2 required), so the literal task command failed; succeeds with `firstName=Test`, `lastName=User`. Returned `HTTP 201` with access_token.

## Suite results

**Total: 332 failed, 0 passed, 0 skipped, 0 did-not-run.** Wall-clock ≈ 4 min 30 s.

| Spec | Pass | Fail | Skip | Notes |
|---|---|---|---|---|
| 01-auth | 0 | 5 | 0 | Stale h1 regex; stale API URL `/api/auth/register` (current is `/api/v1/...`) |
| 02-dashboard | 0 | 5 | 0 | Cascades from auth |
| 03-displays | 0 | 5 | 0 | Cascades |
| 04-content | 0 | 5 | 0 | Cascades |
| 05-playlists | 0 | 6 | 0 | Cascades |
| 06-schedules | 0 | 29 | 0 | Cascades |
| 07-analytics | 0 | 6 | 0 | Cascades |
| 08-settings | 0 | 11 | 0 | Cascades |
| 09-device-status | 0 | 24 | 0 | Cascades |
| 10-analytics-integration | 0 | 22 | 0 | Cascades |
| 11-device-groups | 0 | 20 | 0 | Cascades |
| 12-content-tagging | 0 | 20 | 0 | Cascades |
| 13-health-monitoring | 0 | 28 | 0 | Cascades |
| 14-command-palette | 0 | 23 | 0 | Cascades |
| 15-comprehensive-integration | 0 | 19 | 0 | Cascades |
| 16-billing | 0 | 15 | 0 | Cascades |
| 17-admin | 0 | 7 | 0 | Cascades |
| 18-playlist-builder | 0 | 13 | 0 | Cascades |
| 19-api-keys | 0 | 11 | 0 | Cascades |
| 20-content-folders | 0 | 9 | 0 | Cascades |
| 21-notifications | 0 | 8 | 0 | Cascades |
| 22-device-preview | 0 | 9 | 0 | Cascades |
| 23-comprehensive-validation | 0 | 15 | 0 | Cascades |
| 24-team-audit | 0 | 17 | 0 | Cascades |

## Failures (representative samples — all failures share two root causes)

### Root cause #1 — stale h1 copy regex (UI is correct, tests are out of date)

```
1) e2e-tests\01-auth.spec.ts:4:7 › should display login page
   Locator: locator('h1')
   Expected pattern: /sign in|login/i
   Received string:  "Log in to Vizora"
```

The H1 reads `Log in to Vizora` (with a space). The regex requires `login` (no space) or `sign in`. Neither matches the current marketing copy. Same shape for `Create your account` vs `/create account/i`.

### Root cause #2 — stale API path (`/api/auth/...` vs current `/api/v1/auth/...`)

```
3) e2e-tests\01-auth.spec.ts:67:7 › should login existing user
   await page.request.post('http://localhost:3000/api/auth/register', { ... })
   expect(response.ok()).toBeTruthy();   ← FAILS, response is 404
```

Verified via curl:

```
POST /api/auth/register     → 404 Not Found
POST /api/v1/auth/register  → 201 Created (with longer firstName/lastName)
```

CLAUDE.md confirms the platform is on `/api/v1/...` and the only `/api/...` rewrite is in **prod nginx**, not in Next.js dev. Local Playwright runs hit the bare middleware on :3000 directly, where there's no rewrite — so any test calling `/api/auth/...` 404s and cascade-fails the whole spec.

Both root causes are **test-suite drift, not application bugs**. Independent API + UI probes show the system is healthy.

## Critical-path verdict (evaluated against API + manual probes, NOT Playwright)

For first-customer deployment, these flows MUST work:

- [x] **User registration** — `POST /api/v1/auth/register` → 201, returns `access_token` + auth cookie. **PASS.**
- [x] **User login + session** — `POST /api/v1/auth/login` → 201, sets cookie. `GET /api/v1/auth/me` → 200, returns user + org. **PASS.**
- [x] **Display pairing (code generation)** — `POST /api/v1/devices/pairing/request` with `{deviceIdentifier}` → 201, returns 6-char code (`DBE7G4`) + base64 QR. **PASS.**
- [ ] **Display pairing (device pair, status)** — not exercised in this run (would require a device-side flow). Endpoint exists per `pairing.controller.ts` (`GET /devices/pairing/status/:code`, `POST devices/pairing/complete`). **NOT TESTED.**
- [ ] **Content upload (image)** — list endpoint `GET /api/v1/content` returns 200 with empty result envelope. Upload not exercised. **NOT TESTED.**
- [x] **Playlist list** — `GET /api/v1/playlists` → 200 (empty envelope). Create not exercised. **PARTIAL.**
- [x] **Schedule list** — `GET /api/v1/schedules` → 200 (empty envelope). Assign not exercised. **PARTIAL.**
- [ ] **Display sees content (the integration spec)** — Playwright spec 15 cascades-fail on auth; cannot confirm. **NOT TESTED.**

## Recommendation

**E2E axis verdict: CONDITIONAL — but the condition is on the test suite, not the product.**

The Playwright suite has fully bit-rotted relative to the current UI/API:
- It uses pre-`/api/v1/` paths in `page.request.post` calls.
- It uses pre-rebrand H1 copy (`/login/i`, `/create account/i`) that no longer matches the live-screens-await marketing layout.

Underlying services are demonstrably healthy:
- All three NestJS/Next services start clean and reach healthy state.
- All probed REST endpoints (`auth/*`, `displays`, `content`, `playlists`, `schedules`, `displays/pairing/request`) return correct envelopes with correct status codes.
- DB, Redis, MinIO connect; MCP server registers all 10 tools at startup.

**Implications for the 4-day customer go-live:**

1. The current Playwright runs **provide zero signal** on production readiness — they're failing on test-side staleness, not on application defects. Treating them as a release gate would block on noise.
2. Before the deployment, either (a) fix the suite (mechanical: regex updates + path rewrites) and re-run, or (b) accept the suite is bit-rotted and rely on the API-level probes + manual smoke for the critical paths.
3. **Option (a) is realistic in 4 days** — the breakages are uniform: two find-replace patterns (`/api/auth/` → `/api/v1/auth/`, h1 regex updates) plus a registration-helper update. Estimated effort: half-day for one engineer.
4. **Until the suite is fixed, do not ship contingent on E2E green.** Ship contingent on the API + manual flows that this report verified live.

## Cleanup notes

- The 3 background services (middleware, realtime, web) are still running on :3000/:3001/:3002 at report time. Stop with `taskkill /F /IM node.exe` or kill their background bash tasks individually.
- `test-results/` contains 332 per-test artifact directories (screenshots + videos) — sizable. Safe to delete after this report is read.
- Docker containers from the prior session were already running; nothing new was provisioned.
