# Vizora - Task Tracker

## In Progress: Customer Dashboard + Performance Pass 4 (2026-05-31)

**Branch:** `feat/customer-dashboard-performance-pass`

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
- [ ] Run focused/broad verification.
- [ ] PR, CI, merge.
- [ ] Re-check deployment gate; deploy only if prod checkout is safe.

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

## Next Up (Not Started)

_No active tasks. Pick from deferred items above or start a new feature/sprint._
