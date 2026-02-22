'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { resetPasswordSchema } from '@/lib/validation';
import { z } from 'zod';
import ValuePanel from '@/components/auth/ValuePanel';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordChecklist from '@/components/auth/PasswordChecklist';

type PageState = 'loading' | 'valid' | 'invalid' | 'success';

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }

    apiClient.validateResetToken(token).then((result) => {
      if (result.valid) {
        setMaskedEmail(result.email || '');
        setPageState('valid');
      } else {
        setPageState('invalid');
      }
    }).catch(() => {
      setPageState('invalid');
    });
  }, [token]);

  // Auto-redirect countdown after success
  useEffect(() => {
    if (pageState !== 'success') return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = '/login';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pageState]);

  const passwordMatch = useMemo(() => {
    if (formData.confirmPassword.length < 3) return null;
    return formData.newPassword === formData.confirmPassword;
  }, [formData.newPassword, formData.confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !token) return;
    setLoading(true);
    setError('');
    setErrors({});

    try {
      resetPasswordSchema.parse(formData);
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
      await apiClient.resetPassword(token, formData.newPassword);
      setPageState('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      if (message.toLowerCase().includes('expired')) {
        setError('This reset link has expired. Please request a new one.');
      } else if (message.toLowerCase().includes('used') || message.toLowerCase().includes('invalid')) {
        setError('This reset link is invalid or has already been used.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Left — Value Proposition */}
      <div className="hidden md:flex md:w-[35%] lg:w-[38%]">
        <ValuePanel variant="reset-password" />
      </div>

      {/* Right — Content */}
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
            Create a new secure password.{' '}
            <span className="text-[#00E5A0] font-medium">Your account security matters.</span>
          </p>
        </div>

        <div className="w-full max-w-md lg:max-w-2xl mx-auto md:mx-0">
          {/* Loading state */}
          {pageState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="animate-spin h-8 w-8 text-[var(--primary)] mb-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-[var(--foreground-tertiary)]">Validating reset link...</p>
            </div>
          )}

          {/* Invalid token state */}
          {pageState === 'invalid' && (
            <div className="text-center auth-field-enter">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--error)]/10 border border-[var(--error)]/30 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--error)]">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] eh-heading mb-2">
                Invalid or expired link
              </h2>
              <p className="text-sm text-[var(--foreground-tertiary)] mb-8 max-w-sm mx-auto">
                This password reset link has expired or is invalid. Reset links are valid for 1 hour and can only be used once.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block eh-btn-neon px-6 py-3 rounded-lg text-sm"
              >
                Request a New Reset Link
              </Link>
              <div className="mt-6">
                <Link href="/login" className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--primary)] transition-colors">
                  &larr; Back to Login
                </Link>
              </div>
            </div>
          )}

          {/* Valid token — password form */}
          {pageState === 'valid' && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] eh-heading mb-2 auth-field-enter">
                Create new password
              </h1>
              <p className="text-sm text-[var(--foreground-tertiary)] mb-6 lg:mb-4 auth-field-enter auth-field-enter-1">
                {maskedEmail ? (
                  <>Choose a strong password for <span className="text-[var(--foreground-secondary)] font-medium">{maskedEmail}</span>.</>
                ) : (
                  'Choose a strong password for your Vizora account.'
                )}
              </p>

              {error && (
                <div className="flex items-start gap-3 bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] px-4 py-3 rounded-lg mb-6">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm">
                    <p>{error}</p>
                    {(error.includes('expired') || error.includes('invalid')) && (
                      <Link href="/forgot-password" className="underline font-medium hover:opacity-80 mt-1 inline-block">
                        Request a new reset link
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-3" noValidate>
                <div className="auth-field-enter auth-field-enter-2">
                  <label htmlFor="newPassword" className="block text-[13px] font-semibold text-[var(--foreground-secondary)] mb-1.5">
                    New Password
                  </label>
                  <PasswordInput
                    id="newPassword"
                    value={formData.newPassword}
                    onChange={(e) => update('newPassword', e.target.value)}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    enterKeyHint="next"
                    error={!!errors.newPassword}
                    aria-label="New Password"
                    aria-invalid={!!errors.newPassword}
                  />
                  {errors.newPassword && (
                    <p className="mt-1 text-xs text-[var(--error)]" role="alert">{errors.newPassword}</p>
                  )}
                  <PasswordChecklist password={formData.newPassword} />
                </div>

                <div className="auth-field-enter auth-field-enter-3">
                  <label htmlFor="confirmPassword" className="block text-[13px] font-semibold text-[var(--foreground-secondary)] mb-1.5">
                    Confirm New Password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
                    enterKeyHint="done"
                    error={!!errors.confirmPassword}
                    aria-label="Confirm New Password"
                    aria-invalid={!!errors.confirmPassword}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-[var(--error)]" role="alert">{errors.confirmPassword}</p>
                  )}
                  {passwordMatch !== null && !errors.confirmPassword && (
                    <p className={`mt-1 text-xs flex items-center gap-1 ${passwordMatch ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {passwordMatch ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Passwords match
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          Passwords don&apos;t match
                        </>
                      )}
                    </p>
                  )}
                </div>

                <div className="auth-field-enter auth-field-enter-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto sm:min-w-[220px] sm:mx-auto sm:block eh-btn-neon py-3 sm:px-12 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Resetting password...
                      </span>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </div>
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

              {/* Divider + back link */}
              <div className="relative mt-6 lg:mt-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border)]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[var(--background)] px-3 text-[var(--foreground-tertiary)]">or</span>
                </div>
              </div>

              <div className="mt-4 lg:mt-3 text-center auth-field-enter auth-field-enter-5">
                <Link href="/login" className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--primary)] transition-colors">
                  &larr; Back to Login
                </Link>
              </div>
            </>
          )}

          {/* Success state */}
          {pageState === 'success' && (
            <div className="text-center auth-field-enter">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/30 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--success)]">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] eh-heading mb-2">
                Password reset successful!
              </h2>
              <p className="text-sm text-[var(--foreground-tertiary)] mb-8 max-w-sm mx-auto">
                Your password has been updated. You can now log in with your new password.
              </p>
              <p className="text-xs text-[var(--foreground-tertiary)] mb-4">
                Redirecting to login in {countdown}s...
              </p>
              <Link
                href="/login"
                className="inline-block eh-btn-neon px-6 py-3 rounded-lg text-sm"
              >
                Log In Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
