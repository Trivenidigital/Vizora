import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { QUOTA_KEY } from '../decorators/check-quota.decorator';

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const quotaType = this.reflector.getAllAndOverride<string>(QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no quota check required, allow
    if (!quotaType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const organizationId = request.user?.organizationId;

    if (!organizationId) {
      throw new ForbiddenException('Organization not found');
    }

    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: {
        screenQuota: true,
        _count: {
          select: { displays: true },
        },
      },
    });

    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    // Unlimited quota (-1)
    if (org.screenQuota === -1) {
      return true;
    }

    // Check if under quota
    if (quotaType === 'screen') {
      const currentCount = org._count.displays;
      if (currentCount >= org.screenQuota) {
        throw new ForbiddenException(
          `Screen quota exceeded. You have ${currentCount}/${org.screenQuota} screens. Please upgrade your plan to add more screens.`,
        );
      }
    }

    return true;
  }
}
