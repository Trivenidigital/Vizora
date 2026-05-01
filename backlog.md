# Vizora Backlog

**Last updated:** 2026-03-18
**Production readiness:** ~85% (up from 78% at start of week)
**Tests:** 93 suites, 1,917 tests — ALL PASSING

---

## COMPLETED (This Sprint)

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

## P0 — LAUNCH BLOCKERS (Cannot accept paying customers)

| # | Item | Owner | Effort | Status | Dependencies |
|---|------|-------|--------|--------|-------------|
| B1 | **Configure SMTP on production (SendGrid)** | YOU | 2h | TODO | SendGrid account, DNS access |
| B2 | Set SPF/DKIM/DMARC DNS records for vizora.cloud | YOU | 1h | TODO | DNS access |
| B3 | Set SMTP env vars on production server | YOU | 30m | TODO | B1 complete |
| B4 | Test all 8 existing email types end-to-end | Claude Code | 2h | TODO | B3 complete |
| B5 | **Build email verification flow** (token, endpoint, template, soft enforcement) | Claude Code | 4h | TODO | B3 complete |
| B6 | Wire team invite email to mail service | Claude Code | 1h | TODO | B3 complete |
| B7 | Add unsubscribe link to non-transactional emails | Claude Code | 1h | TODO | B3 complete |
| B8 | **Create Stripe account + products + prices** (4 tiers x 2 intervals) | YOU | 2h | TODO | Business bank account |
| B9 | **Create Razorpay account + plans** (4 tiers x 2 intervals, INR) | YOU | 2h | TODO | Indian business entity or partner |
| B10 | Configure Stripe webhook endpoint | YOU | 30m | TODO | B8 complete |
| B11 | Configure Razorpay webhook endpoint | YOU | 30m | TODO | B9 complete |
| B12 | Set billing env vars on production | YOU | 30m | TODO | B8 + B9 complete |
| B13 | Update plans.ts with real Stripe/Razorpay price IDs | Claude Code | 1h | TODO | B8 + B9 complete |
| B14 | **End-to-end billing test** (register -> checkout -> subscription -> invoice) | Claude Code | 4h | TODO | B12 + B13 complete |
| B15 | Test billing failure scenarios (declined card, cancel, webhook retry) | Claude Code | 2h | TODO | B14 complete |
| B16 | **Full go-live smoke test** (60-step user journey) | Claude Code | 3h | TODO | All above complete |

**Prompt files ready:**
- `week1-day1-2-email-task.md` -> covers B4-B7
- `week1-day3-4-billing-task.md` -> covers B13-B15
- `week1-day7-8-smoke-test-task.md` -> covers B16

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
