# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Keep this file current.** When you add a new module, env var, agent, or PM2 process — update the corresponding section here in the same PR. The file is read into every Claude Code session and stale entries get treated as ground truth.

## Overview

Vizora is a digital signage management platform. Businesses manage and distribute content to display screens across locations via an admin dashboard, with real-time updates over WebSocket.

## Architecture

Nx monorepo with pnpm workspaces. Five services with strict port assignments:

| Service | Tech | Port | Package |
|---------|------|------|---------|
| Middleware API | NestJS 11 | 3000 | `@vizora/middleware` |
| Web Dashboard | Next.js 16 (App Router) | 3001 | `@vizora/web` |
| Realtime Gateway | NestJS + Socket.IO | 3002 | `@vizora/realtime` |
| Grafana | - | 3003 | Docker only |
| MinIO (S3 storage) | - | 9000/9001 | Docker only |

**Ports are hardcoded and enforced** — both middleware and realtime validate their port at startup and exit if misconfigured.

Shared packages:
- `@vizora/database` — Prisma ORM client (PostgreSQL), used by middleware and realtime

Infrastructure (via `docker/docker-compose.yml`): PostgreSQL 16, Redis 7, MongoDB 7, MinIO, ClickHouse 24, Grafana

## Development Commands

```bash
# Setup
pnpm install
docker-compose -f docker/docker-compose.yml up -d
pnpm --filter @vizora/database db:generate    # Generate Prisma client
pnpm --filter @vizora/database db:migrate     # Run migrations

# Run all services
pnpm dev

# Individual services via Nx
npx nx serve @vizora/middleware
npx nx dev @vizora/web
npx nx serve @vizora/realtime

# Build
npx nx build @vizora/middleware
npx nx build @vizora/web
npx nx build @vizora/realtime
```

## Testing

```bash
# Middleware unit tests (Jest, mocked DB)
pnpm --filter @vizora/middleware test
pnpm --filter @vizora/middleware test -- --testPathPattern=content.service  # single file

# Middleware E2E tests (Jest, real DB via docker-compose.test.yml)
pnpm --filter @vizora/middleware test:e2e
pnpm --filter @vizora/middleware test:e2e:full  # starts test DB, runs tests, stops DB

# Web unit tests (Jest + jsdom + React Testing Library)
pnpm --filter @vizora/web test

# Playwright E2E tests (requires all services running)
npx playwright test                          # all 15 spec files
npx playwright test e2e-tests/01-auth.spec.ts  # single spec
npx playwright test --headed                 # with browser UI
```

Playwright runs sequentially (1 worker) to avoid DB race conditions. Retries: 2 in CI, 0 locally.

## Key Architectural Patterns

**Dual JWT authentication**: Separate secrets for users (`JWT_SECRET`) and display devices (`DEVICE_JWT_SECRET`). Devices authenticate via device-specific JWT in WebSocket handshake.

**WebSocket room architecture**: Realtime gateway uses `device:{deviceId}` and `org:{organizationId}` rooms. Devices join both on connect. Dashboard clients join org rooms for live status updates.

**Dual persistence for device status**: Device online/offline status writes to both Redis (fast reads) and PostgreSQL (persistence/dashboard queries).

**Content system**: Supports image/video/url/html types. Template rendering via Handlebars. File validation with magic number verification to prevent MIME spoofing. Expiration system with automatic replacement content.

**Response envelope**: Global `ResponseEnvelopeInterceptor` wraps all responses in `{ success, data, meta }`. Skip with `@SkipEnvelope()` decorator on individual endpoints.

**API versioning**: All routes prefixed with `/api/v1`. Nginx has backwards-compat rewrite from `/api/` to `/api/v1/`.

**Security layers**: Global SanitizeInterceptor on all responses (XSS) — skips template fields (`templateHtml`, `htmlContent`, `customCss`). CSRF middleware, Helmet headers, rate limiting (3-tier: short/medium/long, 100x relaxed in dev/test), cookie-based auth with httpOnly cookies.

