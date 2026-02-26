/**
 * Input validation utils matching backend RegisterDto constraints.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Must contain: 1 uppercase, 1 lowercase, 1 number or special char (matches backend Matches regex)
const PASSWORD_REGEX = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 100) return 'Password must be 100 characters or fewer.';
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must include uppercase, lowercase, and a number or special character.';
  }
  return null;
}

export function validateName(name: string, field: string): string | null {
  if (!name.trim()) return `${field} is required.`;
  if (name.trim().length < 2) return `${field} must be at least 2 characters.`;
  if (name.trim().length > 100) return `${field} must be 100 characters or fewer.`;
  return null;
}

export function validateOrgName(name: string): string | null {
  if (!name.trim()) return 'Organization name is required.';
  if (name.trim().length < 2) return 'Organization name must be at least 2 characters.';
  if (name.trim().length > 255) return 'Organization name must be 255 characters or fewer.';
  return null;
}
