## Customer Critical Path E2E Gate Pass 37

**Goal:** Add a CI-gated middleware E2E test that proves the customer-critical
API path from account creation to paired-display schedule delivery works through
the production `/api/v1` routing shape.

**New primitives introduced:** none. This pass adds test coverage and CI wiring
only. It reuses the existing NestJS app module, auth, Redis pairing flow,
content, playlists, schedules, device JWT verification, Prisma persistence,
response envelope, and `/api/v1` route prefix.

**Hermes-first analysis:** not applicable. This task is not a business-agent,
MCP, Hermes, AI/provider, or spend-path change.

## Drift Check

- `scripts/smoke/api-critical-path.sh` already covers the integrated runtime
  path: register/login, pairing request and complete, device token retrieval,
  content creation, multipart upload, device-content range streaming, playlist
  creation, active schedule creation, and device active-schedule read.
- `.github/workflows/ci.yml` still gates only
  `--testPathPattern=agents` in the middleware E2E job.
- Existing middleware E2E specs are older and use `app.setGlobalPrefix('api')`;
  the new customer-critical-path spec should use `api/v1` to match production.

## Scope

1. Add `middleware/test/customer-critical-path.e2e-spec.ts`.
2. The spec registers a disposable org/user, completes device pairing, creates
   URL content, creates a playlist with that content, creates an always-active
   display schedule, and verifies the paired device token can read that schedule
   with playlist item content.
3. The spec also asserts device-boundary and tenant-boundary failures: no token,
   user JWT, and a second org's device JWT cannot read the first display's
   active schedule; a second org cannot add first-org content to a playlist or
   schedule its own playlist onto the first org's display.
4. Update GitHub Actions E2E command to run this spec alongside the existing
   agents E2E suite.
5. Leave production code untouched unless the E2E exposes a real regression.

## Test Plan

- Focused local E2E:
  `pnpm --filter @vizora/middleware exec jest --config=jest.e2e.config.js --runInBand --testPathPattern=customer-critical-path`
- CI-shaped local E2E:
  `pnpm --filter @vizora/middleware exec jest --config=jest.e2e.config.js --runInBand --testPathPattern="(agents|customer-critical-path)"`
- Focused unit safety if production code changes become necessary.
- `git diff --check`.

## Risks

- Local E2E requires PostgreSQL and Redis on the configured test URLs. If local
  infrastructure is unavailable, CI is the authoritative verification for this
  pass.
- This does not replace the operator-gated production smoke or real hardware
  walkthrough; it only prevents obvious integrated API regressions from merging.
