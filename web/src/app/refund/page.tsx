import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Return & Refund Policy — Vizora',
  description: 'Return and refund policy for the Vizora digital signage platform.',
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)]/30 bg-[var(--surface)]/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
            Vizora
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--foreground-secondary)]">
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-[var(--foreground)] transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Return &amp; Refund Policy</h1>
        <p className="text-sm text-[var(--foreground-tertiary)] mb-10">Last updated: March 20, 2026</p>

        <div className="space-y-8 text-[var(--foreground-secondary)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">1. Free Trial</h2>
            <p>
              Vizora offers a 30-day free trial for all new accounts. No credit card is required to start your trial.
              You may cancel at any time during the trial period with no charges. At the end of the trial, your account
              will be downgraded to the free tier unless you choose a paid plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">2. Subscription Cancellation</h2>
            <p className="mb-3">
              You may cancel your paid subscription at any time from your account Settings page. Upon cancellation:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You will retain access to paid features until the end of your current billing period</li>
              <li>No partial refunds are issued for the remaining time in a billing period</li>
              <li>Your account will revert to the free tier at the end of the billing period</li>
              <li>Your data will be retained for 30 days after downgrade, then permanently deleted</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">3. Refund Eligibility</h2>
            <p className="mb-3">
              We want you to be satisfied with Vizora. If the service does not meet your expectations, you may request a
              full refund within 14 days of your first paid subscription payment. This 14-day refund window applies only to
              your initial subscription purchase.
            </p>
            <p>
              To be eligible for a refund, you must contact us within the 14-day period at{' '}
              <a href="mailto:support@vizora.cloud" className="text-[var(--primary)] hover:underline">
                support@vizora.cloud
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">4. Non-Refundable Items</h2>
            <p className="mb-3">The following are not eligible for refunds:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Add-on services that have already been consumed or activated</li>
              <li>Custom development or professional services work</li>
              <li>One-time setup or onboarding fees (if applicable)</li>
              <li>Subscription renewals beyond the initial 14-day refund window</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">5. How to Request a Refund</h2>
            <p className="mb-3">To request a refund, send an email to{' '}
              <a href="mailto:support@vizora.cloud" className="text-[var(--primary)] hover:underline">
                support@vizora.cloud
              </a>{' '}
              with the following information:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The email address associated with your Vizora account</li>
              <li>The reason for your refund request</li>
              <li>Any relevant details that may help us improve our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">6. Processing Time</h2>
            <p>
              Approved refunds are processed within 5&ndash;10 business days. Refunds are issued to the original payment
              method. Depending on your bank or payment provider, it may take additional time for the refund to appear on
              your statement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">7. Changes to This Policy</h2>
            <p>
              We may update this Return &amp; Refund Policy from time to time. We will notify you of significant changes via
              email or through the platform. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">8. Contact</h2>
            <p>
              For refund questions or requests, contact us at{' '}
              <a href="mailto:support@vizora.cloud" className="text-[var(--primary)] hover:underline">
                support@vizora.cloud
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]/30 py-6 text-center text-xs text-[var(--foreground-tertiary)]">
        <div className="flex items-center justify-center gap-3">
          <Link href="/terms" className="hover:text-[var(--foreground-secondary)] transition-colors">Terms of Service</Link>
          <span className="text-[var(--border)]">|</span>
          <Link href="/privacy" className="hover:text-[var(--foreground-secondary)] transition-colors">Privacy Policy</Link>
          <span className="text-[var(--border)]">|</span>
          <Link href="/sla" className="hover:text-[var(--foreground-secondary)] transition-colors">SLA</Link>
          <span className="text-[var(--border)]">|</span>
          <Link href="/refund" className="text-[var(--foreground-secondary)]">Refund Policy</Link>
          <span className="text-[var(--border)]">|</span>
          <a href="mailto:support@vizora.cloud" className="hover:text-[var(--foreground-secondary)] transition-colors">Support</a>
        </div>
        <p className="mt-2">&copy; {new Date().getFullYear()} Triveni Digital. All rights reserved.</p>
      </footer>
    </div>
  );
}
