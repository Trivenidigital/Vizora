# Autonomous Operations System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 6 PM2 cron-managed agents that autonomously monitor, remediate, and alert for Vizora production 24/7.

**Architecture:** Agent-Per-Domain — each agent is a standalone TypeScript script in `scripts/ops/` sharing a common library. Agents authenticate via service account, detect issues via API, auto-fix with PATCH/POST, verify fixes, and write state to `logs/ops-state.json`. The ops-reporter aggregates and alerts via Slack, email, and a dashboard endpoint.

**Tech Stack:** TypeScript (tsx), Node.js fetch, nodemailer (email), PM2 cron, Redis (dashboard state), NestJS (ops-status endpoint)

**Design Doc:** `docs/plans/2026-02-28-autonomous-ops-design.md`

**Security Note:** Agent scripts use `execSync` with hardcoded commands only (no user input). This is intentional — these are ops scripts that run pm2/psql/redis-cli commands. Do NOT use user-provided strings in any exec call.

---

## Task 1: Shared Library — Types and State Management

**Files:**
- Create: `scripts/ops/lib/types.ts`
- Create: `scripts/ops/lib/state.ts`

**Step 1: Create types.ts**

Define shared types for the ops system:
- `Severity`: 'critical' | 'warning' | 'info'
- `SystemStatus`: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
- `IncidentStatus`: 'open' | 'resolved' | 'escalated'
- `AgentResult`: agent name, timestamp, duration, issues found/fixed/escalated, incidents array
- `Incident`: id, agent, type, severity, target, targetId, detected, message, remediation, status, attempts, resolvedAt?, error?
- `RemediationAction`: agent, timestamp, action, target, targetId, method (GET/PATCH/POST/DELETE/COMMAND), endpoint?, before?, after?, success, error?
- `OpsState`: systemStatus, lastUpdated, lastRun (map of agent→timestamp), incidents array, recentRemediations array, agentResults (map of agent→AgentResult)

**Step 2: Create state.ts**

State management functions for `logs/ops-state.json`:
- `readOpsState()`: Read state file, return empty state if missing
- `writeOpsState(state)`: Write state, trim incidents to 200 max, remediations to 100 max
- `recordAgentRun(state, result)`: Merge agent result into state, update/insert incidents by id
- `addRemediation(state, action)`: Append remediation action
- `determineSystemStatus(state)`: CRITICAL if any open critical incidents, DEGRADED if warnings, else HEALTHY
- `makeIncidentId(agent, type, targetId)`: Generate deterministic incident ID

Use the Windows-safe path resolution pattern from `validate-monitor.ts`:
```typescript
const STATE_FILE = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..', '..', '..', 'logs', 'ops-state.json'
);
```

**Step 3: Verify files parse**

Run: `npx tsx --eval "import './scripts/ops/lib/types.js'; import { readOpsState } from './scripts/ops/lib/state.js'; console.log(JSON.stringify(readOpsState()));"`
Expected: JSON output of empty OpsState

**Step 4: Commit**

```bash
git add scripts/ops/lib/types.ts scripts/ops/lib/state.ts
git commit -m "feat(ops): add shared types and state management for autonomous agents"
```

---

## Task 2: Shared Library — API Client with Mutations

**Files:**
- Create: `scripts/ops/lib/api-client.ts`

**Step 1: Create api-client.ts**

Extend the `validate-monitor.ts` API client pattern with:
- `OpsApiClient` class with constructor(baseUrl, token, agentName)
- `get<T>(path, params?)`: GET with 30s timeout, unwrap response envelope
- `getAll<T>(path, params?)`: Paginated GET, max 500 items
- `patch<T>(path, body, auditTarget?)`: PATCH with audit logging — records RemediationAction
- `post<T>(path, body, auditTarget?)`: POST with audit logging
- `probe(url)`: HEAD request with 5s timeout for health checks
- `get auditLog()`: Returns all recorded RemediationAction entries
- Self-imposed rate limiting: 100ms between requests (10 req/s)
- `login(baseUrl, email, password)`: Standalone auth function (same as validate-monitor.ts)

Every mutation (patch/post) automatically records a `RemediationAction` with agent name, timestamp, method, endpoint, success/failure, and error message.

