import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  isEmail,
} from 'class-validator';
import { Channel, SLACK_WEBHOOK_REGEX } from '../alert-rule.types';

/**
 * Custom class-validator constraint that validates `target` against the
 * channel chosen on the same DTO.
 *
 * Replaces the previous stacked-@ValidateIf pattern, which was broken: in
 * class-validator @ValidateIf is property-scoped (not decorator-scoped), so
 * two @ValidateIf decorators with mutually-exclusive conditions resulted in
 * NEITHER pair firing — leaving `target` validated only as @IsString.
 *
 * Per-channel rules:
 *   - in_app:        non-empty string (the cross-tenant userId check lives
 *                    at the service layer; the DTO can't see the caller's
 *                    organizationId)
 *   - email:         RFC 5321 address shape
 *   - slack_webhook: matches SLACK_WEBHOOK_REGEX
 *   - (unknown):     reject — channel is constrained by @IsIn(CHANNELS) on
 *                    the channel property, so this branch shouldn't fire
 *                    in practice, but defensive.
 */
@ValidatorConstraint({ name: 'IsValidRecipientTarget', async: false })
export class IsValidRecipientTargetConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;

    const obj = args.object as { channel?: Channel };
    const channel = obj.channel;

    switch (channel) {
      case 'in_app':
        return true; // service-layer guard does the cross-tenant check
      case 'email':
        return isEmail(value);
      case 'slack_webhook':
        return SLACK_WEBHOOK_REGEX.test(value);
      default:
        return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as { channel?: Channel };
    switch (obj.channel) {
      case 'email':
        return 'email target must be a valid email address';
      case 'slack_webhook':
        return 'slack_webhook target must be a https://hooks.slack.com/services/... URL';
      case 'in_app':
        return 'in_app target must be a non-empty user id';
      default:
        return 'target failed validation for the chosen channel';
    }
  }
}

export function IsValidRecipientTarget(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidRecipientTargetConstraint,
    });
  };
}
