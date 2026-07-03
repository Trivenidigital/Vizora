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
 * Classify an organizationId value found in a where/data object against the
 * request tenant. `opaque` = an operator/nested shape ({equals}/{in}/AND) we
 * can't cheaply verify — treated as present (pass) so a same-tenant query with
 * an unusual shape is never falsely rejected (review #6).
 */
type OrgClass = 'missing' | 'match' | 'foreign' | 'opaque';
function classifyOrg(cur: unknown, org: string): OrgClass {
  if (cur === undefined) return 'missing';
  if (typeof cur === 'string') return cur === org ? 'match' : 'foreign';
  return 'opaque';
}

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

  // A violation. In `log` mode this MUST NOT block (observe-only / zero behavior
  // change — the guarantee that makes log-mode safe to enable anywhere); only
  // `enforce` rejects. Applies to foreign-org AND un-scoped writes alike.
  const denied = (reason: string): GuardAction =>
    mode === 'log' ? { action: 'warn', reason } : { action: 'reject', reason };

  const a = args ?? {};

  // ---- WHERE-scoped writes: updateMany / deleteMany (org injectable) ----
  if (WHERE_SCOPED_WRITES.has(operation)) {
    const where = asObj(a.where) ?? {};
    switch (classifyOrg(where.organizationId, org)) {
      case 'missing':
        if (mode === 'log') return { action: 'warn', reason: `${model}.${operation} without organizationId scope` };
        return { action: 'inject', args: { ...a, where: { ...where, organizationId: org } } };
      case 'foreign':
        return denied(`${model}.${operation} targets a foreign organizationId (tenant ${org})`);
      default:
        return { action: 'pass' };
    }
  }

  // ---- UNIQUE-where writes: update / delete (Prisma forbids an extra org filter) ----
  if (UNIQUE_WHERE_WRITES.has(operation)) {
    const where = asObj(a.where) ?? {};
    switch (classifyOrg(where.organizationId, org)) {
      case 'missing':
        return denied(`${model}.${operation} uses a bare unique where without organizationId; use ${operation}Many({ where: { id, organizationId } }) for tenant safety`);
      case 'foreign':
        return denied(`${model}.${operation} targets a foreign organizationId`);
      default:
        return { action: 'pass' };
    }
  }

  // ---- DATA writes: create / createMany ----
  if (DATA_WRITES.has(operation)) {
    const data = a.data;
    const rows = Array.isArray(data) ? data : [data];
    let anyMissing = false;
    for (const row of rows) {
      const r = asObj(row);
      if (!r) continue;
      const cls = classifyOrg(r.organizationId, org);
      if (cls === 'foreign') return denied(`${model}.${operation} writes a foreign organizationId for tenant ${org}`);
      if (cls === 'missing') anyMissing = true;
    }
    if (anyMissing) {
      if (mode === 'log') return { action: 'warn', reason: `${model}.${operation} without organizationId in data` };
      // Inject org into every row missing it (arrays included — review #3).
      const injected = Array.isArray(data)
        ? data.map((row) => ({ ...(asObj(row) ?? {}), organizationId: (asObj(row)?.organizationId ?? org) }))
        : { ...(asObj(data) ?? {}), organizationId: org };
      return { action: 'inject', args: { ...a, data: injected } };
    }
    return { action: 'pass' };
  }

  // ---- upsert: unique where (like update) + create data (like create) — review #2 ----
  if (operation === 'upsert') {
    const where = asObj(a.where) ?? {};
    const create = asObj(a.create) ?? {};
    const whereCls = classifyOrg(where.organizationId, org);
    const createCls = classifyOrg(create.organizationId, org);
    if (whereCls === 'foreign' || createCls === 'foreign') {
      return denied(`${model}.upsert targets a foreign organizationId (tenant ${org})`);
    }
    if (whereCls === 'missing' || createCls === 'missing') {
      const reason = `${model}.upsert without organizationId on ${whereCls === 'missing' ? 'where' : 'create'}; the unique where cannot be org-filtered — scope it explicitly`;
      if (mode === 'log') return { action: 'warn', reason };
      // Enforce: a missing where can't be injected (unique) → reject; a missing
      // create org alone can be injected.
      if (whereCls === 'missing') return { action: 'reject', reason };
      return { action: 'inject', args: { ...a, create: { ...create, organizationId: org } } };
    }
    return { action: 'pass' };
  }

  // reads (findUnique/findFirst/findMany/count/aggregate): pass. v1 is write-focused;
  // reads are scoped by the services and remain review-dependent (documented).
  return { action: 'pass' };
}
