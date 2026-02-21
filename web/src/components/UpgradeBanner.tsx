'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { QuotaUsage } from '@/lib/types';

/**
 * Shows a contextual upgrade prompt when users are approaching screen/storage limits.
 * Appears in the dashboard when quota usage exceeds 80%.
 */
export default function UpgradeBanner() {
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiClient.getQuotaUsage()
      .then(setQuota)
      .catch(() => {});
  }, []);

  if (!quota || dismissed) return null;

  // Don't show for unlimited plans
  if (quota.screenQuota === -1) return null;

  // Show when 80%+ of screen quota is used
  const usagePercent = quota.percentUsed;
  if (usagePercent < 80) return null;

  const isAtLimit = quota.remaining === 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isAtLimit ? 'bg-amber-500/10' : 'bg-[#00E5A0]/10'
          }`}>
            <svg className={`w-5 h-5 ${isAtLimit ? 'text-amber-500' : 'text-[#00E5A0]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {isAtLimit
                ? `You've reached your ${quota.screenQuota}-screen limit`
                : `You're using ${quota.screensUsed} of ${quota.screenQuota} screens`
              }
            </p>
            <p className="text-xs text-[var(--foreground-tertiary)] mt-0.5">
              {isAtLimit
                ? 'Upgrade your plan to add more screens'
                : 'Upgrade now for more screens and features'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/settings/billing/plans"
            className="px-4 py-1.5 bg-[#00E5A0] text-[#061A21] text-sm font-semibold rounded-md hover:bg-[#00CC8E] transition-colors"
          >
            Upgrade
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Usage Bar */}
      <div className="mt-3">
        <div className="h-1.5 bg-[var(--background)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit ? 'bg-amber-500' : 'bg-[#00E5A0]'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
