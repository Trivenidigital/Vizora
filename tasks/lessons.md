# Vizora - Lessons Learned

## Session: 2026-02-09 - Pilot Readiness Fix Sprint

### Team Orchestration
- **5 parallel agents work well** for independent workstreams. Spawned security-fixer, realtime-fixer, arch-fixer, frontend-fixer, infra-fixer simultaneously
- **Task dependencies matter** — WS4 (test fixes) had to wait for WS3 (architecture refactor). Assign both to the same agent so they execute sequentially
- **Frontend work completes fastest** — loading.tsx files and console cleanup are simple. Pair with documentation for the same agent
- **Infrastructure is the largest workload** — WS6+WS7 had 20 items. Consider splitting across 2 agents next time
- **Stuck teammates block TeamDelete** — If an agent doesn't respond to shutdown, you can't delete the team. Need to force-delete team files manually

### Architecture Patterns (Vizora-Specific)
- **DataSourceRegistry pattern** replaces N individual constructor injections with a single registry. Tests need mock registry with `.get(type)` method
- **Controller splitting** — when a controller exceeds ~400 lines, split by domain (templates, layouts, widgets, bulk ops). Keep route prefix consistent
- **Dual JWT architecture** — user tokens (JWT_SECRET) and device tokens (DEVICE_JWT_SECRET) are fully independent. Never mix them
- **Heartbeat optimization** — Only write to DB on status transitions (offline→online), not every heartbeat. Redis handles real-time status
- **Prometheus cardinality** — Never use unbounded IDs (device_id) as metric labels. Use organization_id aggregation instead

### Common Pitfalls
- **`enableImplicitConversion: true`** in NestJS ValidationPipe is a hidden type safety risk. Set to false and use explicit `@Type()` decorators
- **`as any` accumulates silently** — 428 casts found in middleware. Fix proactively before they compound. Use `Prisma.InputJsonValue`, `Record<string, unknown>`, typed DTOs
- **Test constructor mismatches** — When refactoring service constructors (e.g., DataSourceRegistry), ALL spec files must be updated or they'll fail en masse
- **Webhook endpoints need @Public()** — Without it, the global JWT guard blocks Stripe/Razorpay callbacks. Easy to miss
- **Console.log in hooks** — Dev-guard ALL console.log in frontend hooks or they leak to production browser consoles

## Deferred Items (Phase 2 - 2026-02-09)

13 items were deferred from the remaining pending items fix sprint. These need separate sprints:

### Test Coverage (5 items — separate test sprint)
- Web dashboard at 23% coverage
- Middleware branch coverage at 58% (target 80%)
- Display client has 0% test coverage
- React act() warnings in Toast tests
- More realtime edge case tests needed

### Infrastructure Decisions (3 items — needs architecture review)
- Nginx HA (single instance, no redundancy)
- Service mesh / circuit breaker (needs Consul/Istio evaluation)
- Android TV WebSocket integration (not yet built, separate feature)

### Large Migrations (3 items — risk too high for sprint)
- RSC migration: 49 client pages need rewriting to React Server Components
- Schedule.startTime/endTime String→Int: data migration risk for existing records
- CPU delta measurement: needs device firmware changes

### Acceptable As-Is (2 items)
- Display.jwtToken as @db.Text (appropriate for JWT storage)
- PlaylistItem @@unique([playlistId, order]) reorder friction (correct constraint)

### Verification Reminders
- Always run `pnpm --filter @vizora/middleware test` after architecture changes
- Check TypeScript compilation with `npx tsc --noEmit` after major refactors
- The 3 pre-existing test failures (auth.controller, pairing.service) existed before our changes — don't chase those
- E2E tests require Docker (PostgreSQL + Redis) — can't run without infrastructure

## Session: 2026-02-09 - Verification & Memory Update

### Windows/Bash Gotchas
- **`tail` pipe buffering blocks background tasks** — `command 2>&1 | tail -30` in a background bash task will buffer indefinitely and appear empty. Always run without piping: `command 2>&1`, then read the output file
- **Windows paths in bash** — `cd C:\projects\vizora\web` fails in Git Bash. Use Unix-style: `cd /c/projects/vizora/web`
- **Nx build wrapper vs direct build** — `npx nx build @vizora/web` can fail due to Nx project graph issues while `cd web && npx next build` succeeds. For web, prefer direct `next build` for verification

### Pre-Existing Test Failures (Do Not Chase)
- **Middleware**: auth.controller, pairing.service (3 tests) — existed before pilot readiness sprint
- **Realtime**: 1 suite fails (Prisma generate issue in test env)
- **Web admin tests**: `organizations-page.test.tsx` (10 tests), `admin-dashboard.test.tsx` (5 tests) — async Client Component rendered in jsdom, renders empty `<div />`. Root cause: pages are async server-component-style but marked `'use client'`. Tied to RSC migration deferral
- **Web**: All other 40+ suites pass

### Build Verification Results (2026-02-09)
- Middleware: builds via `npx nx build @vizora/middleware`
- Realtime: builds via `npx nx build @vizora/realtime`
- Web: builds via `npx nx build @vizora/web` (35 routes, Turbopack)
- **Root cause of prior nx build failure**: `display-android` directory was not in `pnpm-workspace.yaml` but Nx auto-discovered it, breaking the project graph. Fix: add `display-android` to workspace packages

## Session: 2026-02-25 - Content Upload Fix & Deployment

### Production Deployment
- **Server**: root@89.167.55.176, project at `/opt/vizora/app`
- **PM2 manages**: vizora-middleware (x2 cluster), vizora-realtime (x1), vizora-web (x1)
- **Deploy flow**: git pull → rebuild affected services → pm2 restart

### Prisma Client + Webpack Bundling Pitfall (CRITICAL)
- `prisma generate` updates `packages/database/src/generated/prisma/` but NOT `dist/generated/prisma/`
- Middleware webpack resolves `@vizora/database` from `dist/` — so stale DMMF gets bundled
- **After running `prisma generate` on server, MUST also copy to dist**:
  ```bash
  cp packages/database/src/generated/prisma/index.js packages/database/dist/generated/prisma/index.js
  cp packages/database/src/generated/prisma/index.d.ts packages/database/dist/generated/prisma/index.d.ts
  ```
- Then rebuild middleware: `npx nx build @vizora/middleware --skip-nx-cache`
- Verify with: `grep -c "fieldName" middleware/dist/main.js` (count should include DMMF occurrences)

### File Validation False Positives
- `/base64,/i` regex in file-validation.service.ts matched JPEG EXIF/XMP metadata containing "base64,"
- Fix: Changed to `/data:\s*[^;]{1,50};\s*base64,/i` — only matches actual `data:` URI payloads
- Always check real-world file content patterns before adding suspicious content regex

### Response Envelope Unwrapping
- Backend wraps all responses in `{ success, data, meta }` via ResponseEnvelopeInterceptor
- Frontend multipart upload paths may not unwrap the envelope — check `createContent` and similar methods
- Pattern: `const unwrapped = ('success' in result && 'data' in result) ? result.data : result;`
