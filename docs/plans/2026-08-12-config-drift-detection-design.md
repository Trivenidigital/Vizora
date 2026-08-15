# B1 — Persisted-config / runtime drift detection (design)

**Status: APPROVED FOR IMPLEMENTATION 2026-08-12, with six constraints.**

## 0. Ruling — binding constraints

The design was approved with three corrections and two decisions. All are now
folded into the sections below; recorded here so the constraints are not lost.

| # | Constraint | Where applied |
|---|---|---|
| 1 | Model canonical fresh-start shell env as **empty/minimal** | §3, §9.1 |
| 2 | Query `SHOW max_connections` **read-only at runtime**; never declare the budget healthy when unavailable | §7, §9.6 |
| 3 | Compare secrets **in memory**, emit only `MATCH`/`DRIFT` — **no fingerprints in any output** | §4 |
| 4 | Implement the **verified service-specific precedence model**; `/proc` is *not* effective runtime truth | §2 |
| 5 | **Exclude `NEXT_PUBLIC_*` intent checking from v1** until B2 establishes an authoritative build-input source | §5 |
| 6 | No auto-repair; one focused PR; tests first; no deployment until review | §6, §8 |

The `JwtModule` module-definition-order finding is **out of scope** and tracked
separately in `docs/plans/2026-08-12-realtime-jwt-config-order-finding.md`.

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

## 2. The three views — R, P, Z

> **CORRECTED 2026-08-12 after the first live production cycle.** This section
> previously described views A/B/C and rested on a mechanism claim that the
> first real run disproved. Both the model and the claim are corrected below;
> the superseded reasoning is preserved in §2.1 rather than deleted, because the
> way it failed is the point.

The detector distinguishes **three views that are not interchangeable**:

| View | Name | Definition |
|---|---|---|
| **R** | reconstructed effective runtime | what the application is **actually using** now |
| **P** | PM2-managed restart | what `pm2 restart`/`reload` would reuse from PM2 metadata + config |
| **Z** | canonical zero-state start | empty/minimal shell + ecosystem/config + dotenv, **without** relying on stale PM2 stored env |

```
R  =  resolve( procEnviron ∪ pm2Env , dotenv(.env) )        # PM2 injects in-process
P  =  resolve( pm2Env ∪ ecosystem.env_production , dotenv )  # PM2 metadata survives
Z  =  resolve( ecosystem.env_production , dotenv )           # no PM2 stored env at all
```

**Keeping P and Z distinct is load-bearing.** If PM2's stored env is folded into
the "fresh start" model, the detector can declare the system reproducible while
the zero-state rebuild path is broken — recreating exactly the blind spot it
exists to remove. A variable that lives *only* in PM2's stored env survives a
`pm2 restart` (P matches R) and vanishes from a rebuild (Z does not). Nothing is
called simply "fresh start".

### `/proc` is an observation source, never runtime truth

In PM2 **cluster mode** the exec environment carries almost nothing. Measured on
prod:

| service | exec_mode | `/proc` env keys | `NODE_ENV`/`DATABASE_URL`/`REDIS_URL`/`JWT_SECRET`/`PORT` |
|---|---|---|---|
| middleware | **cluster** | **25** | **all absent** |
| realtime | fork | 74 | present |
| web | fork | 72 | present |

PM2 applies `pm2_env` onto `process.env` **inside the worker after exec**, which
`/proc` cannot see — the same invisibility dotenv has. So **absence from `/proc`
proves nothing about where a value came from.**

### 2.1 Superseded claim — recorded, not deleted

The original design read the 2026-08-11 observation as:

```
pm2_env.DATABASE_URL   present, 152 chars, connection_limit=10, statement_timeout=30000
/proc/<pid>/environ    DATABASE_URL ABSENT  ← "so the process got it from dotenv"
.env                   present, 128 chars, connection_limit=30, NO statement_timeout
```

