# Vizora Backlog

**Last updated:** 2026-05-11
**Production readiness:** ~75% — three operator-driven launch blockers open (see P0 below); technical foundation strongest on record
**Tests:** 124 middleware suites / 2335 tests, 10 realtime suites / 212 tests, 79 web suites / 864 tests — ALL PASSING (zero failures). Playwright 24 specs at >90% pass post-2026-05-09 refresh. Verified by autonomous pass `docs/plans/2026-05-09-test-results.md`.
**Customer-1 launch target:** 2026-05-13 (T-2 from today) — **status unconfirmed**; operator must confirm before T-2 prep work continues.

---

## COMPLETED (Since Last Backlog Update — 2026-03-18 → 2026-05-11)

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

## P0 — LAUNCH BLOCKERS for customer-1 (2026-05-13 target)

Per 2026-05-09 readiness pass: the three operator-driven items below are the GO/NO-GO gates. Technical foundation is sound — these are unblockable by code.

| # | Item | Owner | Effort | Status | Notes |
|---|------|-------|--------|--------|-------|
| **C1** | **SMTP / Resend on prod — domain `mail.vizora.cloud` verified (DKIM/SPF/DMARC), `SMTP_*`/`EMAIL_FROM` env set, test send works end-to-end** | Sri | 2h | TODO | Without this, customer registration emails + password resets don't send |
| **C2** | **Customer-1 organization provisioned on prod** (skeleton, admin user invite, plan, quota) | Sri | 1h | TODO | Skip if customer self-registers |
| **C3** | **Real-device walkthrough on customer hardware** (pair, push playlist, reboot, network-flap) | Sri + customer IT | 2h | TODO | Electron has 0% functional test coverage; this IS the test |
| **C4** | B16 60-step go-live smoke test on prod | Claude Code (driven by Sri) | 3h | BLOCKED on C1-C3 | Operator-driven; document in `docs/runbooks/customer-1-go-live-smoke-{DATE}.md` |

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

These are documented + non-blocking for customer-1. Investigations done; implementations deferred.

| # | Item | Effort | Pointer | Why deferred |
|---|------|--------|---------|--------------|
| T1 | Playwright suite refresh — close remaining ~26 failures (heaviest: 16-billing×10) | 6-8h | `docs/plans/2026-05-09-playwright-results.md` | Critical-path flows verified (8/10); 16-billing is OUT of customer-1 scope |
| T2 | Per-firing cost attribution (Path A: balance-delta pre/post each firing) | ~1h | `docs/plans/2026-05-09-hermes-insights-investigation.md` | Cost defense intact (4 layers); attribution is monitoring-quality |
| T3 | agentRunId propagation runner→Hermes→MCP — Hermes 0.12.0 has no `--header` flag; needs upstream patch OR env-var config interpolation experiment | 2h-2d | `docs/plans/2026-05-09-agent-run-id-propagation-investigation.md` | Sidecar's audit-row join falls back to time-range; minor refinement degradation |
| T4 | support-triage cross-tenant token redesign — Option 2 (relax `support:*` tools to accept platform-scope) | 4-6h | `docs/plans/2026-05-09-support-triage-cross-tenant-design.md` | support-triage NOT enabled; operator handles tickets directly |

---

## P1 — LAUNCH WEEK (Should have within first week of launch)

| # | Item | Effort | Status | Notes |
|---|------|--------|--------|-------|
| L1 | Device offline email notification to customers | S (4h) | TODO | Ops agent detects offline but doesn't email customer |
| L2 | Set up UptimeRobot monitoring for health endpoints | XS (1h) | TODO | Manual: create account, add monitors |
| L3 | Custom error pages (branded 404, 500) | S (4h) | TODO | Currently default/unstyled |
| L4 | Basic knowledge base / help docs page | M (1d) | TODO | FAQ + getting started guide |
| L5 | Proof-of-play tracking (log content displayed per device) | M (1d) | TODO | Advertisers need this |
| L6 | Emergency content override (push urgent to all devices) | S (4h) | TODO | Critical for corporate/healthcare |
| L7 | Device remote reload command via WebSocket | S (2h) | TODO | Remote restart already missing too |
| L8 | Wire real-time notification emission on creation | S (2h) | TODO | Currently polling, not real-time |
| L9 | Reduce notification polling (25s -> 60s or WebSocket) | XS (1h) | TODO | Performance improvement |

**Total effort: ~7 dev-days**

---

## P2 — FIRST MONTH (Build within 30 days of launch)

