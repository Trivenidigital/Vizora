import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';

/**
 * Guards write operations (POST, PUT, PATCH, DELETE) behind active subscription.
 * GET/HEAD requests pass through to allow read-only dashboard access for expired users.
 *
 * Free tier: Users whose trial has expired retain limited write access for core
 * operations (device pairing, content push, content upload within quota).
 * The free tier is subject to quota limits enforced separately by QuotaGuard.
 *
 * Entitlement ladder (B3) — dashboard WRITE access per subscription rung:
 *   active / trial (not expired) / free → FULL write access.
 *   past_due       → FULL write access (7-day dunning grace; banner only, no
 *                    enforcement — one failed card must NOT lock the dashboard).
 *   publish_locked → FULL write access EXCEPT publishing NEW content, which is
 *                    gated separately by EntitlementPublishGuard on the
 *                    push/assign endpoints. Screens keep playing.
 *   suspended      → all writes blocked (screens keep playing via the separate
 *                    tenant:suspended device signal).
 *   canceled / any other inactive state → all writes blocked.
 * Publishing itself is NOT gated here — that is EntitlementPublishGuard's job.
 */
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Allow read-only access (GET/HEAD) regardless of subscription status
    const method = request.method?.toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      return true;
    }

    const organizationId = request.user?.organizationId;

    if (!organizationId) {
      throw new ForbiddenException('Organization not found');
    }

    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
      },
    });

    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    // Allow if subscription is active
    if (org.subscriptionStatus === 'active') {
      return true;
    }

    // Allow if in trial period and trial hasn't expired
    if (org.subscriptionStatus === 'trial' && org.trialEndsAt) {
      if (new Date(org.trialEndsAt) > new Date()) {
        return true;
      }
    }

    // Free tier: allow core operations after trial expires.
    // Users on the free tier (including expired trial) can still perform
    // basic operations like pairing devices, pushing content, and uploading
    // within their quota limits. Premium features are gated separately.
    if (org.subscriptionTier === 'free') {
      return true;
    }

    // Dunning rungs that KEEP dashboard write access (B3 ladder):
    //   past_due       → 7-day grace; a single failed charge must not lock the
    //                    dashboard. Banner-only; no write enforcement yet.
    //   publish_locked → general dashboard writes stay allowed; only publishing
    //                    NEW content to screens is blocked, and that is enforced
    //                    by EntitlementPublishGuard on the publish/assign/push
    //                    endpoints — NOT here.
    // suspended / canceled / any other inactive state fall through to the throw.
    if (
      org.subscriptionStatus === 'past_due' ||
      org.subscriptionStatus === 'publish_locked'
    ) {
      return true;
    }

    throw new ForbiddenException(
      'Your subscription is inactive. Please upgrade to continue using this feature.',
    );
  }
}
