'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { SubscriptionStatus } from '@/lib/types';

export default function TrialBanner() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiClient.getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => {});
  }, []);

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
            <p className="text-sm text-red-100">
              <span className="font-semibold">Your free trial has ended.</span>
              {' '}Your data is safe. Upgrade to pick up where you left off.
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
            <p className="text-sm text-amber-100">
              <span className="font-semibold">Free Trial</span>
              {' '}&mdash; {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining. Upgrade to keep your screens running.
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
    <div className="bg-[var(--surface)] border-b border-[var(--primary)]/20">
      <div className="px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 bg-[var(--primary)] rounded-full shrink-0" />
          <p className="text-sm text-[var(--primary)]">
            <span className="font-semibold">Free Trial</span>
            {' '}&mdash; {daysRemaining} days remaining
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/settings/billing/plans"
            className="px-3 py-1 text-sm text-[var(--primary)] border border-[var(--primary)]/30 rounded-md hover:bg-[var(--primary)]/10 transition-colors font-medium"
          >
            View Plans
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-[var(--primary)]/30 hover:text-[var(--primary)]/60 transition-colors"
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
