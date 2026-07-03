# Prisma Tenant-Scoping Extension — design

**Status:** core implemented (log-first, flagged); enforce-mode gated on review + soak.
**Goal (dimension-1 4→5 backstop):** make a cross-tenant write *structurally impossible*
rather than review-dependent. B9 closed the reachable gap (PlaylistsService writes) and
B12 proves isolation end-to-end, but a *future* bare-id write could reopen it. This turns
that from "caught in review" into "caught by the data layer."

## Two hard constraints (why this is careful, not a one-liner)

1. **`DatabaseService extends PrismaClient`.** Prisma's `$extends` returns a *new* client;
   it doesn't mutate `this`. Services call `this.db.model.op()` on the base client, so an
   extension applied to a separate object wouldn't intercept them. Wiring options:
   - (chosen, log-first) `$use` middleware applied in-place in `onModuleInit` — intercepts
     every `this.db.*` call with no call-site changes. `$use` is deprecated in Prisma 6 but
     the repo is on Prisma **5.22**, where it is fully supported. Lowest-risk for a backstop.
   - (target, enforce) migrate `DatabaseService` to *compose* an extended client instead of
     extending `PrismaClient`, then apply `Prisma.defineExtension`. Larger refactor; deferred
     until the guard has soaked in log mode.
2. **Prisma `update`/`delete` require a unique `where`** and reject extra non-unique filters.
   So the guard cannot simply add `organizationId` to a single `update`/`delete` where. It
   therefore: injects org into `updateMany`/`deleteMany`/`findMany`/`count` where; validates/
   injects `organizationId` on `create`/`createMany` data; and for unique-where `update`/
   `delete` it *observes* (log) or *rejects with guidance to use updateMany* (enforce) —
   exactly the B9 pattern.

## Request tenant context (AsyncLocalStorage)

A `query` hook has no request object, so tenant identity is carried in an `AsyncLocalStorage`
(`tenant-context.ts`). An interceptor sets it per request from the authenticated principal:
- user JWT → `request.user.organizationId`
- device JWT → the device's `organizationId`
- admin / system / unauthenticated / cross-org (super-admin, MCP platform tokens) → `bypass: true`

`bypass` is the explicit escape hatch: admin cross-org tools and system jobs run without a
single-tenant scope and must not be constrained. No context at all (e.g. a script outside a
request) → passthrough (the guard only acts when it positively knows the tenant).

## Model allowlist

Only tenant-scoped models are guarded (those with `organizationId` in schema.prisma): Display,
DisplayGroup, Content, Playlist, Schedule, Tag, ContentFolder, Notification, ApiKey,
BillingTransaction, SupportRequest, SupportMessage, ContentImpression, ContentRecommendation,
ProvisioningTemplate, AlertRule, Webhook, WebhookDelivery, TagAssignmentRule, AuditLog,
OrganizationOnboarding, PromotionRedemption, CustomerIncident. **Excluded:** `Organization`
(the tenant root), `User` (guarded separately — auth-scoped), and models with *optional* org
(`McpToken`, `McpAuditLog`, `AgentRun` — cross-org by design). PlaylistItem has no direct
`organizationId` and is reached only via an org-owned Playlist (already covered by B9).

## Modes (flag `TENANT_GUARD_MODE`)

- `off` — extension not applied (prod default until reviewed).
- `log` (non-prod default) — observe only: warn when a guarded-model write carries neither
  `organizationId` in its where/data nor a bypass, while an org context is present. Zero
  behavior change. This is the silent-failure-prevention increment (CLAUDE.md §12).
- `enforce` — inject org into where/data where safe; reject unique-where `update`/`delete`
  and cross-tenant `create` (data.organizationId ≠ context org). Gated on a log-mode soak
  showing zero unexpected violations (CLAUDE.md §11).

## Rollout

log (non-prod) → observe violations for a soak window → fix any surfaced un-scoped writes →
flip `enforce` in non-prod → soak → prod `enforce`. Each step reversible via the flag.

## Test surface

- Unit: the extension's decision function over (model, operation, args, context) — guarded vs
  excluded model; each op; bypass; missing org; create org-mismatch; updateMany injection.
- Integration (B12 fixture): a bare-id cross-tenant `updateMany` on a guarded model is flagged
  (log) / zero-row/throws (enforce); an excluded-model or bypass op is untouched.
