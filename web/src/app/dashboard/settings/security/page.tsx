'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { MfaStatus } from '@/lib/api/mfa';
import { Icon } from '@/theme/icons';
import { useToast } from '@/lib/hooks/useToast';
import MfaEnrollFlow from '@/components/auth/MfaEnrollFlow';

export const dynamic = 'force-dynamic';

/**
 * Security settings (auth #2): TOTP enrollment status, enable/disable, backup
 * code regeneration, and (for org admins) the per-org "require MFA" toggle.
 */
export default function SecuritySettingsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orgMfaRequired, setOrgMfaRequired] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const loadStatus = async () => {
    try {
      const s = await apiClient.mfaStatus();
      setStatus(s);
    } catch {
      // leave null — the card renders a loading state
    }
  };

  useEffect(() => {
    loadStatus();
    (async () => {
      try {
        const user = await apiClient.getCurrentUser();
        setIsAdmin(user.role === 'admin' || user.isSuperAdmin === true);
        const org = user.organization as { mfaRequired?: boolean } | undefined;
        setOrgMfaRequired(org?.mfaRequired === true);
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleDisable = async () => {
    if (!disableCode.trim()) return;
    setBusy(true);
    try {
      await apiClient.mfaDisable(disableCode.trim());
      toast.success('Two-factor authentication disabled');
      setDisableCode('');
      await loadStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (!regenCode.trim()) return;
    setBusy(true);
    try {
      const { backupCodes } = await apiClient.mfaRegenerateBackupCodes(regenCode.trim());
      setNewBackupCodes(backupCodes);
      setRegenCode('');
      toast.success('New backup codes generated');
      await loadStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate backup codes');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleOrgRequired = async (next: boolean) => {
    setBusy(true);
    try {
      const res = await apiClient.setOrgMfaRequired(next);
      setOrgMfaRequired(res.mfaRequired);
      toast.success(next ? 'MFA is now required for all members' : 'MFA requirement removed');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update MFA policy');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-[var(--foreground-tertiary)] hover:text-[var(--primary)]">
          ← Back to settings
        </Link>
        <h2 className="eh-dash-title font-[var(--font-sora)] text-2xl text-[var(--foreground)] mt-2">Security</h2>
        <p className="mt-2 text-[var(--foreground-secondary)]">Two-factor authentication and account security</p>
      </div>

      {/* MFA status / management */}
      <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">Two-factor authentication</h3>
          {status && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                status.enabled
                  ? 'bg-[#00E5A0]/10 text-[#00E5A0]'
                  : 'bg-[var(--background)] text-[var(--foreground-tertiary)] border border-[var(--border)]'
              }`}
            >
              {status.enabled ? 'Enabled' : 'Disabled'}
            </span>
          )}
        </div>

        {!status && <p className="text-sm text-[var(--foreground-tertiary)]">Loading…</p>}

        {status && !status.enabled && !enrolling && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--foreground-secondary)]">
              Add a second step to your login with an authenticator app (TOTP).
            </p>
            <button onClick={() => setEnrolling(true)} className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition">
              Set up two-factor
            </button>
          </div>
        )}

        {status && !status.enabled && enrolling && (
          <MfaEnrollFlow
            onComplete={async () => {
              setEnrolling(false);
              await loadStatus();
            }}
            onCancel={() => setEnrolling(false)}
          />
        )}

        {status && status.enabled && (
          <div className="space-y-6">
            <p className="text-sm text-[var(--foreground-secondary)]">
              Two-factor authentication is on. Backup codes remaining:{' '}
              <span className="font-semibold text-[var(--foreground)]">{status.backupCodesRemaining}</span>
            </p>

            {newBackupCodes && (
              <div className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                <p className="text-sm font-medium text-[var(--foreground)] mb-2">Your new backup codes (shown once):</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {newBackupCodes.map((c) => (
                    <span key={c} className="text-[var(--foreground)]">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Regenerate backup codes */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
                Regenerate backup codes
              </label>
              <p className="text-xs text-[var(--foreground-tertiary)]">
                Enter a current 6-digit code to invalidate old backup codes and get a new set.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={regenCode}
                  onChange={(e) => setRegenCode(e.target.value)}
                  placeholder="123456"
                  className="eh-input px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                />
                <button
                  onClick={handleRegenerate}
                  disabled={busy || regenCode.trim().length < 6}
                  className="px-4 py-2 text-sm font-medium bg-[var(--background)] text-[var(--foreground-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {/* Disable */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">Disable two-factor</label>
              <p className="text-xs text-[var(--foreground-tertiary)]">
                Enter a current 6-digit code or a backup code to turn off two-factor authentication.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="123456"
                  className="eh-input px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <button
                  onClick={handleDisable}
                  disabled={busy || disableCode.trim().length < 4}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  Disable
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Org-level enforcement (admins only) */}
      {isAdmin && (
        <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
          <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Organization policy</h3>
          <label className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg cursor-pointer">
            <div>
              <div className="font-medium text-[var(--foreground)] flex items-center gap-2">
                <Icon name="key" size="md" className="text-[var(--foreground-secondary)]" />
                Require two-factor authentication
              </div>
              <div className="text-sm text-[var(--foreground-secondary)]">
                Members who aren&apos;t enrolled are prompted to set up MFA on their next login.
              </div>
            </div>
            <input
              type="checkbox"
              checked={orgMfaRequired}
              disabled={busy}
              onChange={(e) => handleToggleOrgRequired(e.target.checked)}
              className="w-5 h-5 accent-[#00E5A0] cursor-pointer"
            />
          </label>
        </div>
      )}

      <toast.ToastContainer />
    </div>
  );
}
