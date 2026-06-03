# Release Readiness Gates Pass 50

**Date:** 2026-06-02
**Branch:** `fix/release-readiness-gates-pass-50`

## Goal

Remove three release-readiness gate drifts found after PR #189:

- the customer-critical smoke script was believed to probe the realtime gateway
  at a stale `/api/health` path. Pass 56 supersedes this: repo and runtime truth
  show the gateway health route is `/api/health` because realtime applies the
  global `api` prefix;
- the first-customer onboarding runbook was updated under the same assumption;
  pass 56 supersedes this with `/api/health` as the route truth;
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

- `realtime/src/main.ts` applies global prefix `api`, so
  `realtime/src/app/app.controller.ts` health handlers are exposed under
  `/api/health`.
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
- Superseded by pass 56: keep the smoke script and first-customer runbook on
  `$RT_BASE/api/health`, matching repo and production runtime truth.
- Add web unit tests to the CI `test` job.
- Run focused static tests plus shell syntax checks, ops tests, web tests,
  security scan, and diff checks.
- Run multi-vector review before broader verification.
