# Proposals — making production reproducible from persisted config

**Status: proposals. Nothing here is built.** Kept separate from
`2026-08-11-production-config-reproducibility-incident.md` on purpose: that record
is what happened, this is what to do about it. Sequenced, but each stands alone.

The incident's one-line cause: **production could not be recreated from its own
persisted configuration, and nothing would have told us until something restarted.**

---

## 1. Canonical Redis configuration

**Problem.** Redis auth has two representations and no stated winner. `.env`
defines both `REDIS_URL` and `REDIS_PASSWORD`; realtime reads **only** `REDIS_URL`
(`redis.service.ts:23`, `redis-io.adapter.ts:17`). So `REDIS_PASSWORD` is
decorative there while looking authoritative, and nothing declares which is which.
That ambiguity is how the password went missing from `REDIS_URL` and stayed
missing: the file still had *a* Redis password, just not one anything read.

**Proposal.** Pick one authoritative representation and make the other impossible
to misread.

- Prefer `REDIS_URL` as the single source (it already carries host, port, db and
  password, and matches how ioredis is constructed).
- Either delete `REDIS_PASSWORD` from `.env` and `.env.example`, or have every
  consumer apply it explicitly as the `password` option so both paths agree.
- Whichever is chosen, assert at startup that the effective connection actually
  authenticates (see §2) rather than trusting the string's shape.

**Test that proves it.** A consumer given a passwordless `REDIS_URL` and a correct
`REDIS_PASSWORD` must behave identically across services — today one would connect
and another would not.

---

## 2. Startup configuration assertions

**Problem.** Middleware already fails loudly on *missing* variables — that is how
`API_BASE_URL` was found. But it does not check that variables which are *present*
are usable. `DATABASE_URL` with a wrong password, `REDIS_URL` with no password, and
`CORS_ORIGIN` pointing at localhost all pass a presence check and fail in
production.

**Proposal.** Extend the existing validator from *presence* to *fitness*, and run
it before accepting traffic:

- **Required production URLs** — `API_BASE_URL`, `APP_URL`, `WEB_URL`, `CORS_ORIGIN`
  must be absent of `localhost`/`127.0.0.1` when `NODE_ENV=production`.
- **Forbidden defaults** — extend the existing `minioadmin` check to every known
  placeholder (`changeme`, `postgres:postgres`, sample JWT secrets).
- **Credential connectivity** — actually open Postgres, Redis and MinIO and
  authenticate. A failure here should abort startup with the failing dependency
  named, not surface later as a runtime error.
- **Connection-budget sanity where practical** — compare
  `connection_limit × instances`, summed across services, against
  `SHOW max_connections`. Today's numbers: 2×10 + 1×10 = 30 of 50. The `.env` values
  before correction would have computed 90 of 50 and should have refused to start.

**Guard rail, from prior experience.** Boot-time hard-fail validators have crashed
this product before (PR #101, 2026-05-24, ~1010 PM2 restarts). Default new
assertions to **warn**, gate hard-fail behind an explicit env var, and never key
fail-fast on `NODE_ENV` alone.

---

## 3. PM2 restart / deploy procedure

**Problem.** `--update-env` reads as "reload the environment". It does not: it
**replaces** the process environment with the invoking shell's. That single
misreading caused the first outage.

**Proposal.** Document a canonical procedure and how the effective environment is
constructed at each step:

- **Never** assume `--update-env` means "reload `.env`". State plainly that it
  replaces the environment from the calling shell.
- **Never** depend on an inherited SSH-shell environment. Start from a known-empty
  one (`env -u …`) so a missing variable fails loudly rather than being supplied by
  accident.
- **Never** bash-source `.env` — unquoted values containing `&` are silently lost
  to a subshell.
- Define the canonical fresh-start path, including that `pm2 restart` reuses PM2's
  stored env and `dotenv` never overrides an already-set variable — so a stale
  stored value survives both.
- **Verify a fresh process from persisted config before stopping the healthy one**
  where possible: run the entrypoint in foreground/preflight with the exact
  fresh-start environment and confirm it reaches its readiness boundary. This is
  the process rule from the incident record and it belongs here too.

---

## 4. Persisted-config / runtime drift detection

**The missing systemic control, and the reason the other three are insufficient.**

**Problem.** §2 catches bad configuration *when a process starts*. Today's fault
survived for weeks precisely because **nothing forced a restart**. Every service
was healthy, every dashboard was green, and the configuration they would next boot
from was broken. Startup assertions cannot see that; only a comparison can.

**Proposal.** A periodic check comparing each running service's materially relevant
configuration against the configuration a **fresh** process would start from.

Minimum coverage — chosen because each of these actually drifted:

| Dimension | Why |
|---|---|
| DB / Redis endpoints and credentials | wrong password, missing password |
| DB pool parameters | `connection_limit`, `pool_timeout`, `statement_timeout` |
| Production URLs and CORS | `API_BASE_URL`, `APP_URL`, `WEB_URL`, `CORS_ORIGIN` |
| Required object-storage credentials | MinIO defaults still in place |
| Build-time public web URLs | `NEXT_PUBLIC_*` baking localhost into the next build |

Design constraints:

- **Compare, do not repair.** Alert on drift; **never auto-rewrite secrets.** An
  automated writer here would be a credential-exfiltration surface and could
  overwrite the only correct copy with a stale one.
- **Compare fingerprints, not values.** Hash or length-compare secrets so the check
  can run without logging or transporting them.
- Read the running config from the live process (`/proc/<pid>/environ`, PM2 metadata)
  and the fresh-start config the same way the service would load it.
- Follow §12a: this is exactly the "ship the watchdog with the writer" pattern —
  a check nobody is forced to run is a check that will not run.

**What it would have done here.** Flagged, weeks before any deploy and while
everything was green: Redis URL missing a password, DB password mismatched,
`API_BASE_URL` absent, MinIO at defaults, CORS localhost-only, and a pool
configuration that would exceed `max_connections` on next boot.

---

## Sequencing

1. **§4 first.** It is the only one that reports on a system nobody is restarting,
   and it would have prevented this incident outright.
2. **§3 next** — documentation-only, no code, immediately useful, and it prevents a
   repeat of the specific mistake that caused outage one.
3. **§2 after** — real value, but the highest risk of causing the exact outage class
   it prevents; ship behind a warn-by-default flag.
4. **§1 last** — smallest blast radius, and §2's connectivity assertion already
   removes most of its danger by making a decorative password fail loudly.
