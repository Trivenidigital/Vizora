# Vizora Backlog

**Last updated:** 2026-08-03 (main and production both at `0aaba06c`)
**Production:** `0aaba06c` — synchronized with `main`. Ops status HEALTHY, 0 active incidents.
**Production readiness:** repo-side foundation strongest on record; customer-1 launch remains operator-gated on C1-C4 below.
**Tests:** Current merge evidence: PR #220 GitHub CI passed audit, build, e2e, lint, security, and test. That CI `e2e` job is the narrow middleware Jest gate, not the full Playwright browser suite. Local #211 verification included focused middleware fleet tests (2 suites / 45 tests), realtime tests (13 suites / 287 tests), display focused tests (2 suites / 63 tests), display CI tests (8 suites / 145 tests), display typecheck/build, web tests (106 suites / 1115 tests), web/realtime/middleware builds, diff hygiene, and secret scan. Pass71 re-verified admin web tests (8 suites / 80 tests) for stale K5 closure. Pass72/73 re-verified focused agent/ops gates around Hermes cost and audit fallback. Pass78 adds a repo-side no-send-by-default C1 email readiness helper; pass79 adds a reusable C4 go-live smoke template; operator SMTP/Resend setup and any real test-send remain pending. Historical aggregate test report remains in `docs/plans/2026-05-09-test-results.md`; verify fresh counts before relying on older totals.
**Customer-1 launch date:** operator-confirmed - do not use historical target dates until the operator confirms the actual launch window.

