import {
  IsIn,
  IsString,
  MaxLength,
  Matches,
  ValidateIf,
  MinLength,
} from 'class-validator';
import { CHANNELS, Channel, SLACK_WEBHOOK_REGEX } from '../alert-rule.types';

/**
 * Recipient DTO used both as a standalone POST body (`POST /:id/recipients`)
 * AND inlined in CreateAlertRuleDto.
 *
 * Note: cross-tenant validation for `in_app` channel (target userId must be
 * in the same org as the rule) is enforced at the SERVICE layer, not here,
 * because the DTO doesn't know the caller's organizationId.
 */
export class CreateRecipientDto {
  @IsIn(CHANNELS, { message: `channel must be one of: ${CHANNELS.join(', ')}` })
  channel!: Channel;

  /**
   * Per channel:
   *   - in_app:        target = userId (UUID/CUID — must belong to the same org)
   *   - email:         target = email address
   *   - slack_webhook: target = a valid https://hooks.slack.com/services/... URL
   */
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @ValidateIf((o) => o.channel === 'slack_webhook')
  @Matches(SLACK_WEBHOOK_REGEX, {
    message: 'slack_webhook target must be a https://hooks.slack.com/services/... URL',
  })
  target!: string;
}
