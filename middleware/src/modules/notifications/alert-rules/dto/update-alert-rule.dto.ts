import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateAlertRuleDto } from './create-alert-rule.dto';

/**
 * Update DTO — partial of CreateAlertRuleDto minus `recipients`.
 *
 * Recipients are managed via the dedicated /:id/recipients endpoints because:
 *   - In-line replacement on PATCH would require either full-replace
 *     (destroying audit trail) or merge semantics (complex DTO shape)
 *   - The dedicated endpoints can apply their own RBAC (admin-only add)
 *
 * This DTO is reached only via the admin-gated PATCH /:id endpoint.
 */
export class UpdateAlertRuleDto extends PartialType(OmitType(CreateAlertRuleDto, ['recipients'] as const)) {}