| # | Item | Effort | Status | Notes |
|---|------|--------|--------|-------|
| M1 | CloudFlare CDN + DDoS protection | S (4h) | TODO | Static assets served directly now |
| M2 | Weather widget (OpenWeatherMap free API) | M (1d) | TODO | Top customer request for signage |
| M3 | Google Sheets data source integration | L (3d) | TODO | Key for dynamic menu boards |
| M4 | Content moderation workflow (flag -> review -> approve) | M (2d) | TODO | |
| M5 | Expand template library to 150 templates | M (2d) | TODO | Currently 78 |
| M6 | Device remote restart command | S (4h) | TODO | |
| M7 | Push-to-group endpoint (single API call) | S (4h) | TODO | Currently iterate client-side |
| M8 | Data retention policy (auto-purge audit logs > 90 days) | S (4h) | TODO | |
| M9 | Profile editing: avatar upload | S (4h) | TODO | Name editing done, avatar missing |
| M10 | Fix Loki volume mount (logs lost on restart) | XS (1h) | TODO | Docker-compose change |
| M11 | GDPR data export endpoint | M (1d) | TODO | Subject Access Request |
| M12 | Security alert emails (new login, password changed) | S (4h) | TODO | |

**Total effort: ~15 dev-days**

---

## P3 — QUARTER 1 (Months 2-3)

| # | Item | Effort | Status | Notes |
|---|------|--------|--------|-------|
| Q1 | OAuth / social login (Google) | M (2d) | TODO | |
| Q2 | Per-user/org feature flags | M (2d) | TODO | Currently plan-level only |
| Q3 | RSS/news feed widget | M (1d) | TODO | |
| Q4 | Social media feed widget (Instagram) | M (2d) | TODO | |
| Q5 | Clock/countdown widget | S (4h) | TODO | |
| Q6 | AI Template Designer (integrate Claude/OpenAI) | L (5d) | TODO | API costs — need revenue first |
| Q7 | Content approval workflow | M (2d) | TODO | |
| Q8 | Custom branding per organization | M (2d) | TODO | |
| Q9 | Return policy page + SLA page | S (4h) | TODO | Legal |
| Q10 | Expand template library to 300+ | L (5d) | TODO | |

**Total effort: ~20 dev-days**

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
| K1 | Electron auto-start on boot not configured | Low | TODO | Android TV has it, Electron doesn't |
| K2 | Electron powerSaveBlocker not enabled | Low | TODO | Screen may sleep |
| K3 | Electron auto-update not configured | Low | TODO | electron-updater referenced but not wired |
| K4 | Display client has 0 test coverage | Medium | TODO | Android TV app untested |
| K5 | 3 pre-existing RSC admin test failures | Low | TODO | React Server Component edge cases |
| K6 | AI Designer returns "launching soon" stub | Info | TODO | Intentional — needs API budget |
| K7 | Push-to-group iterates client-side | Low | TODO | No server-side batch endpoint |
| K8 | Playlist loop UI not fully wired | Low | FIXED | Fixed in unblocked tasks sprint |

---

## METRICS

| Metric | Start of Week | Current | Target (Launch) |
|--------|--------------|---------|-----------------|
| Test suites | ~89 | 93 | 95+ |
| Total tests | 1,734 | 1,917 | 2,000+ |
| Test pass rate | 99.9% | 100% | 100% |
| P0 blockers | 8 | 3* | 0 |
| Console errors (dashboard) | Multiple | ~0 | 0 |
| API endpoints returning 400 | 4 | 0 | 0 |
| Template thumbnails 404 | 100+ | 0 | 0 |
| Health check layers | 2 | 5 | 5 |
| Production readiness | 78% | ~85% | 95%+ |

*Remaining P0s are config-only: SMTP setup, Stripe/Razorpay keys, final smoke test

---

## PROMPT FILES (Ready to Run)

| File | Purpose | Dependencies |
|------|---------|-------------|
| `week1-day1-2-email-task.md` | Email verification, invite emails, unsubscribe | SendGrid configured |
| `week1-day3-4-billing-task.md` | Billing checkout, subscriptions, webhooks | Stripe/Razorpay configured |
| `week1-day7-8-smoke-test-task.md` | Full go-live smoke test (60 steps) | Day 1-4 complete |
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
WEEK 1 (NOW):       P0 Blockers — SMTP, Billing, Smoke Test
                     |-- Day 1-2: Email (you: SendGrid, Claude: verification flow)
                     |-- Day 3-4: Billing (you: Stripe/Razorpay, Claude: test checkout)
                     +-- Day 7-8: Smoke test + go-live report

SOFT LAUNCH:         After P0 cleared
                     +-- Invite 5-10 beta users (restaurants, small businesses)

WEEKS 2-3:          P1 Launch Week items
                     +-- Offline alerts, monitoring, error pages, help docs, proof-of-play

MONTH 1:            P2 items
                     +-- Weather widget, Google Sheets, CDN, more templates, GDPR export

QUARTER 1:          P3 items
                     +-- OAuth, AI Designer, RSS, social feeds, approval workflows

FUTURE:             P4 items
                     +-- 2FA, SSO, Fire TV, Chromecast, kiosk mode, video wall
```
