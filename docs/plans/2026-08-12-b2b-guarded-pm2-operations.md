# B2b — Guarded PM2 application operations

**Status: guard implemented + tested. NOT yet used against production.**

Follows [B2a, the canonical PM2 procedure](2026-08-12-b2-canonical-pm2-procedure.md).
B2a documented the right command; nothing enforced it. This is the enforcement.

---

## 1. What it prevents

One command on 2026-08-12 produced three distinct unintended effects, none of
them visible in the command text:

```bash
pm2 reload ecosystem.config.js --env production
```

| Effect | Intended? |
|---|---|
| reloaded `vizora-middleware`, `vizora-realtime`, `vizora-web` | yes |
| **started `ops-db-maintainer`** — which ran a real VACUUM on production | no |
| **re-registered `ops-config-drift-detector`** — a cron entry deliberately `pm2 delete`d an hour earlier | no |

Earlier the same hour, the same command **without** `--env production` applied
each app's default `env` block (`NODE_ENV: 'development'`) and put production
into development mode: both middleware boot validators skipped, realtime's
presence check and `CORS_ORIGIN` requirement skipped, rate limits at the dev
tier, and Swagger publicly reachable at `/api/v1/docs`.

Two properties follow directly:

1. **The resolved target set must be printed and validated before mutation**, so
   "what will this touch?" is answered deterministically rather than discovered
   afterwards.
2. **PM2 must be invoked by explicit service names.** Passing the ecosystem file
   is precisely what lets PM2 decide to start entries that merely exist in it.

---

## 2. Usage

```bash
# Prove what would happen — resolves, classifies, validates, invokes nothing
npx tsx scripts/ops/pm2-guard.ts app-reload --env production --dry-run

# Perform it
npx tsx scripts/ops/pm2-guard.ts app-reload --env production

# Start services that are genuinely not registered (a DIFFERENT operation)
npx tsx scripts/ops/pm2-guard.ts app-start --env production
```

Exit codes: `0` pass (mutated, or dry run) · `1` refused · `2` could not
evaluate — and "could not evaluate" never mutates.

Sample output:

```text
requested operation: app-reload
environment: production

resolved targets:
  vizora-middleware  app-service       registered
  vizora-realtime    app-service       registered
  vizora-web         app-service       registered

allowed class: app-service
unexpected targets: none

VERDICT: PASS
invoking by explicit name: vizora-middleware vizora-realtime vizora-web
```

---

## 3. Acceptance matrix

| Condition | Verdict |
|---|---|
| environment is not `production` | **REFUSE** |
| resolved target outside `app-service` | **REFUSE** |
| an expected `app-service` is absent from PM2 | **REFUSE** — use `app-start` |
| a target registered in PM2 but absent from `ecosystem.config.js` | **REFUSE** |
| any app in the ecosystem is unclassified | **REFUSE** |
| a declared class contradicts the config's structure | **REFUSE** |
| empty target set | **REFUSE** |
| exact registered `app-service` set, in production | **ALLOW** |
| `--dry-run` | every step except the PM2 mutation |

A refused decision exposes **no** invocable names, so the CLI physically cannot
mutate on a refusal path.

**A missing service is a refusal, not an implicit start.** "One expected service
is absent" is a genuinely different situation that deserves a human decision,
not a side effect folded into a routine deploy — that is how a deliberately
deleted cron entry came back.

---

## 4. Classification is declared, not inferred

`deploy/pm2-app-classes.json` assigns every app an operation class. Inferring
from `ops-*` / `hermes-*` prefixes was rejected: a convention that controls a
production mutation is one rename away from being wrong, and a stale hand-copied
constant is exactly what caused the health-guardian churn found the same day.

| Class | Count | Meaning |
|---|---|---|
| `app-service` | 3 | long-running HTTP/WS service — the only class a deploy may reload |
| `ops-cron` | 8 | `scripts/ops/*` autonomous operations agents |
| `agent-cron` | 2 | `scripts/agents/*` business agents |
| `hermes-cron` | 3 | Hermes runtime skills + poller |
| `maintenance-cron` | 2 | scheduled data/monitoring jobs |

Three tests keep it honest:

- **exact coverage** — every ecosystem app is classified, and the manifest holds
  nothing extra. Adding an app without classifying it fails CI, and the guard
  refuses to operate while any app is unclassified.
- **structural consistency** — a declared `app-service` must have no
  `cron_restart`; every `*-cron` class must have one. This catches a mislabelled
  entry, e.g. `ops-db-maintainer` declared as `app-service`.
- **real-ecosystem resolution** — against the actual config, `app-reload`
  resolves exactly the three services and excludes all 15 cron entries.

---

## 5. Enforcement boundary — stated plainly

This guards the **cooperative deployment path**.

Root, or any non-interactive agent, can still call `pm2` directly and bypass it
entirely — which is exactly what happened on 2026-08-12, by an actor that also
bypassed PR review. **B1 (`config-drift-detector`) is the detection backstop**
for that case; it caught the resulting dev-mode regression within seconds of it
being introduced.

A shell alias was considered and **rejected as a control**: it does not apply to
non-interactive shells, which is what an agent uses, so it would have done
nothing against the one bypass actually observed — while making the guard look
stronger than it is. Aliases may exist for convenience; they are not the
boundary.

Making this a real boundary would mean host permissions or command access
restrictions. That is a materially larger control-plane project and a separate
decision.

---

## 6. Not covered

- **`pm2 save` / dump-file state.** The guard does not manage which processes
  survive a reboot.
- **Non-app operations.** Restarting a single ops agent deliberately is still
  raw `pm2`; only the application deploy path is guarded.
- **The B2c build-input manifest** for `NEXT_PUBLIC_*` remains open. B1's
  build-time dimension stays excluded until it exists.