and concluded that the running middleware was using the `.env` value. **That
inference is unsupported.** In cluster mode *every* application variable is
absent from `/proc`, so absence carries no information about ownership.

What the runtime source of that historical `DATABASE_URL` actually was is
**UNKNOWN** and now unknowable — the process has since restarted, and no
behavioural discriminator between the 152-char and 128-char URLs was captured at
the time. It is deliberately *not* re-attributed to PM2: replacing one
unsupported inference with another would repeat the error.

**The incident outcome stands independently of the mechanism claim.** Production
demonstrably could not be recreated from its persisted configuration; that was
established by the failed rebuild itself, not by this attribution. Only the
explanation of *which layer supplied the running value* was wrong.

This is a §9c post-hoc attribution failure, committed in the document arguing
for §9c discipline: a mechanism was named as cause without verifying the data
path that produced the outcome actually reached it.

### The correction that caught it

First live cycle reported `middleware NODE_ENV: effective=development`. Verified
behaviourally before classifying: Swagger is gated on
`process.env.NODE_ENV !== 'production'` (`main.ts:159`) and returns **404** on
both public and loopback probes, so the running value is `production`. `/proc`
has no `NODE_ENV` and `.env` says `development`, leaving PM2's in-process
injection as the only possible source. The finding was a false positive produced
by treating `/proc` as runtime truth.

### Raw collection sources

| Source | Feeds | How |
|---|---|---|
| `/proc/<pid>/environ` | R (supplementary) | NUL-separated; same-user or root. Degraded-but-usable when unreadable |
| `pm2 jlist` → `pm2_env` | R, P | load-bearing — no view can be built without it |
| `ecosystem.config.js` | P, Z | both `env_production` and the default `env` block |
| `.env` via dotenv | R, P, Z (fills gaps) | the `dotenv` library — never bash |

### Config shadowing — the primary reproducibility signal

Because PM2's stored env feeds both R and P, those two rarely differ. The signal
that actually encodes the hazard is **persisted `.env` disagreeing with R**: the
running value comes from a higher-precedence layer, and any start that does not
apply that layer uses the persisted value instead.

The ecosystem default `env` block is deliberately **not** shadow-checked. It is
the development block by construction on every PM2 app, so comparing it against
a production runtime would fire on every service on every run — the alert
fatigue this detector exists to avoid. Its real hazard, a production start that
omits `--env production`, is a deployment-procedure concern (B2) and appears
only as context on a finding that already fired on its own evidence.

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

### Secret handling — no fingerprints at all

**Ruling constraint 3.** Secrets are compared **in memory** and immediately
discarded. The only thing that ever leaves the comparison is a state token:

```
DATABASE_URL credential component : MATCH | DRIFT | BOTH_ABSENT | ONE_ABSENT
REDIS credential component        : MATCH | DRIFT | BOTH_ABSENT | ONE_ABSENT
MINIO effective credential        : MATCH | DRIFT | BOTH_ABSENT | ONE_ABSENT
```

No hash, no HMAC, no truncated digest, no length, no derived token of any kind
appears in an incident, log line, alert body, or `ops-state.json`.

**Why the earlier ephemeral-HMAC proposal was dropped.** It was a real
improvement over unsalted SHA-256 — which would have made this watchdog an
offline password-verification oracle, since `sha256("minioadmin")` is a published
constant and one alert would have confirmed defaults were still in use. But the
reasoning applies one step further than the draft took it: the detector compares
two in-memory strings **inside a single run**, so it never needs an opaque token
at all. Needing a test that proves "fingerprints differ across runs" was the tell
— it meant fingerprints had become an observable output when nothing required
them to be.

Equality is therefore a direct in-memory comparison, length-safe and
timing-safe, with the operands dropped immediately afterward. Presence
(`set`/`unset`) remains safe to report and is often the whole story — the Redis
password was *absent*, not wrong.

