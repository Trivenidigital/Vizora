'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { registerSchema } from '@/lib/validation';
import { z } from 'zod';

export default function RegisterContent() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrors({});

    // Validate form with Zod
    try {
      registerSchema.parse(formData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[error.path[0].toString()] = error.message;
          }
        });
        setErrors(fieldErrors);
      }
      setLoading(false);
      return;
    }

    try {
      // Register with all required fields
      // Registration endpoint sets the auth cookie, no separate login needed
      await apiClient.register(
        formData.email,
        formData.password,
        formData.organizationName,
        formData.firstName,
        formData.lastName
      );
      // Use window.location for a full page navigation to ensure the
      // httpOnly auth cookie is available when Next.js middleware checks it.
      // router.push() causes a race condition where middleware runs before
      // the browser has processed the Set-Cookie header.
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] py-12">
      <div className="bg-[var(--surface)] p-8 rounded-xl shadow-lg border border-[var(--border)] w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 eh-gradient">Create Account</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => {
                  setFormData({ ...formData, firstName: e.target.value });
                  if (errors.firstName) setErrors({ ...errors, firstName: '' });
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] ${
                  errors.firstName ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)] focus:ring-[#00E5A0]'
                }`}
                placeholder="John"
                aria-label="First Name"
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              />
              {errors.firstName && (
                <p id="firstName-error" className="mt-1 text-sm text-red-500" role="alert">
                  {errors.firstName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => {
                  setFormData({ ...formData, lastName: e.target.value });
                  if (errors.lastName) setErrors({ ...errors, lastName: '' });
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] ${
                  errors.lastName ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)] focus:ring-[#00E5A0]'
                }`}
                placeholder="Doe"
                aria-label="Last Name"
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              />
              {errors.lastName && (
                <p id="lastName-error" className="mt-1 text-sm text-red-500" role="alert">
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="organization" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Organization Name
            </label>
            <input
              id="organization"
              type="text"
              value={formData.organizationName}
              onChange={(e) => {
                setFormData({ ...formData, organizationName: e.target.value });
                if (errors.organizationName) setErrors({ ...errors, organizationName: '' });
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] ${
                errors.organizationName ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)] focus:ring-[#00E5A0]'
              }`}
              placeholder="Acme Corp"
              aria-label="Organization Name"
              aria-invalid={!!errors.organizationName}
              aria-describedby={errors.organizationName ? 'organization-error' : undefined}
            />
            {errors.organizationName && (
              <p id="organization-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.organizationName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)] focus:ring-[#00E5A0]'
              }`}
              placeholder="john@acmecorp.com"
              aria-label="Email address"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] ${
                errors.password ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)] focus:ring-[#00E5A0]'
              }`}
              placeholder="••••••••"
              aria-label="Password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : 'password-requirements'}
            />
            {errors.password ? (
              <p id="password-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.password}
              </p>
            ) : (
              <p id="password-requirements" className="mt-1 text-xs text-[var(--foreground-tertiary)]" role="note">
                Must be 8+ characters with uppercase, lowercase, and number/special char
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value });
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] ${
                errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)] focus:ring-[#00E5A0]'
              }`}
              placeholder="••••••••"
              aria-label="Confirm Password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
            />
            {errors.confirmPassword && (
              <p id="confirmPassword-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00E5A0] text-[#061A21] py-2 rounded-md hover:bg-[#00CC8E] disabled:opacity-50 transition font-semibold"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-[var(--foreground-secondary)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#00E5A0] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
