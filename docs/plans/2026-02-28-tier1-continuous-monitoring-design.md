# Tier 1 Continuous Monitoring — Design

## Context

Vizora has 30 validation rules (content, display, schedule, storage) implemented as standalone TypeScript scripts in `.claude/skills/content-validator/scripts/`. Currently these only run on-demand via `/validate`. This design adds 24/7 automated monitoring on the production server with Slack alerts on status changes.

## Decisions

- **Runner:** PM2 cron process (`cron_restart: "*/15 * * * *"`)
- **Environment:** Production server (vizora.cloud, 89.167.55.176)
- **Frequency:** Every 15 minutes
- **Alerts:** Slack incoming webhook — only on status *changes* (not every run)
- **Auth:** Service account auto-login via `/api/v1/auth/login`

## Architecture

```
PM2 (cron every 15min)
  └── scripts/validate-monitor.ts
        ├── Login (VALIDATOR_EMAIL / VALIDATOR_PASSWORD)
        ├── Health check (01-health-check logic)
        │     └── If UNHEALTHY → alert, stop
        ├── Content validator (02 logic)
        ├── Display validator (03 logic)
        ├── Schedule validator (04 logic)
        ├── Aggregate report (05 logic)
        ├── Compare vs logs/validator-latest.json
        │     └── If status CHANGED → Slack alert
        └── Write logs/validator-latest.json
```

Script imports functions from existing validator scripts — single process, no subprocess overhead.

## Slack Alerts

Fire only on status transitions:
- READY → NOT READY: red alert with critical issues listed
- NOT READY → READY: green recovery alert
- READY → DEGRADED: yellow warning alert
- Any → UNHEALTHY: red infrastructure alert

## Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `scripts/validate-monitor.ts` | Create | Main monitoring script (~200 lines) |
| 2 | `ecosystem.config.js` | Modify | Add vizora-validator PM2 app |
| 3 | `.env.example` | Modify | Add VALIDATOR_EMAIL, VALIDATOR_PASSWORD, SLACK_WEBHOOK_URL, VALIDATOR_BASE_URL |

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VALIDATOR_EMAIL` | Service account email | Yes |
| `VALIDATOR_PASSWORD` | Service account password | Yes |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL | Yes |
| `VALIDATOR_BASE_URL` | API URL (default: http://localhost:3000) | No |

## Constraints

- Zero npm dependencies (uses built-in fetch)
- Read-only — only GET requests to Vizora API (plus one POST for login)
- Must handle auth token expiry gracefully (re-login on 401)
- Script exits after each run; PM2 cron handles scheduling
- Results capped at 500 entities per category (existing limit)
