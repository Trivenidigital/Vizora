'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { SubscriptionStatus } from '@/lib/types';
import {
  BANNER_ACTION,
  BANNER_MESSAGE,
  BANNER_QUIET_ACTION,
  BANNER_ROW,
  BANNER_TONE,
} from './banner-tones';

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
      <div className={BANNER_TONE.critical.bar}>
        <div className={BANNER_ROW}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2 h-2 ${BANNER_TONE.critical.dot} rounded-full animate-pulse shrink-0`} />
            <p className={`${BANNER_MESSAGE} ${BANNER_TONE.critical.text}`}>
              <span className="font-semibold">Your free trial has ended.</span>
              <span className="hidden sm:inline">{' '}Your data is safe. Upgrade to pick up where you left off.</span>
            </p>
          </div>
          <Link
            href="/dashboard/settings/billing/plans"
            className={`${BANNER_ACTION} ${BANNER_TONE.critical.action}`}
          >
            Upgrade Now
          </Link>
        </div>
      </div>
    );
  }

  if (isUrgent) {
    return (
      <div className={BANNER_TONE.warning.bar}>
        <div className={BANNER_ROW}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2 h-2 ${BANNER_TONE.warning.dot} rounded-full animate-pulse shrink-0`} />
            <p className={`${BANNER_MESSAGE} ${BANNER_TONE.warning.text}`}>
              <span className="font-semibold">Free Trial</span>
              {' '}&mdash; {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining.<span className="hidden sm:inline"> Upgrade to keep your screens running.</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/settings/billing/plans"
              className={`${BANNER_ACTION} ${BANNER_TONE.warning.action}`}
            >
              Upgrade
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className={`p-1.5 ${BANNER_TONE.warning.text} opacity-60 hover:opacity-100 transition-colors`}
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
    <div className={BANNER_TONE.info.bar}>
      <div className={BANNER_ROW}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 ${BANNER_TONE.info.dot} rounded-full shrink-0`} />
          <p className={`${BANNER_MESSAGE} ${BANNER_TONE.info.text}`}>
            <span className="font-semibold">Free Trial</span>
            {' '}&mdash; {daysRemaining} days remaining
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/settings/billing/plans"
            className={`${BANNER_QUIET_ACTION} ${BANNER_TONE.info.quiet}`}
          >
            View Plans
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className={`p-1.5 ${BANNER_TONE.info.text} opacity-50 hover:opacity-100 transition-colors`}
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
 * Uses the `unknown` tone from the shared vocabulary (`banner-tones.ts`, which
 * was the `slate` tone in EntitlementBanner's `TONE_*` maps established by #355)
 * rather than introducing a new one — degraded must not read as one of the
 * escalating warning tones, and the two banners stack in the same container, so
 * they have to agree on what "unknown" looks like. They now agree by IMPORT:
 * the two copies of the tone maps were the drift risk that rule was guarding.
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
    <div className={BANNER_TONE.unknown.bar} role="alert">
      <div className={BANNER_ROW}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 ${BANNER_TONE.unknown.dot} rounded-full animate-pulse shrink-0`} />
          <p className={`${BANNER_MESSAGE} ${BANNER_TONE.unknown.text}`}>
            <span className="font-semibold">Couldn&rsquo;t check your trial status.</span>
            <span className="hidden sm:inline">{' '}{detail}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRetry}
            disabled={loading}
            className={`${BANNER_QUIET_ACTION} ${BANNER_TONE.unknown.quiet}`}
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </div>
    </div>
  );
}
