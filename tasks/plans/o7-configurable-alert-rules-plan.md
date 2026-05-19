# O7 — Configurable Downtime Alert Rules — Plan

**Date:** 2026-05-19
**Audit ref:** P1 #6 (`docs/plans/2026-05-17-optsigns-vizora-feature-gap.md`)
**Backlog ref:** `backlog.md` → "OptiSigns Parity Roadmap" → O7
**Branch:** `feat/o7-configurable-alert-rules`
**Effort:** S (1.5 dev-days — revised after plan review; original 1d understated test + email work)
**Drift-check tag:** `extends-Hermes`

This work builds Vizora middleware infrastructure for a domain Hermes does not own (NestJS event bus + Prisma schema + HTTP surface). Hermes substrate (WhatsApp ingestion, vision, skill dispatch, multi-channel response from a Python runtime) is orthogonal. Future agents that want to *read* these rules can do so via a new MCP tool over the same table; the table + evaluator themselves live in middleware. See `tasks/.hermes-check-receipts/o7-configurable-alert-rules.json` for the per-step checklist receipt.

## Hermes-first capability checklist

Per `CLAUDE.md §7b`. All 12 steps of the end-to-end flow are `[net-new]` against the Hermes capability list because this is Vizora *platform/middleware* work, not *agent* work. The Hermes capabilities (WhatsApp ingest, vision OCR, skill chain, log-decision-direct, etc.) operate inside the Hermes Python runtime — none of them substitute for NestJS `@OnEvent`, Prisma queries, or Vizora's MailService.

| # | Step | Tag | Why |
|---|------|-----|-----|
| 1 | Stale-device sweep emits `device.offline` event (existing `displays.service.ts:305-332`) | `[net-new]` | Vizora middleware cron + Redis state — Hermes substrate cannot reach |
| 2 | `AlertRuleEvaluator` `@OnEvent('device.offline')` handler | `[net-new]` | NestJS decorator, not Hermes skill dispatch |
| 3 | Prisma query against new `AlertRule` table | `[net-new]` | Vizora Prisma schema, not Hermes per-VPS state |
| 4 | Scope matching (all / tag / group / display) | `[net-new]` | Vizora domain (Tag, DisplayGroup, Display) |
| 5 | `minOfflineSec` debounce + 15-min dedup window | `[net-new]` | Application logic in TypeScript |
| 6 | Recipient dispatch — `in_app` channel | `[net-new]` | Vizora's `Notification` table; not Hermes audit chain |
| 7 | Recipient dispatch — `email` channel | `[net-new]` | Vizora `MailService` (SMTP/Resend); Hermes email is *from* the Hermes runtime, not from inside NestJS |
| 8 | Recipient dispatch — `slack_webhook` channel | `[net-new]` | Direct HTTPS POST; Hermes has no Slack channel |
| 9 | REST CRUD endpoints under `/api/v1/notifications/alert-rules` | `[net-new]` | NestJS controllers |
| 10 | Zod/class-validator DTO validation | `[net-new]` | NestJS standard; existing pattern |
| 11 | Prisma migration + data seed (preserve historical behavior) | `[net-new]` | Vizora Prisma migration scripts |
| 12 | Remove hard-coded `handleDeviceOffline` in `notifications.service.ts:277` | `[net-new]` | Vizora source change |

**Red-flag check:** 12/12 `[net-new]` is the correct disposition. Re-examined common misses (state files → using Prisma not Hermes SKILL state; audit rows → existing `AuditLog` interceptor stays; operator script → CRUD via REST; input validation → DTO layer). Hermes is not a substitute for NestJS+Prisma here.

## Drift-rule self-checks

Per `CLAUDE.md §7a`: read deployed code before drafting schema/handler/tests.