If some future comparison genuinely requires opaque tokens, the ephemeral-key
HMAC remains the right primitive — but it stays **internal**, never emitted.
Rejected for the record: unsalted hashes (offline oracle), a persistent on-box
key (key management plus a file whose compromise retro-enables the oracle across
all historical alerts), and exact length (leaks meaningfully for short secrets).

---

## 5. Build-time-only values — EXCLUDED FROM v1

> **Ruling constraint 5 — `NEXT_PUBLIC_*` intent checking is NOT in B1 v1.**
>
> The reason is explicit, not a deferral of convenience: the investigation proved
> that `.env` is *not* the intended source for these values, and that grepping the
> **SUPERSEDED 2026-08-13 (B2c):** the authoritative record now exists at
> `deploy/web-build-inputs.json`, enforced in CI. The statements below about it
> not existing describe the state at the time of writing.

> bundle by string is ambiguous. There is currently **no authoritative record of
> what the web build was intentionally produced with**. Shipping this dimension
> now would mean inventing that source — and the only two options were a
> permanently noisy warning or a hand-configured expectation that drifts and
> recreates the exact problem this detector exists to catch.
>
> **B2 (canonical deployment procedure) establishes the authoritative build-input
> record.** Once a build manifest states "this web build was produced with X/Y",
> B1 compares the deployed build against that deterministic record instead of
> reverse-engineering minified JavaScript.
>
> v1 scope, stated positively:
>
> ```text
> runtime/fresh-start drift      INCLUDED
> DB / Redis / MinIO             INCLUDED
> production URLs / CORS         INCLUDED
> pool parameters / budget       INCLUDED
> ops-agent credentials          INCLUDED — added 2026-08-15, see below
> NEXT_PUBLIC build-time intent  EXCLUDED — awaiting B2 build manifest
> ```
>
> The detector reports this exclusion explicitly on every run rather than staying
> silent about a dimension it does not cover. Silence would read as "checked and
> fine".

