# Vizora — Production-Readiness Audit (2026-07-06)

Six-dimension audit (correctness, robustness, test coverage, architecture/drift,
dependencies, performance). Every finding cites file:line and was read from the
actual code. Load-bearing S1/S2 claims were independently re-verified by the
synthesizer (marked **✓ verified by synth**); others were verified by the
dimension auditor against cited file:line (**✓ auditor-cited**); genuinely
uncertain items are in **§UNVERIFIED**.

**Headline:** No confirmed live data-leak or in-flight data-loss bug. The real
exposure is (1) a large, un-gated dependency-CVE backlog including a *critical*
injection in the customer-template render path, (2) both multi-tenant safety
nets (DB guard + CI isolation tests) simultaneously down, and (3) several
success paths that return 200 while a downstream write is silently dropped.

---

## S1 — Breaks production / data loss / unrecoverable / security-critical

### S1-1 — Multi-tenant isolation has neither an active DB backstop nor a CI regression gate
**✓ verified by synth** (`database.service.ts:15-17,57`, `ci.yml:178`, `middleware/jest.config.js:29`)
- **What:** The Prisma `$use` cross-tenant-write guard is a **no-op in production** — `tenantGuardMode` defaults to `'off'` when `NODE_ENV==='production'` (`database.service.ts:15-17`) and `registerTenantGuard()` returns early in that mode (`:57`). Independently, the only e2e specs that assert real cross-org isolation (`test/tenant-guard.e2e-spec.ts`, `test/b12-multi-tenant-revocation.e2e-spec.ts`, plus `content/displays/playlists.e2e-spec.ts`) are **excluded from CI** by `--testPathPattern="(agents|customer-critical-path)"` (`ci.yml:178`). All middleware unit tests run against a mocked Prisma (`jest.config.js:29`), so **no CI-gated test ever executes a tenant-scoped query against a database.**
- **Why it matters:** Cross-tenant leakage is the highest-blast-radius bug class for a multi-tenant SaaS. Primary isolation today is compound-`WHERE org` clauses at the service layer (so this is *latent*, not a confirmed live leak) — but a single new or refactored endpoint that forgets its org filter has **neither** a test that would catch it **nor** a DB-level backstop to stop it. Both defenses are down at once. `TENANT_GUARD_MODE` is also undocumented in CLAUDE.md and `.env.example`, so this posture is invisible to operators.
- **Fix:** (a) Add `tenant-guard|b12-multi-tenant-revocation` to the CI e2e `--testPathPattern` — the specs already exist and run against the CI Postgres service (one-line change). (b) Move the DB guard from `off`→`log` in prod, review the logged cross-tenant hits, then `enforce`. (c) Document `TENANT_GUARD_MODE` + current prod default.
- **Status 2026-07-07:** (a) DONE on `fix/audit-s1-production-readiness` — both specs now gated AND verified passing (14/14). Implementing this surfaced a pre-existing test-infra bug the exclusion was hiding: b12's revocation leg 429'd because all in-process supertest calls share the `127.0.0.1` IP-keyed throttle bucket for `/devices/auth/check`; fixed with a scoped `ThrottlerStorage` override in b12's test module. (b)+(c) still OWED — the gated DB-guard flip. **Caveat worth stating:** `tenant-guard.e2e-spec.ts` runs in `log` mode (NODE_ENV=test), so it proves the `$use` hook *detects* tenant context and is ALS-wired — it does NOT prove *enforcement/blocking*. As a regression gate it catches "the hook stopped seeing tenant context"; it would NOT catch "enforcement silently left in warn/log-mode in prod." That gap is exactly what the off→log→enforce flip closes.

### S1-2 — Critical Handlebars injection CVE sits in the customer-template render path that the sanitizer deliberately skips
**✓ verified by synth** (`middleware/package.json:126`, `web/package.json:27`; live `pnpm audit`)
- **What:** `handlebars` is pinned `^4.7.8` and resolves to **4.7.8 — the last version vulnerable** to "JavaScript Injection via AST Type Confusion" (CRITICAL, patched `>=4.7.9`), plus 3 high + 2 moderate advisories in the same range. Vizora renders content templates through Handlebars, and the global SanitizeInterceptor **intentionally skips** `templateHtml`/`htmlContent`/`customCss`/`renderedHtml` (`sanitize.interceptor.ts:35`).
- **Why it matters:** The CVE's attacker profile is *whoever controls the template source* — i.e. an authenticated org template author. Their input is both unsanitized (by design) and fed to a vulnerable engine → server-side JS injection.
- **Fix:** `pnpm update handlebars` (the `^4.7.8` range already permits 4.7.9) and commit the lockfile; confirm no override pins it lower.