- ✅ Read `packages/database/prisma/schema.prisma` (Organization at line 17; Display at line 118; DisplayGroup at line 160; Tag at line 352; DisplayTag at line 383; Notification at line 454) — confirmed model shapes, relations, and indexes used in scope-match path
- ✅ Read `middleware/src/modules/notifications/notifications.service.ts` (lines 260-302 — existing `@OnEvent('device.online')` and `@OnEvent('device.offline')` handlers; only the `device.offline` handler is being replaced)
- ✅ Read `middleware/src/modules/displays/displays.service.ts` (lines 280-332 — confirmed `device.offline` is emitted from `detectOfflineDevices()` cron with payload `{ deviceId, deviceName, organizationId }`; **field is `lastHeartbeat` not `lastSeenAt`**; threshold is hardcoded 2 minutes, so `minOfflineSec` below 120 is meaningless — documented below)
- ✅ Read `middleware/src/app/app.module.ts` (lines 36-56 — `EventEmitterModule.forRoot({ ignoreErrors: false, verboseMemoryLeak: true })`; the INVARIANT in the comment says async handlers must wrap in try/catch — applied below)

## Problem

Today every org user receives the same in-app `device.offline` notification when any display in their org transitions to offline. This is fired by a hard-coded `@OnEvent('device.offline')` handler at `middleware/src/modules/notifications/notifications.service.ts:277`. There is:

- No way to route alerts to specific recipients (only the store-ops team, not the whole org)
- No way to scope by tag (only lobby displays) or by display group
- No way to add a debounce / minimum-duration threshold (one flap → one alert)
- No way to send to external channels (email, Slack webhook) instead of / in addition to in-app
- No way to disable alerts for specific displays without disabling the org-wide handler

OptiSigns customers running multi-region fleets need these. So do Vizora customers, but until now there was nowhere to express the rule.

## Goals

1. Replace the hard-coded `device.offline` handler with a **rule-driven evaluator** that reads `AlertRule` rows for the org and dispatches notifications per rule.
2. Each rule defines: scope (all / tag / group / display), recipients (in-app + email + Slack webhook), and a minimum-offline-duration threshold.
3. Migration seeds a default rule per existing org → existing behavior preserved.
4. Provide CRUD API for rules.

## Non-goals (out of scope for this PR)

- `device.online` recovery alerts (defer — most ops teams want offline only; future `triggerEvent` enum extension)
- Quiet hours / day-of-week schedules (would require an `AlertSchedule` model — defer)
- Per-rule escalation chains ("if not ack'd in 15 min, page on-call") — defer
- Per-recipient delivery preferences / unsubscribe — defer
- SMS / PagerDuty / Opsgenie — out of scope; Slack webhook is the bridge

## Affected files (predicted)

```
packages/database/prisma/schema.prisma                                       (add AlertRule + AlertRuleRecipient models)
packages/database/prisma/migrations/<timestamp>_add_alert_rules/migration.sql
middleware/src/modules/notifications/notifications.module.ts                 (wire new providers)
middleware/src/modules/notifications/notifications.service.ts                (REMOVE hard-coded device.offline handler)
middleware/src/modules/notifications/alert-rules/alert-rules.service.ts      (NEW)
middleware/src/modules/notifications/alert-rules/alert-rules.controller.ts   (NEW)
middleware/src/modules/notifications/alert-rules/alert-rule.evaluator.ts     (NEW — owns @OnEvent handler)
middleware/src/modules/notifications/alert-rules/dto/*.ts                    (NEW — DTOs)
middleware/src/modules/notifications/alert-rules/__tests__/*.spec.ts         (NEW)
```

## Schema (Prisma)

```prisma
model AlertRule {
  id             String   @id @default(cuid())
  organizationId String
  name           String                        // user-facing label
  triggerEvent   String                        // enum-like: "device.offline" (extensible)
  isActive       Boolean  @default(true)
  scope          String                        // "all" | "tag" | "group" | "display"
  scopeTagId     String?                       // FK to Tag — when scope="tag"
  scopeGroupId   String?                       // FK to DisplayGroup — when scope="group"
  scopeDisplayId String?                       // FK to Display — when scope="display"
  minOfflineSec  Int      @default(120)        // debounce; minimum 120 because the stale-heartbeat cron threshold is 2min
  recipients     AlertRuleRecipient[]
  lastFiredAt    DateTime?                     // dedup window
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  scopeTag     Tag?          @relation(fields: [scopeTagId], references: [id], onDelete: SetNull)
  scopeGroup   DisplayGroup? @relation(fields: [scopeGroupId], references: [id], onDelete: SetNull)
  scopeDisplay Display?      @relation(fields: [scopeDisplayId], references: [id], onDelete: SetNull)

  @@index([organizationId, isActive])
  @@index([scopeTagId])
  @@index([scopeGroupId])
  @@index([scopeDisplayId])
  @@map("alert_rules")
}

model AlertRuleRecipient {
  id          String   @id @default(cuid())
  alertRuleId String
  channel     String                        // "in_app" | "email" | "slack_webhook"
  target      String                        // userId (in_app) | email | webhook URL
  createdAt   DateTime @default(now())

  alertRule AlertRule @relation(fields: [alertRuleId], references: [id], onDelete: Cascade)

  @@index([alertRuleId])
  @@map("alert_rule_recipients")
}
```

