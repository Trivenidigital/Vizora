# Autonomous Operations System Design

**Date:** 2026-02-28
**Status:** Approved
**Goal:** Full 24/7 autonomous monitoring, remediation, and alerting for Vizora production

## Problem Statement

Current agent systems (support agent, content validator) are manual — they require `/support` or `/validate` invocation. The monitoring infrastructure (Tier 1 cron, Tier 2 event-driven, Prometheus, Loki) detects issues but cannot act on them. The system can *see* problems but can't *fix* them without a human.

**Target state:** Detect → Auto-fix → Verify fix → Alert only when auto-fix fails.

## Architecture: Agent-Per-Domain

6 autonomous agents as standalone TypeScript scripts in `scripts/ops/`, managed by PM2 cron. Each follows the lifecycle: Authenticate → Detect → Remediate → Verify → Log → Exit.

```
scripts/ops/
├── lib/
│   ├── api-client.ts          # Shared auth + API client (extends validator lib.ts)
│   ├── remediation.ts         # PATCH/POST/DELETE helpers for auto-fix actions
│   ├── alerting.ts            # Slack webhook + email (nodemailer) + dashboard POST
│   ├── state.ts               # Read/write agent state to logs/ops-state.json
│   └── types.ts               # Shared types (AgentResult, Incident, RemediationAction)
├── health-guardian.ts          # Every 5min
├── content-lifecycle.ts        # Every 15min
├── fleet-manager.ts            # Every 10min
├── schedule-doctor.ts          # Every 15min
├── ops-reporter.ts             # Every 30min
└── db-maintainer.ts            # Daily 3am
```

## Agent Specifications

### 1. health-guardian (every 5min)

**Detects:**
- API (middleware) unresponsive — `GET /health/ready`
- Realtime gateway down — `GET /health` on port 3002
- Web dashboard down — `GET /` on port 3001
- PM2 process crashed/errored — `pm2 jlist` status check
- High memory usage (>85%)

**Auto-fixes:**
- Crashed PM2 process → `pm2 restart <name>`
- Errored process → `pm2 restart <name>` with exponential backoff tracking
- Memory threshold exceeded → `pm2 restart <name>` (graceful reload for cluster)

**Verification:** Re-check health endpoint after 30s cool-down. If still failing after 2 restart attempts, mark as "escalation needed."

### 2. content-lifecycle (every 15min)

**Detects:**
- Expired content still active — check expiresAt vs now
- Orphaned content (no playlist reference) — cross-reference content ↔ playlists
- Missing thumbnails — check thumbnailUrl validity
- Oversized files (>100MB) — check fileSize field
- Storage usage >80% — health storage stats

**Auto-fixes:**
- Expired content → `PATCH /api/v1/content/:id` set status=archived, assign replacementContent if configured
- Orphaned content older than 30 days → `PATCH` to archived
- Storage >90% → archive oldest inactive content until below threshold

**Verification:** Re-query to confirm status changed. Log all mutations with before/after state.

### 3. fleet-manager (every 10min)

**Detects:**
- Displays offline >15min — check lastHeartbeat
- Displays in error state — check status field
- Entire location offline — group displays by org, detect cluster failures
- Display with no assigned content — check playlist/schedule assignment

**Auto-fixes:**
- Offline <1hr → emit WebSocket `ping` via realtime API to trigger reconnect
- Offline >1hr → log as persistent failure, track in state
- Error state display → `PATCH /api/v1/displays/:id` reset status to 'inactive'

**Verification:** Wait 60s, re-check heartbeat. Track reconnect success rate.

### 4. schedule-doctor (every 15min)

**Detects:**
- Schedules with past endDate still active
- Schedules referencing deleted playlists
- Schedules with no target displays
- Overlapping schedules on same display (time conflicts)
- Displays with no active schedule or playlist (coverage gaps)

**Auto-fixes:**
- Past-end schedules → `PATCH` set active=false
- References deleted playlist → deactivate schedule, assign display to org default playlist
- Coverage gap → assign fallback playlist if org has one configured

**Verification:** Re-query schedules to confirm deactivation.

### 5. ops-reporter (every 30min)

**Aggregator and alerter — does not fix issues directly.**

**Reads:** `logs/ops-state.json` (written by all other agents)

**Actions:**
- Aggregate all agent results into single system status
- Determine overall health: HEALTHY / DEGRADED / CRITICAL
- Slack: Send webhook on status change or persistent critical issues
- Email: Send digest via nodemailer for DEGRADED/CRITICAL
- Dashboard: `POST /api/v1/health/ops-status` — store state in Redis
- Track remediation history (what was fixed, when, success/failure)
- Alert deduplication: Don't re-alert for same issue within 1 hour unless severity escalates

