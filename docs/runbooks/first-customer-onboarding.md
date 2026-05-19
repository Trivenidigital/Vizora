# First-Customer Onboarding Runbook

**Audience:** Operator (Sri or designated on-call) for the first paying customer go-live (target 2026-05-13).
**Companion docs:** `docs/plans/2026-05-09-production-readiness-report.md` (go/no-go logic), `docs/plans/2026-05-09-test-inventory.md` (coverage map).

This runbook is what you do **on the day of customer #1's launch** and during the first 7 days of concierge support.

---

## T-3 (3 days before launch — 2026-05-10)

### 1. SMTP / Resend on prod (BLOCKER)
Per `backlog.md` B5/B6/B7. Without this, registration emails + password resets don't send and customer is stuck after signup.

```bash
# On prod VPS (root@vizora.cloud):
ssh root@vizora.cloud 'grep -E "^SMTP_|^RESEND_|^EMAIL_FROM" /opt/vizora/app/.env'
# Verify all of: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
# Resend domain `mail.vizora.cloud` must be verified (DKIM/SPF/DMARC green)
```

Smoke test:
```bash
ssh root@vizora.cloud 'cd /opt/vizora/app && bash scripts/smoke/api-critical-path.sh'
# Should return ALL 12 PASSED. Then trigger a real welcome email:
curl -X POST https://vizora.cloud/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"<your-real-email>","password":"Test123!@#",
       "firstName":"Smoke","lastName":"Test","organizationName":"smoke-final"}'
# Within 30s, the configured EMAIL_FROM should land a welcome message in your inbox.
```

