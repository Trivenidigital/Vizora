# Coordinated full-main production rollout

Written 2026-08-14, unexecuted. This is the agreed procedure for the deferred rollout
that carries Vizora#325 (content-version monotonicity) to production. It exists so the
sequence is not reconstructed from memory or chat when someone finally runs it.

**As of writing: NOT AUTHORISED. Production is at `69e02244`. Do not start.**

---

## Two gates — BOTH required before anything runs

1. **Vizora#328 merged** on exact-head green (the runtime verification harness).
2. **The UI-wave owner has explicitly authorised deploying the current full `main`.**

Gate 2 is not a formality. The delta from `69e02244` is mostly *their* workstream —
44 files under `web/src` plus `organizations.service.ts` — covering theme behaviour,
dialogs, command palette, device-state presentation, toasts and branding defaults.
Deploying it is their call, not this workstream's.

---

## Why FULL main, and not a backend-only deploy

A backend-only deploy was considered and **rejected**. It does not isolate #325:
rebuilding middleware from current `main` already ships unrelated backend behaviour
(`organizations.service.ts`), and it would leave the filesystem describing code that
`vizora-web` is not serving. A later routine web rebuild would then silently publish
the entire UI wave.

That source/runtime mismatch is not worth creating for a defect that is currently
**latent** — no archived/expired content is referenced by any playlist, and zero
layouts exist. No cherry-pick or hotfix lineage either; the operational complexity is
not justified.

---

## THIS IS NOT A TV RELEASE

The server deploy and the TV release are independent. Nothing here produces new client
bytes.

**Do NOT:**
- rebuild the Android APK
- create 1.3.16
- retag `v1.3.15`
- replace `/downloads/vizora-display.apk` with newly built bytes
- run any release publication workflow merely because the server is being deployed

`/tv` and the public APK must remain the already-published **1.3.15 / versionCode
10145** artifact. After the deploy, `/tv` is **verified, not republished** — a
regression check that the release was not disturbed.

---

## Pre-deploy — record before touching anything

| capture | why |
|---|---|
| production `git rev-parse HEAD` (expected `69e02244`) | the rollback point |
| `pm2 jlist` — pid, uptime, restart counters for middleware / realtime / web | so "did it actually reload" is answerable afterwards |
| `grep -c activeContentItemsInclude packages/database/dist/lib/effective-content.js` | expected **4** before |
| `grep -c allContentItemsInclude .../effective-content.js` | expected **0** before |
| `/tv` version + public APK sha256 + byte size | the identity that must NOT change |
| **`bash scripts/deploy-verify.sh > /tmp/deploy-verify.pre.txt 2>&1 \|\| true`** | **the before/after discriminator — see below** |

### Why the deploy-verify baseline is not optional (Vizora#333)

On the 2026-08-14 rollout this step did not exist, and `deploy-verify.sh` came back
with 4 failures afterwards. Deciding whether they were regressions took source
archaeology — comparing the script's blob SHA across both commits and diffing the
modules behind each failing route — to establish they were stale oracle expectations
that had been failing all along.

An operator at 2am will not do that. They will either roll back a good deploy or wave
through a real regression. Capture the baseline, and diff it afterwards:

```sh
# pre-deploy
bash scripts/deploy-verify.sh > /tmp/deploy-verify.pre.txt 2>&1 || true
# post-deploy
bash scripts/deploy-verify.sh > /tmp/deploy-verify.post.txt 2>&1 || true
diff /tmp/deploy-verify.pre.txt /tmp/deploy-verify.post.txt
```

**A check that failed before AND after is not a rollout failure. A check that newly
fails is.** Direct discrimination, no archaeology.

Run it from the repo, not a copy: the readiness parser is resolved relative to the
script's own directory (`$SCRIPT_DIR/ops/readiness-status-parser.mjs`), so a copy run
from `/tmp` reports a spurious `parser_missing` FAILURE that is about the copy, not the
deployment. That exact false alarm was hit while fixing this.

---

## Deploy

Pull the exact authorised `main`, then build and reload as ONE intentional release:

1. `@vizora/database`
2. middleware — build + reload
3. realtime — build + reload
4. **web — build + reload, because the UI wave is being deliberately deployed in the
   same rollout.** Not merely because the checkout moved.

Preserve production configuration; use the guarded production reload procedure.

---

## Post-deploy proof — TWO layers, neither sufficient alone

### Layer 1 — artifact and process

1. Production checkout equals the authorised main commit.
2. Compiled `packages/database/dist/lib/effective-content.js` now contains
   `allContentItemsInclude` and **no longer** contains `activeContentItemsInclude`
   (the discriminator flips 4 → 0 and 0 → 4).
3. **Both `vizora-middleware` and `vizora-realtime` restarted AFTER that compiled file
   was produced** — compare each process start time against the file's mtime.

Step 3 is the one most likely to be skipped and is the whole point of the layering: a
fresh Node process importing the new `dist` says **nothing** about what an
already-running process has cached. Both services consume this shared resolver.

### Layer 2 — behaviour, against the deployed artifact

4. Run the merged harness on the production host:
   `cd /opt/vizora/app && node --import tsx scripts/ops/verify-content-version-monotonic.ts`

   It resolves `@vizora/database` → `/opt/vizora/app/packages/database/dist/index.js`
   (verified: the exports map carries a custom `@vizora/source` condition pointing at
   `src`, but nothing on the host enables it — no `NODE_OPTIONS`, no ecosystem/env
   reference, no pm2 condition). So it exercises the compiled artifact.

5. **All checks PASS.**
6. **The second-connection rollback check proves zero synthetic rows survived.**
   "The callback threw" is not itself proof that nothing was left behind.

### Health and non-disturbance

7. middleware / API / realtime health.
8. Public web routes and referenced assets.
9. `/tv` HTTP 200, still advertising **1.3.15 / 10145**; public APK HTTP 200 with APK
   MIME, sha256 still
   `95D1BC01B47E20BD87456D62FF905512D6030AC829DAB72B17AE7F16C74E2383`, size still
   **1,250,557** bytes.

---

## Only then

Mark `#325 = FIXED / DEPLOYED / RUNTIME VERIFIED`.

**If any gate or runtime check fails: stop and report.** Do not widen the deployment,
and do not rebuild the APK.

---

## Evidence classification — do not blur these

- The harness's local `15/15 PASS` against the fixed resolver and `3 FAIL` against a
  build of `69e02244` prove the harness **discriminates**. They are not evidence about
  production.
- Production correctness begins only when steps 1–9 above have all passed on the host.
- `#325` stays **MERGED / NOT DEPLOYED / HIGH-SEVERITY LATENT** until then. Do not
  claim production is fixed because `main` is fixed.

## Safeguard while deferred

**Do not archive, or set an expiry on, content still referenced by an active
playlist** until this rollout completes. That avoids the known trigger.

Ordinary fleet re-pairing is **not** blocked — re-pairing does not trigger #325.
