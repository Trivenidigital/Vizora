'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { EntitlementBanner as EntitlementBannerData } from '@/lib/types';

/**
 * B3 — the dashboard-first escalation channel for the entitlement degrade ladder.
 *
 * The ladder darkens screens only at the LAST rung (suspended); this banner is
 * what applies pressure to the owner during the preceding two weeks. It renders
 * escalating urgency for past_due → publish_locked → suspended, with the days
 * remaining until the next rung. Without it, days 0–13 of the ladder are silent —
 * which is the whole reason it ships with the ladder, not after.
 *
 * Non-ladder states (active/trial/canceled) render nothing here — trial is owned
 * by TrialBanner, and the two never overlap (ladder states sit on a paid tier).
 *
 * A FAILED read renders a degraded notice, never silence (B5). The population
 * this banner exists for — past_due / publish_locked / suspended — is exactly
 * the population a swallowed error used to leave with no warning at all, and a
 * blank bar is indistinguishable from a healthy account. Same semantic model as
 * the billing page (#350): a read that succeeded renders the real state, a read
 * that failed renders an explicitly unknown state, and neither ever renders a
 * fabricated benign one.
 */
export default function EntitlementBanner() {
  const [data, setData] = useState<EntitlementBannerData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    // The error is cleared on SUCCESS, not on attempt — clearing it here would
    // blank the notice for a tick and re-show it on every failed retry.
    apiClient
      .getEntitlementBanner()
      .then((banner) => {
        setData(banner);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(
          (err instanceof Error && err.message) || 'The subscription status request failed',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Degraded read — state UNKNOWN. Neutral tone, and it asserts nothing about
  // the account beyond the fact that we could not check it.
  //
  // NOT dismissible, for the same reason publish_locked isn't: this state may be
  // masking a rung, so it is load-bearing. Dismissing it would restore exactly
  // the silence this fixes — and permanently, since the retry lives inside the
  // notice, so a dismissal would also throw away the only recovery route.
  if (loadError) {
    return (
      <BannerShell
        tone="slate"
        message={
          <>
            <strong>Couldn&rsquo;t check your subscription status.</strong>
            <span className="hidden sm:inline">
              {' '}Any billing warning that applies to your account is missing from this bar until
              it loads. ({loadError})
            </span>
          </>
        }
        actions={<RetryButton onClick={load} loading={loading} />}
      />
    );
  }

  if (!data) return null;

  const { status, daysUntilNextRung } = data;
  const days = daysUntilNextRung ?? 0;
  const dayLabel = days === 1 ? 'day' : 'days';

  // past_due — screens still play; dismissible (least urgent rung).
  if (status === 'past_due' && !dismissed) {
    return (
      <BannerShell
        tone="amber"
        message={<><strong>Payment past due.</strong><span className="hidden sm:inline">{' '}Your screens are still playing — publishing pauses in {days} {dayLabel} if unpaid.</span></>}
        actions={<><PayLink /><DismissButton tone="amber" onClick={() => setDismissed(true)} /></>}
      />
    );
  }

  // publish_locked — screens still play, but no new content can be pushed. NOT
  // dismissible: it explains why publishing is failing.
  if (status === 'publish_locked') {
    return (
      <BannerShell
        tone="orange"
        message={<><strong>Publishing paused — billing past due.</strong><span className="hidden sm:inline">{' '}Your screens keep playing their current content; you can&rsquo;t push new content until you update billing. Screens pause in {days} {dayLabel}.</span></>}
        actions={<PayLink />}
      />
    );
  }

  // suspended — screens are on a holding page. Most urgent; not dismissible.
  if (status === 'suspended') {
    return (
      <BannerShell
        tone="red"
        message={<><strong>Your screens are paused.</strong><span className="hidden sm:inline">{' '}Update your billing to bring them back online.</span></>}
        actions={<PayLink label="Update Billing" />}
      />
    );
  }

  return null;
}

// 'slate' is the degraded/unknown tone — not a ladder rung, so it must not read
// as one of the escalating warnings.
type Tone = 'slate' | 'amber' | 'orange' | 'red';

const TONE_BG: Record<Tone, string> = {
  slate: 'bg-gradient-to-r from-slate-800/70 to-slate-700/50 border-b border-slate-600/40',
  amber: 'bg-gradient-to-r from-amber-900/60 to-amber-800/40 border-b border-amber-700/40',
  orange: 'bg-gradient-to-r from-orange-900/70 to-orange-800/50 border-b border-orange-700/50',
  red: 'bg-gradient-to-r from-red-900/80 to-red-800/60 border-b border-red-700/50',
};
const TONE_DOT: Record<Tone, string> = { slate: 'bg-slate-400', amber: 'bg-amber-400', orange: 'bg-orange-400', red: 'bg-red-400' };
const TONE_TEXT: Record<Tone, string> = { slate: 'text-slate-200', amber: 'text-amber-100', orange: 'text-orange-100', red: 'text-red-100' };

function BannerShell({ tone, message, actions }: { tone: Tone; message: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className={TONE_BG[tone]} role="alert">
      <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 ${TONE_DOT[tone]} rounded-full animate-pulse shrink-0`} />
          <p className={`text-sm ${TONE_TEXT[tone]} truncate sm:whitespace-normal sm:overflow-visible`}>{message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>
    </div>
  );
}

function PayLink({ label = 'Update Payment' }: { label?: string }) {
  return (
    <Link
      href="/dashboard/settings/billing/plans"
      className="shrink-0 px-4 py-1.5 bg-[#00E5A0] text-[#061A21] text-sm font-semibold rounded-md hover:bg-[#00CC8E] transition-colors"
    >
      {label}
    </Link>
  );
}

function RetryButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="shrink-0 px-3 py-1.5 text-sm font-medium text-slate-100 bg-slate-700/60 border border-slate-500/50 rounded-md hover:bg-slate-600/60 disabled:opacity-60 transition-colors"
    >
      {loading ? 'Retrying…' : 'Retry'}
    </button>
  );
}

function DismissButton({ tone, onClick }: { tone: Tone; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`p-1.5 ${TONE_TEXT[tone]} opacity-60 hover:opacity-100 transition`} aria-label="Dismiss">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
