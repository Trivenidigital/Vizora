import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Vizora',
  description: 'Privacy Policy for Vizora digital signage platform and Vizora Display app.',
};

export default function PrivacyPolicyPage() {
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
            <Link href="/login" className="hover:text-[var(--foreground)] transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--foreground-tertiary)] mb-10">Last updated: February 21, 2026</p>

        <div className="space-y-8 text-[var(--foreground-secondary)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">1. Introduction</h2>
            <p>
              Triveni Digital (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the Vizora platform (vizora.cloud) and the Vizora Display
              application. This Privacy Policy explains how we collect, use, and protect information when you use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">2. Information We Collect</h2>

            <h3 className="text-base font-semibold text-[var(--foreground)] mt-4 mb-2">Account Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and password (hashed)</li>
              <li>Organization name and details</li>
            </ul>

            <h3 className="text-base font-semibold text-[var(--foreground)] mt-4 mb-2">Device Information (Vizora Display App)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Device identifier (for pairing with your account)</li>
              <li>Device status (online/offline)</li>
              <li>IP address (for connection establishment)</li>
              <li>Device model and OS version</li>
            </ul>

            <h3 className="text-base font-semibold text-[var(--foreground)] mt-4 mb-2">Usage Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Content playback logs (which content was displayed and when)</li>
              <li>Service uptime and connectivity metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">3. How We Use Information</h2>
            <p className="mb-3">We use collected data solely to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Pair display devices with your Vizora account</li>
              <li>Deliver and schedule content to your displays</li>
              <li>Monitor device health and connectivity</li>
              <li>Provide analytics on content performance</li>
              <li>Send service-related notifications</li>
              <li>Improve and maintain our platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">4. Data Storage &amp; Security</h2>
            <p className="mb-3">
              Content is temporarily cached on display devices for offline playback. Cached content is automatically
              removed when replaced or when the device is unpaired.
            </p>
            <p>
              We use industry-standard security measures including encrypted connections (TLS), hashed passwords (bcrypt),
              and HTTP-only cookies for authentication. All data is stored on secured servers with restricted access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">5. Data Sharing</h2>
            <p>
              We do not sell, trade, or share your personal information with third parties. Data may be disclosed only
              if required by law or to protect our legal rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">6. Data Retention</h2>
            <p>
              Account data is retained while your account is active. Upon account deletion, personal data is removed
              within 30 days. Anonymized analytics data may be retained for service improvement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">8. Children&apos;s Privacy</h2>
            <p>
              Vizora is a business platform not intended for use by children under 13. We do not knowingly collect
              personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email
              or through the platform. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">10. Contact</h2>
            <p>
              For privacy questions or data requests, contact us at{' '}
              <a href="mailto:privacy@vizora.cloud" className="text-[var(--primary)] hover:underline">
                privacy@vizora.cloud
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
          <Link href="/privacy" className="text-[var(--foreground-secondary)]">Privacy Policy</Link>
          <span className="text-[var(--border)]">|</span>
          <a href="mailto:support@vizora.cloud" className="hover:text-[var(--foreground-secondary)] transition-colors">Support</a>
        </div>
        <p className="mt-2">&copy; {new Date().getFullYear()} Triveni Digital. All rights reserved.</p>
      </footer>
    </div>
  );
}
