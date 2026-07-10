import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  MinLength,
  Matches,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Shared password policy for register / change-password / reset-password.
 *
 * These three paths had drifted: reset required only uppercase + a digit (no
 * lowercase), so a user could reset to a password that register would reject;
 * reset and change had no maximum length at all. bcrypt silently truncates the
 * input at 72 BYTES, so an un-capped field lets a long passphrase be silently
 * shortened (and two passwords sharing a 72-byte prefix authenticate
 * interchangeably). Centralising the rule here means the three paths can never
 * diverge again.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

// Upper + lower + (digit OR special).
const PASSWORD_PATTERN = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
const PASSWORD_MESSAGE =
  'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character';

/**
 * Rejects a string whose UTF-8 byte length exceeds `max`. This is a BYTE cap,
 * not a character cap — class-validator's MaxLength counts UTF-16 code units,
 * which under-counts multibyte input and would let a >72-byte password through
 * to bcrypt's silent truncation.
 */
export function MaxBytes(
  max: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'maxBytes',
      target: object.constructor,
      propertyName: propertyName as string,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return true; // @IsString owns type errors
          return Buffer.byteLength(value, 'utf8') <= (args.constraints[0] as number);
        },
        defaultMessage(args: ValidationArguments) {
          return `Password must be at most ${args.constraints[0]} bytes`;
        },
      },
    });
  };
}

/**
 * Composed password validator: string, >= 8 chars, <= 72 bytes, and containing
 * an uppercase letter, a lowercase letter, and a digit or special character.
 */
export function StrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    }),
    MaxBytes(PASSWORD_MAX_BYTES),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE }),
  );
}
