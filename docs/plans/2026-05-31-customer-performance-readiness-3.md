# Customer Performance Readiness Pass 3

**Goal:** Review Vizora as a paying customer would experience it, identify remaining repo-side production-readiness and performance gaps, fix the highest-value buildable issues, and leave merged evidence without touching operator-gated production state.

**New primitives introduced:** none planned. Prefer existing Next dashboard pages/components, NestJS services/controllers/DTOs, Prisma models/indexes, realtime gateway/Socket.IO paths, display clients, ops scripts, and the existing response envelope.

**Hermes-first analysis:**

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard UX and API correctness | none applicable | Build in existing dashboard/API client/middleware paths. |
| Content upload/list/streaming performance | none applicable | Build in existing content/storage/database paths. |
| Pairing/realtime/display delivery reliability | none applicable | Build in existing pairing/realtime/display-client paths. |
| Code review and production readiness | none applicable | Build/test repo-side fixes; keep prod actions operator-gated. |

Awesome-Hermes-agent ecosystem check: not applicable; this pass does not introduce business-agent workflows, MCP tools, AI provider calls, or spend paths.

## Drift Check

- PR #120 merged display delivery reliability fixes.
- PR #121 merged customer dashboard readiness fixes.
- PR #122 merged stale PR #34 readiness residuals and closed PR #34.
- Current `origin/main` is `48affb3e0ff6163ae5babf6bbe74d702c67e5348`.
- Production deploy remains blocked by dirty/diverged `/opt/vizora/app`; do not pull/reset/stash/restart services until prod-local work is reconciled.

## Analysis Plan

- [x] Run independent dashboard/customer UX analysis.
- [x] Run independent middleware/content performance analysis.
- [x] Run independent pairing/realtime/display reliability analysis.
- [x] Run independent code-review/security/readiness analysis.
- [x] Synthesize a ranked customer-facing issue list with file/line evidence.
- [x] Select a scoped buildable bundle that is repo-side, testable, and does not require production secrets, DNS, SMTP, live payments, or real hardware.

## Selected Fix Bundle

- **Device-token enforcement:** reject disabled/deleted displays in realtime connection auth and device-content file serving; make protected media responses revocation-friendly.
- **Delivery correctness:** count only active device sockets, not dashboard observers, when delivering commands/playlists and reporting fleet delivery state.
- **Display client reliability:** handle browser display `token:refresh`, prevent web display JWT leakage to attacker-origin device-content lookalikes, move Electron pairing to `/api/v1`, and execute main-process override commands even if the renderer is unavailable after a pushed page load.
- **Notification recovery:** keep a separate fired-offline marker so long outages emit both offline and back-online notifications.
- **Upload/storage integrity:** reserve upload quota atomically, release reservations on upload/DB failure, fail closed in production when MinIO upload is unavailable, and avoid deleting DB rows when storage deletion fails.
- **Query performance:** add composite indexes for customer hot list paths and active schedule lookup.
- **Dashboard correctness:** align visible API-key scopes with backend validation, make device-group filtering actually filter, fix schedule group round-tripping / multi-device targeting, avoid fake playlist active counts, and stop customization saves from reporting success before the durable API call succeeds.
- **Smoke coverage:** add upload/device-content range smoke coverage if it can be done without secrets or real hardware.

## Implementation Plan

- [x] Add focused regression tests before fixes where practical.
- [x] Implement the selected bundle using Vizora-native modules and patterns.
- [x] Run multi-subagent review before broad tests.
- [x] Run focused and broad tests proportional to touched surfaces.
- [ ] Open PR, wait for CI, merge if clean.
- [ ] Re-check production deployment gate; deploy only if prod checkout is clean and safe.

## Implementation Evidence

- Device-token enforcement now rejects disabled/deleted displays in realtime and device-content file serving, and protected device-content file responses use revocation-friendly `private, no-store` cache headers.
- Delivery correctness now counts and targets active device sockets instead of dashboard sockets that share `device:{id}` observer rooms.
- Browser and Electron display clients persist refreshed device tokens, authenticate protected `/api/v1/device-content/:id/file` URLs only for trusted origins, move Electron pairing to `/api/v1`, and execute main-process override commands when renderer dispatch is unavailable.
- Offline notifications preserve a fired marker so long outages can still emit back-online notifications.
- Upload and replacement quota accounting now reserves atomically, fails closed in production when MinIO is unavailable, releases reservations only when uploaded-object cleanup succeeds, and keeps DB/accounting state aligned when storage deletes fail.
- Hot path database indexes were added for display/content/playlist/schedule list and active-schedule queries.
- Dashboard fixes align API-key scopes with backend validation, load group membership for device filters, round-trip group schedules, create one schedule per selected display, show ready-playlist counts, and persist customization saves through the organization branding API before mutating local state.

## Review Gate

- Backend/runtime reviewer: initial findings fixed for storage quota rollback, failed delete accounting, false offline alerts on intentional disable, multipart `keepBackup=false`, and DB-delete-after-storage-cleanup drift; final re-review CLEAN.
- Frontend/customer UX reviewer: initial findings fixed for nullable schedule target types, durable customization save ordering, layout tokenization, corrupt localStorage token refresh, and group schedule labels; final re-review CLEAN.

## Local Verification

- `git diff --check` - pass; line-ending warnings only.
- `pnpm --filter @vizora/middleware test -- content.service.spec.ts --runInBand` - pass, 96 tests.
- `pnpm --filter @vizora/middleware test -- --runInBand` - pass, 143 suites / 2787 tests.
- `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false` - pass.
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vizora pnpm --filter @vizora/database exec prisma validate` - pass.
- `pnpm --filter @vizora/realtime test -- --runInBand` - pass, 11 suites / 256 tests.
- `pnpm --filter @vizora/web test -- --runInBand` - pass, 89 suites / 925 tests; existing React `act(...)` and jsdom navigation warnings remain.
- `pnpm --filter @vizora/display test -- --runInBand` - pass, 5 suites / 116 tests; expected negative-path logs and existing MaxListeners warning remain.
- `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` - pass.
- `npx nx build @vizora/middleware` - pass with existing webpack warnings.
- `npx nx build @vizora/realtime` - pass with existing source-map / optional `ws` warnings.
- `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 npx nx build @vizora/web` - pass with existing Next middleware deprecation and TypeScript project-reference warnings.

## Pending Integration

- Branch commit, PR creation, GitHub CI, merge, and post-merge deploy gate re-check remain pending.
- Production deployment is still expected to be blocked unless `/opt/vizora/app` has been reconciled; earlier runtime evidence showed the production checkout dirty and diverged from `origin/main`.
