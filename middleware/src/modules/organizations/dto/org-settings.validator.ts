import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Bounds for `settings.defaultDuration` (seconds). Mirrors the per-item bound
 * on playlist items (`AddPlaylistItemDto.duration`, 1..86400) so an org default
 * can never be one a playlist item would reject. The web settings page carries
 * the same pair (`DEFAULT_DURATION_MIN/MAX_SECONDS` in web/src/lib/validation.ts)
 * — change both together.
 */
export const ORG_DEFAULT_DURATION_MIN_SECONDS = 1;
export const ORG_DEFAULT_DURATION_MAX_SECONDS = 86400;

/**
 * `settings` is a free-form JSON blob (branding, notifications, timezone, ...),
 * so it cannot be a nested DTO without the global whitelist stripping or
 * rejecting every key it does not declare. This validates only the keys with
 * a known contract and leaves the rest alone. `@IsObject()` still owns the
 * shape check; a non-object passes here so it reports one error, not two.
 */
export function IsValidOrgSettings(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isValidOrgSettings',
      target: object.constructor,
      propertyName,
      options: {
        message: `settings.defaultDuration must be an integer between ${ORG_DEFAULT_DURATION_MIN_SECONDS} and ${ORG_DEFAULT_DURATION_MAX_SECONDS} seconds`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (value === null || typeof value !== 'object' || Array.isArray(value)) return true;
          if (!('defaultDuration' in value)) return true;
          const duration = (value as { defaultDuration?: unknown }).defaultDuration;
          return (
            typeof duration === 'number' &&
            Number.isInteger(duration) &&
            duration >= ORG_DEFAULT_DURATION_MIN_SECONDS &&
            duration <= ORG_DEFAULT_DURATION_MAX_SECONDS
          );
        },
      },
    });
  };
}