**Security/realtime/readiness wave (#107-#220, merged through 2026-06-03, main `3e1ceb2f`):** session invalidation now spans REST + WebSocket - password-change / account-deactivation force-logout across all devices (REST `#111`, WS connect-time `#112`, WS mid-session 60s sweep `#114`). Customer-1 smoke coverage is hardened (#116), M12 security alert emails are complete (#117), and the latest overnight readiness passes hardened health/readiness gates, validator reporting, admin readiness display, deploy verification, first-customer runbook truthfulness (#218), public app URL precedence for email/reset/pairing/billing/lifecycle links (#209), repo-side display auto-update command plumbing (#211), Hermes runner balance-delta cost attribution (#213), Hermes audit outcome fallback (#214), a no-send-by-default C1 email readiness helper (#219), and a reusable C4 go-live smoke template (#220). P1/P2 tables below reconciled to match.

---

## COMPLETED (2026-08-02 → 2026-08-03 — web follow-up + ops remediation, PRs #257–#267)

Production moved `56a48e5d` → `0aaba06c`. All work below is merged, deployed and runtime-verified.

### Web (#257, #264)
- **Real product screenshot** replaces a fabricated CSS mock on the homepage. The old "Fleet Status" card invented devices (`NYC — Times Square`, `12ms`). Now a real capture of the running app against a synthetic demo tenant, captioned "Actual product UI — demo workspace, synthetic data". Reproducible via `scripts/marketing/`.
- **Context-aware cookie banner** — light on `.mkt` marketing/auth pages, unchanged dark in the app, via `body:has(.mkt) .consent-bar`. Consent storage and behaviour byte-identical; dismissed bar now leaves the tab order.
- **`DemoVideoSection` / `TestimonialsSection`** converted to `--mkt-*` tokens. `TestimonialsSection` **remains unmounted** with a DO-NOT-MOUNT banner — its three named quotes and "4.9/5 from 200+ reviews" have no source in this repo.
- **`SearchFilter` padding bug** — `.eh-input` is defined after `@tailwind utilities`, so source order beat `pl-10` and the search glyph sat on the placeholder in *every* dashboard search box.
- **Sora typeface never applied** at 35 call sites across 22 files: `font-[var(--font-sora)]` types as font-**weight**, producing an invalid declaration that was dropped. Fixed with a named `font-sora` utility (`tailwind.config.js` now declares `fontFamily`), which cannot be mis-typed. Verified in the shipped bundle and by computed `font-family` in a browser.

### Ops (#258, #260, #261, #262, #263)
- **Refresh-token leak CLOSED.** ~384/day (measured, not estimated), 8,405 rows accumulated, `replacedByTokenHash = 0` — never redeemed. Cause: ops agents logged in via `fetch` (no cookie jar) and discarded the refresh cookie. Fix required **three** attempts; the working one sends the cookie **plus** `X-CSRF-Token`, without which logout returns 401 and revokes nothing. Runtime-verified: minted = revoked, 0 unrevoked on natural cycles.
- **Session-release failures are now loud** — logged at ERROR naming the consequence, plus a failure counter and per-run summary. Silence is what let two ineffective fixes ship looking correct.
- **Disabled displays excluded** from `fleet-manager` and `schedule-doctor`. `isDisabled` existed and was returned by the API but no agent read it, so operator-disabled displays paged forever.
- **`agent-silent` false CRITICAL** — an early return on zero displays skipped `recordAgentRun()`, so "nothing to do" read as "dead" to the watchdog.

### Incidents
- 12 active incidents → **0**. Seven attributable to five disabled E2E fixtures were reconciled; the remaining five were investigated individually and resolved with evidence (content already `archived` with 0 references; storage proven healthy by a write/read/delete probe). None were bulk-cleared to force a green status.

### Monitoring (#265, #266, #267)
- **Persistent-offline detection** implemented, deployed and enabled — `PersistentOfflineReconciler`, `*/15`, cross-org in-process query, excludes `isDisabled`, gauge `vizora_persistent_offline_displays` (currently 19). **Aggregate detection only**: no durable incidents, no notifications, no reminder cadence. It holds no event emitter, asserted by test.
- Established distinction now in the permanent record: **transition alerting ≠ persistent-outage coverage**. Prod proved it — 24 displays offline, 2 alert-rule firings ever.
- **Rejected on review:** granting `fleet-manager` cross-tenant scope, and a cross-tenant MCP `list_displays_platform` tool. Both duplicate per-tenant behaviour the product already does correctly.

### Security
- Exposed super-admin credential **rotated** via the app's own change-password path (never printed); 8,354 refresh tokens revoked; no evidence of misuse (zero non-loopback logins post-exposure). **`VALIDATOR_EMAIL` is the platform's only super-admin** — the ops service account runs with full super-admin rights.
- **Ops alert delivery was broken two ways**: no recipient configured, *and* `sendEmailAlert` reads `SMTP_PASS`/`SMTP_FROM` which did not exist on the host (it had `SMTP_PASSWORD`/`EMAIL_FROM`), so it would have failed auth even with a recipient. Fixed; receipt verified at SMTP level (250 + message id).

---

## COMPLETED (Since Last Backlog Update — 2026-03-18 → 2026-05-11)

### Security, realtime, and readiness wave (2026-05-30 → 2026-05-31, PRs #107–#117)

| # | Item | PR / commit |
|---|------|-------------|
| H1 | Real-time notification emission gap — device-offline alert bypassed the realtime broadcast (surfaced only on poll) | #107 (`b860100`) |
| H2 | Per-device remote control on device detail page (reload / restart / clear_cache) | #108 (`875d2fe`) |
| H3 | generic-api widget always-400 + webpack shipped zero `.hbs` (every widget type broke in prod) | #109 (`5059bfe`) |
| H4 | Password-changed security email (`MailService.sendPasswordChangedEmail`) | #110 (`7c2d089`) |
| H5 | Session invalidation — REST: `pwd_changed:`/`user_revoked:` Redis keys + `JwtStrategy.validate` reject (strict `iat <`) | #111 (`82c5c01`) |
| H6 | Session invalidation — WS connect-time handshake consults both keys | #112 (`277a6eb`) |
| H7 | Backlog reconciliation (OptiSigns O-series) | #113 (`6cf99a6`) |
| H8 | Session invalidation — WS mid-session 60s sweep (`sweepInvalidatedSessions`) closes the #112 connect-time-only residual | #114 (`7ecd6f3`) |
| H9 | Backlog/test/current-state reconciliation for customer-1 readiness | #115 (`6959673`) |
| H10 | Customer-1 smoke script now covers pair-complete, playlist creation, schedule assignment, and device active-schedule read path | #116 (`ad57b2b`) |
| H11 | New-login/unrecognized-context security email using existing login audit history; password and Google login paths covered | #117 (`1b28608`) |

### Agent Platform Redesign (2026-05-08 → 2026-05-09)
Triggered by 2026-05-06 OpenRouter credit drain. PR #62 (merged `801b517` on 2026-05-09) + 5 hotfix commits on main bring cost defense to 4 layers (provider cap → app daily cap → per-firing Hermes hard-stop → cross-firing breaker designed for P4).

| # | Item | Commits | Date |
|---|------|---------|------|
| A1 | Plan + design + 2 parallel review passes | `f6c9798`, `7adcf5b` | 2026-05-08 |
| A2 | Schema migration (`AgentRun` model + `agentRunId` FK on `mcp_audit_log`) | `423597e` | 2026-05-08 |
| A3 | `AgentRunsService` + Zod schemas (18 tests) | `2291ea6` | 2026-05-08 |
| A4 | `InternalSecretGuard` + `AgentRunsController` + module wiring (9 tests) | `9901814` | 2026-05-08 |
| A5 | Pre-flight checks + phantom-lever fix in runner script | `88a0140` | 2026-05-08 |
| A6 | `log_shadow_row` cross-tenant defense (P1.1) — accepts per-org tokens, server forces token's org_id | `2538933` | 2026-05-08 |
| A7 | Hermes per-skill tool allowlist via `-t` flag (P1.2) + ecosystem-cron lock test | `1c87576` | 2026-05-08 |
| A8 | insights-poller sidecar + hermes-table parser (P0.5) | `efc9e69` | 2026-05-08 |
| A9 | Grafana dashboard + insights-poller PM2 entry (P0.6) | `05da274` | 2026-05-08 |
| A10 | PR review fixes — 7 critical + 9 important (3-agent parallel review) | `8d60bd1` | 2026-05-08 |
| A11 | Deploy hotfixes — load .env in sidecar; INTERNAL_API_SECRET env-schema; `@Public()` on controller; runner env-load + scoped outcome classifier; response-envelope unwrap | `2e61e51` → `2d6e93f` | 2026-05-09 |

### Production Readiness Pass (2026-05-09 — autonomous)

| # | Item | Output | Date |
|---|------|--------|------|
| R1 | Test inventory (727 lines) — 27 middleware modules + features + risk map | `docs/plans/2026-05-09-test-inventory.md` | 2026-05-09 |
| R2 | Test results — 3411/3443 unit/integration tests pass (zero failures); type-check clean | `docs/plans/2026-05-09-test-results.md` | 2026-05-09 |
| R3 | Playwright Run-1: 0/332 pass — bit-rot diagnosed (stale h1 copy + stale `/api/` paths) | `docs/plans/2026-05-09-playwright-results.md` | 2026-05-09 |
| R4 | Playwright Run-2: ~90%+ pass post-mechanical-fix (`f23ae65`) — ~26 remaining failures (heaviest: 16-billing×10) | same doc + commit | 2026-05-09 |
| R5 | Production readiness report — verdict CONDITIONAL GO for 2026-05-13 | `docs/plans/2026-05-09-production-readiness-report.md` | 2026-05-09 |
| R6 | API smoke test (12 endpoints, <30s) — `bash scripts/smoke/api-critical-path.sh` | `scripts/smoke/api-critical-path.sh` (12/12 pass verified) | 2026-05-09 |
| R7 | First-customer onboarding runbook (T-3 → T-0 → day-7) | `docs/runbooks/first-customer-onboarding.md` | 2026-05-09 |
| R8 | Monitoring playbook (Grafana panels + thresholds + drilldowns) | `docs/runbooks/monitoring-playbook.md` | 2026-05-09 |
| R9 | Hermes-insights empty-output investigation — root cause: `hermes -z` does NOT persist sessions; sidecar dormant by design | `docs/plans/2026-05-09-hermes-insights-investigation.md` | 2026-05-09 |
| R10 | agentRunId propagation investigation — Hermes config supports static headers only, no `--header` flag in 0.12.0 | `docs/plans/2026-05-09-agent-run-id-propagation-investigation.md` | 2026-05-09 |
| R11 | support-triage cross-tenant token design call — recommended kept-disabled for customer-1, Option 2 (platform-scope `support:*` tools) for week-2 | `docs/plans/2026-05-09-support-triage-cross-tenant-design.md` | 2026-05-09 |
| R12 | CLAUDE.md test baseline refreshed (1700+ → 2335; carve-outs resolved) | `e80939d` | 2026-05-09 |
| R13 | Customer-critical Playwright helper preflights local services and runs the launch-relevant browser subset; full suite remains T1 | `scripts/smoke/playwright-customer-critical.mjs` | 2026-06-03 |
| R14 | C1 email readiness helper validates SMTP/app URL env offline by default; SMTP network verify and neutral test-send are separately flag-gated | `scripts/smoke/email-readiness.mjs` | 2026-06-03 |

### Earlier (carried over from prior backlog state)

| # | Item | Branch | Commits | Date |
|---|------|--------|---------|------|
| 1 | Fix 4 broken API endpoints (content, widgets, layouts, notifications) | `fix/day5-6-api-deletion-consent` | `03af03f` | 2026-03-09 |
| 2 | Account deletion with full cascade (GDPR compliance) | `fix/day5-6-api-deletion-consent` | `f3d08f3` | 2026-03-09 |
| 3 | Cookie consent banner | `fix/day5-6-api-deletion-consent` | `12eb382` | 2026-03-09 |
| 4 | Fix template thumbnails / seed on production | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 5 | Fix trial banner text clipping | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 6 | Fix AI Designer modal Escape key | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 7 | Wire playlist loop toggle end-to-end | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 8 | Profile name editing | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 9 | Quick wins sweep (console errors, loading states) | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 10 | Startup self-test (8 subsystem checks) | `feat/health-infrastructure` | — | 2026-03-10 |
| 11 | Deploy verification script (25+ checks) | `feat/health-infrastructure` | — | 2026-03-10 |
| 12 | Regression guard tests (25 static analysis) | `feat/health-infrastructure` | — | 2026-03-10 |
| 13 | Continuous health monitor (6 checks every 5min) | `feat/health-infrastructure` | — | 2026-03-10 |
| 14 | Admin system health dashboard with sparklines | `feat/health-infrastructure` | — | 2026-03-10 |
| 15 | Fix ParseUUIDPipe / CUID mismatch across codebase | — | — | 2026-03-10 |
| 16 | Night 1: Backend hardening (14 critical + 20 med/high fixed) | — | — | 2026-03-08 |
| 17 | Night 2: UI hardening (15 areas polished) | — | — | 2026-03-09 |

| # | Item | Branch | Commits | Date |
|---|------|--------|---------|------|
| 1 | Fix 4 broken API endpoints (content, widgets, layouts, notifications) | `fix/day5-6-api-deletion-consent` | `03af03f` | 2026-03-09 |
| 2 | Account deletion with full cascade (GDPR compliance) | `fix/day5-6-api-deletion-consent` | `f3d08f3` | 2026-03-09 |
| 3 | Cookie consent banner | `fix/day5-6-api-deletion-consent` | `12eb382` | 2026-03-09 |
| 4 | Fix template thumbnails / seed on production | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 5 | Fix trial banner text clipping | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 6 | Fix AI Designer modal Escape key | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 7 | Wire playlist loop toggle end-to-end | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 8 | Profile name editing | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 9 | Quick wins sweep (console errors, loading states) | `feat/week1-unblocked-tasks` | — | 2026-03-09 |
| 10 | Startup self-test (8 subsystem checks) | `feat/health-infrastructure` | — | 2026-03-10 |
| 11 | Deploy verification script (25+ checks) | `feat/health-infrastructure` | — | 2026-03-10 |
| 12 | Regression guard tests (25 static analysis) | `feat/health-infrastructure` | — | 2026-03-10 |
| 13 | Continuous health monitor (6 checks every 5min) | `feat/health-infrastructure` | — | 2026-03-10 |
| 14 | Admin system health dashboard with sparklines | `feat/health-infrastructure` | — | 2026-03-10 |
| 15 | Fix ParseUUIDPipe / CUID mismatch across codebase | — | — | 2026-03-10 |
| 16 | Night 1: Backend hardening (14 critical + 20 med/high fixed) | — | — | 2026-03-08 |
| 17 | Night 2: UI hardening (15 areas polished) | — | — | 2026-03-09 |

---

## P0 — LAUNCH BLOCKERS for customer-1 (operator-gated launch)

Per current readiness reconciliation: the four operator-driven items below are the GO/NO-GO gates. Technical foundation is sound - these are unblockable by code.

| # | Item | Owner | Effort | Status | Notes |
|---|------|-------|--------|--------|-------|
| **C1** | **SMTP / Resend on prod — domain `mail.vizora.cloud` verified (DKIM/SPF/DMARC), `SMTP_*`/`EMAIL_FROM` and public `APP_URL` or `WEB_URL` env set, test send works end-to-end** | Sri | 2h | TODO | Repo-side helper: `pnpm smoke:email-readiness --production` checks config offline; `--verify-smtp` and `--send` require explicit operator flags. Operator still owns DNS/env/test-send. |
| **C2** | **Customer-1 organization provisioned on prod** (skeleton, admin user invite, plan, quota) | Sri | 1h | TODO | Skip if customer self-registers |
| **C3** | **Real-device walkthrough on customer hardware** (pair, push playlist, reboot, network-flap) | Sri + customer IT | 2h | TODO | Electron has 0% functional test coverage; this IS the test |
| **C4** | **Final go-live smoke test on prod** | Claude Code (driven by Sri) | 3h | BLOCKED on C1-C3 | Operator-driven; copy `docs/runbooks/customer-1-go-live-smoke-template.md` to `docs/runbooks/customer-1-go-live-smoke-{DATE}.md` and record evidence there. |

**Stripe/Razorpay live keys (formerly B8-B15):** DEFERRED past customer-1. Customer-1 launches on free tier. Backlog items kept open for the first paid customer:

| # | Item | Owner | Effort | Status | Dependencies |
|---|------|-------|--------|--------|-------------|
| B8 | Create Stripe account + products + prices (4 tiers x 2 intervals) | Sri | 2h | DEFERRED | Business bank account |
| B9 | Create Razorpay account + plans (4 tiers x 2 intervals, INR) | Sri | 2h | DEFERRED | Indian business entity or partner |
| B10-B15 | Stripe/Razorpay webhook setup, env vars, plans.ts, billing E2E tests | mixed | ~10h | DEFERRED | B8 + B9 |

**Original B-series items (B1-B7) — partial status:**
- B1/B2/B3 (SMTP setup, DNS, env vars): SUBSUMED into **C1**
- B4 (test 8 email types end-to-end): BLOCKED on C1
- B5 (email verification flow), B6 (team invite email wiring), B7 (unsubscribe link): UNTOUCHED; defer to week-1 post-launch if not on customer-1's path

---

## Tech-debt from 2026-05-09 readiness pass (post-launch sprint)

These are documented + non-blocking for customer-1. Investigations done; implementations deferred unless marked done.

| # | Item | Effort | Pointer | Why deferred |
|---|------|--------|---------|--------------|
| T1 | PARTIAL - Playwright suite refresh — close remaining ~26 failures (heaviest: 16-billing×10) | 6-8h | `docs/plans/2026-05-09-playwright-results.md`, `scripts/smoke/playwright-customer-critical.mjs` | Customer-critical helper now preflights middleware/web/realtime local ports and runs 01/03/04/05/06/15/21; full browser suite still needs a running stack and fresh result. 16-billing is OUT of customer-1 scope |
| T2 | ✅ DONE - Per-firing cost attribution (Path A: balance-delta pre/post each firing) | ~1h | `docs/plans/2026-05-09-hermes-insights-investigation.md` | Pass72: runner samples post-flight OpenRouter balance and stores nonnegative delta as `agent_runs.costMicrodollars`; live rows require normal deploy, no prod firing performed |
| T3 | PARTIAL - agentRunId propagation runner→Hermes→MCP — Hermes 0.12.0 has no `--header` flag; needs upstream patch OR env-var config interpolation experiment | 2h-2d | `docs/plans/2026-05-09-agent-run-id-propagation-investigation.md` | Pass73: sidecar Path D fallback shipped (MCP audit `agentName` candidates + firing window when `agentRunId` rows are absent) and no longer false-refines empty audit evidence to `no_work`; precise per-run header propagation remains deferred |
| T4 | ✅ DONE - support-triage cross-tenant token redesign — Option 2 (`support:*` tools accept platform-scope) | 4-6h | `docs/plans/2026-05-09-support-triage-cross-tenant-design.md` | Pass75: repo-side MCP/service filters support platform-scope reads/writes while preserving per-org guards. Operator token issuance/Hermes config/cutover still required; support-triage remains disabled for customer-1 |

---

## Android TV client (`vizora-tv`) — carried defects

Split out of the `/tv` APK distribution workstream on purpose (2026-08-10). These
predate 1.3.11 and must **not** hold up publication — see
`docs/plans/2026-08-10-tv-apk-distribution.md`.

| # | Item | Status | Notes |
|---|------|--------|-------|
| TV1 | ✅ DONE — **test env leakage from a developer-local `.env`** (NOT a Node-version issue) | Fixed 2026-08-12, `vizora-tv` PR #16 | **Correction: the earlier "Node 24 vs CI Node 20" diagnosis was wrong.** `DEFAULT_CONFIG` (`src/main.ts:45`) is compiled in from `import.meta.env.VITE_*`, which `vite.config.ts:69` resolves as `env.VITE_API_URL \|\| 'https://api.vizora.io'`. The F43 `update_config` allowlist is anchored to those compiled-in defaults and matches on registrable domain, so the allowlist specs depend on what they resolve to. `.env` is gitignored and every developer has one; CI does not, so CI got the `vizora.io` fallbacks and was always green, while a local `.env` pointing elsewhere (ours: `vizora.cloud`) changed the default underneath the tests. **Proven by controlled experiment:** on the *same* Node 24, moving `.env` aside took the suite from 5 failed to 300 passed / 0 failed — identical to CI. Node was a coincidence, since CI and local machines differed in both. Fixed by committing `.env.test` (fixture, no secrets; vite loads `.env.[mode]` after `.env`, vitest runs `mode=test`), so tests own their environment. Verified test-only — the production bundle still bakes the local `.env` value. Separately, `vi.stubGlobal('navigator', …)` **was** genuinely broken — Node 21+ makes `navigator` a getter-only accessor so the stub silently no-opped — but that was **non-causal** for those five failures; replaced with `defineProperty` as test-correctness cleanup. |
| TV2 | ✅ DONE — **device app version is now persisted and visible** | Fixed 2026-08-11 | The player had always sent `appVersion` in every heartbeat and the server had always thrown it away: `realtime/src/gateways/dto/index.ts` declared it, nothing read it, nothing wrote it — and `web/.../devices/[id]/page.tsx:147` rendered an "App Version" row from `metadata.appVersion` that could therefore never populate (0 of 23 prod devices had the key). It bit during the 1.3.12 rollout: no way to tell which build a screen ran, so "did the update install?" could only be answered by asking the customer. `HeartbeatService.processHeartbeat` now merges it into `devices.metadata` atomically (`metadata || jsonb_build_object(...)`, one statement — the read-modify-write shape loses concurrent writes to other keys, per the `FeatureFlagsService.setFlags` precedent), writing **only when the version changes** so a 15s heartbeat costs a Map lookup rather than a row update. Fail-open, DTO bounded to 64 chars. **No frontend change was needed — the existing UI row simply starts working.** |

---

## P1 — LAUNCH WEEK (Should have within first week of launch)

| # | Item | Status | Notes |
|---|------|--------|-------|
| B1 | **Full-app rebrand — align the authenticated app with the light homepage** | APPROVED, NOT STARTED | Decision 2026-08-03. Today marketing is light and the app is dark, so there is a visual break at login. The app **already has a working light theme**; it just points at the older warm-cream palette — so this is largely a token re-point plus a contrast audit, not a ground-up restyle. **Cost driver: 728 `#00E5A0` occurrences** outside the marketing scope, each needing classification as fill/glow (keep) vs text/border (must become `--mkt-mint-ink`, since neon is 1.65:1 on light). Surface: 42 dashboard + 24 admin routes, 52 components. Full scope, traps and verification plan: `docs/plans/2026-08-03-full-app-rebrand.md`. **Open first:** does dark mode remain supported, and what is the default for existing users? |


| # | Item | Status | Notes |
|---|------|--------|-------|
| B2 | **API-key entitlement gate — deny key auth when the org's current plan lacks API access** | NEW 2026-08-15, IN PR | Became a live commercial-authorization defect when #342 enabled the first API-key business route (`GET /api/v1/content`): an org that downgrades keeps working API keys issued while on a higher tier. Intended invariant (verify against pricing/entitlement code before implementing — do NOT assume "Pro" from UI copy): *key may exist historically, but API-key authentication is denied while current entitlement excludes API access* — deny-at-auth, not revoke-on-downgrade, so re-upgrade restores access without destroying credentials. Enforce in `ApiKeyGuard`/`validateKey` next to the org lookup. |
| B3 | **Razorpay purchase path never persists `subscriptionTier`/`razorpaySubscriptionId`** | NEW 2026-08-15, IN PR | Paying Razorpay customers stayed on tier `free`, so quota, the B2 entitlement gate, and the plan UI were all wrong for them — the only Razorpay event that ever touched `subscriptionTier` moved it DOWN. Fixed across five phases: the subscription id is persisted at checkout and reconciled from webhooks; money events resolve the org from the **payment** entity (`payment.captured` never carries an invoice entity, so the old `data.invoice.customer_id` read was dead on every event); `subscription.activated`/`subscription.charged` are routed and tier is derived from `plan_id` through a single `applyTierFromPlan` write site (unknown plan → status only + `logger.error` + Sentry, **never** coerced to `free`); Razorpay plan ids became interval-dimensioned (checkout no longer drops `dto.interval`, which billed yearly selections monthly); a `billingEventAt` ordering guard stops a retried older event overwriting newer entitlement; and the Razorpay cancel-at-period-end branch writes the same free-tier fields as the immediate branch. Stripe got the same tier resolution on `customer.subscription.updated`. **Prod deploy needs `prisma migrate deploy`** (new nullable `organizations.billingEventAt`). LATENT on prod: zero Razorpay config and zero provider-attached orgs, so this is fixture-verified only. |
| B3a | **Second, unsynchronized Razorpay status map defaults to `incomplete` instead of failing closed** | NEW 2026-08-15, NOT STARTED | Two Razorpay status maps exist and only one fails closed. `BillingService.mapSubscriptionStatus` returns `null` on an unrecognized status so entitlement is left untouched (audit S2-6), but `RazorpayProvider.mapSubscription` (`razorpay.provider.ts:238`) ends `statusMap[sub.status] \|\| 'incomplete'` — an unknown status silently becomes a concrete one. **Harmless today**: that value only reaches `getSubscriptionStatus`'s period fields and never writes `subscriptionStatus`, so it is display-only. It is a promotion hazard: the moment any caller derives entitlement from `Subscription.status` (a plausible next step now that B3 made the provider subscription object load-bearing for interval recovery), a new Razorpay status starts mapping to a concrete state instead of "we do not know". Fix by widening the type with an explicit unknown/`null` and making callers handle it — do NOT just change which concrete default it picks. Same class as the two maps drifting: Razorpay adding a status updates neither. |
| B3b | **`total_count: 12` silently ends every monthly Razorpay subscription after a year** | NEW 2026-08-15, IN PR | `razorpay.provider.ts` created every subscription with a bare `total_count: 12` — a one-year term. For a MONTHLY plan billing stopped after twelve charges and Razorpay moved the subscription to the TERMINAL `completed` state while the customer kept using the product. The commercial question was **ruled by the written contract**: Vizora sells recurring-until-cancelled, stated literally on the plans page ("No, all plans are pay-as-you-go with no long-term contracts. You can cancel at any time." — `plans/page.tsx:181-184`) and corroborated by the unconditional "Renews <date>", the refund policy's customer-initiated-only termination, and a repo-wide search finding zero 12-month intent anywhere. Razorpay has **no perpetual primitive** (exactly one of `total_count`/`end_at` is required), so the bound is now **30 years expressed in each interval's own cycles — 360 monthly, 30 yearly** — and the interval is threaded from the same `dto.interval` that resolves the plan id. Razorpay's own worked example is self-inconsistent (its formula `(12 × 30) / interval` evaluates to 360 while the figure it prints is 1200 = 12 × 100), so 1200 is deliberately NOT taken: 360 is valid under BOTH readings of their 30-vs-100-year contradiction, and an over-large count fails CLOSED — Razorpay rejects the create call and nobody can subscribe at all. The *entitlement* half was already closed by B3, which routes `subscription.completed` to a deliberate terminal collapse. **Razorpay behaviour at exhaustion, the real ceiling, and `PATCH remaining_count` semantics are UNVERIFIED — no Razorpay credentials exist in any environment. Test-mode verification is a pre-launch gate (see the PR's REQUIRED BEFORE BILLING IS ENABLED section).** |
| B3c | **`payment.failed` writes no `billing_transactions` row — failed charges leave no audit trail** | NEW 2026-08-15, NOT STARTED | `handlePaymentSucceeded` records a transaction; `handlePaymentFailed` only starts dunning. So the only durable record of a failed charge is a `past_due` status and an `entitlementStateSince` timestamp — there is no row saying WHICH charge failed, for how much, or how many times, which is exactly what support needs when a customer disputes a dunning email. Recording a `status: 'failed'` row would make the ledger complete; it needs a decision on the id to dedup on (Razorpay `payment.failed` carries a payment id, Stripe an invoice id) and on whether repeated retries of the same charge should be one row or many. |
| B3d | **Residual trial-status lockout shape: paid tier + `trialEndsAt: null` + a `trial` status** | NEW 2026-08-15, NOT STARTED | B3 stopped the webhooks from CREATING this combination (a `trial` status never writes a tier, and `trialEndsAt` is only cleared when granting a paid tier under `active`). The shape is still reachable from other directions — e.g. an org already on a paid tier with `trialEndsAt` cleared receives an `authenticated` event, which maps to `trial` and writes the status: `SubscriptionActiveGuard` then denies every write until the `activated` event lands, because its trial branch needs a future `trialEndsAt` and its free-tier escape does not apply at tier pro. The durable fix is in the GUARD (treat a paid tier as write-capable regardless of trial fields), not in billing — which is why it is filed rather than patched here. |
| B3e | **Comment overstates that `getSubscription` swallows provider errors** | NEW 2026-08-15, NOT STARTED | The B-H2 checkout-guard comment says an unreachable provider reads as "no live subscription" because `getSubscription` returns null on error. That is true for API errors inside the try, but `ensureConfigured()` throws BEFORE it — so an UNCONFIGURED provider raises `ServiceUnavailableException` out of the guard instead of returning null. Behaviourally that is the safer direction (checkout fails loudly rather than double-subscribing), but the comment describes a fail-open that is only partial. Correct the comment, or make the guard's error handling explicit rather than inherited. |
| B3f | **No watchdog for a Razorpay subscription approaching its `total_count`** | NEW 2026-08-16, NOT STARTED, BLOCKED ON TEST-MODE VERIFICATION | B3b sets a 30-year bound, so nothing can exhaust it in any realistic horizon — **and this, not a bigger creation-time number, is the durable answer to longevity** — but the bound is finite and `completed` is TERMINAL (`PATCH /v1/subscriptions/:id` refuses outside Authenticated/Active; there is no revival API), so the belt-and-braces version is a job that raises `remaining_count` on subscriptions nearing the end. Deliberately NOT built in the B3b PR because it depends on answers the Razorpay docs do not give: **(1)** does raising `remaining_count` force the customer to re-authenticate or sign a new mandate (customer-visible, undocumented)? **(2)** does the PATCH emit `subscription.updated`, i.e. does our DB learn about our own write? **(3)** what does Razorpay actually emit at exhaustion — `subscription.completed` alone, or also `subscription.updated`? The docs define completion via `end_date` and never state the `total_count` trigger. **Hard exclusion when built: UPI/eMandate subscriptions, for which the PATCH is refused unconditionally** ("Subscriptions cannot be updated when payment mode is UPI/emandate") — for those customers the creation-time bound is the only lever that will ever exist, which is why B3b sets it high at creation rather than planning to raise it later. Answer (1)–(3) in Razorpay test mode first; a watchdog that silently re-prompts customers for a mandate is worse than the bound it protects. |
| B4 | **Warn or block API-key creation for orgs without API entitlement** | NEW 2026-08-15, NOT STARTED | UX follow-up to B2. `POST /api/v1/api-keys` has `RolesGuard` only, so a free-tier admin can mint a key that will never authenticate — it 403s at first use with no earlier signal. Deliberately ungated in B2 v1 (blocking creation would break the legitimate "buy plan, keys already provisioned" ordering, and B3 currently makes tier unreliable). Prefer a create-time warning in the response/UI over a hard block. |
| B5 | **EntitlementBanner swallows fetch errors** | NEW 2026-08-15, IN PR | `apiClient.getEntitlementBanner().then(setData).catch(() => {})` (`web/src/components/EntitlementBanner.tsx:25`) — a `past_due`/`publish_locked`/`suspended` org whose banner fetch fails sees no warning at all, which is exactly the population the banner exists for. Same degraded-read family as the billing-page fix (a failed read rendering as a benign state). |
| B5b | **TrialBanner has the identical swallowed-read defect** | NEW 2026-08-15, NOT STARTED | `.catch(() => {})` + `if (!subscription) return null` (`web/src/components/TrialBanner.tsx:12-16`) hides "Your free trial has ended" from exactly the trial / free-expired orgs it exists to warn. Renders one line below EntitlementBanner in the same container. Same population argument and same degraded-state model as B5 (#350) — apply the fix shipped in #355. |
| B5c | **Dashboard banner container overlays `<main>` instead of pushing it down** | NEW 2026-08-15, NOT STARTED | The banner container is `fixed top-16` while the content wrapper is only `pt-16` (`web/src/app/dashboard/layout.tsx:246,251`), so banners sit *over* the top of the page rather than displacing it. Pre-existing, but newly reachable in combination: the B5 degraded state is not a ladder state, so a trialing org with a failed entitlement read now stacks two fixed bars (~88px) over content. |
| B6 | **Off-box external prober for true customer-path reachability (DNS/firewall)** | NEW 2026-08-15, NOT STARTED | health-guardian's new `edge-unreachable` watch probes `https://vizora.cloud` **from the VPS itself**, so it detects nginx/TLS/config faults but is structurally blind to everything between a customer and the box: DNS records, registrar/nameserver state, provider firewall or DDoS rules, and route blackholes. `HEALTHCHECKS_HEALTH_GUARDIAN_URL` does **not** cover this either — healthchecks.io only observes whether our agent pinged out, never whether anyone can reach in. Closing it needs a prober running somewhere else (L2's UptimeRobot is the cheapest candidate; a second VPS or a scheduled GitHub Action would also do). Until then, "edge healthy" means *this box can serve*, not *customers can connect* — the caveat is carried in the incident text on purpose. |

