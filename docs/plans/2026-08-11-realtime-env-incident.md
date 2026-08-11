# Realtime outage during the TV2 deploy — 2026-08-11

**Duration:** ~17:45–17:58 UTC (~13 min). **Device impact: none** — 0 of 23 devices
were connected. Dashboard live features were degraded. Middleware, web, `/tv` and
the API were unaffected throughout.

**Caused by the deploy. Resolved. It also exposed a dormant full-stack fault that
was going to fire on the next restart of anything.**

## What I did wrong

Deployed with:

```bash
NODE_ENV=production pm2 reload ecosystem.config.js --only vizora-realtime --env production --update-env
```

`--update-env` replaces the process environment with the environment of the shell
invoking PM2. The realtime process had been running since 2026-07-12 holding
working credentials **in memory**; my SSH shell had none, so the reload started a
process that could authenticate to nothing. Crash loop.

## What that exposed — the actual problem

The reload was only the trigger. Production `.env` had been wrong for a long time
and nothing noticed, because every service was running on credentials loaded at a
much earlier start:

| Variable | `.env` held | Reality |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379`, **no password** | Redis runs with `--requirepass` |
| `REDIS_PASSWORD` | a value | **did not match** the container's |
| `DATABASE_URL` password | **3 characters** | server password is 48 |

**So realtime could not survive any restart, and neither could middleware or web.**
A deploy, a VPS reboot, an OOM kill, or `pm2 resurrect` would each have produced
the same outage — on the API, not just the gateway. It was luck that the trigger
was a low-traffic gateway with zero devices connected.

## Two wrong conclusions, and why they were wrong

Both cost time and both are easy to repeat.

**"psql connected, so the credentials are valid."** It connected because
`pg_hba.conf` **trusts local connections** — the password is never checked for
`docker exec … psql`. A control test with a deliberately wrong password connected
happily, which is what proved the original test meaningless. *Any in-container
auth check is worthless here; test the way the app connects, or run a
known-bad-password control alongside it.*

**"I'll just source `.env` before restarting."** The `DATABASE_URL` line is
unquoted and contains `&`:

```
DATABASE_URL=postgresql://…/vizora?connection_limit=30&pool_timeout=60
```

`set -a; . ./.env` makes bash run the assignment in a **subshell** at the `&`, so
the variable is never set in the calling shell — silently. *Never bash-source this
file; parse it with a real dotenv parser.*

## Why the first two fixes did not take

`dotenv` **never overrides an already-set variable**, and `pm2 restart` **reuses
PM2's stored env**. My earlier `--update-env` had baked the old passwordless
`REDIS_URL` (22 chars) into that stored env, so every subsequent restart kept
re-injecting it and dotenv politely declined to correct it. Confirmed by reading
`/proc/<pid>/environ`.

The fix was `pm2 delete` + `pm2 start` — the only way to discard the stored env —
launched with `env -u REDIS_URL -u DATABASE_URL` so the shell could not
re-poison it.

## Resolution

1. Corrected `REDIS_URL` (password added, URL-encoded), `REDIS_PASSWORD` and the
   `DATABASE_URL` password in `/opt/vizora/app/.env`, taking each from the
   container's own configuration. `.env` backed up before each edit
   (`/root/env.bak.*`).
2. `pm2 delete vizora-realtime` then a clean `pm2 start … --env production`, then
   `pm2 save`.

Verified after: `online`, `restarts=0`, `/api/health` 200, `Redis connected and
ready`, `Database connected successfully`, no errors after the start timestamp,
and all public URLs 200.

## Follow-ups

**1. Restart middleware and web at a chosen time.** They are still running on
in-memory credentials from July. `.env` is now correct, so they *should* come back
cleanly — but that is a prediction, not a verified fact, and the whole point of
this incident is that nobody had checked. Do it deliberately rather than
discovering it during the next unplanned restart.

**2. Realtime ignores `REDIS_PASSWORD`.** `redis.service.ts:23` and
`redis-io.adapter.ts:17` read `REDIS_URL` only, while `.env` defines both. Two
config styles for one setting is exactly how this drifted unnoticed — one is
authoritative and the other is decorative, and nothing says which.

**3. Boot-time credential check.** Every one of these failures was invisible until
a restart. A startup assertion that the configured credentials actually
authenticate would convert a dormant outage into a loud one at deploy time.
Compose with the §12a freshness-SLO habit: config that is only exercised on
restart needs something that exercises it.

**4. Never use `--update-env` against a process whose env you have not verified.**
It is not a refresh; it is a replacement.
