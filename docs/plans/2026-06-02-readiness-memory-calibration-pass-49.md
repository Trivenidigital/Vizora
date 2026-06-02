# Readiness Memory Calibration Pass 49

**Date:** 2026-06-02

**Branch:** `feat/customer-dashboard-perf-pass-49`

## Goal

Stop public readiness from reporting degraded/unhealthy solely because the V8
heap is nearly full at a small absolute size. Use Vizora's existing PM2 memory
budget as the readiness lever so operators and customers see meaningful health
signals.

## Source-of-Truth Check

- Production probe after PR #188:
  - `REMOTE_MAIN=6025c49d794a00297f1caaf4b4d451a0994b55d1`
  - `PROD_HEAD=bb76aa1838740bff5b58623dfef7a906d44f46a6`
  - deploy remains blocked by 72 dirty/untracked prod paths.
  - `/api/v1/health/ready` returned `status: degraded` only because memory was
    `heapUsedMB=152`, `heapTotalMB=155`, `heapUsagePercent=98.2`, `rssMB=389`.
- `HealthService.checkMemory()` currently gates status only on
  `heapUsed / heapTotal`, so normal pre-GC V8 behavior can mark a small process
  unhealthy.
- `ecosystem.config.js` and `scripts/ops/health-guardian.ts` both use a 512 MB
  middleware memory budget. The ops reload threshold is RSS/process memory
  greater than 85% of that budget, not V8 heap saturation alone.

## New Primitives Introduced

No new route, module, model, migration, env var, PM2 process, response shape,
realtime path, MCP tool, Hermes skill, or provider spend path. This pass only
calibrates the existing memory health check.

## Hermes-First Analysis

This is local NestJS health/readiness behavior, not a business-agent, MCP, or
Hermes runtime task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Health memory calibration | none applicable | reuse existing `HealthService` |
| Ops memory budget | none applicable | align with existing PM2/health-guardian 512 MB budget |

Awesome-Hermes ecosystem check: no applicable Hermes skill/library primitive
for a NestJS memory readiness threshold.

## Design

- Keep reporting heap details (`heapUsedMB`, `heapTotalMB`,
  `heapUsagePercent`, `rssMB`) for operator visibility.
- Add `rssUsagePercent` against the existing 512 MB middleware process budget.
- Mark memory degraded/unhealthy based on RSS budget pressure:
  - degraded above 85% of 512 MB.
  - unhealthy above 95% of 512 MB.
- Treat very large heap saturation as a secondary signal:
  - degraded when heap is above 85% and heap used is at least 384 MB.
  - unhealthy when heap is above 95% and heap used is at least 448 MB.
- This keeps the observed production case (`152/155 MB heap`, `389 MB RSS`)
  healthy while still degrading before PM2's 512 MB restart budget is exhausted.
- Do not change liveness, dependency checks, public response shape, or
  health-guardian remediation behavior.

## Plan

- [x] Add red health-service coverage for the production false-positive memory
  case: small saturated heap and sub-threshold RSS remains healthy.
- [x] Add red coverage for real RSS pressure degrading and unhealthy status.
- [x] Add red coverage for large saturated heap pressure even if RSS is under
  the hard budget.
- [x] Implement the calibrated memory thresholds in `HealthService`.
- [x] Run focused health tests.
- [x] Run multi-vector diff review.
- [x] Run broader middleware typecheck/tests/build and security check.
- [ ] Open PR, wait for CI, merge if green.
- [ ] Re-check production deploy gate; deploy only if the dirty/diverged
  production checkout is made safe.

## Verification So Far

- Red run:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/health/health.service.spec.ts`
  failed as expected: the current heap-percent-only logic degraded the small
  saturated heap and missed RSS pressure.
- Green run:
  same command passed 1 suite / 26 tests after calibration.
- Focused health slice:
  `pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/health/health.service.spec.ts src/modules/health/health.controller.spec.ts`
  passed 2 suites / 37 tests.
- TypeScript:
  `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` passed.
- Changed-file ESLint:
  `$env:ESLINT_USE_FLAT_CONFIG='false'; npx eslint middleware/src/modules/health/health.service.ts middleware/src/modules/health/health.service.spec.ts`
  passed with only the existing eslintrc deprecation warning.
- Security:
  `pnpm security:no-hardcoded-jwts` passed.
- Diff hygiene:
  `git diff --check` passed with CRLF normalization warnings only.
- Full middleware:
  `pnpm --filter @vizora/middleware test -- --runInBand` passed 148 suites /
  3027 tests / 1 snapshot.
- Build:
  `npx nx build @vizora/middleware` passed with existing webpack warnings.

## Review

- Health/ops/runtime reviewer: CLEAN. Confirmed the 512 MB budget aligns with
  `ecosystem.config.js` and `scripts/ops/health-guardian.ts`, real RSS pressure
  is still surfaced, and public readiness semantics remain unchanged.
- Code/test/release reviewer: CLEAN. Confirmed threshold math, tests, public
  response shape, TypeScript, and release-safety evidence.

## Risks

- Under-alerting real memory leaks would be worse than the current false
  degraded state. The fix keeps RSS thresholds aligned with the PM2 restart
  budget and keeps large heap saturation as a secondary signal.
- Changing public readiness can alter health-guardian behavior after deploy.
  The intended effect is to avoid false degradation below the existing
  remediation threshold, not to suppress real RSS pressure.
