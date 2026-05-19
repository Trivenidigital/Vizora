import {
  IsEmail,
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
 * Per-channel validation:
 *   - in_app:        target = userId (UUID/CUID). Cross-tenant validation
 *                    (userId belongs to the caller's org) lives at the SERVICE
 *                    layer because the DTO doesn't know the caller's orgId.
 *   - email:         target = RFC 5321 address. @IsEmail at the DTO catches
 *                    CRLF injection / malformed input before it hits SMTP.
 *   - slack_webhook: target = https://hooks.slack.com/services/... URL.
 */
export class CreateRecipientDto {
  @IsIn(CHANNELS, { message: `channel must be one of: ${CHANNELS.join(', ')}` })
  channel!: Channel;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @ValidateIf((o) => o.channel === 'email')
  @IsEmail({}, { message: 'email target must be a valid email address' })
  @ValidateIf((o) => o.channel === 'slack_webhook')
  @Matches(SLACK_WEBHOOK_REGEX, {
    message: 'slack_webhook target must be a https://hooks.slack.com/services/... URL',
  })
  target!: string;
}