**Step 2: Verify it compiles**

Run: `npx tsx --eval "import { OpsApiClient, login } from './scripts/ops/lib/api-client.js'; console.log('OK');"`

**Step 3: Commit**

```bash
git add scripts/ops/lib/api-client.ts
git commit -m "feat(ops): add API client with mutation support and audit logging"
```

---

## Task 3: Shared Library — Alerting Module

**Files:**
- Create: `scripts/ops/lib/alerting.ts`

**Step 1: Create alerting.ts**

Three alert channels + logging:
- `log(agent, msg)`: Timestamped stdout with agent name prefix
- `sendSlackAlert(status, previousStatus, openIncidents, fixedCount)`: POST to SLACK_WEBHOOK_URL with Block Kit formatted message — severity-colored header, open incidents list (max 5 critical), fix count
- `sendEmailAlert(status, openIncidents, fixedCount)`: Dynamic import of nodemailer (only loads if SMTP_HOST configured), HTML email with incident tables
- `updateDashboard(state, token)`: POST full OpsState to `/api/v1/health/ops-status`

Env vars read: SLACK_WEBHOOK_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OPS_ALERT_EMAIL, VALIDATOR_BASE_URL

All functions are no-op if their required env vars are missing (graceful degradation).

**Step 2: Verify it compiles**

Run: `npx tsx --eval "import { log, sendSlackAlert } from './scripts/ops/lib/alerting.js'; log('test', 'OK');"`

**Step 3: Commit**

```bash
git add scripts/ops/lib/alerting.ts
git commit -m "feat(ops): add alerting module (Slack, email, dashboard)"
```

---

## Task 4: Agent 1 — health-guardian

**Files:**
- Create: `scripts/ops/health-guardian.ts`

**Step 1: Create health-guardian.ts**

Runs every 5 minutes. Checks:

1. **Service endpoints**: GET middleware `/api/v1/health/ready`, realtime `/health`, web `/`
   - If unhealthy/unreachable → `pm2 restart <name>` (max 2 attempts)
   - 30s cooldown after restart before declaring success
   - Resolve incident if service recovers

2. **PM2 process status**: Parse `pm2 jlist` JSON output
   - Errored/stopped → `pm2 restart <name>`
   - High memory (>85% of limit: 512MB for middleware/realtime, 1GB for web) → `pm2 reload <name>` (graceful)

3. **Escalation**: After 2 failed restart attempts, mark incident as `escalated`

Uses `execSync` for pm2 commands — these are hardcoded strings, not user input.

Env vars: VALIDATOR_BASE_URL, REALTIME_URL (default :3002), WEB_URL (default :3001)

**Step 2: Verify it compiles**

Run: `npx tsx --eval "import './scripts/ops/health-guardian.js'" 2>&1 | head -5`

**Step 3: Commit**

```bash
git add scripts/ops/health-guardian.ts
git commit -m "feat(ops): add health-guardian agent (service health + PM2 restart)"
```

---

## Task 5: Agent 2 — content-lifecycle

**Files:**
- Create: `scripts/ops/content-lifecycle.ts`

**Step 1: Create content-lifecycle.ts**

Runs every 15 minutes. Authenticates, then:

1. **Expired content**: GET `/content` where status=active, check expiresAt < now
   - Auto-fix: PATCH `/content/:id` → `{ status: 'archived' }`

2. **Orphaned content**: Content not in any playlist, older than 30 days
   - Cross-reference content IDs against all playlist items
   - Auto-fix: PATCH to archived (skip layouts)

3. **Storage monitoring**: Check storage usage from health endpoint
   - >90%: Log critical incident, archive oldest inactive content
   - >80%: Log warning

Every PATCH is audit-logged via the OpsApiClient.

**Step 2: Commit**

```bash
git add scripts/ops/content-lifecycle.ts
git commit -m "feat(ops): add content-lifecycle agent (expire, orphan, storage)"
```

---

## Task 6: Agent 3 — fleet-manager

**Files:**
- Create: `scripts/ops/fleet-manager.ts`

**Step 1: Create fleet-manager.ts**

Runs every 10 minutes. Authenticates, then:

1. **Offline displays**: GET `/displays`, check lastHeartbeat
   - Offline <1hr → POST `/displays/ping` with displayId (WebSocket reconnect attempt)
   - Offline >1hr → Mark as persistent, escalate

2. **Error state**: Displays with status=error
   - Auto-fix: PATCH `/displays/:id` → `{ status: 'inactive' }`

3. **Cluster offline**: Group displays by organizationId
   - If ALL displays in an org (3+) are offline → critical incident "site-wide outage"

4. **No content**: Online displays with no playlist and no schedule → warning

**Step 2: Commit**

```bash
git add scripts/ops/fleet-manager.ts
git commit -m "feat(ops): add fleet-manager agent (offline detection, ping, error reset)"
```

---

## Task 7: Agent 4 — schedule-doctor

**Files:**
- Create: `scripts/ops/schedule-doctor.ts`

**Step 1: Create schedule-doctor.ts**

Runs every 15 minutes. Authenticates, then:

1. **Past-end schedules**: Active schedules where endDate < now
   - Auto-fix: PATCH `/schedules/:id` → `{ isActive: false }`

2. **Orphan schedules**: Targets nonexistent display
   - Auto-fix: PATCH to deactivate

3. **Empty playlist schedules**: Active schedule using empty playlist
   - Log as warning (no auto-fix — needs human to add content)

4. **Coverage gaps**: Displays with no schedule and no playlist
   - Log as warning

**Step 2: Commit**

```bash
git add scripts/ops/schedule-doctor.ts
git commit -m "feat(ops): add schedule-doctor agent (deactivate, coverage gaps)"
```

---

## Task 8: Agent 5 — ops-reporter

**Files:**
- Create: `scripts/ops/ops-reporter.ts`

**Step 1: Create ops-reporter.ts**

Runs every 30 minutes. Does NOT fix issues — aggregates and alerts.

1. **Read state**: Load `logs/ops-state.json`
2. **Determine status**: CRITICAL/DEGRADED/HEALTHY from open incidents
3. **Agent freshness**: Check each agent's lastRun against expected schedule (e.g., health-guardian should run every 5min, so stale after 10min)
4. **Alert decision**: Send alert if:
   - Status changed (HEALTHY→DEGRADED, etc.)
   - CRITICAL persists >1 hour since last alert
   - Recovery (non-HEALTHY→HEALTHY)
5. **Send alerts**: Slack (always), email (DEGRADED/CRITICAL only)
6. **Update dashboard**: POST to `/api/v1/health/ops-status`
7. **Prune**: Remove resolved incidents older than 24h, old remediations

**Step 2: Commit**

```bash
git add scripts/ops/ops-reporter.ts
git commit -m "feat(ops): add ops-reporter agent (aggregate, alert, dashboard)"
```

---

## Task 9: Agent 6 — db-maintainer

**Files:**
- Create: `scripts/ops/db-maintainer.ts`

**Step 1: Create db-maintainer.ts**

Runs daily at 3am. Maintenance only — no issue detection.

1. **PostgreSQL**: `VACUUM ANALYZE` on high-churn tables (Content, Display, Schedule, Playlist, AuditLog, User) via psql
2. **Redis**: Report memory usage and key count via redis-cli
3. **Log rotation**: Truncate .log files older than 7 days in logs/
4. **PM2 flush**: `pm2 flush` to clear PM2's internal log buffer
5. **Backup verification**: Check BACKUP_S3_BUCKET if configured (placeholder for future)

Uses `execSync` with hardcoded psql/redis-cli/pm2 commands only.

**Step 2: Commit**

```bash
git add scripts/ops/db-maintainer.ts
git commit -m "feat(ops): add db-maintainer agent (vacuum, redis, log rotation)"
```

---

## Task 10: PM2 Configuration

**Files:**
- Modify: `ecosystem.config.js`

**Step 1: Add 6 PM2 entries to the apps array**

After the existing `vizora-validator` entry, add:

| Name | Cron | Script |
|------|------|--------|
| ops-health-guardian | `*/5 * * * *` | `tsx scripts/ops/health-guardian.ts` |
| ops-content-lifecycle | `*/15 * * * *` | `tsx scripts/ops/content-lifecycle.ts` |
| ops-fleet-manager | `*/10 * * * *` | `tsx scripts/ops/fleet-manager.ts` |
| ops-schedule-doctor | `*/15 * * * *` | `tsx scripts/ops/schedule-doctor.ts` |
| ops-reporter | `*/30 * * * *` | `tsx scripts/ops/ops-reporter.ts` |
| ops-db-maintainer | `0 3 * * *` | `tsx scripts/ops/db-maintainer.ts` |

