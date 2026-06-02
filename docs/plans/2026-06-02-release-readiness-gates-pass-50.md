# Release Readiness Gates Pass 50

**Date:** 2026-06-02
**Branch:** `fix/release-readiness-gates-pass-50`

## Goal

Remove three release-readiness gate drifts found after PR #189:

- the customer-critical smoke script probes the realtime gateway at the stale
  `/api/health` path even though the gateway exposes native `/health`;
- the first-customer onboarding runbook repeats the same stale realtime health
  path;
- CI builds the web dashboard but does not run the web unit-test suite in the
  `test` job.

## New Primitives Introduced

None. This pass changes release-gate wiring and documentation only. It does
not add a route, model, migration, module, env var, process, response shape,
realtime event, MCP tool, Hermes skill, or AI/provider spend path.

## Hermes-First Analysis

Checked per project convention. This is local CI/smoke/runbook gate
alignment, not a business-agent, MCP, Hermes runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| CI test gating | none applicable | update existing GitHub Actions workflow |
| Smoke health endpoint | none applicable | update existing smoke script |
| Operator runbook | none applicable | update existing runbook |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for
GitHub Actions coverage or shell smoke endpoint alignment.

## Drift Evidence

- `realtime/src/app/app.controller.ts` exposes `GET /health`, `GET /health/live`,
  and `GET /health/ready`.
- `scripts/smoke/api-critical-path.sh` currently probes
  `$RT_BASE/api/health`.
- `docs/runbooks/first-customer-onboarding.md` currently probes
  `http://localhost:3002/api/health`.
- `.github/workflows/ci.yml` runs middleware, realtime, display, and ops tests
  in the `test` job, while web is only covered by the build job.

## Plan

- Add a static regression test covering the realtime smoke path, the runbook
  realtime path, and web unit-test inclusion in CI.
- Prove the test fails before fixes.
- Update the smoke script to use `$RT_BASE/health`.
- Update the first-customer runbook to document `http://localhost:3002/health`.
- Add web unit tests to the CI `test` job.
- Run focused static tests plus shell syntax checks, ops tests, web tests,
  security scan, and diff checks.
- Run multi-vector review before broader verification.
