# Vizora Architecture & Code Quality Review

**Date:** 2026-02-09
**Branch:** feat/phase-3-major-features
**Reviewer:** Architecture Agent (Claude Opus 4.6)

---

## Summary

The Vizora codebase demonstrates a well-organized, production-oriented architecture. The Nx monorepo structure with clear service boundaries, dual JWT authentication, and defense-in-depth security patterns are notable strengths. Below are categorized findings from a thorough review of database schema, module organization, error handling, API design, frontend architecture, dependency health, and code quality.

**Overall Assessment: GOOD -- Ready for pilot with noted improvements**

- Critical issues: 2
- Important issues: 9
- Suggestions: 11

---

## 1. Database Schema Review

**File:** `packages/database/prisma/schema.prisma`

### Strengths
- Comprehensive indexing strategy on all foreign keys and common query patterns
- Proper cascading deletes on org-scoped entities (Content, Display, Playlist, etc.)
- Composite unique constraints where needed (e.g., `[playlistId, order]`, `[organizationId, name]`)
- Smart use of `@db.JsonB` for flexible metadata columns
- Audit logging tables (AuditLog, AdminAuditLog) with full context
- Content expiration and version history with self-referencing relations

### Issues

**[Important] PlaylistItem unique constraint on `[playlistId, order]` creates reordering friction**
The `@@unique([playlistId, order])` constraint on PlaylistItem means reordering items requires careful sequencing (or temporary values) to avoid unique violations during swaps. This works but adds complexity to the reordering logic.

**[Important] PromotionRedemption lacks a relation to the Organization model**
`PromotionRedemption.organizationId` is stored but there is no `@relation` to `Organization`, which means Prisma cannot enforce referential integrity or provide cascading deletes for this field.

**[Suggestion] ContentImpression table could grow unbounded**
The `content_impressions` table has no partition strategy or TTL mechanism. For production at scale, consider partitioning by `date` or adding a retention policy cron job.

**[Suggestion] Display.jwtToken stored as `@db.Text`**
Storing the full JWT token in the database is functional but increases storage. Consider storing only a token identifier (jti) and regenerating tokens on demand.

**[Suggestion] Schedule.startTime/endTime stored as String (HH:MM)**
Using `String` for time fields works but prevents database-level time comparisons. A `Time` type or minutes-since-midnight `Int` would be more queryable.

---

## 2. Module Organization

**Files:** `middleware/src/app/app.module.ts`, `middleware/src/modules/*/`

### Strengths
- 21 well-encapsulated modules with clear domain boundaries
- Proper separation of concerns: auth, content, displays, playlists, schedules, analytics, billing, admin, etc.
- Infrastructure modules (database, redis, config, storage) properly separated from business logic
- Global guards (ThrottlerGuard) and middleware (CSRF) applied at app module level
- ScheduleModule registered at root for cron job support

### Issues

**[Important] ContentController is too large (654 lines) -- violates single responsibility**
`middleware/src/modules/content/content.controller.ts` handles content CRUD, file uploads, templates, layouts, widgets, and bulk operations all in one controller. This should be split into separate controllers (e.g., `TemplateController`, `LayoutController`, `WidgetController`, `BulkContentController`) for maintainability.

**[Important] ContentService has heavy constructor injection (7 data source dependencies)**
`middleware/src/modules/content/content.service.ts` injects `WeatherDataSource`, `RssDataSource`, `InstagramDataSource`, `TwitterDataSource`, `FacebookDataSource` directly. A `WidgetDataSourceRegistry` pattern would be cleaner and allow runtime registration.

**[Suggestion] No ESLint configuration detected**
The `nx.json` generators explicitly set `"linter": "none"`. For a pilot-ready codebase, an ESLint config with at least basic rules (no-unused-vars, no-explicit-any) would catch issues at build time.

---

## 3. Error Handling

**Files:** `middleware/src/modules/common/filters/all-exceptions.filter.ts`, `middleware/src/main.ts`, `realtime/src/main.ts`, `realtime/src/gateways/device.gateway.ts`