All with: `autorestart: false`, `max_memory_restart: '256M'`, dedicated log files in `logs/ops-{name}-{out|error}.log`.

Follow the exact pattern of the existing `vizora-validator` entry.

**Step 2: Verify config is valid**

Run: `node -e "const c = require('./ecosystem.config.js'); console.log(c.apps.map(a => a.name))"`
Expected: 10 entries

**Step 3: Commit**

```bash
git add ecosystem.config.js
git commit -m "feat(ops): add PM2 cron config for 6 autonomous agents"
```

---

## Task 11: NestJS Ops Status Endpoint

**Files:**
- Modify: `middleware/src/modules/health/health.controller.ts`
- Modify: `middleware/src/modules/health/health.service.ts`

**Step 1: Add POST and GET /health/ops-status to health.controller.ts**

Add to imports: `Post`, `Body` from `@nestjs/common`.

Add two methods:
- `@Post('ops-status')` — receives OpsState from ops-reporter, calls `healthService.setOpsStatus(body)`
- `@Get('ops-status')` — returns cached ops status, calls `healthService.getOpsStatus()`

Both are auth-protected (no `@Public()` decorator).

**Step 2: Add setOpsStatus/getOpsStatus to health.service.ts**

- `setOpsStatus(data)`: Store JSON in Redis key `vizora:ops:status` with 1h TTL
- `getOpsStatus()`: Read from Redis, return `{ systemStatus: 'unknown' }` if empty

HealthService already has RedisService injected.

**Step 3: Verify middleware compiles**

Run: `npx nx build @vizora/middleware`

**Step 4: Run existing middleware tests**

Run: `pnpm --filter @vizora/middleware test -- --testPathPattern=health`
Expected: Existing health tests still pass

**Step 5: Commit**

```bash
git add middleware/src/modules/health/health.controller.ts middleware/src/modules/health/health.service.ts
git commit -m "feat(ops): add POST/GET /health/ops-status endpoint"
```

---

## Task 12: Web Dashboard — Ops Status Page

**Files:**
- Create: `web/src/app/dashboard/ops/page.tsx`

**Step 1: Study existing dashboard page patterns**

Read `web/src/app/dashboard/page.tsx` and one other dashboard subpage to understand:
- Layout components used
- Auth/role guards
- Data fetching patterns (server component? client component? useSWR?)
- Card/table component imports

**Step 2: Create ops dashboard page**

Follow existing patterns. Key elements:
- `'use client'` directive (needs auto-refresh)
- Overall status badge with color: green (HEALTHY), yellow (DEGRADED), red (CRITICAL)
- 6 agent cards showing: name, last run time (relative), issues found/fixed, status icon
- Active incidents table: severity, type, target, message, status, detected time
- Remediation history: last 24h actions with success/failure indicators
- Auto-refresh: `useEffect` with `setInterval` every 60s calling `GET /api/v1/health/ops-status`

**Step 3: Verify web compiles**

Run: `NODE_OPTIONS="--max-old-space-size=4096" npx nx build @vizora/web`

**Step 4: Commit**

```bash
git add web/src/app/dashboard/ops/
git commit -m "feat(ops): add ops status dashboard page"
```

---

## Task 13: Grafana Dashboard Provisioning

**Files:**
- Create: `docker/grafana/dashboards/vizora-overview.json`
- Modify: `docker/grafana/provisioning/dashboards/dashboards.yml` (if needed)
- Modify: `docker/grafana/provisioning/alerting/alerts.yml`

**Step 1: Create Grafana dashboard JSON**

Dashboard with panels:
- HTTP request rate (counter: `vizora_http_requests_total`)
- Error rate % (`vizora_http_errors_total / vizora_http_requests_total * 100`)
- Latency p50/p95/p99 (histogram: `vizora_http_request_duration_seconds`)
- Memory usage (from default process metrics)
- Process restart count (from PM2)

