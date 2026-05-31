# Monitoring Playbook — First Customer & Beyond

**Audience:** On-call operator during the first 7 days of customer #1 (and ongoing).
**Companion:** `first-customer-onboarding.md` for the launch sequence.

This is what to look at, when, and what tipping any of these means.

---

## Dashboards

| Dashboard | URL (prod) | Purpose |
|---|---|---|
| **Vizora Overview** | https://grafana.vizora.cloud/d/vizora-overview | HTTP rate, latency, error rate, DB pool, Redis hit rate |
| **Vizora Ops** (autonomous-ops state) | https://vizora.cloud/dashboard/ops (admin login required) | All 6 ops agents' last-run state + incidents |
| **Agent Cost** (this sprint) | https://grafana.vizora.cloud/d/agents-cost | Hermes / OpenRouter spend per skill, outcome distribution, per-firing cost anomalies |
| **OpenRouter** | https://openrouter.ai/activity | Live API usage + cost (provider side) |
| **Resend** | https://resend.com/emails | Email send/delivery/bounce |

If Grafana is down, fall back to direct SQL on Postgres + `pm2 logs`.

---

## Daily review (run once per shift, ~5 min)

### 1. Cost (agent platform)
```bash
# What did Hermes spend yesterday?
ssh root@vizora.cloud 'docker exec -i vizora-postgres psql -U postgres -d vizora -c "
SELECT \"skillName\",
       COUNT(*) AS firings,
       SUM(\"costMicrodollars\") / 1000000.0 AS spend_usd,
       MAX(\"costMicrodollars\") / 1000000.0 AS max_per_firing
FROM agent_runs
WHERE \"startedAt\" >= NOW() - INTERVAL '\''24 hours'\''
GROUP BY \"skillName\"
ORDER BY spend_usd DESC;"'
```
**Threshold:** total spend > $1.00 → investigate (cap is $2/day at OpenRouter)
**Threshold:** max_per_firing > $0.05 → investigate runaway

### 2. Outcome distribution
```bash
ssh root@vizora.cloud 'docker exec -i vizora-postgres psql -U postgres -d vizora -c "
SELECT outcome, COUNT(*)
FROM agent_runs
WHERE \"startedAt\" >= NOW() - INTERVAL '\''24 hours'\''
GROUP BY outcome
ORDER BY COUNT(*) DESC;"'
```
**Healthy:** mostly `success` or `no_work`
**Tipping:** any `tool_error`, `api_error`, `timeout`, `runner_crash` → drill in

### 3. PM2 process state
```bash
ssh root@vizora.cloud 'pm2 list'
```
**Healthy:** middleware ×2 + realtime + web all "online" with multi-day uptime
**Tipping:** any crash count > 0 in last 24h, or any "errored" status

### 4. Display online%
```bash
ssh root@vizora.cloud 'docker exec -i vizora-postgres psql -U postgres -d vizora -c "
SELECT \"organizationId\",
       COUNT(*) AS displays,
       SUM(CASE WHEN status='\''online'\'' THEN 1 ELSE 0 END) AS online,
       ROUND(100.0 * SUM(CASE WHEN status='\''online'\'' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct
FROM devices
WHERE \"organizationId\" = '\''<customer-1-org-id>'\''
GROUP BY \"organizationId\";"'
```
**Threshold:** customer #1 online% < 99% over 24h → Slack customer immediately

### 5. Middleware error rate
```bash
ssh root@vizora.cloud 'pm2 logs vizora-middleware --lines 1000 --nostream 2>&1 | grep -cE "ERROR|5[0-9][0-9]"'
```
**Threshold:** > 50 errors in 1000 lines (5%) → drill into specific endpoints

### 6. Email deliverability
- Open https://resend.com/emails
- Check last 24h: bounce rate < 5%, complaint rate < 0.1%
- If higher: check DKIM/SPF/DMARC, check sender reputation

---

## Real-time alerting (Grafana → Slack)

These should be configured in `docker/grafana/dashboards/agents-cost.json`:

| Alert | Condition | Severity | Action |
|---|---|---|---|
| Daily budget exceeded | `agent_runs.costMicrodollars` sum today > $1M (=$1.00) for 5 min | CRITICAL | Stop hermes-vizora-* PM2 entries; investigate |
| Cluster cost anomaly | `costMicrodollars` sum by skillName over 1h > $200K | WARNING | Drill in to per-firing breakdown |
| Per-firing cost anomaly | any single row's `costMicrodollars` > $50K | WARNING | Inspect that firing's audit log |
| Output cap breach | `tokensOut` > 4096 OR cumulative_in_5min > 30K | CRITICAL | Phantom-lever; verify max_tokens config |
| Hermes version drift | `version_skew` log lines from runner | WARNING | Operator: check `hermes --version` matches HERMES_VERSION env |
| Sidecar parser failure | `InsightsParserError` thrown | CRITICAL | Hermes upgrade broke parser; freeze upgrades, fix parser |
| Frozen-row PATCH attempted | 409 Conflict response rate > 0/h | INFO | Sidecar latency or runner clock drift |
| Service down | `/api/v1/health` returns non-200 for 60s | CRITICAL | PM2 logs + restart |
| Display offline > 5 min | `devices.lastHeartbeat < NOW() - 5min` for customer-1 device | HIGH | Slack customer; check their network |
| Middleware mem > 1GB | per-worker RSS > 1GB | WARNING | Hot reload; investigate leak if recurring |

---

## Drill-down playbooks

### "OpenRouter spend spiked"
1. Identify the skill: `SELECT "skillName", SUM("costMicrodollars") FROM agent_runs WHERE "startedAt" > NOW() - INTERVAL '6 hours' GROUP BY "skillName" ORDER BY 2 DESC;`
2. Identify the firing: `SELECT id, "tokensIn", "tokensOut", "costMicrodollars", "errorExcerpt" FROM agent_runs WHERE "skillName" = '<skill>' ORDER BY "costMicrodollars" DESC NULLS LAST LIMIT 5;`
3. Read the runner log for that PID: `tail -100 /var/log/hermes/runner/<skill>.log | grep -A 50 'pid=<pid>'`
4. If runaway: `pm2 stop hermes-vizora-<skill>` to halt; investigate before re-enabling.

### "Display offline"
1. Check `devices.lastHeartbeat`: should be within last 30s for online displays
2. Check realtime gateway logs: `pm2 logs vizora-realtime --lines 200 | grep <deviceIdentifier>`
3. If realtime is healthy but device hasn't heartbeated: customer-side issue (Wi-Fi / power / proxy)
4. Slack customer with the diagnosis

### "Middleware 5xx spike"
1. Identify the endpoint: `pm2 logs vizora-middleware --lines 500 --nostream | grep -E "5[0-9][0-9]" | awk '{print $NF}' | sort | uniq -c | sort -rn | head`
2. Read the stacktrace for the most-frequent error
3. If DB-related: check `pg_stat_activity` for long-running queries
4. If known bug: revert to last-good SHA per first-customer-onboarding.md rollback procedure

### "Customer can't log in"
1. Verify `/auth/me` endpoint: `curl -i https://vizora.cloud/api/v1/auth/me` (should 401 without cookie)
2. Verify `/auth/login` endpoint: `curl -X POST https://vizora.cloud/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"<customer-admin>","password":"<temp>"}'`
3. Check JWT_SECRET is set: `ssh root@vizora.cloud 'grep -c JWT_SECRET /opt/vizora/app/.env'` (should be 1)
4. Check Postgres user table for the customer's row + `lastLoginAt`
5. If password reset needed: walk customer through forgot-password flow + verify Resend delivery

### "Email not arriving"
1. Open https://resend.com/emails — find the message by recipient
2. Status = `delivered` → user-side (spam folder, mailbox full)
3. Status = `bounced` → check bounce reason (DNS, mailbox doesn't exist)
4. Status not visible → check middleware mail logs: `pm2 logs vizora-middleware --lines 200 | grep -i "smtp\|email"`
5. If sender-reputation issue: rotate to backup SMTP per `mail.module.ts` failover

---

## Long-running concerns (week 2+)

- **agent_runs retention**: 90-day cleanup runs in db-maintainer cron daily 3am UTC. Verify table size doesn't grow unbounded.
- **OpenRouter rate caps**: if customer scales beyond single user, `$2/day` may need to grow.
- **PM2 cluster scaling**: at 2 workers, single-node throughput is ~1k req/s. Above that, plan a second VPS + load balancer.
- **MinIO storage growth**: monitor `du -sh /data/minio`. At 100GB-ish, plan to move to S3 or expand local volume.

---

**Companion docs:**
- `first-customer-onboarding.md` (launch sequence)
- `docs/plans/2026-05-09-production-readiness-report.md` (current state)
- `docs/agents-architecture.md` (agent platform architecture)
