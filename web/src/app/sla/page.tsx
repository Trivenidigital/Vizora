import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Level Agreement — Vizora',
  description: 'Service Level Agreement (SLA) for the Vizora digital signage platform.',
};

export default function SLAPage() {
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
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Service Level Agreement</h1>
        <p className="text-sm text-[var(--foreground-tertiary)] mb-10">Last updated: March 20, 2026</p>

        <div className="space-y-8 text-[var(--foreground-secondary)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">1. Uptime Commitment</h2>
            <p>
              Vizora commits to 99.9% uptime for customers on Pro and Enterprise plans, measured on a calendar month basis.
              Uptime is calculated as the total minutes in the month minus downtime minutes, divided by total minutes in the
              month. Scheduled maintenance windows are excluded from uptime calculations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">2. Scheduled Maintenance</h2>
            <p className="mb-3">
              We perform scheduled maintenance to keep the platform secure and up to date. Maintenance windows are:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Announced at least 48 hours in advance via email and in-app notification</li>
              <li>Performed during low-traffic windows, typically between 2:00 AM and 6:00 AM UTC</li>
              <li>Kept as brief as possible to minimize disruption</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">3. Incident Response</h2>
            <p className="mb-3">
              We classify incidents by severity and respond accordingly:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]/30">
                    <th className="text-left py-2 pr-4 text-[var(--foreground)] font-semibold">Severity</th>
                    <th className="text-left py-2 pr-4 text-[var(--foreground)] font-semibold">Description</th>
                    <th className="text-left py-2 pr-4 text-[var(--foreground)] font-semibold">Response Time</th>
                    <th className="text-left py-2 text-[var(--foreground)] font-semibold">Resolution Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--border)]/20">
                    <td className="py-2 pr-4 font-medium text-[var(--foreground)]">Critical</td>
                    <td className="py-2 pr-4">Service completely down</td>
                    <td className="py-2 pr-4">1 hour</td>
                    <td className="py-2">4 hours</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]/20">
                    <td className="py-2 pr-4 font-medium text-[var(--foreground)]">High</td>
                    <td className="py-2 pr-4">Service significantly degraded</td>
                    <td className="py-2 pr-4">4 hours</td>
                    <td className="py-2">24 hours</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]/20">
                    <td className="py-2 pr-4 font-medium text-[var(--foreground)]">Medium</td>
                    <td className="py-2 pr-4">Minor feature impacted</td>
                    <td className="py-2 pr-4">Next business day</td>
                    <td className="py-2">3 business days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-[var(--foreground)]">Low</td>
                    <td className="py-2 pr-4">Cosmetic or minor issue</td>
                    <td className="py-2 pr-4">Next business day</td>
                    <td className="py-2">5 business days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">4. Service Credits</h2>
            <p className="mb-3">
              If monthly uptime falls below the 99.9% commitment, eligible customers receive service credits applied to
              their next invoice:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]/30">
                    <th className="text-left py-2 pr-4 text-[var(--foreground)] font-semibold">Monthly Uptime</th>
                    <th className="text-left py-2 text-[var(--foreground)] font-semibold">Service Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--border)]/20">
                    <td className="py-2 pr-4">&lt; 99.9% but &ge; 99.5%</td>
                    <td className="py-2">10% of monthly fee</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]/20">
                    <td className="py-2 pr-4">&lt; 99.5% but &ge; 99.0%</td>
                    <td className="py-2">25% of monthly fee</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">&lt; 99.0%</td>
                    <td className="py-2">50% of monthly fee</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3">
              Service credits must be requested within 30 days of the affected month. Credits are capped at 50% of the
              monthly subscription fee and are not redeemable for cash.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">5. Exclusions</h2>
            <p className="mb-3">This SLA does not apply to downtime caused by:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Force majeure events (natural disasters, war, government actions)</li>
              <li>Issues caused by customer actions or configurations</li>
              <li>Third-party service outages (cloud providers, DNS, CDN)</li>
              <li>Scheduled maintenance windows announced in advance</li>
              <li>Features or services labeled as &quot;beta&quot; or &quot;preview&quot;</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">6. Monitoring</h2>
            <p>
              We maintain real-time monitoring of all platform services via automated health endpoints and infrastructure
              metrics. Customers on Pro and Enterprise plans have access to service status information through the dashboard.
              A public status page is planned for a future release.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">7. Support Channels</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Email:{' '}
                <a href="mailto:support@vizora.cloud" className="text-[var(--primary)] hover:underline">
                  support@vizora.cloud
                </a>
              </li>
              <li>In-app support chat (available on Pro and Enterprise plans)</li>
              <li>Priority phone support (Enterprise plans only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">8. Plan Availability</h2>
            <p>
              This Service Level Agreement applies to customers on Pro and Enterprise plans. Free and Starter plans are
              provided on a best-effort basis without uptime guarantees or service credits. Upgrading to a Pro or Enterprise
              plan activates SLA coverage from the start of the next billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">9. Changes to This SLA</h2>
            <p>
              We may update this Service Level Agreement from time to time. We will notify you of material changes at least
              30 days in advance via email. Changes will not reduce the level of service commitment during an active billing
              period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">10. Contact</h2>
            <p>
              For SLA-related questions or to request service credits, contact us at{' '}
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
          <Link href="/sla" className="text-[var(--foreground-secondary)]">SLA</Link>
          <span className="text-[var(--border)]">|</span>
          <Link href="/refund" className="hover:text-[var(--foreground-secondary)] transition-colors">Refund Policy</Link>
          <span className="text-[var(--border)]">|</span>
          <a href="mailto:support@vizora.cloud" className="hover:text-[var(--foreground-secondary)] transition-colors">Support</a>
        </div>
        <p className="mt-2">&copy; {new Date().getFullYear()} Triveni Digital. All rights reserved.</p>
      </footer>
    </div>
  );
}
