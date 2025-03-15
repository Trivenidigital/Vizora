import { ErrorCode, VizoraError } from './errors';

export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
  code: ErrorCode;
}

export function validateInput<T>(value: T, rules: ValidationRule<T>[]): void {
  for (const rule of rules) {
    if (!rule.validate(value)) {
      throw new VizoraError(rule.code, rule.message);
    }
  }
}

// Common validation rules
export const commonRules = {
  required: (fieldName: string): ValidationRule<unknown> => ({
    validate: (value) => value !== undefined && value !== null && value !== '',
    message: `${fieldName} is required`,
    code: ErrorCode.VALIDATION_ERROR
  }),

  minLength: (fieldName: string, min: number): ValidationRule<string> => ({
    validate: (value) => value.length >= min,
    message: `${fieldName} must be at least ${min} characters long`,
    code: ErrorCode.VALIDATION_ERROR
  }),

  maxLength: (fieldName: string, max: number): ValidationRule<string> => ({
    validate: (value) => value.length <= max,
    message: `${fieldName} must not exceed ${max} characters`,
    code: ErrorCode.VALIDATION_ERROR
  }),

  pattern: (fieldName: string, regex: RegExp, description: string): ValidationRule<string> => ({
    validate: (value) => regex.test(value),
    message: `${fieldName} must ${description}`,
    code: ErrorCode.VALIDATION_ERROR
  }),

  isValidJson: (fieldName: string): ValidationRule<unknown> => ({
    validate: (value) => {
      try {
        if (typeof value === 'string') {
          JSON.parse(value);
        }
        return true;
      } catch {
        return false;
      }
    },
    message: `${fieldName} must be valid JSON`,
    code: ErrorCode.VALIDATION_ERROR
  })
};

// Specific validation rules for our use cases
export const pairingCodeRules = [
  commonRules.required('Pairing code'),
  commonRules.pattern(
    'Pairing code',
    /^[A-Z0-9]{6}$/,
    'be 6 characters long and contain only uppercase letters and numbers'
  )
];

export const contentUpdateRules = [
  commonRules.required('Content'),
  commonRules.isValidJson('Content')
];

export const displayIdRules = [
  commonRules.required('Display ID'),
  commonRules.pattern(
    'Display ID',
    /^[a-zA-Z0-9-_]+$/,
    'contain only letters, numbers, hyphens, and underscores'
  )
];

export const reconnectionTokenRules = [
  commonRules.required('Reconnection token'),
  commonRules.pattern(
    'Reconnection token',
    /^[a-f0-9]{64}$/,
    'be a valid reconnection token'
  )
]; 