# Vizora Pilot Readiness - Remaining Pending Items

## Status: 69/69 Findings Fixed (Verification Pending)

All findings from the pilot readiness review have been addressed. Below are **remaining items** identified during the review that were NOT part of the 69 findings fix plan, plus suggestions and future improvements.

---

## Verification Checklist (Post-Fix)

- [ ] `pnpm --filter @vizora/middleware test` — all tests pass (target: 1456+)
- [ ] `pnpm --filter @vizora/realtime test` — 47 new realtime tests pass
- [ ] `pnpm --filter @vizora/web test` — 345 tests still pass
- [ ] `npx nx build @vizora/middleware && npx nx build @vizora/web && npx nx build @vizora/realtime` — all build
- [ ] `docker-compose -f docker/docker-compose.yml config` — validates with Prometheus/Loki additions
- [ ] Spot-check: webhook endpoints have @Public() decorator
- [ ] Spot-check: device JWT expiry is 90 days
- [ ] Spot-check: loading.tsx files exist in all dashboard routes
- [ ] Spot-check: `as any` eliminated from non-test middleware files

---

## Remaining Items NOT in Fix Plan

### Database/Schema Suggestions
- [ ] **PromotionRedemption missing Organization relation** — `organizationId` field has no `@relation`, so Prisma can't enforce referential integrity or cascading deletes [Arch Review]
- [ ] **ContentImpression unbounded growth** — No partition strategy or TTL. Add retention policy cron job for scale [Arch Review]
- [ ] **Display.jwtToken stored as full text** — Consider storing only jti and regenerating tokens on demand [Arch Review]
- [ ] **Schedule.startTime/endTime as String** — Using String for time fields prevents DB-level time comparisons. Consider Int (minutes-since-midnight) [Arch Review]
- [ ] **PlaylistItem unique constraint reordering friction** — `@@unique([playlistId, order])` makes reordering complex [Arch Review]

### Frontend Architecture
- [ ] **Nearly all pages are client components** — 49 files use `'use client'`. Critical pages (dashboard overview, device list) should use React Server Components for SSR [Arch Review]
- [ ] **useAuth client-side flash** — Users see dashboard content briefly before redirect on expired sessions. Server-side middleware check would prevent this [Arch Review]
- [ ] **Duplicate `<main id="main-content">`** — Dashboard layout and root layout both define `<main>` with same ID (invalid HTML) [Arch Review]
- [ ] **Inconsistent response envelope** — Auth endpoints use `{ success, data }` wrapper; other controllers return raw entities [Arch Review]

### Code Quality
- [ ] **No ESLint configuration** — `nx.json` sets `"linter": "none"`. Add ESLint with baseline rules (no-unused-vars, no-explicit-any) [Arch Review]
- [ ] **Remove deprecated `csurf` devDependency** — Listed in middleware devDeps but unused (custom CSRF middleware used instead) [Arch Review]
- [ ] **Remove unused `optional` package** — In root dependencies, appears to be a leftover [Arch Review]
- [ ] **Synchronous file operations** — `content.controller.ts:164-169` uses `fs.existsSync`/`fs.writeFileSync`. Use `fs/promises` [Arch Review]
- [ ] **SanitizeInterceptor strips ALL HTML** — May break template system since `templateHtml` goes through interceptor. Skip JSON metadata fields or allow HTML in specific fields [Arch Review]
- [ ] **No API versioning** — Global prefix is `/api` with no version. Adding `/api/v1` now eases future evolution [Arch Review]
- [ ] **AllExceptionsFilter doesn't handle WebSocket context** — Always calls `host.switchToHttp()`. Currently safe (HTTP-only) but should be guarded [Arch Review]

### Remaining TODOs in Codebase
- [ ] `billing/constants/plans.ts:21` — TODO about Stripe price objects
- [ ] `web/src/app/dashboard/content/page.tsx:658` — TODO for tag filter
- [ ] `web/src/lib/error-handler.ts:31` — TODO for Sentry integration
- [ ] `web/src/components/ErrorBoundary.tsx:35` — TODO for error tracking
- [ ] `ecosystem.config.js:124` — TODO to replace repo URL

### Realtime / WebSocket Improvements
- [ ] **No check if device exists in DB on connect** — Gateway accepts any valid JWT even if device deleted [Realtime Review 2.1]
- [ ] **handleConnection is 196 lines** — Could benefit from decomposition [Realtime Review 2.2]
- [ ] **leave:room has no authorization check** — Any client can leave any room (harmless but could probe room names) [Realtime Review 9.6]
- [ ] **Screenshot imageData not validated as actual PNG** — Could upload arbitrary data to MinIO [Realtime Review 9.5]
- [ ] **No WebSocket-specific health check** — Only checks if server object exists, not if accepting connections [Realtime Review 10.2]
- [ ] **Dashboard auth model unclear** — join:organization uses device JWT claims; may need separate auth path for user clients [Realtime Review 3.1]
- [ ] **CPU usage calculation is point-in-time** — Gives lifetime average, not recent usage. Delta measurement would be better [Realtime Review 7.7]
- [ ] **Android TV client has no WebSocket integration** — Not built yet [Realtime Review]

### Deployment / Infrastructure
- [ ] **No Grafana health check** — Unlike other services, Grafana lacks health check in docker-compose [Deploy Review]
- [ ] **No Nginx health check** — Reverse proxy has no health check; Docker can't detect startup failures [Deploy Review]
- [ ] **Single Nginx instance (no HA)** — If container crashes, all external access lost [Deploy Review]
- [ ] **No service mesh / circuit breaker** — Services communicate directly without retry/fallback [Deploy Review]
- [ ] **Grafana admin defaults to admin/admin** — Override with env vars in production [Deploy Review]
- [ ] **No off-site backup** — Backups stored on same host. Add S3 upload or rsync [Deploy Review]
- [ ] **API_PORT vs MIDDLEWARE_PORT mismatch** — Zod validates API_PORT but runtime uses MIDDLEWARE_PORT [Deploy Review]
- [ ] **Missing BCRYPT_ROUNDS in Zod schema** — Production env template documents it but Zod doesn't validate [Deploy Review]
- [ ] **Realtime gateway has no /api/health endpoint** — Load balancers can't verify health [Deploy Review]

### Test Coverage Gaps
- [ ] **Web dashboard at 23% coverage** — Prioritize auth flows, content management, display management, error handling
- [ ] **Middleware branch coverage at 58%** — Target 80%+ for production
- [ ] **Display client has zero test coverage** — Add unit tests for content rendering and connection logic
- [ ] **React act() warnings in Toast tests** — Minor test quality issue
- [ ] **Increase realtime test coverage** — 47 unit tests is a start; add more edge cases

### Security Nice-to-Haves
- [ ] **Rotate development secrets** — .env files have dev secrets; rotate if ever exposed [Security Review F-10]
- [ ] **join:organization/join:room DTOs** — Currently use inline null checks, no class-validator DTOs [Realtime Review 5.2]
- [ ] **Screenshot imageData base64 validation** — Verify valid base64 before Buffer.from() [Realtime Review 5.3]

---

## Completed Workstreams (2026-02-09)

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
