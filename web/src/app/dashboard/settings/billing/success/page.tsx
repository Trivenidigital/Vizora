'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { SubscriptionStatus } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function CheckoutSuccessPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const planName = subscription?.subscriptionTier || 'your new plan';

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Success Icon */}
        <div className="mx-auto w-20 h-20 bg-[#00E5A0]/10 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-[#00E5A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Welcome to Vizora <span className="capitalize">{planName}</span>!
          </h1>
          <p className="text-[var(--foreground-secondary)]">
            Your subscription is now active. Your screens are online and ready to display content.
          </p>
        </div>

        {/* What's unlocked */}
        <div className="bg-[var(--surface)] rounded-lg p-5 text-left space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
            What&apos;s Unlocked
          </h3>
          <ul className="space-y-2">
            {[
              'All your screens are now active',
              'Upload and schedule content without limits',
              'Full analytics and reporting',
              'Priority support access',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)]">
                <svg className="w-4 h-4 text-[#00E5A0] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-[#00E5A0] text-[#061A21] font-semibold rounded-lg hover:bg-[#00CC8E] transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/dashboard/settings/billing"
            className="px-6 py-2.5 bg-[var(--surface)] text-[var(--foreground-secondary)] font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            View Billing
          </Link>
        </div>
      </div>
    </div>
  );
}