| # | Item | Effort | Status | Notes |
|---|------|--------|--------|-------|
| L1 | Device offline email notification to customers | S (4h) | ✅ DONE | Superseded by **O7** (#63) — `alert-rules` evaluator dispatches in_app/email/slack on device-offline per tag/group with custom recipients. |
| L2 | Set up UptimeRobot monitoring for health endpoints | XS (1h) | TODO | Manual: create account, add monitors |
| L3 | Custom error pages (branded 404, 500) | S (4h) | ✅ DONE | `web/src/app/{not-found,error,global-error}.tsx` + 7 per-route error boundaries (shipped in #92–#106 wave). |
| L4 | Basic knowledge base / help docs page | M (1d) | ✅ DONE | `web/src/app/dashboard/help/page.tsx` ships searchable FAQ categories + getting-started/device/content/playlists/security articles. |
| L5 | Proof-of-play tracking (log content displayed per device) | M (1d) | ✅ DONE | Core shipped as **O2** (#67) — `analytics/proof-of-play.service.ts` + CSV export. Secondary (scheduled-email/PDF/saved-views) lean-cut; verify before claiming gap. |
| L6 | Emergency content override (push urgent to all devices) | S (4h) | ✅ DONE | Full stack: `EmergencyOverrideModal` + `ActiveOverrideBanner` on devices page + `fleet.service` create/clear + Electron push_content/clear_override + crash-recovery. |
| L7 | Device remote reload command via WebSocket | S (2h) | ✅ DONE | reload/restart/clear_cache stack (realtime command enum + `fleet POST /commands` + Electron handlers); per-device control `DeviceControls.tsx` on device detail page (#108). Covers M6 (restart) too. |
| L8 | Wire real-time notification emission on creation | S (2h) | ✅ DONE | `NotificationsService.create()` → `/api/notifications/broadcast` realtime emit. Device-offline alert path that bypassed the broadcast fixed in #107. |
| L9 | Reduce notification polling (25s -> 60s or WebSocket) | XS (1h) | ✅ DONE | `useNotifications` defaults `pollInterval=300000` (5min), unread-count only, plus WebSocket `notification:new`. |

**Remaining P1: L2 (UptimeRobot) only — L1/L3/L4/L5/L6/L7/L8/L9 shipped.**

---

## P2 — FIRST MONTH (Build within 30 days of launch)

| # | Item | Effort | Status | Notes |
|---|------|--------|--------|-------|
| M1 | CloudFlare CDN + DDoS protection | S (4h) | TODO | Static assets served directly now |
| M2 | Weather widget (OpenWeatherMap free API) | M (1d) | ✅ DONE | `WeatherDataSource` + `WeatherWidget` + widget-create UI; requires `OPENWEATHER_API_KEY` for live data. |
| M3 | Google Sheets data source integration | L (3d) | ✅ DONE | `content/widget-data-sources/google-sheets.data-source.ts` |
| M4 | Content moderation workflow (flag -> review -> approve) | M (2d) | ✅ DONE | Superseded by **O10** (#69): submit-for-approval→approve/reject-from-approval pipeline in `content.controller.ts` + `content.service.ts`, tested in `content-approval.service.spec.ts`. |
| M5 | Expand template library to 150 templates | M (2d) | TODO | Currently 78 |
| M6 | Device remote restart command | S (4h) | ✅ DONE | Part of the L7 fleet command stack (#108) — `restart` in the realtime command enum + Electron handler. |
| M7 | Push-to-group endpoint (single API call) | S (4h) | ✅ DONE | Generalized in **O1** (#65) — tag/group/org targeting via `fleet.service` |
| M8 | Data retention policy (auto-purge audit logs > 90 days) | S (4h) | ✅ DONE | `common/data-retention.service.ts` + `auditLog.deleteMany` |
| M9 | Profile editing: avatar upload | S (4h) | ✅ DONE | `POST/DELETE /auth/me/avatar` + settings-page upload/remove UI backed by storage presigned URLs. |
| M10 | Fix Loki volume mount (logs lost on restart) | XS (1h) | ✅ DONE | `docker/docker-compose.yml` mounts named volume `loki_data:/loki` and declares `loki_data` under `volumes:`. |
| M11 | GDPR data export endpoint | M (1d) | ✅ DONE | `POST /users/me/data-export` returns user/org/content/display/playlist/schedule/audit/notification export; settings page downloads JSON. |
| M12 | Security alert emails (new login, password changed) | S (4h) | ✅ DONE | Password-changed email shipped (#110). New-login/unrecognized-context email shipped (#117) using existing `AuditLog.ipAddress` + `AuditLog.userAgent` history, with password and Google login paths covered. |

**Remaining P2 repo-side items:** M1 and M5. M2/M3/M4/M6/M7/M8/M9/M10/M11/M12 shipped.

---

## OptiSigns Parity Roadmap (from 2026-05-17 audit)

Items where Vizora has real foundation in the codebase + high customer value vs OptiSigns gaps. Full analysis: `docs/plans/2026-05-17-optsigns-vizora-feature-gap.md`. Cross-quarter — each item carries its own effort; no quarterly bucket.

Items the audit listed but we are NOT pursuing live (Engage/kiosk, live remote view, WebRTC, Office docs, white-label, nested playlists, etc.) are parked in `tasks/feature-backlog.md` under "OptiSigns parity — deferred items" with trigger conditions.

| # | Item | Effort | Foundation | Audit ref |
|---|------|--------|------------|-----------|
| O1 | ✅ DONE (#65) — **Unified Push to Screens** — tag-based targeting (`type:'tag'`) + push endpoints | M (3d) | `fleet/dto/send-command.dto.ts` (`tag` target enum) + `fleet.service` tag resolver (`case 'tag'`, cross-org guard). Supersedes M7. (Append-to-playlist / scheduled-auto-revert were lean-cut deferrals — verify if needed.) | P0 #2 |
| O2 | ✅ DONE (#67) — **Proof-of-play reports** — paginated query + CSV export over the impression model | M (3d) | `analytics/proof-of-play.service.ts`. Supersedes L5. (Scheduled-email/PDF/Excel were the lean-cut deferrals — verify if needed.) | P0 #4 |
| O3 | TODO — **Designer depth extension** — shapes, layers, lockable template fields, animation, drawing, asset-library insertion, export-as-image. Extension of existing canvas, not a rewrite | L (5d) | Baseline `templates/[id]/edit` canvas exists; depth features NOT built. One of two remaining O-items. | P0 #1 |
| O4 | ✅ DONE (#64) — **Tag-rule auto-assignment engine** | M (2d) | `middleware/src/modules/tag-rules/` service + evaluator | P0 #2 |
| O5 | ✅ DONE (#70/#71) — **Outbound webhooks** (lean cut) + per-delivery audit | L (5d) | `middleware/src/modules/webhooks/`. (SDK/OpenAPI-export/prod-Swagger were lean-cut deferrals — verify if needed.) | P1 #10 |
| O6 | ✅ DONE (#68) — **Provisioning templates** (apply-at-pairing MVP) | M (3d) | `middleware/src/modules/provisioning-templates/` (service/controller/DTOs) + migration `20260519142834_add_provisioning_templates`. (Bulk-CSV pairing / token-CSV export were lean-cut deferrals — verify if needed.) | P1 #7 |
| O7 | ✅ DONE (#63) — **Configurable downtime alert rules** — per tag/group with custom recipients | S (1d) | `notifications/alert-rules/` rule table + `alert-rule.evaluator` (in_app/email/slack dispatch). Supersedes L1. | P1 #6 |
| O8 | ✅ DONE (#66/#109) — **Generic API-to-screen data source** (JSON, v1) | M (3d) | `content/widget-data-sources/generic-api.data-source.ts` + `widget-templates/generic-api.hbs` (backend). Web create-UI exposure deprioritized per operator. XML/CSV deferred. | P0 #3 |
| O9 | TODO — **Teams + folder-level access control + custom roles** — `Team`, `FolderPermission` (read/write/admin per folder), `Role`/`Permission` models | L (5d) | Confirmed NOT built — no `Team`/`FolderPermission` model in `schema.prisma` (count 0). One of two remaining O-items. | P0 #5 |
| O10 | ✅ DONE (#69) — **Content proposal/approval pipeline** — proposer/approver roles, draft→publish | M (3d) | `content.controller.ts` submit/approve/reject endpoints + `content.service.ts` approval methods + `content/dto/approval.dto.ts`. **Supersedes M4 + Q7.** | P0 #5 |

**Status (reconciled 2026-05-31): 8 of 10 OptiSigns items SHIPPED** (O1/O2/O4/O5/O6/O7/O8/O10 — PRs #63–#71 + #109). **Only O3 (Designer depth) and O9 (Teams/folder-ACL) remain**, both L (5d) and not yet started. Several shipped items were "lean MVP / lean cut" — secondary sub-features (O2 scheduled-email/PDF, O5 SDK/OpenAPI-export, O6 bulk-CSV) may be partial; verify against the specific sub-feature before claiming a gap.

---

## P3 — QUARTER 1 (Months 2-3)

| # | Item | Effort | Status | Notes |
|---|------|--------|--------|-------|
| Q1 | OAuth / social login (Google) | M (2d) | ✅ DONE | `POST /auth/google` verifies Google ID tokens via `google-auth-library`; login/register pages render GSI when configured. |
| Q2 | Per-user/org feature flags | M (2d) | 🟡 PARTIAL | Per-org flags shipped (`organizations/feature-flags.service.ts` + settings UI). Per-user flag overrides are not built. |
| Q3 | RSS/news feed widget | M (1d) | ✅ DONE | `RssDataSource`, RSS parser/proxy, `RssWidget`, and dashboard widget-create UI. |
| Q4 | Social media feed widget (Instagram) | M (2d) | ✅ DONE | URL/post-list `SocialFeedWidget` covers multiple platforms by hostname. Backend Instagram/Twitter/Facebook data sources are stubs returning sample data; real Graph/API integration is deferred. |
| Q5 | Clock/countdown widget | S (4h) | ✅ DONE | `ClockWidget` supports clock and countdown modes; dashboard widget UI exposes both. |
| Q6 | AI Template Designer (integrate Claude/OpenAI) | L (5d) | TODO | API costs — need revenue first |
| Q7 | Content approval workflow | M (2d) | ✅ DONE | Superseded by **O10** (#69): content proposal/approval pipeline. |
| Q8 | Custom branding per organization | M (2d) | ✅ DONE | Organization branding endpoints, logo upload, `CustomizationProvider`, and dashboard customization/settings UI. |
| Q9 | Return policy page + SLA page | S (4h) | ✅ DONE | `/refund` and `/sla` pages exist and are linked from the public footer. |
| Q10 | Expand template library to 300+ | L (5d) | TODO | |

**Remaining P3:** Q2 per-user overrides, Q6, Q10. Q1/Q3/Q4/Q5/Q7/Q8/Q9 shipped.

---

## P4 — FUTURE (When revenue supports)

| # | Item | Effort | Status | Notes |
|---|------|--------|--------|-------|
| F1 | 2FA / MFA (TOTP + backup codes) | M (2d) | TODO | Enterprise expectation |
| F2 | SSO/SAML | L (5d) | TODO | Enterprise requirement |
| F3 | Fire TV support | M (3d) | TODO | Platform expansion |
| F4 | Chromecast support | M (3d) | TODO | Platform expansion |
| F5 | Background music add-on | L (5d) | TODO | Licensing complexity |
| F6 | Kiosk mode (touchscreen) | L (5d) | TODO | Different product, different market |
| F7 | QR scan-to-interact | M (3d) | TODO | |
| F8 | Video wall support | L (5d) | TODO | Niche, complex |

**Total effort: ~30+ dev-days**

---

## DESIGN EXPLORATIONS (Parked, not for merge/deploy)

| # | Item | Branch | Status | Notes |
|---|------|--------|--------|-------|
| D1 | **Atelier homepage redesign** (champagne accent, italic Cormorant, canvas mockup hero, `/` + `/product` two-page split) | `feat/design-explorations` | Parked — needs Sri's approval before merge/deploy | Static previews live at `vizora.cloud:8090–8099`. App-code refactor on branch only. Full write-up in `tasks/feature-backlog.md` → "Atelier Homepage Redesign". **DO NOT MERGE.** |

---

## KNOWN ISSUES (Non-blocking, track for future)

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| K1 | Electron auto-start on boot not configured | Low | FIXED | Packaged display clients configure OS auto-start (Windows/macOS login item, Linux autostart desktop file with AppImage path support) |
| K2 | Electron powerSaveBlocker not enabled | Low | FIXED | Packaged display clients start `prevent-display-sleep` and stop it on quit |
| K3 | Electron auto-update not configured | Low | REPO-FIXED / OPERATOR-GATED | Admin-only `update` fleet command now reaches packaged display clients through `electron-updater` with backend + client feed allowlist checks; live rollout still requires signed artifacts on an allowlisted HTTPS feed and target-specific signing verification |
| K4 | Display client has 0 test coverage | Medium | FIXED | Electron display Jest suite, typecheck, and build are CI-gated; real-device walkthrough still required |
| K5 | 3 pre-existing RSC admin test failures | Low | FIXED | Historical RSC-admin failure is stale. Pass71 verified all current admin web tests: 8 suites / 80 tests passed; known React `act(...)` warning noise remains non-failing |
| K6 | AI Designer returns "launching soon" stub | Info | TODO | Intentional — needs API budget |
| K7 | Push-to-group iterates client-side | Low | FIXED | Generalized fleet command endpoint accepts `target.type = group`; `fleet.service` resolves display-group members server-side and fans out through the existing gateway broadcast path |
| K8 | Playlist loop UI not fully wired | Low | FIXED | Fixed in unblocked tasks sprint |
| K9 | No admin/support MFA reset path | Medium | DEFERRED — prerequisite | Zero `mfaEnabled`/`mfaSecret` refs in `admin/` or `users/`; `mfa/disable` needs a TOTP or backup code, so losing both means direct DB access. Harmless while MFA is optional; **must exist before `mfaRequired` is enforced broadly**. Needs a new super-admin audited endpoint — do not build UI first |
| K10 | `@Cron` fires in every PM2 cluster instance | Medium | **FIXED (scoped)** | `CronLeaderService` now ships (PR #228 superseded/closed). 7 of 15 `@Cron` sites are leader-locked, 6 are deliberately not (already idempotent via CAS/P2002/dedup-window), and 2 **must** run per instance (per-worker health state, per-worker Prometheus gauge). Both directions pinned by `common/services/cluster-cron-policy.spec.ts`. The lock is **fail-open**, so customer-visible paths still need their own idempotency underneath it — see the cluster-cron section in CLAUDE.md before adding a cron |
| K19 | `claimDunningNotice` carries the same dead null-check — and there it aborts the whole ladder run | **High** | OPEN | `entitlement.service.claimDunningNotice` does `const client = this.redis.getClient(); if (!client) return false;` — the identical D1 defect fixed in `CronLeaderService`: `getClient()` returns the ioredis object, which is non-null during an outage, so the guard never fires. **Worse here than a stall**: the subsequent `client.set` is unguarded, so its rejection propagates out of `advanceRung`'s per-org loop, out of `advanceLadder`, and is caught only by `handleGracePeriodExpiry`'s outer catch. **One Redis hiccup therefore aborts the entire ladder run mid-way**, leaving every later rung unadvanced for the day and skipping `writeHeartbeat` — which is what the freshness watchdog keys on. Pre-existing, but note that PR #356's own docs cite that SET-NX as part of why the ladder is safe to leave unlocked, so this partially undercuts that argument. Fix: mirror the `isAvailable()` pre-check + bounded timeout + per-org try/catch so one org's Redis failure cannot abort the run. **FIXED in PR #359**: per-org + per-rung isolation, `isAvailable()` gate + bounded `raceWithTimeout`, and the claim now fails **OPEN** (the CAS already caps mail at one per (org, rung), so fail-closed only ever dropped a customer's sole escalation notice). Run outcome is returned + heartbeated + read by the freshness watchdog. #356's cited mechanism corrected in the same PR |
| K21 | The dunning claim key is episode-agnostic, so a legitimate SECOND escalation inside 40 days is dropped | Medium | OPEN | `claimDunningNotice` keys on `dunning:${orgId}:${rung}` with a 40-day TTL and no episode discriminator. A customer who goes past_due → publish_locked, RECOVERS, then goes past_due → publish_locked again within 40 days finds the stale key and the second escalation email is suppressed — the same §12b permanent-drop as K19, in the direction PR #359 did **not** change (that PR only fixed the store-unavailable branch). Note this cuts **in favour** of #359's fail-open: with Redis down the claim is skipped and the correct second email goes out. It also makes #359's "at most one email per (org, rung)" literally false across episodes — but the extra email is legitimate, not spam. Fix: append `entitlementStateSince.getTime()` to the key so each episode gets its own claim namespace |
| K20 | `sendTrialReminders` is lock-only — no second defence against a fail-open double-send | Medium | OPEN | Unlike `expireTrials` (which PR #356 gave a status-guarded `updateMany` CAS), the reminder path has **no** idempotency of its own. The leader lock is fail-open by design, so a Redis outage at 08:00 sends **every** trial reminder twice with nothing to catch it. Note a Redis `SET NX` claim would **not** help — it fails open in the same outage that caused the problem. The real second defence is a persisted marker (`reminderSentAt`-style column, or a sent-notice row keyed on org + days-before-expiry), which needs a **migration** and is therefore its own task, not a follow-up commit |
| K18 | A leader that dies mid-run loses that run until the next window | Low | OPEN — accepted for now | `CronLeaderService` takes the lock and lets it EXPIRE; there is no completed-marker. If the winning instance is killed mid-run (realistically: a PM2 reload landing inside the run) that tick is simply lost — cheap for an every-minute cron, but for a daily one like `handleTrialLifecycle` it means the job does not happen until 08:00 **the next day**, so a day's trial reminders/expiries are skipped silently. Fix would be a second `cron:done:<name>` key written on completion, with the next tick re-running when the window shows started-but-never-completed; deliberately out of scope of the leader-lock PR. Note the fail-open path makes this strictly less likely than it sounds (a Redis outage means both instances run) |
| K11 | Ops fleet monitoring sees one org only | Medium | BY DESIGN — understood | The ops account belongs to `E2E Test Org` and the displays REST API is org-scoped, so `fleet-manager` only ever saw 5 of 24 displays. Real per-tenant coverage lives in the alert-rule engine; cross-tenant scope was **rejected**. Do not "fix" by widening scope |
| K12 | Ops agents re-login every cron firing | Low | MITIGATED | Sessions are now released each run (minted = revoked). Root cause — password auth per run rather than an API key — remains |
| K13 | content-lifecycle can auto-archive REFERENCED content — on truncation, and on reference types it never considered | **High** | **FIXED** | Three defects, all latent on prod (the ops principal is org-scoped to "E2E Test Org": 8 content items, 3 playlists, 0 archived in 7 days, 0 zone pins, 0 replacement refs). (1) #353 gated incident *resolution* on `contentScanComplete` but left the archive WRITE unconditional — the incomplete branch logged, raised `scan-truncated` and archived anyway. The boundary is exact and per-org at **501** (`getAllScan` compares `items.length === meta.total`), and `/playlists` is `createdAt: 'desc'`, so truncation drops the OLDEST playlists — maximally correlated with the >30d archive-eligible population. (2) GAP-1: layout `metadata.zones[].contentId` pins were invisible (`CONTENT_LIST_SELECT` omits `metadata`) and archiving a zone-pinned item BLANKS THAT ZONE on live glass — **live-reachable at any tenant size, no truncation needed**. (3) GAP-2: `Content.replacementContentId` was not in `referencedIds`. Fixed in three layers: the destructive call site now sits inside `if (counters.contentScanComplete)` (pinned by `content-lifecycle-archive-gate.test.ts`), every candidate is re-confirmed with `GET /content/:id` before its archive (untruncatable by construction; also closes the whole-run concurrency window), and layout zones + replacement pointers join the reference set. **"Raise the page-walk cap" was explicitly rejected** — it re-arms the identical defect at the new number and does nothing for the reference types. See K21 for the durable server-side fix |
| K14 | `api-client.ts` `getAll` treats an unrecognized list shape as success | Medium | **FIXED** | The `else break` yielded an empty list every caller read as "this tenant has zero entities", so a response-shape drift would blind every ops agent at once. `getAllScan` now **throws**, which each agent's existing fetch try/catch turns into exit 2 with no state write. Fixed in `fix/ops-agent-safe-clearing` rather than deferred: the incident-clearing sweep would have turned that silent empty list into "resolve everything, report HEALTHY" |
| K15 | Invalid `BACKUP_S3_BUCKET` silently disables backups | Medium | **FIXED** | Returned `{ attempted: false, ok: true }` for a bucket failing the format regex, and `db-maintenance.ts` only raises `backup-failed` when `attempted` is true — so a typo produced no backup, no incident and exit 0, indistinguishable from "backups intentionally off". Now returns `{ attempted: true, ok: false, configured: true }`: a typo is a FAILURE, not a disable. Fixed in `fix/ops-agent-safe-clearing` because the new sweep would otherwise have **cleared a real prior `backup-failed` critical** off the malformed-bucket run |
| K16 | Storage utilization is unmonitored end-to-end | Medium | OPEN | `GET /api/v1/health` returns `{status, timestamp}` only (`health.controller.ts:32-36`) — no `storage`/`disk`/`diskUsage` field. So `content-lifecycle`'s storage check reaches the "does not expose storage stats" branch on **every** run and has never produced a verdict in production; it logs the skip every 15 min. `storage_high` / `storage_check_failed` are therefore currently unreachable on prod, and the coverage-key work in `fix/ops-agent-safe-clearing` is a correct-but-dormant logic fix. Either expose real storage stats on a health/readiness endpoint or drop the check — silently probing a field that does not exist is the worse of the two |
| K21 | `GET /content/orphan-candidates` — move the reference model server-side | Medium | OPEN | The durable fix for K13, deliberately NOT done in that PR (it is a middleware change with its own review). **It is the only option that removes the pagination surface entirely**: the agent asks one question and the server answers it with a single query over `playlistItems`, `replacedBy` and the layout-zone JSON, so there is no client-side universe to truncate and no reference type the client can forget. It also closes K13's remaining residual — the in-agent `replacementContentId` harvest reads only the details of the LAYOUTS and the CONFIRMED CANDIDATES, so a referrer still hides its pointer if it is **(a)** younger than the cutoff, **(b)** already archived, **(c)** held by a playlist, or **(d) deferred past `MAX_ARCHIVE_CANDIDATES_PER_RUN`** — (d) being introduced by K13's own per-run cap: candidate #120 is an ordinary candidate whose pointer is simply not read this cycle, so if it points at candidate #5, #5 is archived and #120's expiry swap lands on archived content. `Content.replacedBy` is already a Prisma relation, so the reverse edge exists; nothing but the endpoint is missing. **Scope note:** `Content.previousVersionId` (the version chain) is a THIRD content→content edge that K13 neither harvests nor names — excluding it is defensible, since archiving a superseded version does not blank glass, but the endpoint should enumerate all three edges explicitly rather than leave the set implied |
| K25 | Evidence-free per-ITEM skips still clear that item's stale `orphaned_content` | Medium | **IN PR** — `fix/ops-item-level-clearing` | K24's shape one level down. K13 gates incident resolution on whether the *check* ran (`contentScanComplete && referenceHarvestComplete`), but within a run that DID execute, two paths skip an individual item without any evidence about it: a failed confirm read (`GET /content/:id` threw) and deferral past `MAX_ARCHIVE_CANDIDATES_PER_RUN`. Neither falsifies the coverage flag, so a stale `orphaned_content` incident for that item is cleared by non-re-raise — a check that did not run **for an item** clears that item's finding. Two-line fix: collect the skipped ids and add them to the `currentIncidentIds` set passed to `resolveNotReraisedForTypes`, so a skipped item's incident is treated as re-raised rather than resolved. Latent at prod's 8-item scale (the cap cannot be reached and the confirm read is local). **Fixed as described** — the two-liner held: `currentIncidentIds` feeds exactly one predicate in `resolveNotReraisedForTypes` (`!has(i.id)`), so an id with no matching prior incident is inert and nothing is fabricated. The skip is also now COUNTED and logged per run (§12a), split by cause, rather than raised as a new incident type — the alert-fatigue trap that made `scan-truncated` info-severity. The **examined**-vs-**unexamined** distinction is the load-bearing half and is pinned by its own test: `playlistItems` / `isGlobal` / named-as-a-replacement skips DID look and must keep resolving, or the fix over-corrects into "`orphaned_content` can only accumulate" |
| K26 | Reviving `checkExpiredContent` must RE-MAKE the gate/confirm decision, not inherit it | Medium | OPEN — blocks K22 | K13 pinned `checkExpiredContent` as deliberately **ungated** by a source-scan test, correctly: its predicate reads only the item's own fields, so truncation yields fewer findings, never a wrong one. That reasoning is about the DETECTION predicate and does **not** extend to the write. The expiry check archives too, and an expired item pinned into a layout zone still blanks that zone — so when K22 revives the check, it needs its own gate/per-item-confirm decision made from scratch, and the source-scan test that currently *asserts it is ungated* must be revisited in the same change or it will actively obstruct the fix. Do not read the existing pin as a standing verdict that the expiry path is safe unguarded |
| K22 | `checkExpiredContent` is a DEAD NO-OP and has never fired | Medium | OPEN | `CONTENT_LIST_SELECT` omits `expiresAt`, so `content-lifecycle.ts`'s `if (c.status !== 'active' \|\| !c.expiresAt) return false` filter always sees `undefined` and the check can never produce a finding. Every `expired_content` incident type, alert and audit path below it is unreachable. **Do not just switch it on**: turning it on will archive the accumulated backlog of expired content in a single run, with a §12b write-site alert per item. Measure the volume first (`SELECT count(*) FROM content WHERE status='active' AND "expiresAt" < now()` per org), then decide between a per-run cap and a one-off supervised sweep. Note the middleware already has its own `content.checkExpiredContent` cron doing the replacement swap, so the two must be reconciled rather than both left running. **See K26** — the revival must re-make the gate/confirm decision rather than inherit K13's "expiry is ungated" pin, which was reasoning about the detection predicate and not the write |
| K23 | content-lifecycle is org-scoped to its own principal — it has never managed customer content | Medium | OPEN — product question | Same shape as K11: the ops account is in "E2E Test Org" and `/content` + `/playlists` are org-scoped, so this agent's entire blast radius is 8 content items in a test org. CLAUDE.md's "Archive expired/orphaned content" reads fleet-wide and is misleading. This is **a product-scope decision, not a bug** — and note that widening it turns every K13-class defect into a cross-tenant one, so K21 should land first. `content-lifecycle-resolution.test.ts` now pins the current org-scoped contract, so a scope widening trips a test rather than shipping quietly |
| K24 | Sweep the other ops agents for "completeness gates resolution but not action" | Medium | OPEN | K13's root shape was: a completeness verdict was computed, wired to the incident-resolution set, and NOT wired to the destructive write it was computed for. `fleet-manager`, `schedule-doctor` and `db-maintainer` all took coverage keys from the same PR (#353) and all take remediation actions. Audit each for the same asymmetry, and where a write is correctly gated, pin the call site with a source-scan test in the shape of `content-lifecycle-archive-gate.test.ts` — the asymmetry is invisible to behavioural tests on any tenant below the truncation boundary, which is every tenant in production today |
| K17 | `issuesFixed` conflates repairs with incident resolutions | Low | OPEN | Since `fix/ops-agent-safe-clearing`, `issuesFixed` counts both actual remediations (a PATCH that deactivated a schedule) and stale-incident resolutions (a check that stopped failing). `ops-reporter` renders it as "Auto-remediated: N" in Slack/email, which now overstates what the agents actually *did*. Follow the ops-watchdog/fleet-manager precedent that created the overload, or add a distinct `issuesResolved` field to `AgentResult` and split the wording |

---

## METRICS

| Metric | Start of Week | Current | Target (Launch) |
|--------|--------------|---------|-----------------|
| Test suites | ~89 | web 113 · middleware 167 · ops 74 tests (verified 2026-08-03) | green |
| Total tests | 1,734 | web 1,167 + middleware 3,350 (verified 2026-08-03) | No regressions |
| Test pass rate | 99.9% | 100% | 100% |
| P0 customer-1 operator gates | 8 | 4* | 0 |
| Console errors (dashboard) | Multiple | ~0 | 0 |
| API endpoints returning 400 | 4 | 0 | 0 |
| Template thumbnails 404 | 100+ | 0 | 0 |
| Health check layers | 2 | 5 | 5 |
| Production readiness | 78% | Repo-side ready; operator-gated | C1-C4 cleared |

*Customer-1 remaining gates: C1 SMTP/Resend verification/test send plus public email-link URL (`APP_URL` or `WEB_URL`), C2 customer-1 org provisioning, C3 real-device walkthrough, C4 final go-live smoke. Stripe/Razorpay live keys are deferred past customer-1 because customer-1 launches on the free tier.

---

## PROMPT FILES (Ready to Run)

| File | Purpose | Dependencies |
|------|---------|-------------|
| `week1-day1-2-email-task.md` | Email verification, invite emails, unsubscribe | SMTP/Resend configured and verified |
| `week1-day3-4-billing-task.md` | Billing checkout, subscriptions, webhooks | Post-customer-1 payment provider setup |
| `week1-day7-8-smoke-test-task.md` | Full go-live smoke test (60 steps) | C1-C3 complete |
| `vizora-comprehensive-e2e-test.md` | Full E2E test (76 tests, 12 suites) | App running |
| `overnight-hardening-loop-task.md` | Backend hardening (12 areas) | None |
| `overnight-ui-hardening-task.md` | UI hardening (15 areas) | Dev server running |
| `production-readiness-review-task.md` | Deep code review audit | None |
| `fit-gap-analysis-task.md` | Competitor analysis + gap report | None |
| `vizora-health-infrastructure-task.md` | Health monitoring (5 layers) | None |
| `template-overhaul-and-editor-fix-task.md` | Replace all templates + fix editor | None |
| `indian-restaurant-templates-task.md` | 12 Indian restaurant templates | None |
| `support-agent-task.md` | In-app support chat widget | None |
| `vizora-demo-video-task.md` | Product demo video (Remotion + Playwright) | None |
| `detach-android-app-task.md` | Detach Android TV to standalone repo | None |
| `detach-ios-app-task.md` | Detach iOS/Apple TV to standalone repo | None |
| `fix-template-editor-task.md` | Fix editor viewport scaling + UX | None |
| `regenerate-templates-premium-task.md` | Replace templates with OptiSigns quality | None |

---

## ROADMAP

```
CUSTOMER-1 LAUNCH:  C1-C4 operator gates
                     |-- C1: SMTP/Resend prod verification + public email-link URL + operator-approved test send
                     |-- C2: Customer-1 org provisioning
                     |-- C3: Real-device customer hardware walkthrough
                     +-- C4: Final go-live smoke test + report

SOFT LAUNCH:         After C1-C4 cleared
                     +-- Invite 5-10 beta users (restaurants, small businesses)

WEEKS 2-3:          Payment live setup + remaining P1
                     |-- Stripe/Razorpay live keys for first paid customer
                     +-- UptimeRobot setup only (operator/manual)

MONTH 1:            P2 items
                     +-- CDN, template expansion, new-login security alert

QUARTER 1:          P3 items
                     +-- Per-user feature flags, AI Designer, 300+ templates

FUTURE:             P4 items
                     +-- 2FA, SSO, Fire TV, Chromecast, kiosk mode, video wall
```