**Interceptor order matters**: LoggingInterceptor runs before SanitizeInterceptor so raw input is logged for debugging.

**DataSourceRegistry pattern**: Content service uses a registry instead of N individual data-source constructor injections. Tests must mock the registry with `.get(type)` method.

## Environment Variables

> Source of truth for every supported var is `.env.example`. The list below is the curated subset that matters for understanding the system. **When adding a new env var: add it to `.env.example`, the relevant section here, AND any docstring/JSDoc that consumes it.**

### Core

```
DATABASE_URL            # PostgreSQL connection string
REDIS_URL               # Redis connection URL
NODE_ENV                # development | production
PORT, MIDDLEWARE_PORT, WEB_PORT, REALTIME_PORT  # Service ports (3000 / 3001 / 3002 / 3002)
CORS_ORIGIN             # Comma-separated allowed origins
```

### Auth

```
JWT_SECRET              # User auth JWT secret (min 32 chars)
JWT_EXPIRES_IN          # Token lifetime, default 7d
DEVICE_JWT_SECRET       # Device auth JWT secret (min 32 chars; separate from JWT_SECRET)
INTERNAL_API_SECRET     # Required in prod — service-to-service auth (middleware ↔ realtime)
BCRYPT_ROUNDS           # Password hashing rounds (10-15, default 12)
GOOGLE_CLIENT_ID        # Optional — Google OAuth client ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID  # Same value, exposed to frontend for GSI button (rebuild web on change)
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY  # Stable Next.js Server-Action key — KEEP CONSTANT across deploys
```

### Web frontend (NEXT_PUBLIC_*)

```
NEXT_PUBLIC_API_URL     # Backend API URL for web frontend
NEXT_PUBLIC_SOCKET_URL  # Realtime gateway URL for web frontend
BACKEND_URL             # Server-side API URL (used by next.config proxy)
```

### Storage / S3 / MinIO

```
MINIO_ENDPOINT, MINIO_PORT, MINIO_BUCKET, MINIO_USE_SSL
MINIO_ACCESS_KEY, MINIO_SECRET_KEY
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY  # Used by S3 SDK paths (e.g. backup S3)
BACKUP_S3_BUCKET        # Optional — S3 bucket for off-site DB backups
BACKUP_DIR              # Local backup dir (default /var/backups/vizora)
BACKUP_RETENTION_DAYS   # Daily backup retention (default 7)
```

### Billing

```
RAZORPAY_KEY_ID, RAZORPAY_BASIC_PLAN_ID, RAZORPAY_PRO_PLAN_ID
```

### Observability

```
SENTRY_DSN              # Sentry error tracking (optional)
SENTRY_RELEASE          # Release tag for Sentry
GRAFANA_ADMIN_USER      # Required — Grafana admin username (no insecure default)
GRAFANA_ADMIN_PASSWORD  # Required — Grafana admin password
METRICS_TOKEN           # Optional — Bearer token for /internal/metrics from non-localhost
```

### Email + alerts

```
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_TO
SLACK_WEBHOOK_URL       # Slack incoming webhook for ops status changes
HEALTHCHECKS_HEALTH_GUARDIAN_URL  # External heartbeat for the ops dead-man (see "Autonomous Operations")
EMAIL_FROM              # Default sender for transactional mail
```

### MCP Server (see also `docs/agents-mcp-server-design.md`)

```
MCP_TOKEN_TTL_DAYS                # Max issuance TTL in days. Default 90. Min 1.
MCP_RATE_LIMIT_PER_MIN            # Per-token per-minute cap. Default 60.
MCP_RATE_LIMIT_PER_DAY            # Per-token per-day cap. Default 1000.
```

### Agent System (business agents — see also `docs/agents-architecture.md`)

