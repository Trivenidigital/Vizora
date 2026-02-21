'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { forgotPasswordSchema } from '@/lib/validation';
import { z } from 'zod';
import ValuePanel from '@/components/auth/ValuePanel';
import FormField from '@/components/auth/FormField';

export default function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const startCooldown = () => {
    setResendCooldown(45);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setFieldError('');

    try {
      forgotPasswordSchema.parse({ email });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setFieldError(err.errors[0]?.message || 'Invalid email');
      }
      setLoading(false);
      return;
    }

    try {
      await apiClient.forgotPassword(email);
      // Mask email for display
      const [local, domain] = email.split('@');
      const masked = local.charAt(0) + '***' + (local.length > 1 ? local.charAt(local.length - 1) : '') + '@' + domain;
      setMaskedEmail(masked);
      setSent(true);
      startCooldown();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      if (message.toLowerCase().includes('too many') || message.toLowerCase().includes('rate')) {
        setError('Too many requests. Please try again in a few minutes.');
      } else if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('network')) {
        setError('Unable to connect. Check your internet connection and try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    try {
      await apiClient.forgotPassword(email);
      startCooldown();
    } catch {
      // Silently fail on resend
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Left — Value Proposition */}
      <div className="hidden md:flex md:w-[45%] lg:w-1/2">
        <ValuePanel variant="forgot-password" />
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 xl:px-20">
        {/* Mobile-only logo */}
        <div className="md:hidden mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex items-center justify-center">
              <span className="text-[#00E5A0] font-bold text-xs font-mono">V</span>
            </div>
            <span className="text-[var(--foreground)] font-semibold text-sm">Vizora</span>
          </div>
        </div>

        <div className="w-full max-w-md mx-auto md:mx-0">
          {!sent ? (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] eh-heading mb-2 auth-field-enter">
                Reset your password
              </h1>
              <p className="text-sm text-[var(--foreground-tertiary)] mb-8 auth-field-enter auth-field-enter-1">
                Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="flex items-start gap-3 bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] px-4 py-3 rounded-lg mb-6">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="auth-field-enter auth-field-enter-2">
                  <FormField
                    id="email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(v) => { setEmail(v); setFieldError(''); }}
                    error={fieldError}
                    onClearError={() => setFieldError('')}
                    validate={(v) => {
                      if (!v.trim()) return 'Email is required';
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email';
                      return null;
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="done"
                  />
                </div>

                <div className="auth-field-enter auth-field-enter-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full eh-btn-neon py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8 text-center space-y-3 auth-field-enter auth-field-enter-4">
                <Link href="/login" className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--primary)] transition-colors">
                  &larr; Back to Login
                </Link>
                <p className="text-sm text-[var(--foreground-tertiary)]">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="text-[var(--primary)] font-medium hover:underline">
                    Sign up free
                  </Link>
                </p>
              </div>
            </>
          ) : (
            /* Success state */
            <div className="text-center auth-field-enter">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/30 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--success)]">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] eh-heading mb-2">
                Check your email
              </h2>
              <p className="text-sm text-[var(--foreground-tertiary)] mb-6 max-w-sm mx-auto">
                We&apos;ve sent a password reset link to <span className="text-[var(--foreground-secondary)] font-medium">{maskedEmail}</span>. Check your inbox and spam folder.
              </p>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-sm text-[var(--primary)] font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend"}
              </button>

              <div className="mt-8">
                <Link href="/login" className="text-sm text-[var(--foreground-secondary)] hover:text-[var(--primary)] transition-colors">
                  &larr; Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
