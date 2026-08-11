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

## The connection-budget catch — a major preflight finding, not incidental cleanup

Before recreating middleware, comparing PM2's live `DATABASE_URL` against `.env`
showed two differences beyond the password:

| | PM2 live (working) | `.env` (would have been used) |
|---|---|---|
| `connection_limit` | 10 | **30** |
| `pool_timeout` | 20 | **60** |
| `statement_timeout` | 30000 | **absent** |

`max_connections` is **50**. Recreating middleware from `.env` would have demanded:

```
middleware   2 instances × 30 = 60
realtime     1 instance  × 30 = 30
                             ─────
                    total     90   against max_connections = 50
```

— while **silently dropping the 30s `statement_timeout` guard**, leaving runaway
queries with no ceiling. That is a larger and far more confusing outage than the
one that occurred: connection exhaustion presents as intermittent failure across
every service at once, with no single failing component to point at.

`.env` was aligned to the tuned values **before** any process was recreated, so
`statement_timeout=30000` was retained. Observed usage afterwards: **14 of 50**.

This was caught by comparing the running configuration against the configuration a
fresh process would use — which is precisely the check proposed as a standing
control (§4 of the proposals). It worked here because it was done by hand, once.

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

## Corrections completed

All of the following are **done**, in persisted production configuration
(`/opt/vizora/app/.env`), each taken from the authoritative source rather than
guessed. `.env` was backed up to `/root/env.bak.*` before every edit. **None is
outstanding.**

| Setting | Corrected to | Source of truth | Runtime mutation |
|---|---|---|---|
| `REDIS_URL` | password added, URL-encoded | container `--requirepass` | realtime restarted |
| `REDIS_PASSWORD` | matched to the container | container `--requirepass` | — |
| `DATABASE_URL` password | 48-char server password | container `POSTGRES_PASSWORD` | — |
| `DATABASE_URL` pool params | `connection_limit=10`, `pool_timeout=20`, `statement_timeout=30000` | PM2 live (working) config | — |
| `API_BASE_URL` | `https://vizora.cloud` | added; was absent | middleware restarted |
| `MINIO_ACCESS_KEY` / `SECRET_KEY` | real 32/48-char credentials | container `MINIO_ROOT_USER` / `_PASSWORD` | — |
| `CORS_ORIGIN` | `https://vizora.cloud,https://www.vizora.cloud` | was localhost-only | — |
| `APP_URL` / `WEB_URL` | `https://vizora.cloud` | were localhost | — |
| **`NEXT_PUBLIC_API_URL`** | **`https://vizora.cloud`** | were localhost | **none — see below** |
| **`NEXT_PUBLIC_SOCKET_URL`** | **`https://vizora.cloud`** | were localhost | **none — see below** |

**The two `NEXT_PUBLIC_*` values were corrected without any runtime mutation.**
They are build-time values baked into the web bundle, so the running build is
unaffected and neither a rebuild nor a restart was performed or is required. The
correction exists solely so the *next* legitimate web build cannot silently bake
localhost endpoints into production. Both were verified against their consumption
path first — each resolves through `new URL(...).origin`, and `useSocket.ts:57`
already falls back to same-origin in production, so the bare origin is the correct
form. **Do not treat these as outstanding work.**

## Closure

```
Current runtime state:
middleware restart-safe from persisted config: PASS
web restart-safe from persisted config:        PASS
realtime restart-safe from persisted config:   PASS

Known stale production build-time web values were corrected in persisted
configuration without rebuilding or restarting web.

This proves the present configuration can recreate the running services.
It does not prove future drift cannot recur; continuous drift detection is
a separate proposed control.
```

Each PASS was established by recreating the process from persisted configuration
with no inherited PM2 environment, then confirming: stable PM2 state, restart count
not climbing over a timed window, Redis authenticated, Postgres authenticated,
health endpoint 200, and no credential or config errors after the start timestamp.
All public URLs 200. Database usage **14 of 50** connections.

Treat these PASSes as a measurement, not a property — they decay silently, and
nothing in place today would report it. The condition that produced this incident,
persisted config drifting from running config while everything looks healthy, is
still unprevented.

Proposed preventive controls are tracked separately in
`2026-08-11-config-reproducibility-proposals.md` — recommendations only, none
built.
