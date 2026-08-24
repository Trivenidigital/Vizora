# Ops alert channels — what exists, and the minimum config to activate one

**Status as of 2026-08-24: no channel is configured on prod. Nothing that the ops
agents detect reaches a human.** Detection works — `health-guardian` raised six
`UNHEALTHY` verdicts during the ClickHouse saturation incident and `ops-reporter`
went `CRITICAL` — but every outbound path terminates in a no-op.

This document exists so activation is a **single config step** once an approved
destination and secret are supplied. It deliberately does not activate anything.

## Why this was invisible

Every sender in `scripts/ops/lib/alerting.ts` returned `void` after a silent
`if (!configured) return;`, so the caller could not tell "delivered" from "no
channel exists". `ops-reporter` logged `alerted: true` — the *decision*, not the
outcome — and stamped the re-alert suppression window off that same decision, so
an alert nobody received could suppress a later one that would have been.

Fixed: senders now return `DeliveryResult { channel, outcome, detail? }` with
`outcome` one of `sent` / `not_configured` / `failed`, and the logs distinguish
condition-detected, delivery-attempted, delivered, no-channel-configured, and
delivery-failed. `alertTimestamp` is set only on a real `sent`.

## Supported channels and their minimum config

Listed cheapest-to-activate first. **Pick ONE dedicated operational channel** —
wiring all four multiplies the places a secret can leak and the places an alert
can silently stop, without adding coverage.

### 1. Slack incoming webhook — recommended

| | |
|---|---|
| Variables | `SLACK_WEBHOOK_URL` |
| Secret? | Yes — the URL *is* the credential. Treat it as one. |
| Used by | `sendSlackAlert` (status transitions), `sendInlineAlert` (per-agent critical/warning) |
| Covers | every ops agent |
| Notes | One variable, no auth handshake, no sender-domain verification. Fastest path from "approved" to "working". |

### 2. SMTP email

| | |
|---|---|
| Variables | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, plus **`OPS_ALERT_EMAIL`** (preferred) or `SMTP_TO` |
| Secret? | Yes — `SMTP_PASS` |
| Used by | `sendEmailAlert` (status transitions only) |
| Gotcha | `scripts/ops/lib/alerting.ts` reads **`SMTP_PASS` and `SMTP_FROM`** — *not* `SMTP_PASSWORD` or `EMAIL_FROM`. A host carrying only the latter pair authenticates as nobody and the failure is swallowed. Set all of them. |
| Gotcha | `SMTP_HOST` is checked **before** the recipient, so an unset host short-circuits before the "no recipient" warning can log. Both must be set for email to work at all. |

### 3. Healthchecks.io dead-man

| | |
|---|---|
| Variables | `HEALTHCHECKS_HEALTH_GUARDIAN_URL` |
| Secret? | Yes — the URL contains the check UUID |
| Used by | `pingHeartbeat` in `health-guardian` |
| Covers | **only** "did health-guardian run and finish cleanly" — not what it found |
| Notes | Complementary, not a substitute. It answers "is the agent alive", where Slack/email answer "what did it find". `ops-watchdog` is the in-box equivalent and needs no secret. |

### 4. Sentry

| | |
|---|---|
| Variables | `SENTRY_DSN` (+ optional `SENTRY_RELEASE`) |
| Secret? | Yes |
| Used by | 17 capture sites across middleware |
| Status | **Accidentally unconfigured, not deliberately disabled** — the code paths exist and are live; the DSN is absent from `.env` and from the running process env. No approved DSN was found anywhere on the box. |
| Notes | This is application error tracking, not host monitoring. It would not have caught the capacity incident. Lowest priority of the four for the problem we actually had. |

## First alerts to wire, once a channel is approved

In priority order. These are host-health conditions; the ones that would have
surfaced the 2026-08-16→24 incident on day one are the first three.

1. **OOM kill** — any `Out of memory: Killed process` in the kernel log. One
   fired 2026-08-23T21:03:16 (`python3`, ~1 GB anon-rss, `cron.service` cgroup)
   and nobody was told.
2. **Sustained swap exhaustion** — swap used above a threshold, or non-zero
   `pswpout/s` sustained across several samples. Swap ran at 1.2–1.3 GB with
   continuous bidirectional paging for days.
3. **Sustained CPU/load saturation** — `%idle` under a floor across N
   consecutive `sar` samples. Five retained days averaged 0.20–0.24% idle and
   the best single sample was 0.31%.
4. **health-guardian restart or escalation** — any `pm2 restart` it fires, and
   any incident reaching `escalated`.
5. **Repeated service restarts** — PM2 `restart_time` climbing outside a deploy
   window.
6. **Readiness failure** — `/health/ready` reporting `status != ok` after the
   stabilisation gate.

**ClickHouse merge backlog is deliberately NOT on this list.** ClickHouse was
stopped 2026-08-24T01:09:04Z and is intended to stay stopped until telemetry is
redesigned; alerting on a service we have chosen to switch off would be noise.
Add it back as part of that redesign, if it returns at all.

## What activation looks like

Once a destination and secret are approved, for the recommended channel:

```bash
# on the prod host
echo 'SLACK_WEBHOOK_URL=<approved-url>' >> /opt/vizora/app/.env
```

The ops agents are PM2 cron apps that re-exec each tick and read `.env` fresh, so
no reload is needed for them. Verify on the next `ops-reporter` firing: the log
must move from `alert_delivered: false [slack=not_configured ...]` to
`alert_delivered: true [slack=sent]`. **That log line is now trustworthy** — it
reports the outcome, not the intent.
