# Vizora - Task Tracker

## In Progress: Display Delivery Reliability Follow-up (2026-05-31)

**Branch:** `feat/customer-performance-hardening-2`

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
- [ ] Open PR, wait for CI, merge if clean.

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

## Next Up (Not Started)

_No active tasks. Pick from deferred items above or start a new feature/sprint._