### S1-3 — The dependency security gate is wired to never fail; behind it, 4 critical + 72 high CVEs
**✓ verified by synth** (`ci.yml:237-239`, `security-audit.yml:19-21`; live `pnpm audit` = **204 vulns: 4 critical / 72 high / 109 moderate / 19 low**)
- **What:** Both the CI `security` job step and the dedicated weekly `security-audit.yml` run `pnpm audit --audit-level=high` under `continue-on-error: true`, so neither can ever fail a build. With the gate dead, `pnpm update` stopped happening and the tree accumulated the counts above. The directly-reachable, runtime-facing ones:
  - **axios `^1.13.6`** (root:94, middleware:114, realtime:110) — 10+ HIGH: full-MITM via prototype pollution, Proxy-Authorization credential leak to redirect target, NO_PROXY/SSRF bypass. Patched `>=1.16.0` (caret already allows). Server-side outbound client for Google auth, weather, payment providers, ops agents hitting internal URLs.
  - **next `~16.1.6`** (web:29) — HIGH App-Router middleware/proxy bypass (patched `>=16.2.6`), App-Router SSRF (`>=16.2.5`), null-origin Server-Action CSRF bypass (`>=16.1.7`). The `~` pin blocks even the 16.2.x patch line. Auth is cookie/CSRF-based → these are auth-boundary failures.
  - **multer `2.1.1`** exact (middleware:132) — HIGH DoS via deeply-nested field names, patched `>=2.2.0`. The **exact** pin blocks the fix on the file-upload path.
  - **mongoose `^9.1.5`** (middleware:131) — HIGH NoSQL injection via `$nor` `sanitizeFilter` bypass, patched `>=9.1.6`.
  - **nodemailer `^8.0.1`** (root:72, middleware:133) — HIGH raw-option bypass of `disableFileAccess`/`disableUrlAccess` → arbitrary file read + SSRF (patched `>=9.0.1`); 8.x CRLF-injection + bad TLS-cert validation patched `8.0.9`. Sends real prod email.
