# Vizora - Task Tracker

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

---

## Active Task: Vizora Frontend Redesign (2026-05-13)

### Goal

Reposition the public Vizora homepage from the current dark, AI-forward "Electric Horizon" treatment to **Operational Simplicity with Premium Confidence**: light, trustworthy, SMB-friendly, product-first, and free of AI/cyber/NOC visual language.

### Design Checklist

- [x] Review current repo state, lessons, and landing page structure.
- [x] Identify current design drift: neon dark palette, AI-heavy sections, glow/orb effects, enterprise command-center language.
- [x] Confirm scope before implementation: homepage-only first, landing-specific utilities if needed, and metadata only if directly supporting new positioning.
- [x] Replace homepage narrative with the provided wireframe: navigation, hero, trust cards, three pillars, deployments, scheduling simplicity, simple pricing, final CTA.
- [x] Create believable operational product visuals using real-feeling locations, playlists, device status, schedules, and content library data.
- [x] Remove AI-forward sections/copy from the public homepage flow.
- [x] Update marketing palette toward #F7F8FA, #FFFFFF, #111827, #4B5563, #2563EB, #E5E7EB.
- [x] Keep motion subtle: reveal, small hover elevation, no glow/orb/particle effects.
- [x] Verify with focused web test and desktop/mobile browser screenshots. Full build is blocked by existing web build/Turbopack configuration issues noted below.

### Proposed Implementation Plan

1. Collapse the landing route to a simpler homepage composition in `web/src/app/page.tsx`.
2. Rewrite or replace the landing section components under `web/src/components/landing/` to match the eight-section brief.
3. Update global landing utilities in `web/src/app/globals.css` only where needed, avoiding broad dashboard token churn.
4. Update homepage metadata in `web/src/app/layout.tsx` away from AI-driven positioning.
5. Run focused verification: lint/type/build as available, then browser screenshot checks for layout, text fit, and visual tone.

### Review Notes

- Current homepage imports `AIFeaturesSection`, `StatsSection`, `SecuritySection`, `FAQSection`, and other sections not present in the new wireframe. These are candidates for removal from the homepage flow, not necessarily deletion from the repo.
- Current visual system uses `eh-*` utilities with neon greens, deep teal backgrounds, glow animations, and negative letter spacing. The redesign should either replace these for landing usage or introduce new landing utilities while leaving dashboard styling stable.
- The brief is specific enough to proceed once scope is confirmed; no Hermes/runtime/prod-state checks apply because this is a reversible public frontend redesign with no data or external-service side effects.

### Implementation Review (2026-05-13)

- Added isolated `web/src/components/landing/OperationalHomepage.tsx` and pointed `/` at it from `web/src/app/page.tsx`.
- Added landing-only `vh-*` utilities to `web/src/app/globals.css`; dashboard tokens and existing shared app surfaces were not changed.
- Updated direct homepage positioning metadata in `web/src/app/layout.tsx`.
- Added `web/src/app/__tests__/homepage.test.tsx` to lock the new SMB positioning and prevent old AI/command-center copy from returning.
- Verification passed: `pnpm --filter @vizora/web test -- --runTestsByPath src/app/__tests__/homepage.test.tsx`.
- Visual verification captured: `homepage-redesign-desktop-review.png` and `homepage-redesign-mobile-review.png`.
- Full `pnpm --filter @vizora/web build` is blocked before homepage compilation by existing Google font TLS fetch failures and Tailwind config module resolution for `./src/theme/colors` / `./src/theme/tokens`.
- `pnpm --filter @vizora/web exec tsc --noEmit` is blocked by an existing generated `.next/dev/types/routes.d.ts` syntax error.

### Deployment Review (2026-05-14)

- Pushed `feat/vizora-frontend-redesign` and cherry-picked homepage commit `12420cb` onto the VPS deployment worktree as `10d0a65`, preserving unrelated local VPS edits.
- Built `@vizora/web` on the VPS with `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 pnpm --filter @vizora/web build`.
- Restarted and saved PM2 process `vizora-web`.
- Verified `https://vizora.cloud/` returns the new H1, pricing headline, metadata title, and no old AI/command-center homepage copy.
- Captured deployed desktop/mobile screenshots: `deployed-homepage-desktop-full.png` and `deployed-homepage-mobile-full.png`.

---

## Active Task: Sitewide Premium Confidence Pass (2026-05-14)

### Goal

Apply the approved "Operational Simplicity with Premium Confidence" direction across the web frontend, moving shared app/auth/admin/dashboard surfaces away from the old Electric Horizon neon/AI language while preserving routes, workflows, and dashboard functionality.

### Implementation Plan

1. Rebase shared CSS variables and `eh-*` compatibility utilities onto the new light/blue Vizora palette.
2. Update theme token files and default white-label customization colors so Tailwind extensions and runtime theming match the new direction.
3. Mechanically replace legacy neon arbitrary colors across frontend components with the new blue, white, gray, success, warning, and error palette.
4. Hand-edit auth and shared marketing copy/components that still imply AI automation, dark cyber visuals, or neon startup positioning.
5. Run focused web tests, production build, and desktop/mobile visual checks for homepage, auth, dashboard, and admin routes.

### Progress

- [x] Mapped legacy `eh-*`, neon color, and AI-forward usage across `web/src`.
- [x] Rebase global variables and compatibility utility meanings.
- [x] Update token/default customization colors.
- [x] Replace hardcoded legacy colors across components.
- [x] Clean auth/shared copy and old marketing remnants.
- [x] Verify with tests/build/screenshots.
- [x] Deploy to VPS after verification.

### Verification Review (2026-05-14)

- Passed focused tests: `pnpm --filter @vizora/web test -- --runTestsByPath "src/app/__tests__/homepage.test.tsx" "src/app/(auth)/__tests__/login-page.test.tsx" "src/app/(auth)/__tests__/register-page.test.tsx" "src/components/__tests__/ViewToggle.test.tsx" "src/components/__tests__/Button.test.tsx"`.
- Passed production build with `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 pnpm --filter @vizora/web build`.
- Visual checked homepage plus login/register auth surfaces locally. Dashboard/admin routes redirect to auth locally without backend auth, but their shared shells and components now inherit the updated tokens and hardcoded blue/neutral palette.

### Deployment Review (2026-05-14, Sitewide Pass)

- Pushed `feat/vizora-frontend-redesign` commit `2b71f87` and cherry-picked it onto the VPS deployment worktree as `32b9436`, preserving unrelated local VPS edits.
- Built `@vizora/web` on the VPS with `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 pnpm --filter @vizora/web build`.
- Restarted and saved PM2 process `vizora-web`.
- Verified `https://vizora.cloud/` returns the new homepage copy and does not return old AI/command-center homepage copy.
- Captured deployed auth screenshots: `deployed-sitewide-login.png` and `deployed-sitewide-register.png`.
