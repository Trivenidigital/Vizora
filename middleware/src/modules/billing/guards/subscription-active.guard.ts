import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * Guards write operations (POST, PUT, PATCH, DELETE) behind active subscription.
 * GET/HEAD requests pass through to allow read-only dashboard access for expired users.
 */
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    throw new ForbiddenException(
      'Your subscription is inactive. Please upgrade to continue using this feature.',
    );
  }
}
