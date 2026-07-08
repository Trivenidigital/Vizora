import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request tenant identity, carried in AsyncLocalStorage so the Prisma
 * tenant-guard (which runs inside a query hook with no request access) can read
 * it. Set by TenantContextInterceptor from the authenticated principal.
 *
 * - organizationId: the single tenant this request is scoped to.
 * - bypass: explicit escape hatch for admin cross-org / system / MCP-platform
 *   contexts that legitimately operate outside a single tenant.
 *
 * NO context at all (outside any request) → the guard passes through: it only
 * acts when it positively knows the tenant.
 */
export interface TenantContext {
  organizationId: string | null;
  bypass: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Run `fn` with the given tenant context bound for its entire async subtree. */
export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The current request's tenant context, or undefined outside any bound scope. */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Convenience: a bypass context for admin/system/cross-org work. */
export const BYPASS_TENANT_CONTEXT: TenantContext = { organizationId: null, bypass: true };
