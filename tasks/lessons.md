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

### Verification Reminders
- Always run `pnpm --filter @vizora/middleware test` after architecture changes
- Check TypeScript compilation with `npx tsc --noEmit` after major refactors
- The 3 pre-existing test failures (auth.controller, pairing.service) existed before our changes — don't chase those
- E2E tests require Docker (PostgreSQL + Redis) — can't run without infrastructure
