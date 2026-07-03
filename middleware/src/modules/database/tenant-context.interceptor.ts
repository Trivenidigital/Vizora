import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithTenantContext, TenantContext } from './tenant-context';

/**
 * Binds the per-request TenantContext (AsyncLocalStorage) so the Prisma
 * tenant-guard can read it. Runs as a global interceptor — AFTER guards, so
 * `request.user` (set by JwtStrategy) is populated.
 *
 * The subscription to `next.handle()` is wrapped INSIDE `runWithTenantContext`
 * so the handler (controller → service → Prisma) executes within the ALS scope;
 * doing `run(() => next.handle())` alone would not, because the handler runs at
 * subscribe time, outside the synchronous run() call.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const tenantCtx = deriveTenantContext(req);
    return new Observable((subscriber) => {
      runWithTenantContext(tenantCtx, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}

/**
 * Derive the tenant scope from the authenticated principal.
 * - super-admin / MCP-platform / unauthenticated cross-cutting → bypass
 * - a user or device bound to one org → that org
 * - otherwise bypass (log mode passes either way; enforce-mode derivation is
 *   tightened under review before it can block).
 */
export function deriveTenantContext(req: {
  user?: { organizationId?: string | null; isSuperAdmin?: boolean };
  deviceAuthPayload?: { organizationId?: string | null };
}): TenantContext {
  const user = req.user;
  if (user?.isSuperAdmin) return { organizationId: null, bypass: true };
  const orgId = user?.organizationId ?? req.deviceAuthPayload?.organizationId ?? null;
  if (orgId) return { organizationId: orgId, bypass: false };
  return { organizationId: null, bypass: true };
}