- **Why it matters:** This is the root cause of the whole dependency picture — a check that "runs" but is structurally incapable of failing (the exact Class-1 silent-failure pattern this repo's own CLAUDE.md §12a warns about).
- **Fix:** Remove `continue-on-error: true` from `security-audit.yml` so it hard-fails on `high`; run `pnpm update` to clear caret-range CVEs (axios/mongoose/handlebars/nodemailer-8.x); unpin `multer`→`^2.2.0` and drop the stale `multer@<2.1.1` override; bump `next`→`~16.2.6`; re-baseline.
- **Status 2026-07-07 (DONE on `fix/audit-s1-production-readiness`, reviewed):** dep bumps + 13 transitive overrides + nodemailer 8→9 landed; `pnpm audit --prod` high/critical **19→0**; `continue-on-error` dropped in both workflows; blocking gate = `pnpm audit --prod --audit-level=high --ignore-unfixable` (exits 0 today, green-by-fixing). Gate-structure review (independent) confirmed the old `--audit-level=high` was red only on **dev/build tooling** (piscina RCE via @swc/cli, vitest, webpack-dev-server) — `--prod` legitimately scopes those out without hiding prod risk. **Two accepted fail-open valves, recorded with eyes open:** (1) `--ignore-unfixable` silently passes a *true-unfixable* prod high (no released patch) — correct response there is remove/override/workaround, but the blocking signal is suppressed; a non-blocking weekly full `pnpm audit` keeps it visible. (2) `--ignore-registry-errors` is kept ONLY on the scheduled `security-audit.yml` (avoid false 6am alarms); the `ci.yml` PR gate deliberately omits it so it fails **closed** on a registry error. **Load-bearing residual (NOT closed by this PR):** `main` has no branch protection (`gh api …/protection` → 404, `…/rulesets` → `[]`), so the `security`/`build`/`test` jobs are not required checks — the gate is **advisory until branch protection marks them required**. This is a repo-settings decision for the maintainer.

### S1-4 — Electron 28 (EOL) ships to always-on customer kiosks with unpatchable HIGH use-after-free CVEs
**✓ verified by synth** (`display/package.json:87`, root `package.json:70`)
- **What:** `electron ^28.3.3` — Electron 28 (Dec 2023) is **end-of-life; no security backports**. Advisories flag `<38.8.6`/`<39.8.1` for multiple HIGH use-after-free (offscreen paint, WebContents fullscreen, PowerMonitor) and renderer command-line-switch injection. Nothing on the 28 line will ever be patched.
- **Why it matters:** The packaged display client runs on always-on kiosks with OS auto-start — the highest-dwell-time attack surface in the fleet — and cannot be fixed by a version bump within range.
- **Fix:** Plan an Electron major upgrade (28 → 39.x) with migration + real-device walkthrough. Track as a hard blocker for the display client, decoupled from the web/middleware bumps.

---

## S2 — Serious; degrades reliability or produces operator-invisible drift

### S2-1 — Ops shared-state lock: held across network I/O, "proceeds without lock" on timeout, and release steals other agents' locks → silent corruption of the monitoring layer
**✓ verified by synth** (`scripts/ops/lib/state.ts:47-76,118-163`, `fleet-manager.ts:158,214`, `health-guardian.ts:39` + restart-cooldown)
- **What:** Three compounding defects in the `logs/ops-state.json` file lock shared by 7 PM2 cron agents:
  1. `readOpsState()` acquires the lock (`state.ts:119`) and holds it until the paired `writeOpsState()`. Agents do their **entire run inside that window**, including network I/O: `fleet-manager.ts:214` `await api.post('/displays/ping', …)` runs per-offline-display under the lock; health-guardian sleeps `RESTART_COOLDOWN_MS = 30_000` under it. So the lock is routinely held far longer than `LOCK_TIMEOUT_MS = 5_000`.
  2. On timeout `acquireLock()` does **not throw** — it falls through and "proceed[s] without lock" (`state.ts:71`). The caller then does a full read-modify-write with no mutual exclusion.
  3. `releaseLock()` does an unconditional `unlinkSync(LOCK_FILE)` with **no ownership check** (`:74-76`), so a timed-out-and-proceeded agent deletes a lock another agent legitimately holds.
  - Plus: `writeOpsState` uses non-atomic `writeFileSync` (`:159`); a crash mid-write leaves truncated JSON; the next `readOpsState` catches the `JSON.parse` throw and returns `emptyState()` (`:133-135`) **while still holding the lock for a write** → the subsequent write **wipes all incidents/remediations and resets `systemStatus` to HEALTHY**.
- **Why it matters:** Cron aligns multiple agents at `:00`. When one holds the lock across I/O (guaranteed when a service is down: 30s cooldown; common when several displays are offline: N sequential pings), the others time out at 5s and interleave lock-less writes → last-writer-wins loses incidents, and a torn read → HEALTHY-reset masks open critical incidents for ~1 cron cycle and permanently loses the remediation audit trail. This is exactly the silent-failure class the ops layer exists to detect — occurring inside its own state store. (Not customer data → S2, not S1, but it defeats the mechanism that would surface every other silent failure.)
- **Fix:** Restructure agents to do detection I/O **first** with no lock, then acquire→read→merge→write→release in a tight CPU-only window. In `state.ts`: `acquireLock()` should **throw/skip the run** on timeout, not proceed lock-less; `releaseLock()` should write a unique token/PID into the lock file and only unlink if it still matches (compare-then-delete); `writeOpsState` should write `.tmp`+`renameSync` (atomic); on parse failure, rename to `.corrupt-<ts>` and alert instead of silently substituting `emptyState()`. Add a `state.test.ts` (currently zero coverage).

### S2-2 — Redis outage takes the entire device fleet offline; the "Postgres fallback" the design implies does not exist on the connect path
**✓ auditor-cited** (`device.gateway.ts:1030,1041,1406`, `redis.service.ts:101-105`, offline scanner `displays.service.ts:304-331`)
- **What:** `setupDeviceRooms` awaits `redisService.setDeviceStatus()` **before** the DB write (`device.gateway.ts:1030` → `:1041`), not wrapped in try/catch. `setDeviceStatus`'s `redis.setex` (`redis.service.ts:104`) has no error handling. On a Redis outage the throw propagates to the `handleConnection` catch → `client.disconnect()`; the device never joins rooms, never gets its playlist, and the DB `status='online'` write at `:1041` is never reached. `handleHeartbeat` does the same Redis-first call (`:1406`) and on failure skips the DB `lastHeartbeat` refresh.
- **Why it matters:** No device can connect/reconnect while Redis is down, though Postgres is healthy. For already-connected devices, the skipped heartbeat refresh means after 2 min the offline scanner marks the **entire live fleet offline** and fires a `device.offline` event (and possibly mass offline emails) per device — a fleet-wide false-offline storm from a Redis blip. The architecture doc treats Redis as a "fast-read cache," but it is a hard dependency on the connect path.
- **Fix:** Wrap the `setDeviceStatus` calls in `setupDeviceRooms` and `handleHeartbeat` in try/catch that logs and continues to the DB write (the DB write already tolerates its own failure at `:1049`) — make Redis symmetric so Postgres is the real fallback.

### S2-3 — Playlist assignment returns 200 while the live push is silently dropped
**✓ auditor-cited** (`playlists.service.ts:271,520-572`)
- **What:** Playlist assignment writes the DB then fire-and-forgets `notifyDisplaysOfPlaylistUpdate` (`.catch(err=>log)` at `:271`). Inside, the per-display POST to realtime runs through `circuitBreaker.executeWithFallback`; on failure/open-circuit the fallback **only logs** (`:557-567`). No retry, and nothing is enqueued into the Redis pending-playlist queue (that queue is populated by the gateway on the offline path, not by middleware on push failure). The REST call returns 200 regardless of push outcome.
- **Why it matters:** A transient push failure to a *still-connected* device (circuit open, 5s timeout, brief realtime-unhealthy window where the socket survives) leaves that display on the OLD content indefinitely — the operator believes it's live. Whole-realtime-down self-heals via socket-drop→reconnect→`sendInitialState`; a transient push failure to a connected device does **not** self-heal. Operator-invisible content drift.
- **Fix:** On push failure to a device middleware believes is connected, enqueue into the same Redis `setPendingPlaylist` queue the gateway drains on reconnect, or emit a `playlist_push_failed` metric/alert. Don't let 200 imply delivery.

### S2-4 — Upload crash between MinIO write and DB insert leaks storage quota permanently
**✓ auditor-cited** (`content.controller.ts:144-170,188-201`, `storage-quota.service.ts:65-74,131-133`)
- **What:** Order is `reserveQuota` (commits `storageUsedBytes += size` via atomic conditional UPDATE, `:69-74`) → `uploadToMinio` (`controller:144`) → `contentService.create` (DB row, `:163`). The catch (`:188-201`) deletes the object and releases quota **only if the process survives**. A crash/OOM (512 MB PM2 limit) after `:144` and before `:163` kills the catch.
- **Why it matters:** The reservation is a committed Postgres write, so leaked bytes persist across restart. The orphaned MinIO object is invisible to the content-lifecycle agent (it scans orphaned Content *rows*, not objects with no row). Repeated crash-during-upload monotonically inflates `storageUsedBytes` until `reserveQuota`'s `<= storageQuotaBytes` guard rejects **all** uploads for that org, with no visible cause and no scanner that recomputes real usage.
- **Fix:** Add a reconciliation job (extend content-lifecycle) that recomputes `storageUsedBytes` from Content rows via the existing `setUsage` path and prunes objectless MinIO objects. Or reserve quota in Redis with a TTL so abandoned reservations self-expire.

### S2-5 — Billing webhook: orphaned `pending` claim returns 200 on PSP retry → silent event loss after a crash mid-processing
**✓ auditor-cited** (`billing.service.ts:592-703`, `webhooks.controller.ts` `@HttpCode(OK)`)
- **What:** `claimWebhookEvent` sets `pending` with `SET NX EX 300` (`:602-608`). If the process is hard-killed between claiming and `completeWebhookEvent`, the key is orphaned as `pending`. On PSP retry, `claimWebhookEvent` returns `'duplicate'` → `{ received: true }` → HTTP 200, which tells the PSP the event was delivered, so it stops retrying. A *caught* error is fine (it releases the claim + rethrows → non-2xx → clean retry); only a hard crash is exposed, and only if the retry lands inside the 300s pending window (PSPs frequently retry within minutes).
- **Why it matters:** A crash during `handleCheckoutCompleted`/`handleSubscriptionUpdated` can permanently drop a subscription activation or cancellation — a money-path event silently lost.
- **Fix:** On the `duplicate` branch, `GET` the value and distinguish `pending` from `completed`: return non-2xx (409/503) when `pending` so the PSP keeps retrying; 200 only when `completed`.

### S2-6 — Billing `mapSubscriptionStatus` fails **open to `active`** on missing/unmapped status
**✓ auditor-cited** (`billing.service.ts:764,987-1015`)
- **What:** `handleSubscriptionUpdated` computes `status = mapSubscriptionStatus(provider, data.status || data.subscription?.status)`. If both are `undefined` (parse-shape mismatch) or the value isn't in the map (Stripe `paused`, any unrecognized Razorpay state), the function returns `statusMap[x] || 'active'` → **`'active'`** (`:1001,:1013`), written to the org's `subscriptionStatus`.
- **Why it matters:** A non-paying/paused subscription can be silently flipped to `active`, restoring entitlement — a fail-open on a money-adjacent field. Narrow trigger, wrong default direction.
- **Fix:** Default the fallthrough to a safe state (`'past_due'`/skip the update); never coerce unknown → most-permissive.

### S2-7 — `McpAuditLog` grows unbounded — no retention job and no `createdAt` index
**✓ auditor-cited** (`mcp.service.ts:233,248`, `schema.prisma:934-966`, `data-retention.service.ts:37-83`)
- **What:** Every MCP tool call writes one `mcp_audit_log` row (success and error). `DataRetentionService` prunes `auditLog`/`notification`/`passwordResetToken` but **never `mcpAuditLog`**; no other pruner touches it. Its four indexes all lead with `tokenId`/`agentName`/`organizationId`, so a future `deleteMany({where:{createdAt:{lt}}})` sweep would full-table-scan. `AdminAuditLog` is similarly unpruned (lower volume).
- **Why it matters:** Hermes agents already drive MCP tool calls on cron (~15/30 min), each firing multiple calls → order 1k rows/day today, and the roadmap opens MCP to customer integrations (no natural ceiling). Class-1 silent-growth surface shipped without the freshness SLO + prune CLAUDE.md §12a mandates.
- **Fix:** Add an `mcpAuditLog.deleteMany({where:{createdAt:{lt: ninetyDaysAgo}}})` block to `runRetentionPolicy()` (mirror the auditLog block, ~8 lines) + `@@index([createdAt])` on `McpAuditLog` (and `AdminAuditLog`).

### S2-8 — Config "source of truth" is fragmented across three disagreeing inventories; ~72 read vars are undocumented and unvalidated
**✓ auditor-cited** (`.env.example`, `env.validation.ts:3-100`, `config.module.ts:16`)
- **What:** CLAUDE.md declares `.env.example` canonical, but the boot-time Zod schema validates only ~18 vars while code reads ~90. Absent from `.env.example` despite being read: the entire SMTP block (code reads both `SMTP_PASS` and `SMTP_PASSWORD`), `OPS_EMAIL/OPS_PASSWORD/OPS_ALERT_EMAIL`, `REALTIME_URL/WEB_URL/MIDDLEWARE_URL/FRONTEND_URL/APP_URL`, `LIFECYCLE_LIVE/LIFECYCLE_TEST_EMAILS`, `AWS_*`, `BCRYPT_ROUNDS`, `TENANT_GUARD_MODE`, `BILLING_VALIDATION_STRICT`, all billing secrets, and more.
- **Why it matters:** An operator provisioning prod from `.env.example` silently omits SMTP/ops/agent/billing config; the "validates on startup" guarantee covers only ~18 vars, so a missing `SMTP_HOST`/`RAZORPAY_KEY_ID` boots clean and fails at first use (quiet email dry-runs, alerts to the wrong mailbox).
- **Fix:** Reconcile `.env.example` against the actual `process.env`/`configService.get()` read set; add the SMTP/ops/agent/billing blocks; or drop the "source of truth for *every* var" wording.

### S2-9 — Stripe is a fully-wired payment provider that no doc mentions
**✓ verified by synth** (`middleware/package.json:143` `stripe ^20.3.1`; auditor-cited `stripe.provider.ts:33,43`, `main.ts:47-50`, `csrf.middleware.ts:83`)
- **What:** CLAUDE.md Billing lists only Razorpay vars; `.env.example` has **no** billing secrets at all. Yet Stripe is a live provider: `stripe` is a middleware dependency, `stripe.provider.ts` reads `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/price IDs, `main.ts` keeps rawBody for Stripe+Razorpay sig verification, and CSRF exempts `/api/v1/webhooks/stripe`. `RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` are also undocumented.
- **Why it matters:** An entire money-path provider is invisible to the documented contract — the money-flow/external-boundary axis drifting silently.
- **Fix:** Add Stripe to CLAUDE.md Billing and both providers' secrets (incl. `*_WEBHOOK_SECRET`, `*_KEY_SECRET`, price IDs, `APP_URL`) to `.env.example`.

### S2-10 — `Display.status` has two independent write-authorities, two read sources, and no shared type
**✓ auditor-cited** (`schema.prisma:141`, `device.gateway.ts:1031,1044,1316,1335,1407,1437`, `displays.service.ts:280,319,369`, `heartbeat.service.ts:175-192`, `analytics.service.ts:320`)
- **What:** The realtime gateway writes `status:'online'/'offline'` on WS connect/disconnect; middleware independently writes on heartbeat REST and two crons — no defined authority, so the two services race on the same column (realtime marks offline on socket drop while a middleware heartbeat marks online; winner is timing-dependent). `getDeviceHealth` reads status **only from Redis** (5-min TTL) while dashboards read **from Postgres**, so "is this device online?" has two answers by endpoint. The allowed set (`online/offline/pairing/error`) exists only as a schema comment — a free-form string in both writers; a typo silently breaks every `where:{status:'online'}` count. (Schema records a deliberate "no Prisma enums" decision, so at minimum a shared TS union is needed; it doesn't exist.)
- **Fix:** Define one authority (recommend realtime owns transitions, middleware cron only reconciles stale) and export a shared `DisplayStatus` union from `@vizora/database` imported by both services.

### S2-11 — Security-critical device-token crypto is duplicated byte-for-byte across services and has already begun to diverge
**✓ auditor-cited** (`middleware/.../device-token-auth.util.ts:7,22,26,97-109`, `realtime/.../device-token-hash.ts:3,5,9`, `device-handshake-auth.ts:96-125`)
- **What:** `hashDeviceToken`, `isCurrentDeviceToken`, `SHA256_HEX_PATTERN`, and the revocation predicate (find display by `sub`; compare `organizationId`/`isDisabled`/current-token-hash) are independently implemented in both middleware and realtime. The two `isCurrentDeviceToken` copies already differ (non-null vs nullable param).
- **Why it matters:** This is the device-revocation contract. A change must be edited in two files in lockstep; divergence is a cross-tenant/stale-credential auth hole, and drift has already started.
- **Fix:** Hoist the token-hash primitives + revocation predicate into `@vizora/database` (both services already depend on it) and import in both.

### S2-12 — The 70% coverage gate, the Codecov upload, and cross-service integration are all effectively no-ops in CI
**✓ verified by synth** (`ci.yml:95-107,116-120,184-186`, `middleware/jest.config.js:24-31`)
- **What:** CI runs bare `pnpm test` (=`jest`, no `--coverage`) for every workspace, so `coverageThreshold: 70/70/70/70` never executes and the Codecov step uploads a never-generated `middleware/coverage` with `fail_ci_if_error:false`. Separately, realtime e2e (the only test standing up a real Socket.IO server) is `continue-on-error:true` (`:185`), and middleware e2e is limited to `(agents|customer-critical-path)` — so no CI test exercises the actual middleware↔realtime round trip. CI lint (`package.json:16`) covers only `middleware/src realtime/src` — `web/` (largest surface), `scripts/`, and `display/` are unlinted.
- **Why it matters:** "70% coverage enforced," "coverage tracked in Codecov," "services talk to each other," and "frontend is linted" all read as real gates in config review and none of them gate. Coverage can regress arbitrarily; the flagged-risky seams can break; a green build proves less than it appears to.
- **Fix:** Run `pnpm test:cov` in the CI test job (or delete the threshold+Codecov step so config stops implying a gate); repair the realtime-e2e Prisma/Mongo setup and drop `continue-on-error`; extend lint to `web/src scripts display/src`.

### S2-13 — `@types/node` version disagrees with both CI and runtime Node
**✓ verified by synth** (`middleware/package.json:158` `^25.1.0` vs root:62 `20.19.9`, web/realtime `^20`; `ci.yml` node 22; dev node 24)
- **What:** Middleware type-checks against `@types/node ^25`, CI executes on Node 22, prod/dev on 24 — three non-matching contracts, and no `engines.node` in any manifest.
- **Why it matters:** `tsc` accepts Node-25-only globals/signatures that don't exist at runtime on 22/24 — the exact class of error the type-checker is meant to catch, masked.
- **Fix:** Align `@types/node` to the runtime major (`^24`) across workspaces, set CI `node-version` to match, add `engines.node` to root.

---

## S3 — Quality / maintainability (grouped)

**Correctness / robustness**
- **Email never normalized** (`auth.service.ts:495,516`, DTOs lack `@Transform(toLowerCase)`, `schema.prisma:81` case-sensitive `@unique`): `John@…` vs `john@…` → login miss; case-rotation multiplies the 10-attempt lockout budget; duplicate accounts possible. Fix: lowercase in DTO transform + lockout key.
- **Expired-content replacement not status-checked** (`content.service.ts:654-681`): repoints playlist items to a replacement validated only for same-org, not `status:'active'`/future `expiresAt` → dead content pushed to devices. Fix: filter the lookup.
- **File validation over-strict on MP4/MOV** (`file-validation.service.ts:54-73,216-227`): requires `ftyp` box size ∈ {0x18,0x1C,0x20} and matches `moov`/`mdat` at offset 0 instead of 4 → legitimate videos rejected as "spoofing." Fix: match `ftyp` at offset 4 per ISO-BMFF.
- **Lifecycle nudge claim committed before send** (`organizations.service.ts:297-333,410-425`): crash between claim and `sendMail` = permanently-lost nudge, next run sees the timestamp and returns `already_sent`, never retried/alerted. Fix: distinguish `claimed` from `confirmed_sent` + sweep orphaned claims.
- **`ops-state.json` non-atomic write / HEALTHY-reset** — folded into S2-1.
- **Electron cache download has no integrity/size/timeout guard** (`display/.../cache-manager.ts:235-277`): no `response.on('error')`, no bytes-vs-`Content-Length` check, no timeout → ECONNRESET mid-body hangs forever or caches a truncated file rendered as corrupt content. Fix: response-error handler + size check + timeout.
- **Electron url/html/template content has no load-error handling** (`display/src/renderer/app.ts:480-494`): img/video advance on error; iframe branches don't → a failed/401 iframe shows a stuck dark frame with no advance. Fix: `iframe.onerror`/load-timeout → `handleContentError`.
- **Billing webhook controller maps all errors to 401 "Invalid signature"** (`webhooks.controller.ts:37-43,62-68`): a DB failure on a signature-valid event reports as a forgery → pollutes PSP dashboards + misleads triage. Fix: let non-signature errors surface as 5xx.

**Performance**
- **`content_impressions` daily prune has no matching index** (`cleanup-impressions.ts:37-43` deletes on bare `timestamp<cutoff`; only index is composite `[organizationId,timestamp]`, `schema.prisma:326-332`) → nightly full-table scan on the fastest-growing table. Fix: `@@index([timestamp])`.
- **Fleet override methods do sequential per-device Redis round-trips** (`fleet.service.ts:344-346,363-370,374-377,404-406`): N awaited RTTs per fleet-wide override. Fix: pipeline/`MSET`/`MGET`/multi-member `SREM`.
- **`expireContent` runs one transaction per expired row serially** (`content.service.ts:644-695`). Fix: bounded-concurrency or grouped bulk `updateMany`/`deleteMany`.
- **`SanitizeInterceptor` deep-clones the entire response tree on every request** (`sanitize.interceptor.ts:118-179`) regardless of whether anything needs sanitizing → per-request GC pressure on the hottest surface (bounded by the 100-item page cap). Fix: return original refs for `<>&`-free subtrees.
- **Analytics fetches all org displays with no `take`** (`analytics.service.ts:49-58,186-193`). Fix: `groupBy` DB-side.

**Dependencies (hygiene — fold into the S1-3 re-baseline)**
- Stale `pnpm.overrides` pin **below** current advisories: `serialize-javascript→7.0.4` (patched `>=7.0.5`), `tar→7.5.10` (patched `>=7.5.16`), `multer→2.1.1` (see S1-3). Refresh ceilings or drop.
- `@nestjs/jwt`/`@nestjs/passport` major split: middleware `11` vs realtime/root `^10` — standardize on `^11`.
- Nx plugins mix exact + caret (`@nx/js` exact vs `@nx/nest` caret) — pin all `@nx/*` to `22.4.2`.
- `jest` major split: database `^30` vs everything else `^29` (with `ts-jest ^29`) — align.
- `reflect-metadata ^0.1.13` while NestJS 11 targets `0.2.x` — bump to `^0.2.2`.
- Deprecated `@types/*` stubs / lagging types: drop `@types/uuid`, `@types/dompurify`; bump `@types/nodemailer` to match runtime.
- `puppeteer` in `onlyBuiltDependencies` authorizes a ~150-300 MB Chromium download on every `pnpm install`/CI for a one-off seed script — gate behind `PUPPETEER_SKIP_DOWNLOAD` or remove.
- GitHub Actions third-party actions pinned to mutable major tags (`codecov/codecov-action@v4`, docker actions `@v3/@v5` in `docker-build.yml`) — SHA-pin, at minimum the docker actions with registry push creds. (`pull_request_target` correctly unused.)
- `autoInstallPeers: true` (`pnpm-workspace.yaml:8`) silently resolves the peer mismatches above rather than surfacing them.

**Architecture / doc drift**
- Response envelope emits `{success, data}` — no `meta` — vs CLAUDE.md `{success, data, meta}` (`response-envelope.interceptor.ts:41-47`).
- Rate limiting is 4-tier (a `default` tier exists), not the documented 3 (`app.module.ts:86-90`).
- Sanitize allowlist is 4 fields incl. `renderedHtml` (not 3) and the output leg runs `sanitizeTemplateHtml()`, not passthrough (`sanitize.interceptor.ts:35,164-167`).
- Realtime routes are **unversioned** (`globalPrefix='api'`) while middleware is `/api/v1` — internal calls hit `/api/push/*`, `/api/internal/*`; realtime metrics at bare `/internal/metrics`. If realtime is ever fronted by the nginx `/api/→/api/v1/` rewrite, every internal call breaks (`realtime/main.ts:65`).
- Middleware unconditionally appends `&connection_limit=10&pool_timeout=20` in prod → `DATABASE_URL` can carry `connection_limit` twice; realtime guards against this (`database.service.ts:28-31` vs `realtime/.../database.service.ts:16-19`). `.env.example`'s `connection_limit=30` sizing note is silently overridden.
- `env.validation.ts:57-64` comment claims vars absent from the Zod schema resolve `undefined` via `ConfigService.get()`; billing secrets are absent yet billing works → the comment's mechanism is wrong (ConfigService falls back to `process.env`). See §UNVERIFIED.
- PM2 entries `cleanup-impressions`, `vizora-validator`, `hermes-insights-poller` are in no CLAUDE.md table; insights-poller is recorded as dormant yet still fires every 5 min.

**Tests**
- Billing webhook **controller** "invalid signature" tests only assert error→401 mapping, not signature validation (real HMAC verification IS covered at the provider layer — `razorpay.provider.spec.ts:452-489`) — misleading names only.
- `--passWithNoTests` on the middleware unit step means a jest-config/path break resolves zero specs and passes green.
- Playwright `18-playlist-builder.spec.ts:77-80` swallows a non-2xx create → 7 following tests `test.skip()` and report green (mitigated: Playwright not in CI).

---

## RESOLVED pre-flight checks (2026-07-07)

- **NestJS `ConfigService.get()` fallback to `process.env`** — **RESOLVED: it DOES fall back.** `@nestjs/config@4.0.2` `config.service.js:112-117` reads `process.env` via `getFromProcessEnv()` for keys absent from the validated config, gated only by `_skipProcessEnv`, which `config.module.ts:14-22` never sets (no `ignoreEnvVars`/`cache`/`skipProcessEnv`). Billing secrets resolve in prod. **S2-9 stays S2** (not S1). The `env.validation.ts:57-64` comment ("Zod strips unknown keys → ConfigService returns undefined") is factually wrong — corrected as an S3 doc fix.
- **GitHub branch protection** — **RESOLVED: `main` is NOT protected at all** (`gh api repos/.../branches/main/protection` → 404 "Branch not protected"). Worse than assumed: the `test`/`e2e` jobs are not required checks, so even after the CI test-pattern fix and dropping `continue-on-error`, nothing at the repo level blocks a merge on a failing gate. **The CI fixes are necessary-but-not-sufficient until branch protection is enabled** — a repo-settings decision surfaced to the operator (also affects the operator's own push workflow, so not flipped autonomously).

## UNVERIFIED (could not confirm from code alone; flagged for a targeted check)
- **`@nestjs/mongoose@^11.0.4` peer-compat with `mongoose@9`** before bumping to 9.1.6 — confirm the supported peer range or `autoInstallPeers` may silently downgrade.
- **Duplicate `@Cron` in middleware cluster mode (×2 instances)** — `detectOfflineDevices` is likely idempotent via its `WHERE status:'online'` filter, but the offline-notification path's dedup under a both-instances-read-first race was not confirmed → possible duplicate offline notifications.
- **`mcp_audit_log` actual prod row count / growth rate** — `SELECT count(*), min("createdAt")` on the VPS sizes S2-7 urgency.
- **`auth.service.generateToken` (`:1176`)** signs with no explicit `expiresIn` while the API returns `getAccessTokenTtlSeconds()`; correct only if `JwtModule.signOptions.expiresIn` equals that value (JwtModule config not read). If they diverge, clients mis-time refresh.
- **MongoDB may be dead infra** — `MONGODB_URL` is documented + optional-validated but no `process.env.MONGODB_URL` read was found in app code.
- **SSRF post-resolution check is IPv4-only** (`file-validation.service.ts:372-450`) — a host resolving to a private IPv6 (`::1`, `fc00::/7`) or multi-A-record (DNS-rebinding) passes the resolved-IP guard. Real, but a **security-dimension** finding (out of scope for these six passes; flagged for a security review).

---

## Verification ledger

| Claim | How verified |
|---|---|
| Ops-lock held across I/O, proceeds-unlocked, lock-stealing, HEALTHY-reset | ✓ synth read `state.ts`, `fleet-manager.ts` |
| Tenant DB guard off in prod | ✓ synth read `database.service.ts:15-17,57` |
| CI excludes tenant e2e; audit ×2 non-blocking; coverage/codecov no-op; lint 2/5 | ✓ synth read `ci.yml`, `security-audit.yml`, root `package.json` |
| 204 vulns / 4 crit / 72 high | ✓ synth ran live `pnpm audit` |
| handlebars 4.7.8 / axios 1.13 / next 16.1.6 / electron 28 / multer 2.1.1 / mongoose 9.1.5 / nodemailer 8.0.1 / @types/node 25 | ✓ synth read all manifests |
| Stripe wired but undocumented | ✓ synth confirmed `stripe` dep; auditor cited provider reads |
| Redis-outage connect, playlist-push-drop, upload-quota-leak, billing webhook/status, mcpAuditLog growth, Display.status dual-writer, token-crypto dup, and all S3 code findings | ✓ auditor-cited file:line (not independently re-read by synth) |
