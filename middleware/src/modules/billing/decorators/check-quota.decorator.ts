import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { QuotaGuard } from '../guards/quota.guard';

export const QUOTA_KEY = 'quota_type';

export function CheckQuota(quotaType: 'screen') {
  return applyDecorators(
    SetMetadata(QUOTA_KEY, quotaType),
    UseGuards(QuotaGuard),
  );
}
