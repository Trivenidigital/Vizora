import { applyDecorators, UseGuards } from '@nestjs/common';
import { SubscriptionActiveGuard } from '../guards/subscription-active.guard';

export function RequiresSubscription() {
  return applyDecorators(UseGuards(SubscriptionActiveGuard));
}
