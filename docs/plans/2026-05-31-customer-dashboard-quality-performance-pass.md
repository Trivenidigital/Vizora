# Customer Dashboard Quality + Performance Pass

**Goal:** Remove misleading customer-facing dashboard behavior and fix launch-critical correctness issues found by reviewer agents after PR #120.

**Branch:** `feat/customer-dashboard-quality-pass`

**New primitives introduced:** small web formatting/pagination helpers only; no new service, process, table, env var, agent, or external provider path.

**Hermes-first analysis:**

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Customer dashboard UI correctness | none applicable | Build in Vizora web; not an agent/Hermes task. |
| Device playback/pairing correctness | none applicable | Build in existing display/realtime/middleware paths. |
| SMTP config parity | none applicable | Fix existing mail service env handling. |

Awesome-Hermes ecosystem check: no agent orchestration or MCP skill work is introduced, so Hermes is not the right substrate for this pass.

## Reviewed Findings

- Dashboard/device/content/playlist/schedule pages treat default-paginated `limit=10` API responses as complete.
- Fleet command and emergency override toasts ignore `devicesDelivered` / `devicesFailed`.
- Device Health dashboard fabricates random health metrics on refresh.
- Content library `Clear all` does not clear tag filters, and bulk image upload asks the backend to generate thumbnails after upload even though the upload endpoint already does it.
- SMTP startup checks accept `SMTP_PASS`, but `MailService` only reads `SMTP_PASSWORD`.
- Layout zone resolvers emit `playlist` / `content` fields that renderers do not read.
- Realtime queued commands replay newest-first.
- Fleet `push_content` maps non-existent Prisma `Content.title` / `thumbnailUrl` fields.
- Pairing clients poll every 2s against a 10/min throttle.

## Implementation Checklist

- [x] Add failing tests for SMTP env parity, command FIFO, fleet content field mapping, fleet command result messaging, stable health data, content tag clearing, duplicate thumbnail prevention, layout zone compatibility, pairing poll cadence, and paginated dashboard list/picker loading.
- [x] Implement the minimal fixes in existing Vizora-native modules.
- [x] Add focused tests for the changed files.
- [x] Run focused suites for middleware, realtime, web, and display.
- [x] Dispatch subagent diff reviews before broad tests.
- [x] Run broader affected service suites/builds.
- [ ] Commit, open/merge PR if CI is green.
- [ ] Deploy only if the prod worktree safety gate is clear; current prod checkout is dirty/diverged, so deployment remains blocked until reconciled.

## Review Gate

- Backend/realtime reviewer: high tenant-scope and medium duration-unit findings fixed; final re-review CLEAN.
- Frontend/customer UX reviewer: device SSR envelope, dashboard pagination, health refresh, health sorting, no-target command, partial-refresh, and capped-pagination findings fixed; final re-review CLEAN.
- Performance/readiness reviewer: dashboard pagination and partial-refresh findings fixed; final re-review CLEAN.

## Focused Verification

- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="mail.service|fleet.service|content.service"` - pass, 3 suites / 126 tests.
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern="redis.service|device.gateway"` - pass, 3 suites / 107 tests.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="pagination|dashboard/content|dashboard/devices|dashboard/playlists|dashboard/schedules|dashboard/health|dashboard/__tests__|EmergencyOverrideModal|FleetCommandDropdown|commandResultMessage|useDeviceConnection|usePlaylistPlayer|usePairing|DeviceHealthMonitor"` - pass, 14 suites / 106 tests; existing React act warnings and intentional negative-path console errors remain.

## Broad Verification

- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 141 suites / 2763 tests.
- `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 245 tests.
- `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 115 tests; known MaxListeners warning and expected negative-path logs remain.
- `pnpm --filter @vizora/web test -- --runInBand` - pass, 86 suites / 905 tests; existing React act warnings and expected negative-path logs remain.
- `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- `pnpm --filter @vizora/display build` - pass.
- `NODE_OPTIONS=--max-old-space-size=4096 npx nx build @vizora/web` - pass with existing Next middleware/proxy and missing production API URL warnings.
- Direct ESLint equivalent (`ESLINT_USE_FLAT_CONFIG=false eslint "middleware/src/**/*.ts" "realtime/src/**/*.ts"`) - exit 0, 187 warnings, no errors. Local `pnpm lint` wrapper is Windows-incompatible because the script uses Unix-style env assignment.
- `git diff --check` - pass; line-ending warnings only.
