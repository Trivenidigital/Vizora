'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { registerSchema } from '@/lib/validation';
import { z } from 'zod';
import ValuePanel from '@/components/auth/ValuePanel';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordChecklist from '@/components/auth/PasswordChecklist';

export default function RegisterContent() {
  const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com', 'mail.com', 'aol.com'];
  const typoMap: Record<string, string> = {
    'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gamil.com': 'gmail.com',
    'gmali.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com',
    'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
    'outllok.com': 'outlook.com', 'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com',
    'hotmal.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  };

  const getEmailSuggestion = (email: string): string | null => {
    if (!email.includes('@')) return null;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;
    if (typoMap[domain]) {
      return email.split('@')[0] + '@' + typoMap[domain];
    }
    return null;
  };

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
  const [success, setSuccess] = useState(false);
  // Honeypot field for bot protection
  const [website, setWebsite] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const clearFieldError = (field: string) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const allFieldsFilled = useMemo(
    () =>
      formData.firstName.trim() !== '' &&
      formData.lastName.trim() !== '' &&
      formData.email.trim() !== '' &&
      formData.password !== '' &&
      formData.confirmPassword !== '' &&
      formData.organizationName.trim() !== '' &&
      agreeTerms,
    [formData, agreeTerms]
  );

  // Password match indicator
  const passwordMatch = useMemo(() => {
    if (formData.confirmPassword.length < 3) return null;
    return formData.password === formData.confirmPassword;
  }, [formData.password, formData.confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Honeypot check — bots fill hidden fields
    if (website) return;

    setLoading(true);
    setError('');
    setErrors({});

    try {
      registerSchema.parse(formData);
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

    if (!agreeTerms) {
      setErrors((prev) => ({ ...prev, agreeTerms: 'You must agree to the Terms of Service' }));
      setLoading(false);
      return;
    }

    try {
      await apiClient.register(
        formData.email,
        formData.password,
        formData.organizationName,
        formData.firstName,
        formData.lastName
      );
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      if (message.toLowerCase().includes('already exists') || message.toLowerCase().includes('duplicate')) {
        setError('An account with this email already exists.');
      } else {
        setError(message);
      }
    } finally {
      if (!success) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Left — Value Proposition */}
      <div className="hidden md:flex md:w-[45%] lg:w-1/2">
        <ValuePanel variant="register" />
      </div>

      {/* Right — Registration Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16">
        {/* Mobile-only compact trust banner */}
        <div className="md:hidden mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex items-center justify-center">
              <span className="text-[#00E5A0] font-bold text-xs font-mono">V</span>
            </div>
            <span className="text-[var(--foreground)] font-semibold text-sm">Vizora</span>
          </div>
          <p className="text-[var(--foreground-tertiary)] text-sm">
            Join 2,500+ organizations managing their displays.{' '}
            <span className="text-[#00E5A0] font-medium">Free for 30 days.</span>
          </p>
        </div>

        <div className="w-full max-w-md lg:max-w-2xl mx-auto md:mx-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] eh-heading mb-2">
            Create your account
          </h1>
          <p className="text-sm text-[var(--foreground-tertiary)] mb-6 lg:mb-4">
            Get started in under 5 minutes. No credit card required.
          </p>

          {error && (
            <div className="flex items-start gap-3 bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] px-4 py-3 rounded-lg mb-6">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p>{error}</p>
                {error.includes('already exists') && (
                  <Link href="/login" className="underline font-medium hover:opacity-80">
                    Log in instead
                  </Link>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] px-4 py-3 rounded-lg mb-6">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Account created! Redirecting...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-3" noValidate>
            {/* Honeypot — hidden from users, bots fill it */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Row 1: Name + Organization — 3 cols on xl, 2 on sm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-3 auth-field-enter auth-field-enter-1">
              <FormField
                id="firstName"
                label="First Name"
                value={formData.firstName}
                onChange={(v) => update('firstName', v)}
                error={errors.firstName}
                onClearError={() => clearFieldError('firstName')}
                validate={(v) => (v.trim().length === 0 ? 'First name is required' : null)}
                placeholder="John"
                autoComplete="given-name"
                enterKeyHint="next"
              />
              <FormField
                id="lastName"
                label="Last Name"
                value={formData.lastName}
                onChange={(v) => update('lastName', v)}
                error={errors.lastName}
                onClearError={() => clearFieldError('lastName')}
                validate={(v) => (v.trim().length === 0 ? 'Last name is required' : null)}
                placeholder="Doe"
                autoComplete="family-name"
                enterKeyHint="next"
              />
              <div className="sm:col-span-2 xl:col-span-1">
                <FormField
                  id="organization"
                  label="Organization Name"
                  value={formData.organizationName}
                  onChange={(v) => update('organizationName', v)}
                  error={errors.organizationName}
                  onClearError={() => clearFieldError('organizationName')}
                  validate={(v) => (v.trim().length === 0 ? 'Organization name is required' : null)}
                  placeholder="Acme Corp"
                  autoComplete="organization"
                  enterKeyHint="next"
                  tooltip="This creates your workspace. Team members will join this organization."
                />
              </div>
            </div>

            {/* Row 2: Email + Password — 2 cols on lg */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-3 auth-field-enter auth-field-enter-2">
              <div>
                <FormField
                  id="email"
                  label="Work Email"
                  type="email"
                  value={formData.email}
                  onChange={(v) => {
                    update('email', v);
                    setEmailSuggestion(getEmailSuggestion(v));
                  }}
                  error={errors.email}
                  onClearError={() => clearFieldError('email')}
                  validate={(v) => {
                    if (!v.trim()) return 'Email is required';
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email';
                    return null;
                  }}
                  placeholder="john@acmecorp.com"
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="next"
                />
                {emailSuggestion && (
                  <p className="text-xs text-amber-400 mt-1">
                    Did you mean{' '}
                    <button
                      type="button"
                      className="underline font-medium hover:text-amber-300"
                      onClick={() => {
                        update('email', emailSuggestion);
                        setEmailSuggestion(null);
                      }}
                    >
                      {emailSuggestion}
                    </button>
                    ?
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-[13px] font-semibold text-[var(--foreground-secondary)] mb-1.5"
                >
                  Password
                </label>
                <PasswordInput
                  id="password"
                  value={formData.password}
                  onChange={(e) => {
                    update('password', e.target.value);
                    clearFieldError('password');
                  }}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  error={!!errors.password}
                  aria-label="Password"
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-[var(--error)]" role="alert">
                    {errors.password}
                  </p>
                )}
                <PasswordChecklist password={formData.password} />
              </div>
            </div>

            {/* Row 3: Confirm Password — half-width on lg to align with password column */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-3 auth-field-enter auth-field-enter-3">
              <div className="lg:col-start-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-[13px] font-semibold text-[var(--foreground-secondary)] mb-1.5"
                >
                  Confirm Password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    update('confirmPassword', e.target.value);
                    clearFieldError('confirmPassword');
                  }}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  enterKeyHint="done"
                  error={!!errors.confirmPassword}
                  aria-label="Confirm Password"
                  aria-invalid={!!errors.confirmPassword}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-[var(--error)]" role="alert">
                    {errors.confirmPassword}
                  </p>
                )}
                {passwordMatch !== null && !errors.confirmPassword && (
                  <p
                    className={`mt-1 text-xs flex items-center gap-1 ${
                      passwordMatch ? 'text-[var(--success)]' : 'text-[var(--error)]'
                    }`}
                  >
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
            </div>

            {/* Terms of Service */}
            <div className="flex items-start gap-2 auth-field-enter auth-field-enter-4">
              <input
                type="checkbox"
                id="agreeTerms"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  if (errors.agreeTerms) setErrors((prev) => ({ ...prev, agreeTerms: '' }));
                }}
                className="w-4 h-4 mt-0.5 rounded border-[var(--border)] bg-[var(--background)] text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-2 accent-[#00E5A0] cursor-pointer"
              />
              <label htmlFor="agreeTerms" className="text-xs text-[var(--foreground-tertiary)] cursor-pointer select-none leading-relaxed">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>
            {errors.agreeTerms && (
              <p className="text-xs text-[var(--error)] -mt-3" role="alert">
                {errors.agreeTerms}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || success || !allFieldsFilled}
              className="w-full eh-btn-neon py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none auth-field-enter auth-field-enter-5"
            >
              {success ? (
                <span className="flex items-center justify-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 9L7.5 13.5L15 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Account Created!
                </span>
              ) : loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating your account...
                </span>
              ) : (
                'Create Account'
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

          {/* Divider + Login link */}
          <div className="relative mt-6 lg:mt-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--background)] px-3 text-[var(--foreground-tertiary)]">or</span>
            </div>
          </div>

          <p className="text-center mt-4 lg:mt-3 text-sm text-[var(--foreground-secondary)]">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--primary)] font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
