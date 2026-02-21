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
  type: z.enum(['image', 'video', 'pdf', 'url'], {
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

// Registration Validation
export const registerSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  organizationName: z.string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be less than 100 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type RegisterForm = z.infer<typeof registerSchema>;

// Forgot Password Validation
export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

// Reset Password Validation
export const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
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
