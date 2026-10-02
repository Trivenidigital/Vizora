import { z } from 'zod';

/**
 * Validation schemas for forms across the application
 * Using Zod for runtime type checking and validation
 */

// Content Upload Validation
export const contentUploadSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters'),
  type: z.enum(['image', 'video', 'pdf', 'url', 'html', 'template'], {
    errorMap: () => ({ message: 'Please select a valid content type' }),
  }),
  url: z.string()
    .min(1, 'File or URL is required')
    .max(2000, 'URL is too long'),
});

export type ContentUploadForm = z.infer<typeof contentUploadSchema>;

// Playlist Creation Validation
export const playlistCreateSchema = z.object({
  name: z.string()
    .min(1, 'Playlist name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
});

export type PlaylistCreateForm = z.infer<typeof playlistCreateSchema>;

// Device Edit Validation
export const deviceEditSchema = z.object({
  nickname: z.string()
    .min(1, 'Device nickname is required')
    .max(50, 'Nickname must be less than 50 characters'),
  location: z.string()
    .max(100, 'Location must be less than 100 characters')
    .optional(),
});

export type DeviceEditForm = z.infer<typeof deviceEditSchema>;

// Login Validation
export const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export type LoginForm = z.infer<typeof loginSchema>;

/*
 * ── REGISTRATION: ONE MIRROR OF THE SERVER DTO ───────────────────────────────
 *
 * `middleware/src/modules/auth/dto/register.dto.ts` is the contract. This block
 * exists to be the ONLY place the client states it, because three layers had
 * drifted from it independently and from each other:
 *
 *   field              per-field tick      this schema (old)   server DTO
 *   firstName          non-empty           min 1, max 50       min 2, max 100
 *   lastName           non-empty           min 1, max 50       min 2, max 100
 *   organizationName   non-empty           min 1, max 100      min 2, max 255
 *   password           checklist           8, upper, DIGIT     8, <=72 BYTES,
 *                                                              upper+lower+
 *                                                              (digit OR special)
 *
 * Two independent defects fell out of that, both reported from production. The
 * minimums let through what the server rejects — "Sri / Y / ABC" showed three
 * green ticks and came back a bare 400 — and the maximums were STRICTER than the
 * server, so a 60-character surname was refused for no reason. The password row
 * was wrong in both directions at once: it demanded a digit the server does not
 * require, while the checklist beside it correctly said "number or special", so a
 * user could satisfy every visible rule and still be blocked.
 *
 * MIRROR, DO NOT IMPROVE. Two of the server's rules are arguably wrong — a
 * 2-character minimum excludes people whose legal surname is one character, and
 * the minimums count whitespace because the DTO does not trim names. Both are
 * reproduced here on purpose. Changing them is a product decision and belongs in
 * the DTO, not in a client that would then disagree with it again.
 */

/** Verbatim from `password.validation.ts`. Keep these three in step with it. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/*
 * Copied CHARACTER FOR CHARACTER from the server's `PASSWORD_PATTERN`. Upper +
 * lower + (digit OR non-word). Do not "tidy" it: the point of a copy is that it
 * cannot disagree, and this one has quirks — it is unanchored, and the
 * `(?![.\n])` is all but inert because the engine simply retries at the next
 * position. Rewriting it as three clean lookaheads would be more readable and
 * would also be a second opinion about what the server accepts.
 */
const PASSWORD_PATTERN = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

/**
 * UTF-8 byte length, which is what the server caps.
 *
 * bcrypt truncates at 72 BYTES, so a character count under-measures multibyte
 * input and would let a passphrase through to be silently shortened — after
 * which two passwords sharing a 72-byte prefix authenticate interchangeably.
 */
const utf8Bytes = (value: string): number => {
  let bytes = 0;
  // `for...of` iterates CODE POINTS, so a surrogate pair counts once as 4 bytes
  // rather than twice as 3. Computed rather than using `TextEncoder`, which is a
  // browser/Node global that jsdom does not provide — a byte cap that throws in
  // one environment is worse than one that is three lines long.
  for (const char of value) {
    const cp = char.codePointAt(0) as number;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
};

/**
 * The register fields, one per DTO property. Exported so per-field validation and
 * the submit check read the SAME definition — a second hand-written copy beside
 * this is how the three layers diverged in the first place.
 */
/**
 * The ONE client mirror of `@StrongPassword()`.
 *
 * Shared by register and reset-password, which both hit DTOs decorated with it.
 * They had drifted apart and from the server in the same way: each demanded a
 * DIGIT the server does not require, and neither checked lowercase or the byte
 * cap. `password.validation.ts` exists for exactly this reason on the server —
 * its header records that reset once accepted a password register would reject —
 * so the client needs the same single definition rather than two copies.
 */
export const passwordField = z.string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(
    PASSWORD_PATTERN,
    'Password must contain an uppercase letter, a lowercase letter, and a number or special character',
  )
  .refine((v) => utf8Bytes(v) <= PASSWORD_MAX_BYTES, {
    message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
  });

export const registerFields = z.object({
  // `@Transform` lowercases and trims BEFORE `@IsEmail` runs, so the client has
  // to do the same or it rejects input the server would have accepted.
  email: z.string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: passwordField,
  // Client-only: the server never sees this field.
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must be at most 100 characters'),
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must be at most 100 characters'),
  organizationName: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(255, 'Organization name must be at most 255 characters'),
});

export const registerSchema = registerFields.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type RegisterForm = z.infer<typeof registerSchema>;
export type RegisterField = keyof typeof registerFields.shape;

/**
 * Validate ONE register field against the same definition the submit check uses.
 *
 * This is what the per-field ticks call. A field must not show a tick unless the
 * value would pass the server, and the only way to guarantee that is for the tick
 * and the submit to share a definition rather than agree by inspection.
 */
export function validateRegisterField(field: RegisterField, value: string): string | null {
  const result = registerFields.shape[field].safeParse(value);
  return result.success ? null : (result.error.errors[0]?.message ?? 'Invalid value');
}

// Forgot Password Validation
export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

// Reset Password Validation
/*
 * Reset-password hits `@StrongPassword()` too, and carried the identical defect:
 * it demanded a digit the server does not require, so a password of
 * "Abcdefg!" was refused here while the DTO would have taken it — and it let
 * through a password with no lowercase, which the DTO refuses. Both forms also
 * render the same `PasswordChecklist`, which states the server's rule correctly,
 * so a user could satisfy every visible row and still be blocked at submit.
 */
export const resetPasswordSchema = z.object({
  newPassword: passwordField,
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

/**
 * Validate a form field and return error message if invalid
 */
export function validateField<T>(
  schema: z.ZodSchema<T>,
  fieldName: string,
  value: any,
  allValues?: Partial<T>
): string | null {
  try {
    // For single field validation, create partial object
    const dataToValidate = allValues || { [fieldName]: value };
    
    // Parse and validate
    schema.parse(dataToValidate);
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Find error for this specific field
      const fieldError = error.errors.find(err => 
        err.path.join('.') === fieldName
      );
      return fieldError?.message || null;
    }
    return null;
  }
}

/**
 * Validate entire form and return all errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  values: Partial<T>
): Record<string, string> {
  try {
    schema.parse(values);
    return {};
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach(err => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return errors;
    }
    return {};
  }
}

/**
 * Extract field-level errors from Zod validation error
 * Used for inline error display
 */
export function extractFieldErrors(zodError: z.ZodError): Record<string, string> {
  return zodError.errors.reduce((acc, err) => {
    const field = err.path[0] as string;
    // Only store first error per field
    if (!acc[field]) {
      acc[field] = err.message;
    }
    return acc;
  }, {} as Record<string, string>);
}
