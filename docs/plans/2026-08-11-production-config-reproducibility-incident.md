# Production was not reproducible from persisted configuration — 2026-08-11

**Two outages, ~13 minutes each. Neither was caused by the change being deployed.**

| | Window | Impact |
|---|---|---|
| Realtime gateway | ~17:45–17:58 UTC | 0 of 23 devices connected; dashboard live features degraded |
| Middleware / API | ~18:28–18:41 UTC | API down, public 502; marketing site and `/tv` stayed up |

Both were caused by **latent restart-unsafety** plus **incorrect assumptions during
recovery**. Neither was caused by TV2, the change being shipped — TV2 was merely
the first thing in weeks to restart a service.

## The finding, stated plainly

**Production could not be recreated from its own persisted configuration.** Every
service was running on environment captured at a much earlier start. `/opt/vizora/app/.env`
had drifted into a development file, and nothing noticed because nothing had
restarted. A reboot, an OOM kill, `pm2 resurrect`, or any routine deploy would
each have produced these outages — with nobody choosing the timing.

Realtime exposed it first. Middleware then proved the same class of fault across
five more dimensions.

## What was actually wrong

Discovered in this order, each blocking the one after it:

| Setting | `.env` held | Reality |
|---|---|---|
| `REDIS_URL` | no password | Redis runs with `--requirepass` |
| `REDIS_PASSWORD` | a value | did not match the container's |
| `DATABASE_URL` password | 3 characters | server password is 48 |
| `API_BASE_URL` | **absent** | required by the boot validator → hard fail |
| `MINIO_ACCESS_KEY` / `SECRET_KEY` | `minioadmin` | validator rejects defaults in prod → hard fail |
| `CORS_ORIGIN` | `localhost:3001,3002` only | would reject the real dashboard origin |
| `APP_URL` / `WEB_URL` | `localhost:3001` | email links would point at localhost |
| `NEXT_PUBLIC_API_URL` / `SOCKET_URL` | localhost | would bake localhost into the next web build |
| `DATABASE_URL` pool params | `connection_limit=30`, no `statement_timeout` | live config used `10` and a 30s statement timeout |

**Middleware was independently un-restartable for five reasons**: missing
`API_BASE_URL`, default MinIO credentials, localhost-only CORS, localhost
application URLs, and unsafe DB pool settings. Fixing any one would not have
brought it back.

## The catch that prevented a larger outage

Before recreating middleware, comparing PM2's live `DATABASE_URL` against `.env`
showed `connection_limit=10` versus `30`, and that `.env` had **lost**
`statement_timeout=30000`.

`max_connections` is **50**. Recreating middleware from `.env` would have demanded
2 instances × 30 = 60 for middleware alone, plus realtime's 30 — **90 against a
limit of 50** — while silently dropping the statement-timeout guard. That would
have been a larger and much more confusing outage than the one that happened.
`.env` was aligned to the tuned values first. Observed usage afterwards: **14 of
50**.

## Reasoning mistakes — the second outage is on these

Preserved because the outcome does not excuse the method.

**"`psql` connected, so the credentials are valid."** It connected because
`pg_hba.conf` **trusts local connections** — the password is never checked for
`docker exec … psql`. A control test with a deliberately wrong password connected
happily, which is what proved the original test meaningless. *Test the way the app
connects, or run a known-bad-password control alongside.*

**"I'll source `.env` before restarting."** The `DATABASE_URL` line is unquoted and
contains `&`, so `set -a; . ./.env` runs the assignment in a **subshell** and the
variable is never set in the calling shell — silently. *Never bash-source this
file; parse it with a real dotenv parser.*

**"The credential fix is sufficient, so recreate the process."** This caused the
second outage. Middleware failed on a *different* validator entirely, and the
rollback failed too — because the original `DATABASE_URL` had never been the
problem. The cause was only found by running `dist/main.js` in the foreground,
which is what should have happened **before** the healthy process was deleted.

**"The stored-env key diff proves nothing is missing."** It compared PM2's stored
env against `.env`. `API_BASE_URL` was absent from *both*, so a diff of the two
could never surface it. *A diff between two sources cannot find what neither has;
compare against what the code requires.*

## Why the first two fix attempts silently failed

`dotenv` **never overrides an already-set variable**, and `pm2 restart` **reuses
PM2's stored env**. An earlier `--update-env` had baked the old passwordless
`REDIS_URL` (22 chars) into that stored env, so every restart re-injected it and
dotenv declined to correct it. Confirmed by reading `/proc/<pid>/environ`.

> **Scope of the remedy.** `pm2 delete` + `pm2 start` is the **verified recovery
> path for this setup**, not a universal PM2 rule. What is established: on this
> host, after the stored env was poisoned, a plain `pm2 restart` kept re-injecting
> the stale value and recreating the process cleared it.

## Process rule added

**When validating restart safety, first run the production entrypoint in an
isolated foreground/preflight mode with the exact fresh-start environment, and
confirm it reaches its readiness boundary. Do not make the first diagnostic
experiment by deleting the currently healthy PM2 process.**

Running `NODE_ENV=production node dist/main.js` for 30 seconds would have surfaced
`Missing required production env vars: API_BASE_URL` with **zero** downtime. It is
the cheapest possible experiment and it was run fourth instead of first.

## Current state

```
middleware restart-safe: PASS
web restart-safe:        PASS
realtime restart-safe:   PASS
```

Each verified by recreating the process from persisted configuration with no
inherited PM2 environment, then confirming: stable PM2 state, restart count not
climbing over a timed window, Redis authenticated, Postgres authenticated, health
endpoint 200, and no credential or config errors after the start timestamp. All
public URLs 200. Database usage **14 of 50** connections — safely below the limit.

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` were also corrected in persisted
config, deliberately **without** rebuilding or restarting web: the running build is
unaffected, and the purpose is only to stop the next legitimate web build baking
localhost endpoints into production.

## What this does NOT establish

**Restart safety is not permanent.** It was verified at one moment against one
snapshot of persisted configuration. The condition that produced this incident —
persisted config drifting away from running config while everything looks healthy —
is not prevented by anything that exists today. Startup assertions would catch bad
config *when something restarts*; today's problem survived for weeks precisely
because nothing forced a restart.

Treat these PASSes as a measurement, not a property. They decay silently.

Proposals for the systemic controls are kept separate, in
`2026-08-11-config-reproducibility-proposals.md` — deliberately not mixed into this
record.