```
AGENT_STATE_DIR         # Override state-file directory (default: <cwd>/logs/agent-state)
AGENT_AI_PROVIDER       # heuristic | openai | anthropic (heuristic is default + always available)
AGENT_ORCHESTRATOR_ENABLED        # Feature flag — orchestrator agent
BILLING_REVENUE_ENABLED           # Feature flag — billing-revenue agent
CONTENT_INTELLIGENCE_ENABLED      # Feature flag — content-intelligence agent
SCREEN_HEALTH_CUSTOMER_ENABLED    # Feature flag — screen-health agent
LIFECYCLE_LIVE          # Customer-lifecycle: actually send emails (default false)
LIFECYCLE_TEST_EMAILS   # Comma-separated allowlist of email recipients in test mode
OPENAI_API_KEY          # Required when AGENT_AI_PROVIDER=openai
ANTHROPIC_API_KEY       # Required when AGENT_AI_PROVIDER=anthropic
```

### Operations (PM2 cron-managed agents)

```
OPS_EMAIL, OPS_PASSWORD # Service-account credentials used by ops scripts
OPS_ALERT_EMAIL         # Alert recipient email (optional; SMTP_TO is the actual envelope target)
REALTIME_URL            # Realtime gateway base URL (default http://localhost:3002)
WEB_URL                 # Web frontend base URL (default http://localhost:3001)
VALIDATOR_BASE_URL      # Middleware base URL for ops scripts (default http://localhost:3000)
RETENTION_DAYS          # Audit/log retention used by db-maintainer
```

### Third-party

```
OPENWEATHER_API_KEY     # Optional — OpenWeatherMap API key for weather widget
```

## Project Structure Highlights

```
middleware/src/modules/    # NestJS modules:
                           #   admin, agents, analytics, api-keys, auth, billing,
                           #   common, config, content, database, display-groups,
                           #   displays, fleet, folders, health, mail, mcp, metrics,
                           #   notifications, organizations, playlists, redis,
                           #   schedules, storage, support, template-library, users
middleware/src/modules/agents/  # Business-agent infrastructure (PR #32, 2026-04-19):
                                #   AgentStateService, agent-state.schema, controllers
                                #   for /api/v1/agents/* — see docs/agents-architecture.md
middleware/src/modules/mcp/     # Model Context Protocol server — read-only tool surface
                                # for agents (Vizora-internal + future Hermes sidecar).
                                # See docs/agents-mcp-server-design.md and the "MCP
                                # Server" section below.
middleware/src/modules/common/  # Shared guards (csrf), interceptors (logging, sanitize, response-envelope), middleware (csrf)
middleware/test/           # E2E test specs (*.e2e-spec.ts)
packages/database/prisma/schema.prisma  # Data model: Organization, User, Display, Content, Playlist, Schedule, DisplayGroup, Tag, AuditLog, AdminAuditLog, McpToken, McpAuditLog, ContentRecommendation, CustomerIncident, ...
web/src/app/               # Next.js App Router: (auth)/, dashboard/, api/, product/
web/src/lib/hooks/          # useSocket, useRealtimeEvents for WebSocket integration
realtime/src/gateways/     # device.gateway.ts — main WebSocket handler
scripts/agents/            # Business agents (cron + on-demand): customer-lifecycle, support-triage, etc.
scripts/ops/               # Autonomous ops agents (PM2 cron) — see "Autonomous Operations"
e2e-tests/                 # 15 Playwright spec files (01-auth through 15-comprehensive-integration)
docs/agents-architecture.md          # Discipline patterns extracted from shift-agent
docs/agents-mcp-server-design.md     # MCP server module sketch (read-only v1)
tasks/feature-backlog.md   # Long-lived parking lot for evaluated/deferred ideas
backlog.md                 # P0-P4 active backlog with status + effort estimates
```

## Display Clients

**Electron** (`display/`): Desktop app for Windows/macOS/Linux. Webpack + TypeScript. Packages via electron-builder.

**Android TV**: Extracted to standalone repo (`vizora-tv`). Capacitor 6 + Vite + TypeScript. See [github.com/Trivenidigital/vizora-tv](https://github.com/Trivenidigital/vizora-tv).

**Mobile Companion**: Extracted to standalone repo (`vizora-mobile`). Expo 54 + React Native 0.81 + TypeScript. Management app (NOT a display client). See [github.com/Trivenidigital/vizora-mobile](https://github.com/Trivenidigital/vizora-mobile).

## Production Deployment

PM2 via `ecosystem.config.js`: middleware runs 2 instances in cluster mode, realtime runs single instance (WebSocket state consistency), web runs single instance. All have memory limits, exponential backoff restart, and graceful shutdown.

## Swagger Docs

Available at `http://localhost:3000/api/v1/docs` in development mode only.

## Known Test State

> Numbers below are approximate; the codebase is actively gaining tests. **Verify with a fresh run before relying on a specific number.** Current spec-file counts (a rough proxy for test count): middleware ≈ 106, realtime ≈ 10, web ≈ 78. Per-test counts run several multiples of those.

- **Middleware**: 1700+ tests pass at last full run. Historical pre-existing failures (auth.controller, pairing.service) — verify locally if you see a fail; not all are regressions.
- **Realtime**: ~28 tests pass. 1 suite has historically failed on a Prisma generate issue in the test env.
- **Web**: 40+ suites pass. 2 admin test suites have historically failed (async Client Component in jsdom — tied to deferred RSC migration).
- **Display**: No test coverage yet.
- **Builds**: All 3 services compile via `npx nx build @vizora/{middleware,web,realtime}`. `web` may need `NODE_OPTIONS="--max-old-space-size=4096"` on memory-constrained dev machines.

## Support Agent System

Developer-facing Claude Code workflow that turns support requests into code changes.

**Usage:** `/support "description of the issue"`

**Workflow:** classify → locate code → generate plan → **developer approval** → implement with git commits → verify

**Components:**
- **Skill:** `.claude/skills/support-agent/SKILL.md` — orchestration logic with Level 3 reference files
- **Subagents:** `.claude/agents/request-analyzer.md`, `code-scout.md`, `plan-writer.md` — read-only specialists
- **Slash command:** `.claude/commands/support.md` — entry point

**Constraint:** Never auto-implements. Every change requires explicit developer approval before any code is written.

## Content Validator Agent

Automated deployment readiness checker. Runs 30 validation rules across content, displays, schedules, and storage.

**Usage:** `/validate [scope] [--token TOKEN] [--base-url URL]`

**Workflow:** health check → authenticate → run validators in parallel → generate readiness report (READY / DEGRADED / NOT READY)

**Components:**
- **Skill:** `.claude/skills/content-validator/SKILL.md` — orchestration with Level 3 reference files
- **Scripts:** `.claude/skills/content-validator/scripts/` — 5 TypeScript validation scripts (zero deps, read-only)
- **Subagents:** `.claude/agents/{infra-checker,content-auditor,display-inspector,schedule-analyzer,report-compiler}.md`
- **Slash command:** `.claude/commands/validate.md` — entry point
- **Rules catalog:** `.claude/skills/content-validator/validation-rules.md` — 30 rules (10 critical, 14 warning, 5 info)

**Constraint:** Read-only. Scripts only use GET requests. No data is ever modified. No AI API costs.

## Autonomous Operations System

7 PM2 cron-managed agents providing 24/7 monitoring, auto-remediation, alerting, and a dead-man triad.

> **Keep this table aligned with `ecosystem.config.js`** when adding/removing PM2 entries under the `ops-*` namespace.

**Scripts:** `scripts/ops/` — agent scripts + shared library in `scripts/ops/lib/` (state, alerting, types, api-client)

| Agent | Schedule | Responsibility |
|-------|----------|---------------|
| health-guardian | Every 5min | Service health, PM2 restarts, memory monitoring; pings `HEALTHCHECKS_HEALTH_GUARDIAN_URL` on success (external dead-man) |
| content-lifecycle | Every 15min | Archive expired/orphaned content, storage monitoring |
| fleet-manager | Every 10min | Offline display detection, ping reconnect, error reset |
| schedule-doctor | Every 15min | Deactivate broken schedules, coverage gaps |
| ops-reporter | Every 30min | Aggregate status, Slack/email alerts, dashboard update |
| ops-watchdog | Every 15min | Detects when other ops agents stop firing past per-agent SLA (3× cron interval). Slack alert on stale. Internal dead-man — catches what `HEALTHCHECKS_HEALTH_GUARDIAN_URL` can't (one-agent-stuck vs whole-VPS-down). |
| db-maintainer | Daily 3am | PostgreSQL vacuum, Redis cleanup, log rotation |

**State:** `logs/ops-state.json` — shared state file with incidents and remediation audit trail. Read/write through `scripts/ops/lib/state.ts` (file-locked: `readOpsState` acquires, `writeOpsState` releases — every reader MUST pair with a writer).

**Dashboard:** `GET /api/v1/health/ops-status` — Redis-cached ops status for web dashboard at `/dashboard/ops`. Prefer this over reading `ops-state.json` directly from new callers.

**Design:** `docs/plans/2026-02-28-autonomous-ops-design.md`

## MCP Server

`middleware/src/modules/mcp/` — Vizora's Model Context Protocol server. Read-only tool surface that agents (Vizora-internal cron, Claude Code subagents, future Hermes sidecar, eventually customer integrations) call instead of hitting per-domain REST endpoints.

**Endpoints:**
- `POST /api/v1/mcp` — MCP transport (JSON-RPC over HTTP). Bearer-token auth.
- `GET  /api/v1/mcp` — MCP transport SSE leg.
- `POST /api/v1/admin/mcp-tokens` — issue token (super-admin only). Returns plaintext bearer ONCE.
- `GET  /api/v1/admin/mcp-tokens` — list tokens (no plaintext).
- `DELETE /api/v1/admin/mcp-tokens/:id` — revoke (idempotent).

**Tools today:**
- `list_displays` — paginated, scope `displays:read`, optional status filter. (PR #42)
- `list_open_support_requests` — paginated, scope `support:read`, returns triage candidates as **structural signals only** (word_count, has_attachment, message_count, age_minutes, priority, category, ai_category, org_tier). Body and PII NEVER cross the wire. Default WHERE excludes already-triaged requests (D7 reply-loop prevention).
- `update_support_request_priority` — scope `support:write`, sets priority on one request (cross-org guard via compound where).
- `update_support_request_ai_category` — scope `support:write`, sets V2 taxonomy slug. Zod-constrained to the V2 enum.
- `create_support_message` — scope `support:write`, posts an agent-authored comment. Author identity comes from the bearer-token context, content capped at 2000 chars.
- `list_onboarding_candidates` — **platform-scope** read tool, scope `customer:read`. Returns onboarding candidates across ALL orgs as structural signals only (tier, days_since_signup, milestone_flags, nudges_sent). NEVER returns org name, admin email, or billing detail. Requires a platform-scope token (`organizationId IS NULL` in `mcp_tokens`); per-org tokens are rejected with INVALID_INPUT. Used by the customer-lifecycle Hermes shadow skill.

**Token shapes:**
- **Per-org token** (`organizationId` is a real org id) — for agents that operate on one org's data. Used by all the `displays:*` and `support:*` tools. The data-access methods compound their WHERE clauses with the token's org id, so the token can never see other orgs' data.
- **Platform-scope token** (`organizationId IS NULL`) — for cross-org agents like customer-lifecycle and the future agent-orchestrator. Per-org tools reject these with INVALID_INPUT (`requireOrgScope` helper). Platform-scope tools require these (the inverse check in the tool handler). Issued via `McpTokenService.issue({ organizationId: null, ... })`.

**Hermes Agent runtime (prod VPS):**
- Installed at `/usr/local/lib/hermes-agent`, command at `/usr/local/bin/hermes`.
- Config: `/root/.hermes/config.yaml` (mcp_servers.vizora pointing at `https://vizora.cloud/api/v1/mcp`).
- Secrets: `/root/.hermes/.env` (chmod 600) — `OPENROUTER_API_KEY`, `VIZORA_MCP_TOKEN`, `VIZORA_MCP_BASE_URL`.
- Gateway: `systemd` unit `hermes-gateway.service` (active) — required for cron jobs to fire.
- Skills repo: `hermes-skills/<skill-name>/SKILL.md` — git-tracked, scp'd to `/root/.hermes/skills/` on deploy.

**Hermes-driven agents (state):**
- `vizora-support-triage` — **shadow mode** in cron `*/5 * * * *`. Reads via MCP, scores, appends `/var/log/hermes/vizora-support-triage-shadow.jsonl`. Live-mode skill (`SKILL-live.md`) is built and committed but NOT deployed; cutover is a one-line SCP after the gate below clears.
- `vizora-customer-lifecycle` — **shadow mode** in cron `*/30 * * * *`. Calls `list_onboarding_candidates` (platform-scope), picks template per org via heuristic-matching prompt, appends `/var/log/hermes/vizora-customer-lifecycle-shadow.jsonl`. PM2 cron `agent-customer-lifecycle` continues to send all real emails. Live-mode skill is NOT YET BUILT — the live path needs `mark_onboarding_nudge_sent`, `auto_complete_org_onboarding`, and `send_lifecycle_nudge_email` write tools first (see `tasks/feature-backlog.md`).

**Agent migration roadmap (Hermes-first rule)**

Inventory of `scripts/agents/*.ts` and their migration status:

| Agent | Lines | State | Migration plan |
|-------|-------|-------|----------------|
| support-triage | 306 | LIVE (PM2 cron, every 5 min) | **Migrated to Hermes shadow.** Cutover gated on shadow-data review. |
| customer-lifecycle | 463 | LIVE (PM2 cron, every 30 min). Sends real onboarding emails when `LIFECYCLE_LIVE=true`. | **Migrated to Hermes shadow.** Read path: `list_onboarding_candidates` (platform-scope MCP tool). Skill: `hermes-skills/vizora-customer-lifecycle/SKILL.md`. Cron: `*/30 * * * *`. Comparison: `scripts/agents/compare-lifecycle-hermes-vs-heuristic.ts`. **Live cutover NOT done** — the write tools (`mark_onboarding_nudge_sent`, `auto_complete_org_onboarding`, `send_lifecycle_nudge_email`) are not yet built; the customer-visible email path stays on the PM2 cron. Backlog entry tracks the staged rollout. |
| billing-revenue | 32 | SCAFFOLD (gated off). | Per Hermes-first rule, when implemented build as `hermes-skills/vizora-billing-revenue/SKILL.md`, not TS. |
| content-intelligence | 32 | SCAFFOLD (gated off). | Per Hermes-first rule, build as `hermes-skills/vizora-content-intelligence/SKILL.md`. |
| screen-health-customer | 33 | SCAFFOLD (gated off). | Per Hermes-first rule, build as `hermes-skills/vizora-screen-health/SKILL.md`. The `list_displays` MCP tool already exists; only `create_customer_incident` write tool needed. |
| agent-orchestrator | 33 | SCAFFOLD (gated off). | Per Hermes-first rule, **Hermes IS the orchestrator runtime** — use its built-in `delegate_task` tool to coordinate per-family skills, don't write a custom loop. |

Each scaffold's file header now carries the Hermes-first comment so future implementers see the rule without having to rediscover it.

**Cutover playbook for support-triage (Hermes shadow → live)**

Gate before swapping `SKILL.md`:
1. ≥ 7 days of shadow data accumulated in the JSONL.
2. Run `npx tsx scripts/agents/compare-hermes-vs-heuristic.ts` from the VPS. Require:
   - ≥ 50 tickets scored
   - ≥ 80% priority agreement vs DB priority
   - Avg disagreement rank-distance ≤ 1.0
3. Sign-off from Sri (the Hermes-first rule applies; the cutover decision still goes through him).

Cutover (when gate clears):
```bash
# Promote live skill on VPS
scp hermes-skills/vizora-support-triage/SKILL-live.md \
    root@vizora.cloud:/root/.hermes/skills/vizora-support-triage/SKILL.md
# Hermes auto-reloads skill content on each cron firing — no daemon restart needed
```

Rollback (if anything goes wrong):
```bash
scp hermes-skills/vizora-support-triage/SKILL.md \
    root@vizora.cloud:/root/.hermes/skills/vizora-support-triage/SKILL.md
```

The PM2 cron `agent-support-triage` continues to run as a safety net throughout — decommission it (`pm2 delete agent-support-triage`) only after Hermes-live has run for ≥ 14 days without incident.

**Pending PRs:**
- PR-B — remaining 12 tools (display detail, content, playlists, schedules, organizations, audit).
- PR-C — Hermes sidecar `vizora_mcp_client.py` + first agent migration (`support-triage`).

**Key behaviors to know:**
- Bearer tokens are sha256-hashed; plaintext shown once at issuance, never persisted.
- `@SkipEnvelope()` on every MCP endpoint — global response envelope is bypassed so MCP JSON-RPC reaches the wire unwrapped.
- CSRF middleware exempts the entire `/api/v1/mcp` tree (bearer auth, no cookie surface).
- Per-token rate limit (default 60/min, 1000/day). In-memory; ~2× effective limit in PM2 cluster mode (documented in code).
- Audit row written to `mcp_audit_log` for every tool call (success or error). Inputs redacted via the same anchored regex `AgentStateService` uses.
- Errors map to MCP-spec codes: `NOT_FOUND` (resource missing), `INVALID_INPUT` (params bad), `UNAUTHORIZED` (token issue), `FORBIDDEN` (scope), `RATE_LIMITED`, `INTERNAL`. **Distinction matters** — `NOT_FOUND` tells agents to back off, `INVALID_INPUT` invites retry.

**Design doc:** `docs/agents-mcp-server-design.md`.

## Agent Architecture (business agents)

Reference docs added 2026-05-03 from a review of the sister project `shift-agent` (Hermes Agent runtime, 15 agents in production). Read these before designing or maintaining a Vizora business agent:

- **`docs/agents-architecture.md`** — discipline patterns: the 8 hard rules (dispatcher-first routing, identity-by-metadata, fail-closed, helper-scripts-own-IDs, templates-not-LLM-text, input sanitization, dual-source audit, hardened outbound), per-agent file shape, `safe_io` pattern, required out-of-band alerts, build order, testing stages, security posture.
- **`docs/agents-mcp-server-design.md`** — proposed Vizora MCP server module (`middleware/src/modules/mcp/`). Read-only v1 with 13 tools, token-based auth, rate limiting, audit, observability. Design only — implementation gated on a real consumer (see `tasks/feature-backlog.md`).

**Existing agent state code:** `middleware/src/modules/agents/agent-state.service.ts` (PR #32, merged 2026-04-19) — anchored secret/PII redaction, file-locking with timeout, known-family path safety, async fs/promises, manual-run enqueue. Use this for new agent state I/O — don't reimplement.

## Backlog locations

- **`backlog.md`** (root) — active P0–P4 backlog with status, effort estimates, and roadmap
- **`tasks/feature-backlog.md`** — long-lived parking lot for evaluated/deferred ideas (each with **what / why deferred / trigger to revisit**)
- **`tasks/hermes-backlog.md`** — Hermes/Path B taxonomy-v2 backlog with the 2026-05-24 measurement gate
