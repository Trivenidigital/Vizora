# Critical Smoke Upload + Streaming Coverage

**Goal:** Extend the operator-facing critical-path smoke so a go-live check proves real multipart upload and authenticated device-content byte-range streaming, not only URL content creation.

**New primitives introduced:** none. Reuse the existing Bash smoke harness, `/api/v1/content/upload`, device JWT from pairing, `/api/v1/device-content/:id/file`, response envelope parsing helpers, and temp-file cleanup.

**Hermes-first analysis:**

| Domain | Hermes skill found? | Decision |
|---|---|---|
| API smoke coverage | none applicable | Build in existing `scripts/smoke/api-critical-path.sh`. |
| Multipart content upload | none applicable | Reuse existing middleware upload endpoint and storage path. |
| Device-content streaming | none applicable | Reuse existing authenticated device-content controller and byte-range support. |

Awesome-Hermes-agent ecosystem check: not applicable; this change does not introduce business-agent workflows, MCP tools, AI provider calls, or spend paths.

## Drift Check

- `scripts/smoke/api-critical-path.sh` already covers health, register/login, pairing, URL content creation, playlist, schedule, active schedule device read, and notifications.
- The script does not upload a real file through multipart form data.
- The script does not probe authenticated `/api/v1/device-content/:id/file` streaming or range responses.
- Unit coverage exists for upload quota and device-content range behavior, but the operator smoke does not prove the integrated storage path.

## Plan

- [x] Add a tiny generated PDF fixture inside the smoke temp directory.
- [x] Upload it through `/api/v1/content/upload` using the authenticated cookie/CSRF path.
- [x] Parse the uploaded content ID through the standard response envelope helper.
- [x] Fetch an authenticated byte range from `/api/v1/device-content/:id/file` with the paired device JWT.
- [x] Verify status `206`, exact `Content-Range` total, and PDF header bytes.
- [x] Delete the uploaded content after the range probe, with best-effort exit cleanup for interrupted runs.
- [x] Run syntax verification and focused smoke-script checks; run full smoke only if a local stack is available.

## Review Focus

- Keep the script re-runnable and cleanup-safe.
- Do not commit binary fixtures or secrets.
- Avoid image uploads in the smoke fixture so production runs do not leave generated thumbnail files behind.
- Do not make local development smoke brittle where existing MinIO setup is expected.
- Preserve existing critical-path checks and result reporting.

## Review Gate

- Bash/operator-safety reviewer: initial low findings on run uniqueness, `Content-Range`, and signal traps fixed; final re-review CLEAN.
- Customer-readiness/operator-state reviewer: initial persistent production artifact finding fixed by switching to a PDF fixture and deleting uploaded content; final re-review CLEAN.

## Verification

- `pnpm install --frozen-lockfile` - pass.
- `C:\Program Files\Git\bin\bash.exe -n scripts/smoke/api-critical-path.sh` - pass.
- `git diff --check` - pass; line-ending warnings only for existing Windows checkout behavior.
- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|content.controller|device-content.controller"` - pass, 7 suites / 190 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2787 tests.
- `pnpm --dir packages/database exec prisma validate --schema prisma/schema.prisma` with `NODE_OPTIONS=--use-system-ca` - pass.

## Residual Risk

- Full local critical-path smoke was not run because Docker Desktop is not running and local services on ports 3000/3001/3002 are unavailable. Do not run the smoke against production as a substitute while the production deploy gate remains blocked.