### Strengths
- Global `AllExceptionsFilter` catches all unhandled exceptions with proper production/development response differentiation
- `unhandledRejection` and `uncaughtException` handlers on both middleware and realtime processes
- WebSocket gateway has try/catch on every handler (handleConnection, handleDisconnect, handleHeartbeat, etc.)
- Non-fatal errors (DB updates, notifications) are caught and logged without killing the connection
- Sentry integration for error tracking in both services
- Content errors reported to Sentry with device context

### Issues

**[Important] `handleDisconnect` casts error with `(error as Error).message` without guarding**
At `realtime/src/gateways/device.gateway.ts:342`, the catch block uses `(error as Error).message` directly. If the thrown value is not an Error, this will throw at the logging line itself. Other handlers in the same file correctly use `error instanceof Error ? error.message : 'Unknown error'`.

**[Suggestion] `AllExceptionsFilter` does not handle WebSocket context**
The filter always calls `host.switchToHttp()`. If applied to a WebSocket context, this would fail. Currently safe because the filter is only on the middleware service (HTTP-only), but should be documented or guarded.

---

## 4. API Design

**Files:** Various controllers in `middleware/src/modules/*/`

### Strengths
- RESTful endpoints with proper HTTP verbs (GET for reads, POST for creates, PATCH for updates, DELETE for deletes)
- Consistent `@Roles()` decorators on all mutation endpoints
- Pagination DTO with validation (`Min(1)`, `Max(100)`) applied to list endpoints
- `@HttpCode()` decorators on action endpoints (archive, restore, bulk operations)
- Swagger documentation with tags, descriptions, and auth configuration
- Content-type-aware rate limiting (strict in production, relaxed in dev)
- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`
- `@CheckQuota('screen')` decorator for display creation (billing enforcement)

### Issues

**[Critical] `content/:id/expiration` endpoint accepts raw body instead of DTO**
At `content.controller.ts:435`, the `setExpiration` method uses `@Body() body: { expiresAt: string; replacementContentId?: string }` -- a raw inline type instead of a validated DTO class. This bypasses the global `ValidationPipe` (which only validates class-validator decorated classes). An attacker could send additional unexpected fields.

**[Important] `displays/:id/tags` DELETE endpoint uses `@Body()` on a DELETE request**
At `displays.controller.ts:168`, the `removeTags` method sends a body with DELETE. While technically valid, many HTTP clients and proxies strip bodies from DELETE requests. A `POST` or query parameter approach would be more reliable.

**[Important] Several analytics API methods return `any` type**
In `web/src/lib/api.ts`, methods like `getAnalyticsSummary()`, `getDeviceMetrics()`, `exportAnalytics()` all return `Promise<any>` or `Promise<any[]>`. This loses type safety for the entire analytics data pipeline.

**[Suggestion] Inconsistent response envelope**
Auth endpoints wrap responses in `{ success: true, data: {...} }` but most other controllers return the raw entity. A consistent response format would simplify frontend handling.

**[Suggestion] No API versioning**
The global prefix is `/api` with no version segment. Adding `/api/v1` now would ease future API evolution.

---

## 5. Frontend Architecture

**Files:** `web/src/app/`, `web/src/lib/`, `web/src/components/`

### Strengths
- Proper Next.js 16 App Router structure with (auth) and dashboard route groups
- Root layout is a server component; dashboard layout is client-side with auth checks
- `ErrorBoundary` component at root layout level
- `error.tsx` and `global-error.tsx` present for error recovery
- Accessibility: skip-to-content link, ARIA labels on avatar
- Theme system with `ThemeProvider` and `CustomizationProvider`
- `DeviceStatusProvider` context wraps dashboard for real-time updates
- Smart API client using relative `/api` URL for same-origin proxy (avoids CORS)
- CSRF token extraction from cookies and inclusion in headers
- Client-side timeout with AbortController and retry logic for GET requests
- Loading spinner shown while auth state is being determined

### Issues

**[Critical] No `loading.tsx` files anywhere in the app directory**
Not a single `loading.tsx` file exists under `web/src/app/`. This means Next.js cannot show streaming/suspense loading states during page transitions. Every page is a `'use client'` component that manages its own loading state, which means no progressive rendering and potential flash-of-empty-content on navigation.

**[Important] Nearly all page components are client components (`'use client'`)**
49 files in `web/src/app/` use `'use client'`. This means the entire dashboard is client-side rendered, losing the benefits of React Server Components (RSC): no server-side data fetching, no streaming, larger JS bundles. For a pilot this is acceptable but for scale, critical pages (dashboard overview, device list) should fetch data on the server.

**[Important] `useAuth` hook appears to manage auth state client-side**
Auth state is checked on every page load via the `useAuth` hook. If the user's session expires, they see a flash of dashboard content before being redirected. A server-side middleware or `cookies()` check in a layout server component would prevent this.

**[Suggestion] Dashboard layout defines `<main id="main-content">` and root layout also defines `<main id="main-content">`**
Two `<main>` elements with the same ID creates invalid HTML. The dashboard layout should use a `<div>` or the root layout should remove the `<main>` wrapper.

---

## 6. Dependency Health

**Files:** `package.json` (root), `middleware/package.json`, `web/package.json`, `realtime/package.json`

### Strengths
- Modern stack: NestJS 11, Next.js 16, React 19, Prisma, Socket.IO 4.8
- Consistent Nx 22.4.2 across root and plugins
- Workspace protocol (`workspace:*`) for internal packages
- Security-focused dependencies: sanitize-html, helmet, bcryptjs
- Sharp for image processing (good for thumbnail generation)
- Playwright for E2E testing

### Issues

**[Important] Sentry version mismatch between middleware and realtime**
- middleware: `@sentry/node: ^9.0.0`
- realtime: `@sentry/node: ^10.37.0`, `@sentry/nestjs: ^10.37.0`, `@sentry/profiling-node: ^10.37.0`

Different major versions of Sentry could cause subtle behavior differences or conflicts. Align on v10 across both services.

**[Important] Jest version mismatch across services**
- middleware: `jest: ^30.2.0`, `ts-jest: ^29.4.6` (major version mismatch!)
- web: `jest: ^29.7.0`, `ts-jest: ^29.1.0`
- realtime: `jest: ^29.5.0`, `ts-jest: ^29.1.0`

Jest 30 in middleware with ts-jest 29 is a concerning mismatch. Align versions across the monorepo.

**[Suggestion] `csurf` in middleware devDependencies is deprecated**
`middleware/package.json` lists `csurf: ^1.11.0` in devDependencies. The `csurf` package has been deprecated since 2022 due to security issues. The codebase correctly implements custom CSRF middleware, so this unused dependency should be removed.

**[Suggestion] `optional` package in root dependencies (`^0.1.4`)**
This appears to be a leftover and may not be needed. Verify and remove if unused.

---

## 7. Code Quality Patterns

### Strengths
- TypeScript strict mode enabled in `tsconfig.base.json` and web tsconfig
- Global sanitization interceptor prevents XSS on all inputs
- File validation with magic number verification prevents MIME type spoofing
- DNS lookup validation in file-validation service prevents SSRF
- CSRF middleware with constant-time comparison (timing attack resistant)
- Account lockout with Redis-backed attempt tracking
- Password hashing with configurable bcrypt rounds (default 14)
- Proper use of database transactions for multi-step operations (registration)

### Issues

**[Important] 428 `as any` type assertions in middleware source**
This is a significant amount of type unsafety. Key offenders:
- `content.controller.ts:133` -- uses `as any` to pass data to `contentService.create()`
- `auth.service.ts:243` -- `generateToken(user: any, organization: any)`
- `content.service.ts` -- 10 occurrences of `as any`
While some are in test files (acceptable), the production code assertions should be replaced with proper types.

**[Important] 46 `console.log` statements in web frontend**
Most are debug logging guarded by `process.env.NODE_ENV === 'development'` in `api.ts` (good), but many in hooks (`useRealtimeEvents.ts`: 12, `useAnalyticsData.ts`: 6, `useOptimisticState.ts`: 5, `useErrorRecovery.ts`: 6) are not guarded. These will print to users' browser consoles in production.

**[Suggestion] TODOs remaining in codebase**
- `billing/constants/plans.ts:21` -- TODO about Stripe price objects
- `web/src/app/dashboard/content/page.tsx:658` -- TODO for tag filter
- `web/src/lib/error-handler.ts:31` -- TODO for Sentry integration
- `web/src/components/ErrorBoundary.tsx:35` -- TODO for error tracking
- `ecosystem.config.js:124` -- TODO to replace repo URL

These indicate unfinished work that should be tracked.

**[Suggestion] `sanitize-html` strips ALL HTML tags by default**
The `SanitizeInterceptor` uses `allowedTags: []`, which strips all HTML. This will break the template system since `templateHtml` content goes through the same interceptor. The interceptor should either skip JSON metadata fields or allow HTML in specific fields.

**[Suggestion] Synchronous file operations in content controller**
`content.controller.ts:164-169` uses `fs.existsSync` and `fs.writeFileSync` for local file storage. While only used as a MinIO fallback, synchronous I/O blocks the event loop. Use `fs/promises` equivalents.

---

## 8. Production Readiness Patterns

### Strengths
- PM2 ecosystem config with cluster mode, memory limits, and exponential backoff
- Port enforcement on both middleware (3000) and realtime (3002)
- Environment variable validation on production startup
- Graceful shutdown hooks enabled
- Request timeout middleware (30s general, 120s uploads)
- Swagger docs disabled in production
- Error messages hidden in production (`disableErrorMessages: true`)
- CSP headers enabled in production via Helmet

### Issues

**[Suggestion] Deploy configuration in `ecosystem.config.js` uses placeholder values**
Both production and staging deploy configs reference `git@github.com:your-org/vizora.git` and generic hostnames (`production-server`, `staging-server`). These need real values before deployment.

**[Suggestion] No health check endpoint exposed for load balancer probes**
The `HealthModule` exists but its controller only has basic checks. Ensure it returns database connectivity, Redis status, and critical dependency health for production monitoring.

---

## Architecture Diagram Summary

```
                    [Load Balancer / Nginx]
                           |
          +----------------+----------------+
          |                |                |
     [Middleware]     [Web/Next.js]   [Realtime]
      Port 3000       Port 3001      Port 3002
          |                              |
          +--------+  +--------+---------+
                   |  |        |
              [PostgreSQL] [Redis] [MinIO]
               (Prisma)             (S3)
