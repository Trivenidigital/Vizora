# B2 — Canonical PM2 restart / deploy procedure

**Status: procedure + acceptance criteria. Documentation and one invariant test; no runtime behaviour changed.**

Follows [B1 drift detection](2026-08-12-config-drift-detection-design.md) and the
[2026-08-11 config-reproducibility incident](2026-08-11-production-config-reproducibility-incident.md).

---

## 0. Why this exists

On **2026-08-12 ~17:00 UTC** all three application services were restarted
**without `--env production`**. PM2 therefore applied each app's default `env`
block, which sets `NODE_ENV: 'development'`. Production ran in development mode
for roughly ten minutes:

| Consequence | Mechanism |
|---|---|
| Swagger publicly reachable at `/api/v1/docs` | gated on `NODE_ENV !== 'production'` (`middleware/src/main.ts:159`) |
| middleware presence validator skipped | gated on `NODE_ENV === 'production'` (`main.ts:37`) |
| Zod production checks skipped (MinIO defaults, `INTERNAL_API_SECRET`) | `superRefine` runs only when `NODE_ENV === 'production'` |
| realtime presence check + `CORS_ORIGIN` requirement skipped | `realtime/src/main.ts:12`, `:39` |
| rate limits at the dev tier | 100× relaxed in dev |

Nothing in the deploy path prevented it, and nothing detected it except B1 —
which flagged it within seconds but was itself not yet enabled on a schedule.

**The `.env` edit that accompanied it was correct and is not the fault.** The
fault is that a restart can silently select the development environment.

---

## 1. Canonical commands

These are the only production-mutating PM2 commands. All select
`--env production` explicitly.

```bash
cd /opt/vizora/app

# Reload everything after a code deploy (graceful, cluster-aware)
pm2 reload ecosystem.config.js --env production

# Start from zero (fresh box, or after `pm2 delete all`)
pm2 start ecosystem.config.js --env production

# Persist the process list so it survives a reboot
pm2 save
```

### Rules

1. **Never** run `pm2 restart <app>`, `pm2 reload all`, or `pm2 restart all`
   for application services. Those reuse PM2's stored env and do **not**
   re-read the ecosystem file — the outcome depends on how the process was
   last started, which is exactly the ambiguity B1 exists to detect.
2. **Never** pass `--update-env` unless deliberately re-reading the invoking
   shell's environment. It changes which layer wins.
3. `--env production` is required even when it looks redundant. PM2 selects the
   `env` block by default; the flag is the only thing that selects
   `env_production`.
4. Any variable a service needs in production must come from
   ecosystem / dotenv / config — **never** from operator shell inheritance.
   B1 models the fresh-start shell as empty precisely so that a shell-inherited
   variable surfaces as missing.

### Post-command verification (mandatory)

A reload is not complete until these pass:

```bash
# 1. Every app service is in production mode
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  JSON.parse(d).filter(p=>p.name.startsWith("vizora-"))
    .forEach(p=>console.log(p.name, p.pm2_env.NODE_ENV, p.pm2_env.status))})'

# 2. The dev-only surface is closed  → MUST be 404
curl -s -o /dev/null -w "%{http_code}\n" https://vizora.cloud/api/v1/docs

# 3. Health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://vizora.cloud/

# 4. Restart counters stop moving (sample twice, ~45s apart)
```

`/api/v1/docs` returning **200** is the single cheapest tell that a restart
selected the wrong environment. Check it every time.

---

## 2. `env_production` coverage — acceptance criterion

> Every app included in the canonical production reload must either define
> `env_production`, or be explicitly documented and tested as intentionally
> using its default `env` block.

Enforced by `scripts/ops/ecosystem-env-coverage.test.ts`, which fails CI when an
app has neither.

### Current state — 18 apps

| Group | Count | Posture |
|---|---|---|
| declares `env_production` with `NODE_ENV=production` | 15 | ✅ |
| documented as intentionally default-env | 3 | ✅ (below) |
| undecided | **0** | — |

### The three exemptions, with evidence

All three read their own configuration and never consult PM2-injected
`NODE_ENV`:

| App | Why the default block is correct |
|---|---|
| `hermes-vizora-customer-lifecycle` | runs `run-hermes-skill.sh`, which reads `/opt/vizora/app/.env` directly |
| `hermes-vizora-support-triage` | same runner |
| `hermes-insights-poller` | tsx script using `import 'dotenv/config'`; reads only `MIDDLEWARE_URL` / `INTERNAL_API_SECRET` |

`scripts/agents/hermes/run-hermes-skill.sh:51` states it outright — *"PM2
doesn't auto-source .env files"* — and reads keys with `grep`/`cut` rather than
`source`, because values contain shell-special characters. That is the same
unquoted-`&`-in-`DATABASE_URL` trap B1 documented: `set -a; . ./.env` silently
fails to set the variable.

### Why they are not simply given an `env_production` block

Because they would not use it, and a block that has no effect is worse than an
honest exemption: the next person reads it as meaningful configuration.

**However** — see §4. Their absence makes the canonical reload print warnings,
and that has its own cost.

---

## 3. Reading the reload output

`pm2 reload ecosystem.config.js --env production` currently prints, three times:

```
[PM2][WARN] Environment [production] is not defined in process file
```

These are the three exempted Hermes apps. They are benign **and that is the
problem**: a canonical production command that routinely prints known-benign
warnings teaches operators to skim past warnings, so a warning that matters
lands in a channel nobody trusts. It is the same shape as `Vacuum: 0 OK, 7
failed` running daily unnoticed for months.

**Open decision (not made here):** give the three apps an explicit
`env_production: {}` — no behaviour change, since they read `.env` themselves —
purely so the canonical command produces clean output and any future warning is
genuinely anomalous. The counter-argument is that an empty block looks like
configuration and invites someone to "fill it in". Recorded rather than decided,
because it trades one legibility failure for another and deserves an explicit
call.

---

## 4. What this does NOT cover

- **Enforcement.** Nothing prevents someone from typing `pm2 restart all`. The
  invariant test covers ecosystem *coverage*, not command *usage*. A real guard
  would be a deploy wrapper script that refuses to run without `--env
  production`; that is a code change, deliberately out of scope here.
- **The web build inputs.** `NEXT_PUBLIC_*` are baked at build time and are not
  a PM2 concern. B1 explicitly deferred intent-checking to a build manifest that
  B2 was expected to establish — **this document does not establish it.** It
  remains open, and B1's build-time dimension stays excluded until it exists.
- **Operator attribution.** The 2026-08-12 restart was performed by an
  unidentified second agent session. That is tracked separately; no procedure
  document prevents an uncoordinated actor.

---

## 5. Acceptance

```text
canonical commands documented and always select --env production   DONE
post-reload verification steps, including the /api/v1/docs tell     DONE
env_production coverage invariant enforced in CI                    DONE (5 tests)
three Hermes apps reviewed with evidence, not silently accepted     DONE
deploy-wrapper enforcement                                          NOT DONE (out of scope)
build-input manifest for NEXT_PUBLIC_*                              NOT DONE (still open)
```