### 2. Customer-#1 organization provisioned
Skip if the customer self-registers. Otherwise, pre-create:
- Organization (slug, plan tier, screen quota — set per contract)
- Admin user invitation (sent to customer's nominated admin email)
- Initial template library access (per their content plan)

### 3. Real-device walkthrough on customer hardware (BLOCKER)
Vizora's display app is Electron — `0% functional test coverage`. We pair-on-release as the only mitigation. This walkthrough proves it works on the customer's actual model.

Steps (operator + customer's IT):
1. Power on display device + connect to customer's network (note any captive portal / proxy / firewall behaviour)
2. Launch the Vizora display app
3. From a laptop, log into the customer's Vizora dashboard
4. Generate a pairing code (`Devices → Add → Generate Code`)
5. Enter the code on the display
6. Verify `device.status = online` in dashboard within 30s
7. Push a test playlist (any single image)
8. Verify display shows the image within 30s
9. Reboot the display device
10. Verify it auto-pairs back online within 60s of boot
11. Disconnect / reconnect Wi-Fi (simulate flaky network)
12. Verify reconnect within 2 min

Document any deviations in `docs/runbooks/customer-1-walkthrough-{DATE}.md`. If any step times out >2× the threshold, **escalate to design review** before launch.

### 4. Activate external dead-man
```
ssh root@vizora.cloud 'grep HEALTHCHECKS_HEALTH_GUARDIAN_URL /opt/vizora/app/.env'
# Should be a URL from healthchecks.io. If empty, configure now.
```

### 5. Re-run middleware E2E suite once Docker is up locally
```bash
pnpm --filter @vizora/middleware test:e2e:full   # NOT --silent
# Expect: "all suites pass" — flag any new failures
```

---

## T-2 (2 days before launch — 2026-05-11)

### 1. Final go-live smoke (B16 — 60-step checklist)
Run in this order:
1. `pnpm --filter @vizora/middleware test --testPathIgnorePatterns="e2e-spec"` → expect 2335/2367 pass
2. `pnpm --filter @vizora/realtime test` → expect 212/212
3. `pnpm --filter @vizora/web test` → expect 864/864
4. `bash scripts/smoke/api-critical-path.sh` (against localhost first)
5. `API_BASE=https://vizora.cloud bash scripts/smoke/api-critical-path.sh` (against prod)
6. Open `https://vizora.cloud` in a fresh incognito browser → verify landing page renders, all CTAs work
7. Sign up with a NEW disposable email → verify welcome email lands within 60s
8. Click email verify link → verify landed in dashboard
9. Generate pairing code, pair the SAME display from T-3 walkthrough → verify still online
10. Push a NEW image → verify display swaps within 30s

Record everything in `docs/runbooks/customer-1-go-live-smoke-{DATE}.md` with timestamps.

### 2. Optional: Playwright suite refresh
Per `2026-05-09-playwright-results.md`, the suite has bit-rot. Most stale paths fixed in commit `<TBD>`; remaining work is per-test selector updates.

```bash
# Bring up local stack
docker compose -f docker/docker-compose.yml up -d postgres redis minio
pnpm --filter @vizora/middleware dev > /tmp/mw.log 2>&1 &
pnpm --filter @vizora/realtime dev > /tmp/rt.log 2>&1 &
pnpm --filter @vizora/web dev > /tmp/web.log 2>&1 &
# Wait for "Ready in X" lines in each log (60-90s for web)

# Run Playwright with full reporter
npx playwright test --reporter=list 2>&1 | tee /tmp/pw.log
```

If pass rate >80%, declare Playwright restored. If <80%, accept as week-1 tech-debt and move on (`api-critical-path.sh` is the substitute regression net for launch).

---

## T-1 (1 day before launch — 2026-05-12)

### Freeze — only hotfixes for blockers found in T-2

### Pre-flight checklist on prod
```bash
# Check 1: PM2 process state
ssh root@vizora.cloud 'pm2 list'
# Expect: vizora-middleware (cluster ×2 online), vizora-realtime online, vizora-web online,
#         hermes-insights-poller (cron: stopped between firings is normal),
#         hermes-vizora-customer-lifecycle (cron: stopped between firings is normal)
#         hermes-vizora-support-triage NOT enabled (per design — see follow-up #3 in production-readiness-report.md)

# Check 2: Migrations applied (pre-flight visibility — no writes)
ssh root@vizora.cloud 'cd /opt/vizora/app/packages/database && npx prisma migrate status' > .ssh_pmstat.txt 2>&1
cat .ssh_pmstat.txt
# Expect: "Database schema is up to date!" — OR a list of pending migrations
# you're about to apply via Check 2a below.

# ---------------------------------------------------------------------------
# Checks 2a → 2b → 2c MUST run in this order. Skipping 2b (`prisma generate`)
# between migrate-deploy and the seed leaves the local Prisma client stale,
# and the seed will fail with a confusing `TypeError: Cannot read properties
# of undefined (reading 'findUnique')` on whatever model was added by the
# new migration. Verified locally 2026-05-19.
# ---------------------------------------------------------------------------

# Check 2a: Apply migrations
ssh root@vizora.cloud 'cd /opt/vizora/app && pnpm --filter @vizora/database exec prisma migrate deploy' > .ssh_migrate.txt 2>&1
cat .ssh_migrate.txt
# Expect: "All migrations have been successfully applied." (or "No pending migrations.")

# Check 2b: Regenerate the Prisma client BEFORE any script that imports
# packages/database/src/generated/prisma (e.g. the O7 seed below). Schema
# additions are invisible to runtime callers until generate runs.
ssh root@vizora.cloud 'cd /opt/vizora/app && pnpm --filter @vizora/database exec prisma generate --schema packages/database/prisma/schema.prisma' > .ssh_prisma_generate.txt 2>&1
cat .ssh_prisma_generate.txt
# Expect: "Generated Prisma Client (v...) to ./src/generated/prisma in Xms"

# Check 2c (O7 — alert rules seed) — REQUIRED after migration 20260519050346_add_alert_rules
# is applied for the FIRST time on prod. Without this step, existing orgs lose their
# device-offline alerts (the rule-driven evaluator has nothing to evaluate). New orgs
# created post-deploy are auto-seeded via AuthService.register (PR #63 follow-up); this
# backfill is needed only for orgs that pre-date the migration.
# Idempotent — safe to re-run; rows with the auto-migrated name are skipped.
ssh root@vizora.cloud 'cd /opt/vizora/app && export $(grep DATABASE_URL .env | xargs) && npx tsx packages/database/scripts/seed-default-alert-rules.ts' > .ssh_seed.txt 2>&1
cat .ssh_seed.txt
# Expect: "[seed] Done. created=N skipped_existing=0 orgs_with_no_admins=M"
# If `created=0 skipped_existing=N` on second run, the seed already landed — that's correct.
# If you see "Cannot read properties of undefined (reading 'findUnique')" or similar
# on prisma.alertRule / prisma.alertRuleFire — Check 2b was skipped or failed. Re-run
# 2b and then 2c.

# Check 3: OpenRouter balance + daily cap
# Open https://openrouter.ai/settings/keys in browser
# Verify per-day spend cap = $2.00 (or higher if customer #1 traffic profile demands)

# Check 4: Resend dashboard
# Open https://resend.com/domains
# Verify mail.vizora.cloud shows DKIM/SPF/DMARC all green

# Check 5: All health endpoints
for url in https://vizora.cloud/api/v1/health https://vizora.cloud/ https://vizora.cloud:3002/api/health; do
  curl -s -o /dev/null -w "$url -> %{http_code}\n" "$url"
done
```

### Notify on-call
- Email customer point-of-contact: "We're ready for launch tomorrow. I'll be available <hours>."
- Slack/PagerDuty: announce on-call window

---

## T-0 (Launch day — 2026-05-13)

### Hour 0 — customer onboarding session
1. Walk customer through admin dashboard (5 min)
2. Generate pairing code together (1 min)
3. Pair display (1 min)
4. Upload customer's first content asset (5 min)
5. Create their first playlist + schedule (10 min)
6. Verify display shows scheduled content (immediate)
7. Hand off the runbook in `docs/customer-handoff.md` (TBD — create per-customer)

### Hour 0–24 — concierge mode
- Stay online; respond to customer Slack/email within 15 min
- Watch the Grafana dashboard (see `monitoring-playbook.md`) every 30 min
- If ANY of the alarm thresholds trip, Slack the customer immediately + investigate

---

## First 7 days post-launch — monitoring

See `docs/runbooks/monitoring-playbook.md` for the full panel-by-panel review.

**Daily checklist** (operator runs once/day at start of shift):
- [ ] OpenRouter spend (yesterday): should be < $0.50/day for 1 customer
- [ ] Customer's display online% (last 24h): > 99%
- [ ] Zero 5xx errors from middleware (`pm2 logs vizora-middleware --lines 200 | grep -c "ERROR"`)
- [ ] PM2 cluster restart count: 0 (rolling 24h)
- [ ] No new entries in `agent_runs` with `outcome` IN (`api_error`, `tool_error`, `timeout`, `runner_crash`)
- [ ] Customer hasn't filed a support ticket (or any open ticket has a triage owner)

If any tip → escalate to design review.

---

## Escalation paths

| Issue | Severity | Action |
|---|---|---|
| Display offline > 5 min | HIGH | Slack customer; check their network; remote-pair if needed |
| Customer can't log in | CRITICAL | Check SMTP (Resend dashboard), check `/auth/me` endpoint, check JWT_SECRET |
| Content not playing | HIGH | Check `/displays/:id/content` endpoint, check MinIO access, verify schedule active |
| 5xx errors spiking | CRITICAL | Pull middleware logs, check Postgres pool, restart middleware if memory > 1GB |
| OpenRouter spend > daily budget | MEDIUM | Check `agent_runs` for runaway, check Hermes cron firings, raise OpenRouter cap if intentional |
| Hermes-vizora-customer-lifecycle stops firing | LOW | Re-enable PM2 entry; investigate root cause off-call |

---

## Rollback procedure (if launch fails)

1. **Stop new traffic**: temporarily put up "Maintenance" page on `vizora.cloud` (operator has the static HTML in `web/public/maintenance.html`)
2. **Revert deploy**: `ssh root@vizora.cloud 'cd /opt/vizora/app && git reset --hard <last-known-good-sha> && npx nx build @vizora/middleware && pm2 reload vizora-middleware'`
3. **Roll back migrations** if needed: `ssh root@vizora.cloud 'cd /opt/vizora/app/packages/database && export $(grep DATABASE_URL ../../.env | xargs) && npx prisma migrate resolve --rolled-back <migration-name>'` (see `docs/runbooks/migrations.md`)
4. **Customer comms**: "We've encountered an issue and are rolling back. ETA: <X> hours."
5. **Post-mortem within 48h**

---

## Customer-1 scope (what's IN, what's OUT for launch day)

### IN scope
- Sign up + email verify
- Login + 2FA NOT required (deferred)
- Display pairing (single device)
- Content upload (image, video, URL, HTML)
- Template library (87 system templates)
- Playlist create / edit / reorder
- Schedule playlist on display (calendar UI)
- Display sees content (real-time push)
- Notifications (in-app)
- Settings: profile, organization, team
- Billing: free tier (no payment required for 1st month)

### OUT of scope (deferred to post-launch)
- Stripe / Razorpay live checkout (only free tier for customer #1)
- AI Designer (stub only)
- Mobile companion app (separate repo, not deployed)
- Hermes-driven support triage (`hermes-vizora-support-triage` disabled — operator handles tickets)
- Hermes-driven customer lifecycle live mode (in shadow only — operator reviews JSONL output)
- Multi-tenant features beyond customer #1 (we're optimizing for ONE org's success)

If the customer asks for an OUT-of-scope feature, log it in `tasks/feature-backlog.md` and respond: "We've noted this for the next sprint."

---

**Companion docs to this runbook:**
- `docs/runbooks/monitoring-playbook.md` (Grafana panels + thresholds)
- `docs/plans/2026-05-09-production-readiness-report.md` (go/no-go context)
- `docs/runbooks/migrations.md` (migration rollback procedure)
- `scripts/smoke/api-critical-path.sh` (12-endpoint smoke test)
