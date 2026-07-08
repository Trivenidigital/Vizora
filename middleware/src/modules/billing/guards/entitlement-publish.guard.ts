import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * B3 — blocks NEW publishing while the tenant is on the publish-lock rung or
 * beyond (publish_locked / suspended). Screens keep playing their last-published
 * content; only pushing *new* content is gated. This is the dashboard-side
 * escalation rung — it emits no device signal (that's `tenant:suspended` at the
 * holding rung). Apply to content-push / playlist-assign endpoints.
 *
 * Fail-OPEN on infra error: if the entitlement lookup itself fails, allow the
 * publish rather than block a paying customer on a transient DB blip (the ladder
 * is a dunning tool, not a security boundary — tenant isolation is enforced
 * separately).
 */
const PUBLISH_BLOCKED_STATUSES = new Set(['publish_locked', 'suspended']);

@Injectable()
export class EntitlementPublishGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organizationId = request.user?.organizationId;
    if (!organizationId) return true; // auth guard owns the unauthenticated case

    let status: string | undefined;
    try {
      const org = await this.db.organization.findUnique({
        where: { id: organizationId },
        select: { subscriptionStatus: true },
      });
      status = org?.subscriptionStatus;
    } catch {
      return true; // fail-open on infra error
    }

    if (status && PUBLISH_BLOCKED_STATUSES.has(status)) {
      throw new ForbiddenException(
        'Publishing is paused while your billing is past due. Your screens keep playing — ' +
          'update your payment method to resume publishing.',
      );
    }
    return true;
  }
}
