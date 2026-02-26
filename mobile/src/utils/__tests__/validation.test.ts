import {
  validateEmail,
  validatePassword,
  validateName,
  validateOrgName,
} from '../validation';

describe('validateEmail', () => {
  it('returns null for valid emails', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('test.user@domain.org')).toBeNull();
    expect(validateEmail('name+tag@company.co')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('   ')).toBe('Email is required.');
  });

  it('returns error for invalid format - no @', () => {
    expect(validateEmail('userexample.com')).toBe(
      'Please enter a valid email address.',
    );
  });

  it('returns error for invalid format - no domain', () => {
    expect(validateEmail('user@')).toBe(
      'Please enter a valid email address.',
    );
  });

  it('returns error for invalid format - no TLD', () => {
    expect(validateEmail('user@domain')).toBe(
      'Please enter a valid email address.',
    );
  });
});

describe('validatePassword', () => {
  it('returns null for valid passwords', () => {
    expect(validatePassword('SecurePass1!')).toBeNull();
    expect(validatePassword('MyP@ssw0rd')).toBeNull();
    expect(validatePassword('Abcdefg1')).toBeNull();
  });

  it('returns error for empty password', () => {
    expect(validatePassword('')).toBe('Password is required.');
  });

  it('returns error for password shorter than 8 characters', () => {
    expect(validatePassword('Ab1!')).toBe(
      'Password must be at least 8 characters.',
    );
    expect(validatePassword('Short1!')).toBe(
      'Password must be at least 8 characters.',
    );
  });

  it('returns error for password longer than 100 characters', () => {
    const longPassword = 'A1!' + 'a'.repeat(98);
    expect(validatePassword(longPassword)).toBe(
      'Password must be 100 characters or fewer.',
    );
  });

  it('returns error for password missing uppercase', () => {
    expect(validatePassword('lowercase1!')).toBe(
      'Password must include uppercase, lowercase, and a number or special character.',
    );
  });

  it('returns error for password missing lowercase', () => {
    expect(validatePassword('UPPERCASE1!')).toBe(
      'Password must include uppercase, lowercase, and a number or special character.',
    );
  });

  it('returns error for password missing number or special character', () => {
    expect(validatePassword('NoNumbersHere')).toBe(
      'Password must include uppercase, lowercase, and a number or special character.',
    );
  });
});

describe('validateName', () => {
  it('returns null for valid names', () => {
    expect(validateName('John', 'First name')).toBeNull();
    expect(validateName('AB', 'Last name')).toBeNull();
    expect(validateName('A longer name value', 'Name')).toBeNull();
  });

  it('returns error for empty name', () => {
    expect(validateName('', 'First name')).toBe('First name is required.');
    expect(validateName('   ', 'Last name')).toBe('Last name is required.');
  });

  it('returns error for name shorter than 2 characters', () => {
    expect(validateName('A', 'First name')).toBe(
      'First name must be at least 2 characters.',
    );
  });

  it('returns error for name longer than 100 characters', () => {
    const longName = 'A'.repeat(101);
    expect(validateName(longName, 'First name')).toBe(
      'First name must be 100 characters or fewer.',
    );
  });

  it('uses the field parameter in error messages', () => {
    expect(validateName('', 'Display name')).toBe(
      'Display name is required.',
    );
    expect(validateName('X', 'Username')).toBe(
      'Username must be at least 2 characters.',
    );
  });
});

describe('validateOrgName', () => {
  it('returns null for valid org names', () => {
    expect(validateOrgName('Acme Inc.')).toBeNull();
    expect(validateOrgName('AB')).toBeNull();
    expect(validateOrgName('My Organization')).toBeNull();
  });

  it('returns error for empty org name', () => {
    expect(validateOrgName('')).toBe('Organization name is required.');
    expect(validateOrgName('   ')).toBe('Organization name is required.');
  });

  it('returns error for org name shorter than 2 characters', () => {
    expect(validateOrgName('A')).toBe(
      'Organization name must be at least 2 characters.',
    );
  });

  it('returns error for org name longer than 255 characters', () => {
    const longName = 'A'.repeat(256);
    expect(validateOrgName(longName)).toBe(
      'Organization name must be 255 characters or fewer.',
    );
  });
});