**`minOfflineSec` floor of 120:** the stale-heartbeat cron at `displays.service.ts:305-332` only emits `device.offline` once a device's `lastHeartbeat` is >2 min stale. Setting `minOfflineSec < 120` does nothing extra. The DTO layer rejects values <120 with a 400.

**Two-table over JSON column for recipients:** simpler queries ("find rules emailing X"), referential integrity for in-app channel, easier to extend (per-recipient quiet-hours later).

**String not enum for `triggerEvent` / `scope` / `channel`:** Prisma `String` keeps schema flexible for `device.online` / `content.expired` / `storage.full` extensions without migrations. Validated at DTO layer.

## Service shape

`AlertRulesService` (org-scoped CRUD):
- `create(orgId, dto)` — rule + recipients in transaction
- `findAll(orgId, { isActive?, triggerEvent? })`
- `findOne(orgId, id)` — cross-org guard via compound where
- `update(orgId, id, dto)`
- `remove(orgId, id)`
- `addRecipient(orgId, ruleId, dto)`
- `removeRecipient(orgId, ruleId, recipientId)`

`AlertRuleEvaluator`:
- `@OnEvent('device.offline')` handler — takes over from `notifications.service.ts:277`
- Wrapped in `try/catch` per `app.module.ts:42-54` INVARIANT — uncaught rejection becomes process error under PM2
- Loads active rules: `WHERE organizationId = ? AND triggerEvent = 'device.offline' AND isActive = true`
- For each rule:
  - Match scope against the offline device (skip if no match)
  - Check `minOfflineSec` against `now - device.lastHeartbeat` (skip if below threshold). NB: by the time the event fires, the cron has already passed its own 120s threshold, so most rules with `minOfflineSec=120` will trivially match
  - Check dedup: if `lastFiredAt > now - 15min` for this rule, skip
  - Dispatch to each recipient with per-recipient try/catch (one failure doesn't kill others)
    - `in_app` → insert `Notification` row scoped to `recipient.target` (= userId) — reuses existing Notification schema, not the old broadcast helper
    - `email` → new `MailService.sendAlertEmail(to, rule, device)` method that inlines HTML via the existing `wrapInTemplate(bodyContent)` pattern (no new `.hbs` file — Vizora's MailService inlines HTML in TS, see `sendPasswordResetEmail` for the precedent)
    - `slack_webhook` → POST to recipient.target with `{"text": "..."}` shape
  - Update `lastFiredAt = now`

**Dedup constant:** `DEDUP_WINDOW_MS = 15 * 60 * 1000` (hard-coded v1; per-rule override is a future enhancement).

## Controller / API

```
POST   /api/v1/notifications/alert-rules                — create rule + recipients
GET    /api/v1/notifications/alert-rules                — list (filter: isActive, triggerEvent)
GET    /api/v1/notifications/alert-rules/:id            — detail
PATCH  /api/v1/notifications/alert-rules/:id            — update
DELETE /api/v1/notifications/alert-rules/:id            — hard delete (cascades to recipients)
POST   /api/v1/notifications/alert-rules/:id/recipients
DELETE /api/v1/notifications/alert-rules/:id/recipients/:recipientId
```

All under existing `JwtAuthGuard` + org-scope via `@CurrentUser('organizationId')` decorator (existing pattern, confirmed in `notifications.controller.ts:29-32`).

RBAC:
- `POST` / `GET` / `PATCH` / `POST recipients` — any logged-in org user (allows team self-service)
- `DELETE` rule + `DELETE recipient` — gated behind `@Roles('admin')` to prevent accidental teardown of admin-configured rules (matches the pattern on `notifications.controller.ts` manual-notification create at lines 29-31)

(Future: full `manage:alerts` permission once O9 lands.)

## Migration / behavior change

**Behavior change:** today every org gets implicit alerts; post-deploy only orgs with explicit rules do.

**Mitigation:** the migration includes a data step that seeds a default `AlertRule` per existing org:
- `name = "Default offline alert (auto-migrated)"`
- `scope = "all"`, `triggerEvent = "device.offline"`, `isActive = true`, `minOfflineSec = 120`
- One recipient per org admin (channel=`in_app`, target=admin's userId)

Preserves existing per-admin in-app notification behavior 1:1. New orgs created after deploy get no default rule.

**Zero-admin orgs:** an org with no users having `role='admin'` gets the AlertRule row created but zero recipients. The evaluator iterates zero recipients → no-op. Logged at INFO level so post-deploy ops can spot orgs that need a manual recipient added.

**Idempotency:** seed runs as raw SQL `INSERT ... ON CONFLICT DO NOTHING` keyed on `(organizationId, name)`.

## Tests

Unit (Jest, mocked DB):
- `alert-rules.service.spec.ts` — CRUD + cross-org guard (any operation with wrong orgId → NotFound)
- `alert-rule.evaluator.spec.ts` — fires/skips per scope; dedup window; per-recipient try/catch; debounce threshold; SSRF guard rejects non-Slack hosts
- `alert-rules.controller.spec.ts` — happy path + 404 cross-org + 400 bad DTO

Removed:
- The existing `handleDeviceOffline` unit tests in `notifications.service.spec.ts` (handler being deleted)

## Risks

| Risk | Mitigation |
|---|---|
| Behavior change to existing orgs | Data migration seeds default rule per org |
| Webhook target is hostile URL (SSRF) | Validate `slack_webhook` target against `^https://hooks\.slack\.com/services/` regex; reject anything else for v1. **Channel expansion to PagerDuty / Discord / Teams is deferred** — each needs its own URL allowlist, payload shape, and integration tests; explicit follow-up PR required |
| Email storm from misconfigured rule | 15-min dedup per (rule, device); `MAX_RECIPIENTS_PER_RULE = 20` enforced at DTO layer |
| Cascade delete: rule deleted while evaluator running | Evaluator loads snapshot at event time; in-flight dispatches complete using snapshot |
| Scope FK target deleted (tag/group/display) | `onDelete: SetNull` + evaluator skips with `WARN` log when scope=tag but scopeTagId=null |
| Uncaught rejection in async `@OnEvent` | Per `app.module.ts:42-54` INVARIANT — wrap handler body in try/catch (existing pattern; copy from `OnboardingService`) |
| `minOfflineSec` set below 120 (no extra debounce because cron threshold) | DTO validation rejects values <120 with 400 |
| O1 (unified push) ships first and changes `Tag` / `DisplayTag` schema | Both O1 and O7 query `DisplayTag` for scope matching. Treat tag schema as a contract — coordinate any change to it across both PRs. If O1 lands first, re-verify O7's scope-tag query shape before merging |

## Acceptance criteria

- [ ] Migration applies cleanly forward (Prisma migrate dev) AND reset
- [ ] All new unit tests pass; no existing tests regress
- [ ] `tsc --noEmit` clean on middleware
- [ ] One default rule seeded per existing org (verified in dev DB)
- [ ] Emit `device.offline` in dev → recipient gets in-app notification matching pre-O7 behavior
- [ ] Cross-org isolation verified (rule in org A doesn't fire for org B's device)
- [ ] SSRF guard verified by test (reject `http://internal/...`)

## Open questions (to resolve in design phase)

1. **Should `in_app` recipient `target` be a `userId` or `null` (= all org users)?** Lean: explicit `userId`; UI can offer "All org admins" as a sugar option expanded at create-time.
2. **Slack webhook payload shape — reuse `scripts/ops/lib/alerting.ts` Slack helper or inline?** Lean: minimal inline payload `{"text": "..."}` for v1; share later if both grow.
3. **Should the seed-default-rule migration retain the existing in-app handler as a fallback?** Lean: no — clean cutover with data migration. Falling back means two code paths.
