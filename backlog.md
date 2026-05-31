# Vizora Backlog

**Last updated:** 2026-05-31 (main at `7ecd6f3`)
**Production readiness:** ~75% — three operator-driven launch blockers open (see P0 below); technical foundation strongest on record
**Tests:** 124 middleware suites / 2335 tests, 10 realtime suites / 212 tests, 79 web suites / 864 tests — ALL PASSING (zero failures). Playwright 24 specs at >90% pass post-2026-05-09 refresh. Verified by autonomous pass `docs/plans/2026-05-09-test-results.md`.
**Customer-1 launch target:** 2026-05-13 (T-2 from today) — **status unconfirmed**; operator must confirm before T-2 prep work continues.

**Security/realtime hardening wave (#107–#114, merged through 2026-05-31, main `7ecd6f3`):** session invalidation now spans REST + WebSocket — password-change / account-deactivation force-logout across all devices (REST `#111`, WS connect-time `#112`, WS mid-session 60s sweep `#114`). Launch-week and first-month rows shipped across the #63–#114 waves; M12 half-shipped. P1/P2 tables below reconciled to match.

---

## COMPLETED (Since Last Backlog Update — 2026-03-18 → 2026-05-11)

### Security & realtime hardening wave (2026-05-30 → 2026-05-31, PRs #107–#114)

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
| M12 | Security alert emails (new login, password changed) | S (4h) | 🟡 PARTIAL | Password-changed email shipped (#110, `MailService.sendPasswordChangedEmail`). New-login / unrecognized-device half DEFERRED — needs login IP / device-history schema migration. |

**Remaining P2 repo-side items:** M1, M5, and M12's new-login/unrecognized-device half. M2/M3/M4/M6/M7/M8/M9/M10/M11 shipped.

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

WEEKS 2-3:          Remaining P1
                     +-- UptimeRobot setup only (operator/manual)

MONTH 1:            P2 items
                     +-- CDN, template expansion, new-login security alert

QUARTER 1:          P3 items
                     +-- Per-user feature flags, AI Designer, 300+ templates

FUTURE:             P4 items
                     +-- 2FA, SSO, Fire TV, Chromecast, kiosk mode, video wall
```