```

- Middleware: REST API, file uploads, business logic, cron jobs
- Web: Dashboard UI, proxies API calls via Next.js rewrites
- Realtime: WebSocket gateway for device communication, heartbeats, live updates
- Shared: @vizora/database package (Prisma client) used by middleware and realtime

---

## Recommendations Priority

### Must Fix Before Pilot
1. **[Critical]** Add DTO validation class for `content/:id/expiration` endpoint body
2. **[Critical]** Add at least `loading.tsx` to `web/src/app/dashboard/` for page transition UX

### Should Fix Soon
3. Align Sentry versions across middleware and realtime (use v10)
4. Align Jest versions across all packages
5. Fix `handleDisconnect` error typing in device gateway
6. Guard `console.log` statements in production web builds (or use a logger utility)
7. Split `ContentController` into focused sub-controllers
8. Add proper TypeScript types to replace `as any` in auth.service and content.service
9. Fix the DELETE body issue on display tags endpoint
10. Type the analytics API methods instead of returning `any`
11. Add relation to Organization on PromotionRedemption

### Nice to Have
12. Add ESLint with baseline rules
13. Remove deprecated `csurf` devDependency
14. Convert sync file operations to async
15. Add API versioning prefix
16. Standardize response envelope format
17. Fix duplicate `<main>` element IDs
18. Add ContentImpression retention policy
19. Add `loading.tsx` to all route segments
20. Move page components to server components where possible
21. Consider SanitizeInterceptor behavior with template HTML content
22. Update ecosystem.config.js placeholder values
