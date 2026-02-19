import { z } from 'zod';
import {
  contentUploadSchema,
  loginSchema,
  registerSchema,
  playlistCreateSchema,
  deviceEditSchema,
  validateField,
  validateForm,
  extractFieldErrors,
} from '../validation';

describe('contentUploadSchema', () => {
  it('accepts valid content upload data', () => {
    const valid = { title: 'My Content', type: 'image' as const, url: 'https://example.com/image.png' };
    expect(contentUploadSchema.parse(valid)).toEqual(valid);
  });

  it('accepts all valid content types', () => {
    for (const type of ['image', 'video', 'pdf', 'url'] as const) {
      const result = contentUploadSchema.safeParse({ title: 'Test', type, url: 'https://example.com' });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid content type', () => {
    const result = contentUploadSchema.safeParse({ title: 'Test', type: 'audio', url: 'https://example.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Please select a valid content type');
    }
  });

  it('rejects empty title', () => {
    const result = contentUploadSchema.safeParse({ title: '', type: 'image', url: 'https://example.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Title is required');
    }
  });

  it('rejects title exceeding 100 characters', () => {
    const result = contentUploadSchema.safeParse({ title: 'x'.repeat(101), type: 'image', url: 'https://example.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Title must be less than 100 characters');
    }
  });

  it('accepts title at exactly 100 characters', () => {
    const result = contentUploadSchema.safeParse({ title: 'x'.repeat(100), type: 'image', url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects empty url', () => {
    const result = contentUploadSchema.safeParse({ title: 'Test', type: 'image', url: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('File or URL is required');
    }
  });

  it('rejects url exceeding 2000 characters', () => {
    const result = contentUploadSchema.safeParse({ title: 'Test', type: 'image', url: 'https://example.com/' + 'x'.repeat(2000) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('URL is too long');
    }
  });

  it('rejects missing fields', () => {
    const result = contentUploadSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const valid = { email: 'user@example.com', password: 'password123' };
    expect(loginSchema.parse(valid)).toEqual(valid);
  });

  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'password123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Email is required');
    }
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Please enter a valid email address');
    }
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Password is required');
    }
  });

  it('rejects password shorter than 6 characters', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '12345' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Password must be at least 6 characters');
    }
  });

  it('accepts password at exactly 6 characters', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '123456' });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema', () => {
  const validRegister = {
    email: 'user@example.com',
    password: 'Password1',
    confirmPassword: 'Password1',
    firstName: 'John',
    lastName: 'Doe',
    organizationName: 'Acme Corp',
  };

  it('accepts valid registration data', () => {
    expect(registerSchema.parse(validRegister)).toEqual(validRegister);
  });

  it('rejects empty email', () => {
    const result = registerSchema.safeParse({ ...validRegister, email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...validRegister, email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'Pass1', confirmPassword: 'Pass1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwError = result.error.errors.find(e => e.path[0] === 'password');
      expect(pwError?.message).toBe('Password must be at least 8 characters');
    }
  });

  it('rejects password without uppercase letter', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'password1', confirmPassword: 'password1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwError = result.error.errors.find(e => e.path[0] === 'password');
      expect(pwError?.message).toBe('Password must contain at least one uppercase letter');
    }
  });

  it('rejects password without a number', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'Passwordx', confirmPassword: 'Passwordx' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwError = result.error.errors.find(e => e.path[0] === 'password');
      expect(pwError?.message).toBe('Password must contain at least one number');
    }
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({ ...validRegister, confirmPassword: 'Different1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const cpError = result.error.errors.find(e => e.path.includes('confirmPassword'));
      expect(cpError?.message).toBe("Passwords don't match");
    }
  });

  it('rejects empty confirmPassword', () => {
    const result = registerSchema.safeParse({ ...validRegister, confirmPassword: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = registerSchema.safeParse({ ...validRegister, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects firstName exceeding 50 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, firstName: 'x'.repeat(51) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.errors.find(e => e.path[0] === 'firstName');
      expect(err?.message).toBe('First name must be less than 50 characters');
    }
  });

  it('rejects empty lastName', () => {
    const result = registerSchema.safeParse({ ...validRegister, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects lastName exceeding 50 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, lastName: 'x'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('rejects empty organizationName', () => {
    const result = registerSchema.safeParse({ ...validRegister, organizationName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects organizationName exceeding 100 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, organizationName: 'x'.repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.errors.find(e => e.path[0] === 'organizationName');
      expect(err?.message).toBe('Organization name must be less than 100 characters');
    }
  });
});

describe('playlistCreateSchema', () => {
  it('accepts valid playlist data', () => {
    const valid = { name: 'My Playlist', description: 'A description' };
    expect(playlistCreateSchema.parse(valid)).toEqual(valid);
  });

  it('accepts playlist without description', () => {
    const result = playlistCreateSchema.safeParse({ name: 'My Playlist' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = playlistCreateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Playlist name is required');
    }
  });

  it('rejects name exceeding 100 characters', () => {
    const result = playlistCreateSchema.safeParse({ name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Name must be less than 100 characters');
    }
  });

  it('rejects description exceeding 500 characters', () => {
    const result = playlistCreateSchema.safeParse({ name: 'Test', description: 'x'.repeat(501) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Description must be less than 500 characters');
    }
  });
});

describe('deviceEditSchema', () => {
  it('accepts valid device edit data', () => {
    const valid = { nickname: 'Lobby Display', location: 'Building A' };
    expect(deviceEditSchema.parse(valid)).toEqual(valid);
  });

  it('accepts device edit without location', () => {
    const result = deviceEditSchema.safeParse({ nickname: 'Display 1' });
    expect(result.success).toBe(true);
  });

  it('rejects empty nickname', () => {
    const result = deviceEditSchema.safeParse({ nickname: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Device nickname is required');
    }
  });

  it('rejects nickname exceeding 50 characters', () => {
    const result = deviceEditSchema.safeParse({ nickname: 'x'.repeat(51) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Nickname must be less than 50 characters');
    }
  });

  it('rejects location exceeding 100 characters', () => {
    const result = deviceEditSchema.safeParse({ nickname: 'Display', location: 'x'.repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Location must be less than 100 characters');
    }
  });
});

describe('validateField', () => {
  it('returns null for valid field', () => {
    const result = validateField(loginSchema, 'email', 'user@example.com', {
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result).toBeNull();
  });

  it('returns error message for invalid field', () => {
    const result = validateField(loginSchema, 'email', 'bad', {
      email: 'bad',
      password: 'password123',
    });
    expect(result).toBe('Please enter a valid email address');
  });

  it('returns null when the specific field has no error', () => {
    // password is valid, email is invalid, but we ask for password errors
    const result = validateField(loginSchema, 'password', 'password123', {
      email: 'bad',
      password: 'password123',
    });
    expect(result).toBeNull();
  });

  it('uses fieldName as key when allValues is not provided', () => {
    // Without allValues, it creates { email: 'bad' } which will fail on email + missing password
    const result = validateField(loginSchema, 'email', 'bad');
    expect(result).toBe('Please enter a valid email address');
  });

  it('returns null when non-ZodError is thrown', () => {
    // Create a schema that throws a non-Zod error
    const brokenSchema = z.any().transform(() => {
      throw new Error('not a zod error');
    });
    const result = validateField(brokenSchema, 'field', 'value');
    // The Error is not a ZodError, so it returns null
    expect(result).toBeNull();
  });
});

describe('validateForm', () => {
  it('returns empty object for valid form', () => {
    const result = validateForm(loginSchema, {
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result).toEqual({});
  });

  it('returns all field errors for invalid form', () => {
    const result = validateForm(loginSchema, { email: '', password: '' });
    expect(result).toHaveProperty('email');
    expect(result).toHaveProperty('password');
  });

  it('returns only the fields that are invalid', () => {
    const result = validateForm(loginSchema, { email: 'user@example.com', password: '' });
    expect(result).not.toHaveProperty('email');
    expect(result).toHaveProperty('password');
  });

  it('returns errors with refinement (password mismatch)', () => {
    const result = validateForm(registerSchema, {
      email: 'user@example.com',
      password: 'Password1',
      confirmPassword: 'Different1',
      firstName: 'John',
      lastName: 'Doe',
      organizationName: 'Acme',
    });
    expect(result).toHaveProperty('confirmPassword', "Passwords don't match");
  });

  it('returns empty object when non-ZodError is thrown', () => {
    const brokenSchema = z.any().transform(() => {
      throw new Error('not a zod error');
    });
    const result = validateForm(brokenSchema, { field: 'value' });
    expect(result).toEqual({});
  });
});

describe('extractFieldErrors', () => {
  it('extracts field errors from ZodError', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = extractFieldErrors(result.error);
      expect(errors).toHaveProperty('email');
      expect(errors).toHaveProperty('password');
    }
  });

  it('keeps only first error per field', () => {
    // Empty password triggers both "required" and "min 6" — but zod may short-circuit.
    // Use a field that definitely produces two errors: registerSchema password without uppercase and number
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'short',  // too short, no uppercase, no number
      confirmPassword: 'short',
      firstName: 'John',
      lastName: 'Doe',
      organizationName: 'Acme',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = extractFieldErrors(result.error);
      // password should have only one error (the first one)
      expect(typeof errors['password']).toBe('string');
    }
  });

  it('returns empty object for ZodError with no errors', () => {
    // Construct a ZodError with empty issues array
    const emptyZodError = new z.ZodError([]);
    const errors = extractFieldErrors(emptyZodError);
    expect(errors).toEqual({});
  });
});
