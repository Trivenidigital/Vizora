'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { SubscriptionStatus } from '@/lib/types';

/**
 * Trial + free-tier-expired banner. Renders one line below EntitlementBanner in
 * the dashboard layout; the two never overlap (the ladder sits on a paid tier).
 *
 * A FAILED read renders a degraded notice, never silence (B5b). This banner's
 * loudest state is "Your free trial has ended" — so an org whose subscription
 * read fails used to lose exactly the warning the banner exists to deliver, and
 * a blank bar is indistinguishable from a healthy account. Same semantic model
 * as EntitlementBanner (#355) and the billing page (#350): a read that succeeded
 * renders the real state, a read that failed renders an explicitly unknown
 * state, and neither ever renders a fabricated benign one.
 *
 * The endpoint HAS a server-side degraded sentinel — `SubscriptionStatus.degraded`
 * — but it is deliberately NOT treated as unknown here, because its scope does
 * not reach this banner's inputs. `BillingService.getSubscriptionStatus` sets it
 * only when the PAYMENT PROVIDER read throws, which makes `currentPeriodEnd` and
 * `cancelAtPeriodEnd` unknown; `subscriptionStatus`, `subscriptionTier` and
 * `trialEndsAt` — the only three fields this banner reads — still come from our
 * own database and stay authoritative. Degrading on it would fabricate an alarm,
 * which is the same failure as fabricating a benign state, pointed the other way.
 * (Contrast EntitlementBanner, whose `status: 'unknown'` sentinel IS the state it
 * renders.) A test pins this so it cannot drift silently.
 */
export default function TrialBanner() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    // The error is cleared on SUCCESS, not on attempt — clearing it here would
    // blank the notice for a tick and re-show it on every failed retry.
    apiClient.getSubscriptionStatus()
      .then((status) => {
        setSubscription(status);
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

  // Self-heal on network restore. `ApiClient.request` retries only AbortError
  // (timeouts) and replays once through /auth/refresh on a 401 — a dropped
  // connection rejects with a plain `TypeError: Failed to fetch` and reaches us
  // un-retried. Since the notice is not dismissible, without this it would sit
  // over a healthy org's dashboard for the whole session unless they hit Retry.
  useEffect(() => {
    const onOnline = () => load();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [load]);

  // Degraded — state UNKNOWN. Neutral tone, and it asserts nothing about the
  // account beyond the fact that we could not check it.
  //
  // Checked BEFORE `dismissed`, and itself NOT dismissible: this state may be
  // masking an ended trial, so it is load-bearing. Dismissing it would restore
  // exactly the silence this fixes — and permanently, since the retry lives
  // inside the notice, so a dismissal would also throw away the only recovery
  // route. There is deliberately no N-consecutive-failure gate either; that
  // just reinstates the defect at N−1 failures.
  if (loadError) {
    return (
      <DegradedNotice
        detail={`Any trial or expiry warning that applies to your account is missing from this bar until it loads. (${loadError})`}
        onRetry={load}
        loading={loading}
      />
    );
  }

  if (!subscription || dismissed) return null;

  const { subscriptionStatus, subscriptionTier, trialEndsAt } = subscription;

  // Only show for trial or expired/canceled states on free tier
  const isTrialing = subscriptionStatus === 'trial' && trialEndsAt;
  const isExpired = (subscriptionStatus === 'canceled' || subscriptionStatus === 'past_due') && subscriptionTier === 'free';
  const isTrialExpired = isTrialing && new Date(trialEndsAt) <= new Date();

  if (!isTrialing && !isExpired) return null;

  // Calculate days remaining
  let daysRemaining = 0;
  if (isTrialing && !isTrialExpired) {
    daysRemaining = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  const isUrgent = daysRemaining <= 5 && daysRemaining > 0;
  const showExpired = isExpired || isTrialExpired;

  if (showExpired) {
    return (
      <div className="bg-gradient-to-r from-red-900/80 to-red-800/60 border-b border-red-700/50">
        <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shrink-0" />
            <p className="text-sm text-red-100 truncate sm:whitespace-normal sm:overflow-visible">
              <span className="font-semibold">Your free trial has ended.</span>
              <span className="hidden sm:inline">{' '}Your data is safe. Upgrade to pick up where you left off.</span>
            </p>
          </div>
          <Link
            href="/dashboard/settings/billing/plans"
            className="shrink-0 px-4 py-1.5 bg-[#00E5A0] text-[#061A21] text-sm font-semibold rounded-md hover:bg-[#00CC8E] transition-colors"
          >
            Upgrade Now
          </Link>
        </div>
      </div>
    );
  }

  if (isUrgent) {
    return (
      <div className="bg-gradient-to-r from-amber-900/60 to-amber-800/40 border-b border-amber-700/40">
        <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shrink-0" />
            <p className="text-sm text-amber-100 truncate sm:whitespace-normal sm:overflow-visible">
              <span className="font-semibold">Free Trial</span>
              {' '}&mdash; {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining.<span className="hidden sm:inline"> Upgrade to keep your screens running.</span>
            </p>
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
              className="p-1.5 text-amber-300/60 hover:text-amber-200 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal trial state (> 5 days left)
  return (
    <div className="bg-gradient-to-r from-[#061A21] to-[#0a2a35] border-b border-[#00E5A0]/20">
      <div className="px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 bg-[#00E5A0] rounded-full shrink-0" />
          <p className="text-sm text-[#00E5A0]/90 truncate sm:whitespace-normal sm:overflow-visible">
            <span className="font-semibold">Free Trial</span>
            {' '}&mdash; {daysRemaining} days remaining
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/settings/billing/plans"
            className="px-3 py-1 text-sm text-[#00E5A0] border border-[#00E5A0]/30 rounded-md hover:bg-[#00E5A0]/10 transition-colors font-medium"
          >
            View Plans
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-[#00E5A0]/30 hover:text-[#00E5A0]/60 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The degraded/unknown rendering for a failed subscription read.
 *
 * Reuses the `slate` degraded tone established by #355 (EntitlementBanner's
 * `TONE_*` maps) rather than introducing a new one — degraded must not read as
 * one of the escalating warning tones, and the two banners stack in the same
 * container, so they have to agree on what "unknown" looks like.
 */
function DegradedNotice({
  detail,
  onRetry,
  loading,
}: {
  detail: string;
  onRetry: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="bg-gradient-to-r from-slate-800/70 to-slate-700/50 border-b border-slate-600/40"
      role="alert"
    >
      <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse shrink-0" />
          <p className="text-sm text-slate-200 truncate sm:whitespace-normal sm:overflow-visible">
            <span className="font-semibold">Couldn&rsquo;t check your trial status.</span>
            <span className="hidden sm:inline">{' '}{detail}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRetry}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 text-sm font-medium text-slate-100 bg-slate-700/60 border border-slate-500/50 rounded-md hover:bg-slate-600/60 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </div>
    </div>
  );
}
