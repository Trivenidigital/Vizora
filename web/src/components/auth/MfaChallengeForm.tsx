'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

/**
 * Login-challenge step (auth #2). Shown after a correct password when the
 * account is MFA-enrolled. Posts the challenge token + a TOTP or backup code to
 * /auth/mfa/challenge; on success the server sets the session cookie and we
 * continue exactly as a normal login.
 */
export default function MfaChallengeForm({
  challengeToken,
  onSuccess,
}: {
  challengeToken: string;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.mfaChallenge(challengeToken, code.trim());
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      if (message.toLowerCase().includes('log in again')) {
        setError('This login expired. Please start over.');
      } else {
        setError('Invalid code. Enter the current 6-digit code or a backup code.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md lg:max-w-2xl mx-auto md:mx-0">
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] eh-heading mb-2">
        Two-factor authentication
      </h1>
      <p className="text-sm text-[var(--foreground-tertiary)] mb-6">
        Enter the 6-digit code from your authenticator app, or one of your backup codes.
      </p>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg mb-6 bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)]">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="mfa-code" className="block text-[13px] font-semibold text-[var(--foreground-secondary)] mb-1.5">
            Authentication code
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError('');
            }}
            placeholder="123456"
            className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent tracking-widest"
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.trim().length < 4}
          className="w-full sm:w-auto sm:min-w-[220px] sm:mx-auto sm:block eh-btn-neon py-3 sm:px-12 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
