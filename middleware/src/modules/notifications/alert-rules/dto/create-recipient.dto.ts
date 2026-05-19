import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { CHANNELS, Channel } from '../alert-rule.types';
import { IsValidRecipientTarget } from './is-valid-recipient-target.validator';

/**
 * Recipient DTO used both as a standalone POST body (`POST /:id/recipients`)
 * AND inlined in CreateAlertRuleDto.
 *
 * Per-channel validation is delegated to the `IsValidRecipientTarget`
 * custom validator. The previous stacked-@ValidateIf pattern was broken
 * (class-validator's @ValidateIf is property-scoped, so two mutually
 * exclusive conditions on the same property short-circuited to false
 * for both validators — email targets had zero shape validation).
 *
 * Per-channel rules now live in the one validator:
 *   - in_app:        non-empty string. Cross-tenant guard (userId belongs
 *                    to the caller's org) lives at the service layer.
 *   - email:         RFC 5321 address shape.
 *   - slack_webhook: https://hooks.slack.com/services/... URL.
 */
export class CreateRecipientDto {
  @IsIn(CHANNELS, { message: `channel must be one of: ${CHANNELS.join(', ')}` })
  channel!: Channel;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @IsValidRecipientTarget()
  target!: string;
}
