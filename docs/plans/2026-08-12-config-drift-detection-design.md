# B1 — Persisted-config / runtime drift detection (design)

**Status: investigation + design. No code written, nothing deployed.**

Scope is set by `2026-08-11-config-reproducibility-proposals.md` §4. Goal: detect
when a **currently healthy** service can no longer be recreated from its persisted
configuration — the condition that survived weeks unnoticed because nothing
restarted.

---

## 1. Config-loading path per service

These are **not** the same across services. That was proven the hard way.

### middleware

| | |
|---|---|
| PM2 cwd | `/opt/vizora/app/middleware` (cluster, 2 instances) |
| dotenv | `middleware/src/main.ts:6` — `import 'dotenv/config'`, loads `.env` from **cwd** |
| file resolved | `middleware/.env` → **symlink** → `/opt/vizora/app/.env` |
| second layer | `ConfigModule.forRoot({ validate: validateEnv })` — `modules/config/config.module.ts:14` |

**Two independent validators, and they fail at different points:**

1. `main.ts:38` — bare **presence** check for `API_BASE_URL`, `CORS_ORIGIN`,
   `DATABASE_URL`, `JWT_SECRET`, `DEVICE_JWT_SECRET`, `INTERNAL_API_SECRET`.
   `process.exit(1)` on any missing.
2. `modules/config/env.validation.ts` — Zod **fitness** schema. Rejects
   `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` equal to `minioadmin` in production,
   enforces ≥32-char secrets, requires `INTERNAL_API_SECRET` in production.

Both fired during the 2026-08-11 incident, sequentially — fixing the first
revealed the second. **A drift detector must evaluate both**, or it will report
"would start fine" when it would not.

### realtime

| | |
|---|---|
| PM2 cwd | `/opt/vizora/app/realtime` (fork, 1 instance) |
| dotenv | `app/app.module.ts:24` — `ConfigModule.forRoot({ isGlobal: true })`, loads `.env` from **cwd** |
| file resolved | `realtime/.env` → **symlink** → `/opt/vizora/app/.env` |
| fitness validator | **none** — no equivalent of middleware's Zod schema |

> **Latent hazard worth recording separately.** `app.module.ts:31` does
> `JwtModule.register({ secret: process.env.DEVICE_JWT_SECRET })` at *module-definition*
> time — evaluated when the module file is imported, which is **before**
> `ConfigModule.forRoot()` executes. If `DEVICE_JWT_SECRET` ever arrives only via
> dotenv rather than the process env, the JWT module would capture `undefined`
> while everything else sees the correct value. Not today's bug; not B1's job to
> fix; should not be lost.

### web — the one that differs most

| | |
|---|---|
| PM2 cwd | `/opt/vizora/app/web` (fork, 1 instance), `npm start` → `next start -p 3001` |
| dotenv | **none — there is no `web/.env`** |
| runtime env | PM2 stored env only. Observed: exactly 3 vars (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `PORT`, `NODE_ENV`) |
| ecosystem | `env_production` **reads `web/.env.local` at PM2 start** to re-inject `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| runtime config | `next.config.js:81` — `BACKEND_URL ?? 'http://localhost:3000'` (localhost is **correct** here: server-side proxy to middleware) |
| build-time | `NEXT_PUBLIC_*` baked into `.next` at build; runtime values do not affect the served bundle |

**Consequence:** for web, "what a fresh process would consume" is almost entirely
ecosystem + `.env.local`, *not* the shared `.env`. A detector that assumes the
middleware/realtime shape would produce false results for web.

---

## 2. Runtime observation source

Three sources exist and **they disagree** — that disagreement is itself the signal.

| Source | What it is | How |
|---|---|---|
| `/proc/<pid>/environ` | what the process **actually holds** | NUL-separated; requires same-user or root |
| `pm2 jlist` → `pm2_env` | what PM2 **would inject on restart** | precedent: `health-guardian.ts:254` already runs `execSync('pm2 jlist')` |
| `.env` via dotenv | what dotenv **would supply** for keys not already set | parse with the `dotenv` library |

**The three-way disagreement observed on 2026-08-11, on healthy middleware:**

```
pm2_env.DATABASE_URL   present, 152 chars, connection_limit=10, statement_timeout=30000
/proc/<pid>/environ    DATABASE_URL ABSENT  (process got it from dotenv)
.env                   present, 128 chars, connection_limit=30, NO statement_timeout
```

So the running process used the `.env` value, PM2 would have injected a *different*
one on restart, and neither matched the other. **A two-way comparison would have
missed this.** The detector must be three-way.

**No debug endpoint.** Nothing new is exposed over HTTP; all three sources are
local reads.

---

## 3. Fresh-start calculation

Compute what a service would receive **without stopping it**, reproducing real
precedence:

```
effective_fresh = dotenv(.env from service cwd)
                    filled in UNDER
                  (ecosystem env_production  ∪  invoking-shell env)
