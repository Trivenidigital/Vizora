'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { z } from 'zod';
import ValuePanel from '@/components/auth/ValuePanel';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';

function isValidRedirectUrl(url: string): boolean {
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
  const [rememberMe, setRememberMe] = useState(false);

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const clearFieldError = (field: string) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setErrors({});

    try {
      loginSchema.parse(formData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message;
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
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      console.error('[LOGIN] Login error:', err);
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.toLowerCase().includes('locked')) {
        setError('Account temporarily locked. Please try again in 15 minutes.');
      } else if (message.toLowerCase().includes('credentials') || message.toLowerCase().includes('invalid')) {
        setError('Invalid email or password. Please try again.');
      } else if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('network')) {
        setError('Unable to connect. Check your internet connection and try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Left — Value Proposition */}
      <div className="hidden md:flex md:w-[35%] lg:w-[38%]">
        <ValuePanel variant="login" />
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex flex-col justify-center lg:justify-start px-6 py-8 sm:px-10 lg:pl-6 lg:pr-10 lg:pt-28 xl:pl-8 xl:pr-14">
        {/* Mobile-only compact trust banner */}
        <div className="md:hidden mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex items-center justify-center">
              <span className="text-[#00E5A0] font-bold text-xs font-mono">V</span>
            </div>
            <span className="text-[var(--foreground)] font-semibold text-sm">Vizora</span>
          </div>
          <p className="text-[var(--foreground-tertiary)] text-sm">
            Welcome back to your display management platform.{' '}
            <span className="text-[#00E5A0] font-medium">2,500+ organizations trust Vizora.</span>
          </p>
        </div>

        <div className="w-full max-w-md lg:max-w-2xl mx-auto md:mx-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] eh-heading mb-2">
            Log in to Vizora
          </h1>
          <p className="text-sm text-[var(--foreground-tertiary)] mb-6 lg:mb-4">
            Welcome back. Your screens are waiting.
          </p>

          {error && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-lg mb-6 ${
              error.toLowerCase().includes('locked')
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)]'
            }`}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                {error.toLowerCase().includes('locked') ? (
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                )}
              </svg>
              <div className="text-sm">
                <p>{error}</p>
                {error.toLowerCase().includes('locked') && (
                  <Link href="/forgot-password" className="underline font-medium hover:opacity-80 mt-1 inline-block">
                    Reset your password instead
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-3" noValidate>
            <div className="auth-field-enter auth-field-enter-1">
              <FormField
                id="email"
                label="Email"
                type="email"
                value={formData.email}
                onChange={(v) => update('email', v)}
                error={errors.email}
                onClearError={() => clearFieldError('email')}
                validate={(v) => {
                  if (!v.trim()) return 'Email is required';
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email';
                  return null;
                }}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
              />
            </div>

            <div className="auth-field-enter auth-field-enter-2">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-[13px] font-semibold text-[var(--foreground-secondary)]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[var(--foreground-tertiary)] hover:text-[var(--primary)] transition-colors"
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                value={formData.password}
                onChange={(e) => {
                  update('password', e.target.value);
                  clearFieldError('password');
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                enterKeyHint="done"
                error={!!errors.password}
                aria-label="Password"
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-[var(--error)]" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2 auth-field-enter auth-field-enter-3">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)] bg-[var(--background)] text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-2 accent-[#00E5A0] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-[var(--foreground-tertiary)] cursor-pointer select-none">
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto sm:min-w-[220px] sm:mx-auto sm:block eh-btn-neon py-3 sm:px-12 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none auth-field-enter auth-field-enter-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-4 mt-4 lg:mt-3 text-[10px] text-[var(--foreground-tertiary)]">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              256-bit encrypted
            </span>
            <span className="text-[var(--border)]">|</span>
            <span>Free 30-day trial</span>
            <span className="text-[var(--border)]">|</span>
            <span>5 screens included</span>
          </div>

          {/* Divider + Register link */}
          <div className="relative mt-6 lg:mt-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--background)] px-3 text-[var(--foreground-tertiary)]">or</span>
            </div>
          </div>

          <p className="text-center mt-4 lg:mt-3 text-sm text-[var(--foreground-secondary)]">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[var(--primary)] font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
