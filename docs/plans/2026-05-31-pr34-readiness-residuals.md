# PR #34 Readiness Residuals Plan

**Goal:** Resolve the still-relevant production-readiness fixes from stale PR #34 on top of current `origin/main`, without replaying obsolete or conflicting changes.

**New primitives introduced:** none. This ports existing security/ops behavior onto current Vizora-native modules and scripts.

**Hermes-first analysis:**

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Web security headers | none applicable | Build in existing `web/next.config.js`; no agent/runtime skill surface. |
| Realtime notification cleanup | none applicable | Build in existing realtime notification service. |
| Ops content lifecycle archiving | none applicable | Build in existing PM2 ops script and `OpsApiClient`. |

Awesome-Hermes-agent ecosystem check: not applicable; this is repository runtime hardening, not a business-agent workflow or AI/provider spend path.

## Drift Check

- `middleware/src/main.ts` already has env-driven `TRUST_PROXY_HOPS`; residual gaps are Sentry capture for unhandled rejections and clearer port bind diagnostics.
- `web/next.config.js` still injects raw `BACKEND_URL` / `NEXT_PUBLIC_SOCKET_URL` into browser CSP and still emits deprecated `X-XSS-Protection`.
- `realtime/src/services/notification.service.ts` still logs and retries orphaned Redis offline notification keys forever after organization FK failures.
- `scripts/ops/content-lifecycle.ts` still calls `PATCH /content/:id { status: "archived" }` even though the production endpoint is `POST /content/:id/archive`.

## Plan

- [x] Harden `web/next.config.js` CSP inputs, headers, `/pricing` redirect, and production socket URL guard.
- [x] Add CI-safe public URL env defaults for web builds.
- [x] Preserve current `TRUST_PROXY_HOPS` behavior while adding Sentry capture for unhandled rejections and clearer bind errors.
- [x] Drop only organization-FK orphaned realtime notification keys, with tests.
- [x] Switch content lifecycle archive calls to `POST /content/:id/archive`, classify 409/404/405 failures, keep inline alerts, and surface storage-check failures as incidents.
- [x] Update `.env.example`, `CLAUDE.md`, and `tasks/todo.md` evidence.
- [x] Run focused tests/builds, reviewer pass, PR, CI, merge.

## Merge Gate

- [x] Focused realtime notification tests pass.
- [x] Middleware/realtime/web builds pass.
- [x] Web build verifies production CSP guard with CI-safe env.
- [ ] Stale PR #34 is either closed or superseded by the new merged PR.

## Verification Evidence

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

## Review Evidence

- Security/runtime reviewer: initial CSP and external image findings fixed; final re-review CLEAN.
- Ops/realtime reviewer: initial lock-scope, CI wiring, overlap, and archive-error findings fixed; final re-review CLEAN.
