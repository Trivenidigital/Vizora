# Vizora - Lessons Learned

## Session: 2026-08-03 - Ops remediation + web follow-up (prod `0aaba06c`)

### Green tests are not evidence of correctness — this cost two deploys
- The ops refresh-token fix **shipped twice looking correct** and was wrong both times: first a `beforeExit` hook that fired but let the process exit before its fire-and-forget request completed; then a logout the server rejected **401**. Both had passing suites, sound reasoning, and clean deploys. Only checking the runtime afterwards caught them.
- **Rule:** for anything whose effect lives outside the process (a DB row, an email, a revoked session), a green suite means *ready for runtime verification*, not *fixed*. Query the actual state after deploying.

### Swallowed errors are how a broken fix looks identical to a working one
- `logout()` swallowed its failure by design, so two ineffective fixes looked like silence rather than failure. The leak was only found by counting rows.
- **Rule:** best-effort code may not fail loudly, but it must never be *silent*. Log the failure, name the consequence, and increment a counter. `catch {}` with a comment is not acceptable on a path whose whole purpose is a side effect.
- A test stub that returns `ok: true` regardless of status will hide exactly this class of bug. Derive `ok` from the status.

### A fix applied to one agent is not a fix
- The shared client learned to release its session, but `validate-monitor.ts` carried its **own duplicate `login()`** and kept leaking. `#259` filtered disabled displays in `fleet-manager` only, so `schedule-doctor` re-raised a reconciled incident minutes later.
- **Rule:** when fixing a behaviour that several agents share, enumerate every agent that performs it. Grep for the *behaviour* (`auth/login`, display evaluation), not for the symbol you just edited.

### "Nothing to do" must still be a recorded run
- `fleet-manager` returned early on zero displays, skipping `recordAgentRun()`. `ops-watchdog` reads that timestamp, so an agent with nothing to do was indistinguishable from a dead one — a false CRITICAL within minutes.
- The branch had been **unreachable for the agent's whole life**; a new filter reached it. **The guard was the bug, the filter merely exposed it.** Expect newly-reachable dead code when you change a filter's output domain.

### Tailwind scans raw file text, including comments
- Documenting the `font-[var(--x)]` anti-pattern with the literal spelled out **regenerated the broken rule in the production bundle**. The comment now describes it without writing it.

### Arbitrary-value typing is namespace-specific — do not over-generalise either way
- The inherited claim that `text-[var(--x)]` "compiles to nothing" was **false** and was propagated into code and a commit message before anyone checked. `dataTypes.color` accepts anything starting with `var(`, so colour namespaces are safe.
- But the over-correction is also wrong: `font-[var(--font-sora)]` genuinely mistyped to `font-weight` at 35 sites and silently dropped. **Colour namespaces are safe; others are not.** Prefer a named theme utility over any arbitrary value.

### Runtime state beats configuration files
- PM2 caches env at spawn and `dotenv` does **not** override an existing `process.env`, so editing `.env` silently changed nothing for four agents until `pm2 restart --update-env`. `health-guardian` stayed green throughout because it never authenticates — a **false all-clear**.
- Ops `logout` needs `X-CSRF-Token`: presenting cookies makes the request look cookie-authenticated, so cookies *without* the header are rejected 401 and nothing is revoked. Bearer-only returns 201 and revokes nothing at all.

### Claims must not outrun the evidence
Three corrections were needed this session, all the same shape — a conclusion stronger than what was measured:
- "already covers all 24 displays" — transition alerting is **not** persistent-outage coverage.
- "emailing real tenants" — every org on prod is free/canceled with no billing identifier; there are **no** active paying customers.
- "the only gap is a missing regenerate endpoint" — a **head-limited grep** truncated before the route that proves it exists.
- **Rule:** before asserting absence, confirm the search was exhaustive. Before asserting coverage, name the mechanism and check it actually fires.

### Read-only safety is a property of the work, not of the scheduler
- Middleware runs two PM2 cluster instances and every `@Cron` fires in both (`CronLeaderService`, PR #228, is unmerged). Harmless for a read-only reconciler using `set()`; the moment a side effect is added, two instances duplicate it.

---

## Session: 2026-06-03 - Runtime Assumption Correction

### SMTP / Email State
- When the operator says SMTP used to work, do not infer "SMTP unconfigured" from stale backlog gates alone. Separate repo-side email-link/config validation from runtime SMTP truth, and verify current env/runtime/test-send evidence before reporting email as broken. Customer-visible sends still require explicit operator approval.

## Session: 2026-05-31 - Autonomous Builder Correction

### Session Coordination
- When the operator says there is no other session, treat Codex as the sole builder and use local subagents only as review/research workers. Do not preserve stale "other session" coordination language from an old prompt.

### Worktree Editing
- In this environment `apply_patch` defaults to the primary checkout path from the initial context, not necessarily the shell command workdir. For isolated worktree tasks, use absolute paths in `apply_patch` and verify `git status` in both the primary checkout and worktree after the first edit.
- When dispatching subagents after creating an isolated worktree, put the exact worktree path in the prompt and require them to report `git rev-parse --show-toplevel`, branch, and HEAD before analysis. Otherwise they may inspect the primary checkout and return stale findings from older branches or dirty scratch.

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
- **Root cause of prior nx build failure**: `display-android` directory was not in `pnpm-workspace.yaml` but Nx auto-discovered it, breaking the project graph. NOTE: `display-android` was extracted to standalone repo `vizora-tv` on 2026-03-05 and removed from monorepo.

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

## Session: 2026-02-27 - Support Agent System

### Git Credential Helper on Windows
- `credential.helper=manager` (system-level in `C:/Program Files/Git/etc/gitconfig`) opens GUI popup — hangs non-interactive Bash tool
- `gh auth setup-git` adds gh helper at global level but system-level `manager` still fires first
- System config requires admin to modify (`git config --system --unset`)
- Workaround: push eventually completes (very slow due to stderr buffering), or use `gh api` for remote operations
- **Lesson**: When `git push` hangs, don't retry 10 times — check `git config --list | grep credential` immediately

### Claude Code Skill Architecture
- Skills in `.claude/skills/<name>/SKILL.md` auto-register and appear in skill list
- Slash commands in `.claude/commands/<name>.md` register as `/<name>` commands
- Subagent definitions in `.claude/agents/<name>.md` define specialist agents
- Frontmatter `description` should start with "Use when..." and ONLY describe triggering conditions (not workflow)
- Level 3 reference files (not `@`-linked) avoid burning context — loaded only when needed
- Config-only changes (`.claude/`, `CLAUDE.md`) don't need builds or PM2 reload on deploy