```

Two rules that must be encoded, both learned from the incident:

- **`process.env` wins; dotenv never overrides an already-set key.** This is why
  correcting `.env` alone did not fix realtime — PM2 kept re-injecting a stale
  `REDIS_URL` and dotenv politely declined.
- **Never bash-source `.env`.** The `DATABASE_URL` line is unquoted and contains
  `&`; `set -a; . ./.env` runs the assignment in a subshell and the variable is
  silently never set. Use the `dotenv` parser — already a dependency and already
  imported by other ops agents.

**Ecosystem parsing caveat:** `ecosystem.config.js` is JavaScript, and web's
`env_production` block *executes* a `.env.local` read when required. Requiring the
file is therefore not side-effect-free. Options: `require()` it in a child process,
or accept the read as benign. Flagged as an open question (§9).

---

## 4. Direct comparison vs fingerprint

**Direct** — safe to compare and print verbatim:

```
API_BASE_URL, APP_URL, WEB_URL, CORS_ORIGIN
DATABASE_URL  → scheme, user, host, port, database, and the query params
                connection_limit / pool_timeout / statement_timeout
REDIS_URL     → scheme, host, port, and whether a password is present
MINIO_ENDPOINT, MINIO_PORT, MINIO_BUCKET, MINIO_USE_SSL
NODE_ENV, PORT, TRUST_PROXY_HOPS
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL, BACKEND_URL
```

**Fingerprint only** — never printed, never persisted in the clear:

```
DATABASE_URL password component
REDIS_URL password component
JWT_SECRET, DEVICE_JWT_SECRET, INTERNAL_API_SECRET
MFA_ENCRYPTION_KEY
MINIO_ACCESS_KEY, MINIO_SECRET_KEY
SMTP_PASS, RAZORPAY_*, OPENAI/ANTHROPIC keys
```

`DATABASE_URL` and `REDIS_URL` are **mixed**: the comparator must decompose each
URL and treat the password component separately from everything else. A whole-URL
fingerprint would report "credentials drifted" for a pool-parameter change, which
is the wrong severity and the wrong remediation.

**Also note the MinIO fallback chain:** `main.ts:223` reads
`MINIO_ACCESS_KEY || AWS_ACCESS_KEY_ID`. The *effective* credential may come from
either variable, so comparing `MINIO_ACCESS_KEY` alone can report a false match or
a false drift. The comparator must model the fallback, not the variable name.

### Fingerprint threat model

A plain unsalted `SHA-256` fingerprint turns this watchdog into an **offline
password-verification oracle**. Anyone who reads `ops-state.json`, a Slack alert,
or a log line can test guesses at zero cost. For low-entropy secrets this is not
theoretical: `sha256("minioadmin")` is a published constant, so a single alert
would confirm the deployment still uses defaults.

**Proposal — per-run ephemeral HMAC key.**

```
key = crypto.randomBytes(32)      // generated per execution, never persisted
fp  = HMAC-SHA256(key, value)     // truncated to 12 hex chars for display
```

Rationale: the detector only ever compares fingerprints **within a single run**
(running vs PM2-stored vs fresh-start). Cross-run stability is not required. An
ephemeral key gives exactly the property needed — equality comparison inside the
run — while making every emitted fingerprint **meaningless to anyone who later
reads it**, including us. There is no key to manage, rotate, or leak.

Rejected alternatives:

- *Unsalted hash* — offline oracle, as above.
- *Persistent on-box HMAC key* (e.g. `/etc/vizora/drift.key`, 0600 root) — works,
  but introduces key management and a file whose compromise re-enables the oracle
  for all historical alerts. Only worth it if cross-run fingerprint comparison is
  ever needed; it is not.
- *Exact length* — leaks meaningfully for short secrets. If length is reported at
  all, bucket it (`<16` / `16–31` / `32+`).

Presence (`set` / `unset`) is safe and is often the whole story — the Redis
password was *absent*, not wrong.

---

## 5. Build-time-only values

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` are compiled into `.next` and
**cannot be observed from a running process's environment**. They were localhost
in `.env` for an unknown period while the served bundle was correct.

Detection therefore requires comparing the **intended** value (`.env`) against the
value **actually baked into the built artifact**:

```
grep the built bundle for the origin, compare to .env's NEXT_PUBLIC_API_URL
```

This is inherently more brittle than env comparison — it depends on the value
appearing as a literal string in the output. Verified feasible: after the
2026-08-12 correction, `grep -ohE "https://(api\.vizora\.io|vizora\.cloud)" dist/assets/*.js`
returned the expected origin from the local build.

Severity should be **WARNING**, not CRITICAL: a stale build-time value breaks the
*next* build, not the running service. That is exactly the distinction that makes
it easy to miss and worth reporting.

---

## 6. Proposed execution location and cadence

**A new ops agent, not a standalone script.** `scripts/ops/config-drift-detector.ts`,
following the shape of the existing seven and reusing:

- `lib/state.ts` — `readOpsState` / `writeOpsState` (file-locked), `makeIncidentId`
  for **dedup**, `recordAgentRun`
- `lib/alerting.ts` — `log`, `sendSlackAlert`, `sendEmailAlert`, `updateDashboard`
- `lib/types.ts` — `Incident` (`id, agent, type, severity, target, targetId, detected`)
  and `AgentResult` (`issuesFound / issuesFixed / issuesEscalated`, `incidents`)

`issuesFixed` will always be **0** by design — this agent never repairs.

**Cadence: hourly** via PM2 `cron_restart`. The check is cheap (local file reads
plus one `pm2 jlist`, no network), and drift is slow-moving. Hourly bounds
discovery at ~1 hour against the weeks it went unnoticed, with dedup preventing
repeat alerts for unchanged drift.

**The watchdog must itself be watched.** Add it to `ops-watchdog`'s monitored-agent
list with a 3× SLA, so the agent going silent is detected — the same dead-man
property the other agents have. This directly answers the proposal's "avoid
creating another checker nobody schedules."

Operational properties: no restart, no config mutation, bounded execution
(timeout on `pm2 jlist`, per the existing `health-guardian` pattern), and its own
failure observable via `ops-watchdog`.

---

## 7. Proposed severity model

| Class | Meaning | Examples from the real incident |
|---|---|---|
| **CRITICAL** | a fresh start would **fail** | missing `API_BASE_URL`; MinIO at `minioadmin` (Zod rejects); credential fingerprint mismatch between running and fresh-start; DB connection budget over `max_connections` |
| **HIGH** | fresh start succeeds but behaves **materially differently** | `CORS_ORIGIN` localhost-only in production; `APP_URL`/`WEB_URL` localhost; running vs persisted endpoint differ |
| **WARNING** | non-fatal difference | pool/tuning drift (`connection_limit`, `pool_timeout`, `statement_timeout`); build-time `NEXT_PUBLIC_*` stale vs the built artifact |

**No class auto-repairs.** Alert only.

The connection-budget check deserves its CRITICAL rating on evidence: computed
`2 × 30 + 30 = 90` against `max_connections = 50` would have taken the API down
harder than the outage that actually occurred.

---

## 8. Concrete tests

Deterministic, no live services — fixtures for `/proc` content, `pm2 jlist` JSON,
and `.env` text.

| # | Case | Expected |
|---|---|---|
| 1 | all three sources agree | healthy, no incident |
| 2 | DB password fingerprint differs running vs fresh-start | CRITICAL |
| 3 | `REDIS_URL` has no password in fresh-start config, running has one | CRITICAL |
| 4 | `API_BASE_URL` absent from fresh-start resolution | CRITICAL (bare-presence validator would exit 1) |
| 5 | MinIO keys equal `minioadmin` | CRITICAL (Zod fitness would reject) |
| 6 | `CORS_ORIGIN`/`APP_URL` contain `localhost` under `NODE_ENV=production` | HIGH |
| 7 | `2 × connection_limit=30 + 30 > max_connections=50` | CRITICAL |
| 8 | `statement_timeout` present in running, absent in fresh-start | WARNING |
| 9 | built bundle origin ≠ `.env` `NEXT_PUBLIC_API_URL` | WARNING |
| 10 | **no raw secret appears in any incident, log line, alert body, or `ops-state.json`** | asserted explicitly |
| 11 | **the agent writes no configuration file** — `.env`, ecosystem and PM2 untouched | asserted explicitly |
| 12 | two consecutive runs with identical drift | one incident, deduped via `makeIncidentId` |
| 13 | `pm2 jlist` unavailable/times out | degrades to a reported failure, does not crash or half-report |
| 14 | `.env` line unquoted with `&` | parsed correctly (regression against the bash-sourcing trap) |
| 15 | ephemeral-key fingerprints differ across two runs for the same value | confirms no persistent oracle |

Tests 10, 11 and 15 are the safety properties; they should fail loudly rather than
being incidental.

---

## 9. Unresolved assumptions — need a decision before coding

1. **Invoking-shell environment.** `effective_fresh` depends on the operator's
   shell at `pm2 start`, which is unknowable in advance. Proposal: model it as
   **empty**, and make the §3 PM2 procedure mandate `env -u …` starts so reality
   matches the model. Otherwise the detector's answer is only valid for one
   specific operator invocation.

2. **`ecosystem.config.js` evaluation.** It is JS, and web's `env_production`
   block reads `web/.env.local` when required. Requiring it in-process is a side
   effect. Child-process evaluation is safer but heavier. Decision needed.

3. **Privilege.** `/proc/<pid>/environ` requires same-user or root. Ops agents run
   under PM2 as root today, so this works — but it means the agent handles raw
   secrets in memory. That is unavoidable for comparison; it strengthens the case
   for ephemeral-key fingerprints and no persistence.

4. **Scope of services.** middleware, realtime, web are in scope. The 7 ops agents
   and the Hermes runtime also read `.env` — out of scope for v1, worth noting.

5. **Build-artifact grep brittleness.** §5's approach depends on the origin
   appearing as a literal in the bundle. Minification currently preserves it;
   a future build change could break the check silently. It should fail as
   "cannot determine", never as "matches".

6. **`max_connections` source.** Reading it requires a DB connection. Either query
   it (adds a dependency and a credential use) or configure the expected value.
   Querying is more truthful; configuring is more isolated. Leaning query, with
   the check skipped-and-reported if the query fails.

---

## What this design deliberately does not do

No auto-repair, no secret persistence, no new HTTP surface, no service restart, no
config mutation. It answers exactly one question on a cadence:

> *If this healthy process died right now, would it come back?*