The evidence below is retained because B2 needs it.

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` are compiled into `.next` and
**cannot be observed from a running process's environment**. They were localhost
in `.env` for an unknown period while the served bundle was correct.

Detection therefore requires comparing the **intended build-time** value against
the value **actually baked into the built artifact**.

> **Correction (2026-08-12, verified against the tree).** An earlier draft of this
> section proposed `grep … dist/assets/*.js` and called it verified. That is the
> **Vite** artifact shape — it belongs to `vizora-tv`, not to `web`. Checked:
> `web/dist/` contains exactly one file, a `tsconfig.tsbuildinfo` dated
> **2026-02-25**, and no `assets/` directory at all. The grep would have matched
> nothing, forever, and silently. The real artifact is
> `web/.next/static/chunks/*.js` (dated 2026-08-02).

Three constraints, each established by inspecting the actual build output:

**1. Correct artifact path.**

```
web/.next/static/chunks/*.js        # served bundle
web/dist/                           # stale tsbuildinfo, NOT a build artifact
```

**2. The baseline is NOT `.env`.** Local `.env` holds
`NEXT_PUBLIC_API_URL=http://localhost:3000`, while the built bundle correctly
contains `https://vizora.cloud` — because the documented build procedure
*overrides* `.env` (the prod-URL guard rejects localhost origins at build time).
Comparing bundle-against-`.env` would therefore emit a **WARNING on every
correctly-built deployment**. The comparison baseline must be the intended
build-time value (the build command's env / documented prod origin), never the
runtime `.env`.

**3. A bare origin grep is ambiguous.** The current bundle contains two distinct
origins:

| Origin | Chunks | Source |
|---|---|---|
| `https://vizora.cloud` | 2 | env substitution — the value under test |
| `https://api.vizora.io` | 1 | **hardcoded** in `web/src/app/dashboard/settings/api-keys/page.tsx:321`, a `curl` example rendered for users |

So "grep the bundle for an origin" picks up a documentation string that no env var
controls. The check must test for the *specific expected* origin, and must treat
"zero matches" or "unexpected candidate present" as **cannot determine** — never
as a match, per §9.5.

This remains inherently more brittle than env comparison: it depends on the value
surviving minification as a literal.

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

### Mapping onto the existing ops `Severity` enum

`lib/types.ts` defines `Severity = 'critical' | 'warning' | 'info'` — there is no
`high`. Rather than widen a shared enum every other agent depends on, the drift
class lives in the incident **`type`** and maps onto the framework's three levels:

| Drift class | ops `severity` | `determineSystemStatus` effect |
|---|---|---|
| CRITICAL | `critical` | → `CRITICAL` |
| HIGH | `warning` | → `DEGRADED` |
| WARNING | `info` | no status change; recorded + on dashboard |

This is a deliberate 1:1 mapping that preserves ordering. Pool/tuning drift
landing at `info` is correct: it is recorded and visible without paging anyone,
and `sendSlackAlert` only enumerates `critical` and `warning`.

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
| 9 | ~~build-time `NEXT_PUBLIC_*`~~ | **deferred to B2** — v1 asserts the exclusion is *reported*, not silent |
| 16 | `max_connections` query fails | budget reported `UNKNOWN`, **never healthy** |
| 17 | B is missing a var that C has only via operator shell inheritance | CRITICAL (empty-shell model, §9.1) |
| 18 | `/proc` lacks a var that dotenv supplies | C reconstructs it; **no** false "missing" incident |
| 10 | **no raw secret appears in any incident, log line, alert body, or `ops-state.json`** | asserted explicitly |
| 11 | **the agent writes no configuration file** — `.env`, ecosystem and PM2 untouched | asserted explicitly |
| 12 | two consecutive runs with identical drift | one incident, deduped via `makeIncidentId` |
| 13 | `pm2 jlist` unavailable/times out | degrades to a reported failure, does not crash or half-report |
| 14 | `.env` line unquoted with `&` | parsed correctly (regression against the bash-sourcing trap) |
| 15 | **no fingerprint, hash, or derived token of a secret appears in any output** | asserted explicitly (replaces the dropped "fingerprints differ across runs" test) |

Tests 10, 11 and 15 are the safety properties; they should fail loudly rather than
being incidental.

---

## 9. Unresolved assumptions — need a decision before coding

1. ~~**Invoking-shell environment.**~~ **RESOLVED — modelled as empty (ruling).**
   Predicting arbitrary SSH-shell state is not attempted; the point is
   reproducibility. The invariant B2 must enforce:

   ```text
   Canonical fresh start begins from a defined minimal/empty environment.
   Any required service variable must come from the documented PM2/ecosystem/
   dotenv/config path, not operator shell inheritance.
   ```

   The detector models B with an empty shell, which makes any variable that only
   ever arrived via operator shell inheritance show up as **missing on fresh
   start** — correctly, and loudly.

2. **`ecosystem.config.js` evaluation.** It is JS, and web's `env_production`
   block reads `web/.env.local` when required. Requiring it in-process is a side
   effect. Child-process evaluation is safer but heavier. Decision needed.

3. **Privilege.** `/proc/<pid>/environ` requires same-user or root. Ops agents run
   under PM2 as root today, so this works — but it means the agent handles raw
   secrets in memory. That is unavoidable for comparison; it strengthens the case
   for ephemeral-key fingerprints and no persistence.

4. **Scope of services.** middleware, realtime, web are in scope. The 7 ops agents
   and the Hermes runtime also read `.env` — out of scope for v1, worth noting.

   **PARTIALLY SUPERSEDED 2026-08-15.** The ops agents' *credentials* are now in
   scope as one separate small control — `analyzeOpsAgentCredentialDrift` in
   `lib/config-drift.ts`, wired in `runDetection`, incident scope `ops-agents`.
   Trigger: prod's `/opt/vizora/app/.env` held a VALIDATOR_EMAIL/VALIDATOR_PASSWORD
   pair that 401s while the running agents authenticated fine on a different,
   working pair carried in PM2's stored env — `import 'dotenv/config'` never
   overwrites an already-set variable, so the PM2 values shadowed the file. Same
   config-shadow class as realtime's `PORT`, on a surface the three-service scope
   could not see; a cold start would have FATAL'd all four credentialed agents
   (fleet-manager, schedule-doctor, content-lifecycle, ops-reporter) at once.

   The control samples ONE credentialed agent — the first of `ops-fleet-manager`,
   `ops-schedule-doctor`, `ops-content-lifecycle`, `ops-reporter` whose `pm2_env`
   is readable and agrees across both `pm2 jlist` samples. These are cron apps,
   usually `stopped`, and `pm2_env` is readable without a live pid; requiring both
   samples to agree keeps a read that lands inside a respawn from surfacing as a
   credential incident. Sampling is not pinned to one hardcoded entry, because a
   deleted or renamed app would then emit an `unobservable` finding every hour
   forever.

   Both sides are modelled the same way the service views are:

   ```text
   runtime  PM2 stored env  over  .env at the running agent's pm_cwd
   restart  ecosystem env_production  over  .env at the ecosystem-derived cwd
   ```

   `pm_cwd` is load-bearing: the ops agents load `.env` relative to their cwd, so
   the file the RUNNING agent read is the one `pm_cwd` points at. Using the
   ecosystem-derived cwd for both sides would report MATCH against a file the
   running process never opened. A disagreement between the two cwds is itself a
   finding — the running agents and a restart are reading different files.

   Modelling the restart side as `.env` ALONE would have been the other half of
   the same mistake: `computeZeroState` includes `env_production` for every
   service, and an operator who fixed the drift by adding credentials to the ops
   app's `env_production` block could never clear the finding.

   `analyzeOpsAgentCredentialDrift` receives ONLY the four credential variables
   (`projectOpsCredentialKeys`), never a full environment snapshot. Email and
   password are BOTH treated as secrets; only MATCH/DRIFT verdict tokens reach a
   finding. Anything unobservable — no readable PM2 entry, an unreadable or
   unparseable `.env` — is reported as `info`-severity `ops-credentials-unobservable`
   rather than resolved into a credential verdict, and does NOT mark the scope
   evaluated, so it can never clear a prior finding.

   Blast radius, per agent rather than rounded up: fleet-manager, schedule-doctor
   and content-lifecycle exit FATAL with no credentials; `ops-reporter` warns and
   skips only its dashboard update (`ops-reporter.ts:289`), leaving
   `/dashboard/ops` stale.

   The rest of the ops-agent config surface, and the Hermes runtime, remain out of
   scope.

5. **Build-artifact grep brittleness.** §5's approach depends on the origin
   appearing as a literal in the bundle. Minification currently preserves it;
   a future build change could break the check silently. It should fail as
   "cannot determine", never as "matches". **Now sharpened by evidence** (§5):
   the bundle also contains a hardcoded documentation origin that no env var
   controls, so the check must target the specific expected origin rather than
   "any origin". Still open: where the *intended* build-time value is read from,
   given it is deliberately not `.env`. Candidates — the deploy runbook's build
   command, an explicit `web/.env.build`, or a constant in the detector's own
   config. This is the one input the detector cannot currently derive.

6. ~~**`max_connections` source.**~~ **RESOLVED — live read-only query (ruling).**
   `SHOW max_connections` with a short timeout, using the existing production DB
   identity and no elevated privilege. A configured expected value may exist only
   as a *secondary* comparison, never as the source of truth — it would eventually
   drift and recreate the very problem this detector exists to catch.

   When the query cannot be performed the budget is **never** reported healthy:

   ```text
   DB_CONNECTION_BUDGET = UNKNOWN
   reason = max_connections unavailable
   ```

---

## What this design deliberately does not do

No auto-repair, no secret persistence, no new HTTP surface, no service restart, no
config mutation. It answers exactly one question on a cadence:

> *If this healthy process died right now, would it come back?*
