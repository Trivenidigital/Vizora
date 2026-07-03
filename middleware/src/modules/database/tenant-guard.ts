import type { TenantContext } from './tenant-context';

export type TenantGuardMode = 'off' | 'log' | 'enforce';

/**
 * Tenant-scoped models (have a required `organizationId` in schema.prisma).
 * EXCLUDED: Organization (tenant root), User (auth-scoped, guarded separately),
 * and optional-org models (McpToken/McpAuditLog/AgentRun — cross-org by design).
 * PlaylistItem has no direct org and is reached only via an org-owned Playlist.
 */
export const GUARDED_MODELS: ReadonlySet<string> = new Set([
  'Display', 'DisplayGroup', 'Content', 'Playlist', 'Schedule', 'Tag', 'ContentFolder',
  'Notification', 'ApiKey', 'BillingTransaction', 'SupportRequest', 'SupportMessage',
  'ContentImpression', 'ContentRecommendation', 'ProvisioningTemplate', 'AlertRule',
  'Webhook', 'WebhookDelivery', 'TagAssignmentRule', 'AuditLog', 'OrganizationOnboarding',
  'PromotionRedemption', 'CustomerIncident',
]);

/** Writes whose WHERE can safely carry a non-unique org filter (injectable). */
const WHERE_SCOPED_WRITES = new Set(['updateMany', 'deleteMany']);
/** Writes keyed on a UNIQUE where — Prisma rejects an extra org filter here. */
const UNIQUE_WHERE_WRITES = new Set(['update', 'delete']);
/** Writes carrying tenant rows in `data`. */
const DATA_WRITES = new Set(['create', 'createMany']);

export type GuardAction =
  | { action: 'pass' }
  | { action: 'warn'; reason: string }
  | { action: 'inject'; args: Record<string, unknown> }
  | { action: 'reject'; reason: string };

export interface GuardInput {
  model: string | undefined;
  operation: string;
  args: Record<string, unknown> | undefined;
  context: TenantContext | undefined;
  mode: TenantGuardMode;
}

const asObj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

/**
 * Decide what the tenant guard should do for one operation. Pure — no Prisma, no
 * IO — so the whole policy is unit-testable. The caller (DatabaseService $use)
 * maps the action onto behavior.
 *
 * Invariants:
 *  - Non-guarded model, no context, or bypass → always `pass`.
 *  - `log` mode never mutates or throws — it only returns `warn` for a write that
 *    a concrete tenant made without carrying its org (a potential un-scoped write).
 *  - `enforce` mode injects org into where/data where safe, and `reject`s a
 *    unique-where update/delete or a cross-tenant create it cannot make safe.
 */
export function evaluateTenantOp(input: GuardInput): GuardAction {
  const { model, operation, args, context, mode } = input;

  if (mode === 'off') return { action: 'pass' };
  if (!model || !GUARDED_MODELS.has(model)) return { action: 'pass' };
  if (!context || context.bypass) return { action: 'pass' };
  const org = context.organizationId;
  if (!org) return { action: 'pass' }; // tenant unknown → cannot scope

  const a = args ?? {};

  // ---- WHERE-scoped writes: updateMany / deleteMany ----
  if (WHERE_SCOPED_WRITES.has(operation)) {
    const where = asObj(a.where) ?? {};
    const cur = where.organizationId;
    if (cur === undefined) {
      if (mode === 'log') return { action: 'warn', reason: `${model}.${operation} without organizationId scope` };
      return { action: 'inject', args: { ...a, where: { ...where, organizationId: org } } };
    }
    if (cur !== org) return { action: 'reject', reason: `${model}.${operation} targets organizationId=${String(cur)} but request tenant is ${org}` };
    return { action: 'pass' };
  }

  // ---- UNIQUE-where writes: update / delete (Prisma forbids extra org filter) ----
  if (UNIQUE_WHERE_WRITES.has(operation)) {
    const where = asObj(a.where) ?? {};
    if (where.organizationId === undefined) {
      const reason = `${model}.${operation} uses a bare unique where without organizationId; use ${operation}Many({ where: { id, organizationId } }) for tenant safety`;
      return mode === 'log' ? { action: 'warn', reason } : { action: 'reject', reason };
    }
    if (where.organizationId !== org) return { action: 'reject', reason: `${model}.${operation} targets a foreign organizationId` };
    return { action: 'pass' };
  }

  // ---- DATA writes: create / createMany ----
  if (DATA_WRITES.has(operation)) {
    const data = a.data;
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      const r = asObj(row);
      if (!r) continue;
      const cur = r.organizationId;
      if (cur !== undefined && cur !== org) {
        return { action: 'reject', reason: `${model}.${operation} writes organizationId=${String(cur)} for tenant ${org}` };
      }
    }
    // Missing org on create: injectable (single object) in enforce; warn in log.
    const single = asObj(data);
    if (single && single.organizationId === undefined) {
      if (mode === 'log') return { action: 'warn', reason: `${model}.${operation} without organizationId in data` };
      return { action: 'inject', args: { ...a, data: { ...single, organizationId: org } } };
    }
    return { action: 'pass' };
  }

  // upsert and reads: pass (v1 is write-focused; upsert's unique where is handled
  // like update by the DATA/where rules above only when decomposed — left as pass
  // to avoid partial coverage that reads as complete).
  return { action: 'pass' };
}
