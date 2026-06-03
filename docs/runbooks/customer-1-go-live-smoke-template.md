# Customer-1 Go-Live Smoke Report

Copy this template to `docs/runbooks/customer-1-go-live-smoke-{DATE}.md` before the final C4 smoke.
Do not paste secrets, tokens, customer passwords, or full email addresses into this report.

## Metadata

- Date:
- Operator:
- Customer org:
- origin/main SHA:
- production SHA:
- PR / deploy tag:
- Production URL: `https://vizora.cloud`
- GO/NO-GO decision:

## Operator Boundary

- [ ] No production env changes were made during this C4 smoke, except operator-approved pre-existing C1 setup.
- [ ] No DNS, payment, SMTP provider, or secret changes were made during this C4 smoke.
- [ ] No destructive real-device command was run.
- [ ] Any SSH command output was redirected to `.ssh_*.txt` and read as a separate step.

## C1 - SMTP / Resend Evidence

- Domain `mail.vizora.cloud` verified in Resend:
- Public `APP_URL` or `WEB_URL` points at `https://vizora.cloud`:
- Offline config check:
  - Command: `ssh root@vizora.cloud 'cd /opt/vizora/app && pnpm smoke:email-readiness --production' > .ssh_email_readiness_check.txt 2>&1`
  - Result:
- Optional SMTP credential handshake:
  - Command: `ssh root@vizora.cloud 'cd /opt/vizora/app && EMAIL_READINESS_ALLOW_NETWORK=true pnpm smoke:email-readiness --production --verify-smtp' > .ssh_email_readiness_smtp.txt 2>&1`
  - Result:
- Operator-approved neutral test send:
  - Command: `ssh root@vizora.cloud 'cd /opt/vizora/app && EMAIL_READINESS_ALLOW_SEND=true pnpm smoke:email-readiness --production --send --to <operator-test-email>' > .ssh_email_readiness_send.txt 2>&1`
  - Result:
- Welcome email observed during signup smoke:

## C2 - Customer Organization Evidence

- Customer self-registered, or org was pre-created:
- Admin user present:
- Plan / tier:
- Screen quota:
- Initial content/template access:
- Notes:

## C3 - Real-Device Walkthrough Evidence

- Device model / OS:
- Network:
- Pairing code generated:
- Pairing completed:
- Dashboard status reached online:
- Playlist pushed:
- Display updated within target:
- Reboot recovery:
- Network flap recovery:
- Real-device walkthrough result:
- Deviations / screenshots:

## C4 - Final Go-Live Smoke

### Repo / CI

- PR branch:
- origin/main SHA:
- GitHub checks green: audit, build, e2e, lint, security, test
- Claude Code review result:

### Local Test Baseline

- `pnpm --filter @vizora/middleware test --testPathIgnorePatterns="e2e-spec"` result:
- `pnpm --filter @vizora/realtime test` result:
- `pnpm --filter @vizora/web test` result:
- `pnpm test:ops` result:

### Production API Smoke

- Local VPS smoke:
  - Command: `ssh root@vizora.cloud 'cd /opt/vizora/app && bash scripts/smoke/api-critical-path.sh' > .ssh_local_smoke.txt 2>&1`
  - Result:
- Public API/web ingress smoke:
  - Command: `ssh root@vizora.cloud 'cd /opt/vizora/app && API_BASE=https://vizora.cloud WEB_BASE=https://vizora.cloud bash scripts/smoke/api-critical-path.sh' > .ssh_go_live_smoke.txt 2>&1`
  - Result:

### Browser And Dashboard Smoke

- Landing page renders at `https://vizora.cloud`:
- Signup reaches dashboard:
- Welcome email delivered:
- Email verification remains deferred; no email-confirmation link expected:
- Pairing code generated:
- Same display from C3 paired:
- New image pushed:
- Display swaps within 30s:

### Optional Customer-Critical Playwright

- Local stack was running on middleware :3000, web :3001, realtime :3002:
- `pnpm e2e:customer-critical -- --reporter=list` result:
- Failing specs, if any:
- Launch-critical substitute used:

## Health / Observability

- `https://vizora.cloud/api/v1/health/ready`:
- `https://vizora.cloud/api/v1/health/live`:
- Ops dashboard:
- External dead-man / healthchecks:
- PM2 process state:
- Recent error logs:

## Result

- GO/NO-GO decision:
- Blockers:
- Residual risks:
- Rollback plan if GO:
- Follow-up tasks:
