'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import type { MfaEnrollData, MfaEnableResult } from '@/lib/api/mfa';

/**
 * TOTP enrollment flow (auth #2). Three steps:
 *   1. fetch a pending secret + QR (POST /auth/mfa/enroll)
 *   2. user scans the QR, enters a code, we enable (POST /auth/mfa/enable)
 *   3. show the one-time backup codes with copy/download
 *
 * Reused in two contexts:
 *   - voluntary (settings): no `enrollmentToken`; the user already has a session.
 *   - forced (login, org requires MFA): pass `enrollmentToken`; on enable the
 *     server completes the login and `onComplete` fires so the caller can route
 *     to the dashboard.
 */
export default function MfaEnrollFlow({
  enrollmentToken,
  onComplete,
  onCancel,
}: {
  enrollmentToken?: string;
  onComplete?: (result: MfaEnableResult) => void;
  onCancel?: () => void;
}) {
  const [enroll, setEnroll] = useState<MfaEnrollData | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MfaEnableResult | null>(null);

  const beginEnroll = useCallback(async () => {
    setError('');
    try {
      const data = await apiClient.mfaEnroll(enrollmentToken);
      setEnroll(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start enrollment');
    }
  }, [enrollmentToken]);

  useEffect(() => {
    beginEnroll();
  }, [beginEnroll]);

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.mfaEnable(code.trim(), enrollmentToken);
      setBackupCodes(res.backupCodes);
      setResult(res);
    } catch {
      setError('Invalid code. Enter the current 6-digit code from your app.');
    } finally {
      setLoading(false);
    }
  };

  const secretParam = enroll ? new URL(enroll.otpauthUrl).searchParams.get('secret') : null;

  const copyCodes = () => {
    if (backupCodes) void navigator.clipboard?.writeText(backupCodes.join('\n'));
  };
  const downloadCodes = () => {
    if (!backupCodes) return;
    const blob = new Blob([backupCodes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vizora-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Step 3 — backup codes
  if (backupCodes) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Save your backup codes</h3>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1">
            Each code works once. Store them somewhere safe — they let you sign in if you lose your
            authenticator. They will not be shown again.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono text-sm">
          {backupCodes.map((c) => (
            <span key={c} className="text-[var(--foreground)]">{c}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={copyCodes} className="px-3 py-1.5 text-sm font-medium bg-[var(--background)] text-[var(--foreground-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition">
            Copy
          </button>
          <button onClick={downloadCodes} className="px-3 py-1.5 text-sm font-medium bg-[var(--background)] text-[var(--foreground-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition">
            Download
          </button>
        </div>
        <button
          onClick={() => result && onComplete?.(result)}
          className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition"
        >
          {enrollmentToken ? 'Continue to dashboard' : 'Done'}
        </button>
      </div>
    );
  }

  // Steps 1 & 2 — QR + verify
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Set up two-factor authentication</h3>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">
          Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy), then
          enter the 6-digit code it shows.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm">
          {error}
        </div>
      )}

      {enroll ? (
        <>
          <div className="flex flex-col items-center gap-3">
            <img
              src={enroll.qrDataUrl}
              alt="MFA QR code"
              width={192}
              height={192}
              className="rounded-lg border border-[var(--border)] bg-white p-2"
            />
            {secretParam && (
              <p className="text-xs text-[var(--foreground-tertiary)] break-all text-center">
                Or enter this key manually: <span className="font-mono text-[var(--foreground-secondary)]">{secretParam}</span>
              </p>
            )}
          </div>

          <form onSubmit={handleEnable} className="space-y-3">
            <label htmlFor="mfa-enable-code" className="block text-[13px] font-semibold text-[var(--foreground-secondary)]">
              Verification code
            </label>
            <input
              id="mfa-enable-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError('');
              }}
              placeholder="123456"
              className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent tracking-widest"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || code.trim().length < 6}
                className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Enable two-factor'}
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </>
      ) : (
        !error && <p className="text-sm text-[var(--foreground-tertiary)]">Preparing enrollment…</p>
      )}
    </div>
  );
}
