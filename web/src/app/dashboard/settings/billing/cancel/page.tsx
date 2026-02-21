'use client';

import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Info Icon */}
        <div className="mx-auto w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Payment Not Completed
          </h1>
          <p className="text-[var(--foreground-secondary)]">
            No worries — you weren&apos;t charged. You can try again anytime or continue with your current plan.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/settings/billing/plans"
            className="px-6 py-2.5 bg-[#00E5A0] text-[#061A21] font-semibold rounded-lg hover:bg-[#00CC8E] transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-[var(--surface)] text-[var(--foreground-secondary)] font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
