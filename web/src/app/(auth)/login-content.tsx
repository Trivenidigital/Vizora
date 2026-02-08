'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import Button from '@/components/Button';
import { z } from 'zod';

function isValidRedirectUrl(url: string): boolean {
  // Must be a relative path, not protocol-relative or absolute
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
}

export default function LoginContent() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirectUrl = rawRedirect && isValidRedirectUrl(rawRedirect) ? rawRedirect : '/dashboard';

  const [formData, setFormData] = useState({ email: '', password: '' });
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
      loginSchema.parse(formData);
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
      await apiClient.login(formData.email, formData.password);
      if (process.env.NODE_ENV === 'development') {
        console.log('[LOGIN] Login successful, redirecting to:', redirectUrl);
      }
      // Use window.location for a full page navigation instead of router.push().
      // router.push() does a client-side navigation where Next.js middleware
      // may run before the browser has fully processed the Set-Cookie header
      // from the login response, causing a redirect loop back to /login.
      // A full navigation ensures the cookie is available when middleware checks it.
      window.location.href = redirectUrl;
    } catch (err: any) {
      console.error('[LOGIN] Login error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="bg-[var(--surface)] p-8 rounded-xl shadow-lg border border-[var(--border)] w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 eh-gradient">Login to Vizora</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)] focus:ring-[#00E5A0]'
              }`}
              placeholder="you@example.com"
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
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Password
            </label>
            <input
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
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-500" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          <Button
            type="submit"
            loading={loading}
            className="w-full"
            aria-label="Log in to your account"
          >
            Login
          </Button>
        </form>

        <p className="text-center mt-6 text-[var(--foreground-secondary)]">
          Don't have an account?{' '}
          <Link href="/register" className="text-[#00E5A0] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
