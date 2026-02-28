# Tier 1 Continuous Monitoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the 30 validation rules every 15 minutes on production via PM2, alerting to Slack only on status changes.

**Architecture:** Single TypeScript script imports validation logic inline (not subprocess), authenticates via service account, compares results against last-known state, fires Slack webhook on transitions.

**Tech Stack:** TypeScript, Node.js built-in fetch, PM2 cron_restart, Slack incoming webhooks.

---

### Task 1: Create validate-monitor.ts

**Files:**
- Create: `scripts/validate-monitor.ts`

**Step 1: Write the monitoring script**

The script:
1. Reads env vars (VALIDATOR_EMAIL, VALIDATOR_PASSWORD, SLACK_WEBHOOK_URL, VALIDATOR_BASE_URL)
2. Logs in via POST /api/v1/auth/login
3. Runs health check (01 logic)
4. If unhealthy, alerts and exits
5. Runs content/display/schedule validators (02-04 logic)
6. Aggregates into report (05 logic)
7. Reads logs/validator-latest.json for previous status
8. If status changed, sends Slack webhook
9. Writes new result to logs/validator-latest.json
10. Exits

**Step 2: Verify script runs locally**

Run: `npx tsx scripts/validate-monitor.ts`
Expected: Script runs, outputs JSON, writes logs/validator-latest.json

**Step 3: Commit**

```bash
git add scripts/validate-monitor.ts
git commit -m "feat: add continuous monitoring script for 30 validation rules"
```

### Task 2: Update ecosystem.config.js

**Files:**
- Modify: `ecosystem.config.js`

**Step 1: Add vizora-validator PM2 app**

Add new entry with cron_restart: "*/15 * * * *", autorestart: false.

**Step 2: Commit**

```bash
git add ecosystem.config.js
git commit -m "feat: add vizora-validator PM2 cron process (every 15min)"
```

### Task 3: Update .env.example

**Files:**
- Modify: `.env.example`

**Step 1: Add validator env vars section**

Add VALIDATOR_EMAIL, VALIDATOR_PASSWORD, SLACK_WEBHOOK_URL, VALIDATOR_BASE_URL.

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add validator monitoring env vars to .env.example"
```

### Task 4: Test end-to-end locally

**Step 1: Run against local Vizora API**

```bash
VALIDATOR_EMAIL=validator@vizora.test VALIDATOR_PASSWORD=Test1234 VALIDATOR_BASE_URL=http://localhost:3000 npx tsx scripts/validate-monitor.ts
```

Expected: JSON output, logs/validator-latest.json created, no Slack (no webhook URL set).

**Step 2: Run again to verify change detection**

Expected: "No status change" in output (same result as previous run).