Use Prometheus as datasource (already configured in docker-compose).

**Step 2: Verify dashboard provisioning config**

Check `docker/grafana/provisioning/dashboards/dashboards.yml` maps to the dashboards directory. Update if needed.

**Step 3: Add Slack contact point to alerting**

Update `alerts.yml` to add a Slack notification channel that uses `$SLACK_WEBHOOK_URL`. Connect existing alert rules to this contact point.

**Step 4: Commit**

```bash
git add docker/grafana/
git commit -m "feat(ops): add Grafana dashboard and Slack alert contact point"
```

---

## Task 14: Install nodemailer + Update Documentation

**Files:**
- Modify: `package.json` (root workspace)
- Modify: `CLAUDE.md`

**Step 1: Install nodemailer**

Run: `pnpm add -D nodemailer @types/nodemailer -w`

**Step 2: Update CLAUDE.md**

Add "Autonomous Operations System" section after "Content Validator Agent" documenting:
- 6 agents with schedules
- State file location
- Dashboard endpoint
- New environment variables (SMTP_*, OPS_ALERT_EMAIL, REALTIME_URL, WEB_URL)
- Link to design doc

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml CLAUDE.md
git commit -m "feat(ops): install nodemailer, document autonomous ops in CLAUDE.md"
```

---

## Task 15: Final Verification

**Step 1: Verify all agent scripts compile**

```bash
npx tsx --eval "import './scripts/ops/lib/types.js'; console.log('types OK')"
npx tsx --eval "import './scripts/ops/lib/state.js'; console.log('state OK')"
npx tsx --eval "import './scripts/ops/lib/api-client.js'; console.log('api OK')"
npx tsx --eval "import './scripts/ops/lib/alerting.js'; console.log('alert OK')"
```

**Step 2: Verify middleware builds**

Run: `npx nx build @vizora/middleware`

**Step 3: Verify PM2 config**

Run: `node -e "const c = require('./ecosystem.config.js'); console.log(c.apps.length, 'apps:', c.apps.map(a => a.name).join(', '))"`
Expected: `10 apps: vizora-middleware, vizora-realtime, vizora-web, vizora-validator, ops-health-guardian, ops-content-lifecycle, ops-fleet-manager, ops-schedule-doctor, ops-reporter, ops-db-maintainer`

**Step 4: Run middleware tests to ensure no regressions**

Run: `pnpm --filter @vizora/middleware test`
Expected: All existing tests pass

**Step 5: Final commit if needed**

```bash
git add -A
git commit -m "chore(ops): final verification and cleanup"
```

---

## Summary

| Task | Description | Files | Commit |
|------|-------------|-------|--------|
| 1 | Shared types + state | 2 new | `feat(ops): shared types and state` |
| 2 | API client with mutations | 1 new | `feat(ops): API client` |
| 3 | Alerting module | 1 new | `feat(ops): alerting` |
| 4 | health-guardian | 1 new | `feat(ops): health-guardian` |
| 5 | content-lifecycle | 1 new | `feat(ops): content-lifecycle` |
| 6 | fleet-manager | 1 new | `feat(ops): fleet-manager` |
| 7 | schedule-doctor | 1 new | `feat(ops): schedule-doctor` |
| 8 | ops-reporter | 1 new | `feat(ops): ops-reporter` |
| 9 | db-maintainer | 1 new | `feat(ops): db-maintainer` |
| 10 | PM2 config | 1 modified | `feat(ops): PM2 cron config` |
| 11 | NestJS ops endpoint | 2 modified | `feat(ops): ops-status endpoint` |
| 12 | Web dashboard page | 1 new | `feat(ops): ops dashboard` |
| 13 | Grafana dashboards | 2+ new | `feat(ops): Grafana dashboards` |
| 14 | nodemailer + docs | 3 modified | `feat(ops): nodemailer + docs` |
| 15 | Final verification | 0 | `chore(ops): verification` |

**Total: ~12 new files, ~6 modified files, 15 commits**

**After this plan:** The full 24/7 lifecycle is covered:
```
Deploy ──→ Monitor ──→ Detect ──→ Auto-fix ──→ Verify ──→ Alert ──→ Dashboard
             ✅          ✅         ✅           ✅        ✅          ✅
```