### 6. db-maintainer (daily 3am)

**Maintenance tasks — no issue detection.**

- PostgreSQL: `VACUUM ANALYZE` on high-churn tables (Content, Display, Schedule, AuditLog)
- PostgreSQL: `REINDEX` on frequently queried indexes
- Redis: Clear expired keys, report memory usage
- Logs: Rotate PM2 logs older than 7 days (archive then flush)
- MinIO: Report storage usage per bucket
- Backup verification: Check latest backup exists and is <24h old

Reports results to ops-state.json for ops-reporter to include.

## Shared Infrastructure

### API Client

Extends existing `scripts/validate-monitor.ts` patterns:
- Mutation methods: `patch()`, `post()`, `delete()` for auto-remediation
- Audit logging: Every mutation logged with agent name, action, target, before/after state
- Rate limiting: Self-imposed 10 req/s to avoid overwhelming the API
- Service account auth: `VALIDATOR_EMAIL` / `VALIDATOR_PASSWORD` (same as Tier 1 cron)

### Alerting Module

Three channels:
- **Slack:** POST to `SLACK_WEBHOOK_URL` with severity-colored attachments
- **Email:** nodemailer with SMTP config for DEGRADED/CRITICAL digests
- **Dashboard:** POST to `/api/v1/health/ops-status` (Redis-backed)

### State Persistence

All agents write to `logs/ops-state.json`:
```json
{
  "lastRun": { "health-guardian": "2026-02-28T10:05:00Z" },
  "incidents": [
    {
      "id": "inc-001",
      "agent": "fleet-manager",
      "type": "display_offline",
      "target": "display-abc",
      "detected": "2026-02-28T10:00:00Z",
      "remediation": "ping_sent",
      "status": "resolved|open|escalated",
      "attempts": 2
    }
  ],
  "systemStatus": "HEALTHY|DEGRADED|CRITICAL"
}
```

### New API Endpoint

`GET /api/v1/health/ops-status` — returns current ops state from Redis. Protected by auth. Admin-only.

### PM2 Configuration

6 new entries in `ecosystem.config.js`:
- All with `autorestart: false`, `cron_restart` schedules
- Each writes logs to `logs/ops-{agent-name}.log`
- Uses `process.exitCode` (not `process.exit()`) for Windows compatibility

## Environment Variables

New variables required:
```
SMTP_HOST              # Email server hostname
SMTP_PORT              # Email server port (587 for TLS)
SMTP_USER              # Email auth username
SMTP_PASS              # Email auth password
OPS_ALERT_EMAIL        # Destination email for ops alerts
SLACK_WEBHOOK_URL      # Already exists from Tier 1
VALIDATOR_EMAIL        # Already exists from Tier 1
VALIDATOR_PASSWORD     # Already exists from Tier 1
```

## Dashboard Integration

### Web Dashboard: System Health Page

New page at `web/src/app/dashboard/ops/page.tsx` (admin-only):
- Overall status badge: HEALTHY / DEGRADED / CRITICAL
- Agent status cards: Last run, result, next scheduled run
- Active incidents list with remediation status
- Remediation history (last 24h)
- Service health: API, Realtime, Database, Redis, MinIO
- Auto-refresh: Poll every 60 seconds

### Grafana Dashboards (provisioned)

Pre-built JSON dashboard files in `docker/grafana/dashboards/`:
- HTTP request rate, error rate, latency percentiles
- Memory usage per service
- Display fleet status (online/offline counts)
- Alert contact points configured for Slack webhook

## Relationship to Existing Systems

| Existing | Autonomous Ops | Relationship |
|----------|---------------|-------------|
| Tier 1 cron (validate-monitor.ts) | ops-reporter | Ops-reporter subsumes Tier 1 alerting |
| Tier 2 event-driven (NestJS) | All agents | Agents complement real-time detection with periodic sweeps |
| Content Validator (/validate) | content-lifecycle | On-demand validator remains for developer use; content-lifecycle runs 24/7 |
| Support Agent (/support) | N/A | Support agent handles developer workflows, not ops |
| Health endpoints | health-guardian | Health-guardian consumes health endpoints to drive auto-fix |
| Prometheus/Grafana | ops-reporter | Ops-reporter feeds dashboard; Grafana gets provisioned dashboards |

## Design Constraints

- All scripts use `process.exitCode` (not `process.exit()`) — Windows Node.js v24 compatibility
- Zero npm dependencies beyond nodemailer — all use Node.js built-in `fetch`
- All mutations are logged with before/after state for audit trail
- Agents never delete data — only archive, deactivate, or reassign
- Rate limited to 10 req/s per agent to avoid API overload
- Exponential backoff on repeated restart attempts (health-guardian)
- Alert deduplication: 1-hour suppression window per incident
