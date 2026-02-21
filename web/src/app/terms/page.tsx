import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Vizora',
  description: 'Terms of Service for Vizora digital signage platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)]/30 bg-[var(--surface)]/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
            Vizora
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--foreground-secondary)]">
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-[var(--foreground)] transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--foreground-tertiary)] mb-10">Last updated: February 21, 2026</p>

        <div className="space-y-8 text-[var(--foreground-secondary)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Vizora platform (vizora.cloud) and Vizora Display application, you agree to be
              bound by these Terms of Service. If you do not agree, do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">2. Description of Service</h2>
            <p>
              Vizora is a digital signage management platform that allows you to manage and distribute content to display
              devices. Our services include the web dashboard, API, real-time communication gateway, and display client
              applications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">3. Account Registration</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must provide accurate and complete registration information</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must notify us immediately of any unauthorized access to your account</li>
              <li>One person or entity may not maintain more than one account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to use Vizora to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Display content that violates any applicable law or regulation</li>
              <li>Distribute malware or harmful software through display devices</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the platform</li>
              <li>Use the service to send spam or unsolicited communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">5. Content Ownership</h2>
            <p>
              You retain ownership of all content you upload to Vizora. By uploading content, you grant us a limited
              license to store, process, and deliver that content to your registered display devices. We do not claim
              ownership of your content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">6. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted service. We may perform
              scheduled maintenance with advance notice. We are not liable for any downtime or service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">7. Data and Privacy</h2>
            <p>
              Your use of Vizora is also governed by our{' '}
              <Link href="/privacy" className="text-[var(--primary)] hover:underline">
                Privacy Policy
              </Link>
              , which describes how we collect, use, and protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">8. Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these terms. You may close your account at any
              time by contacting us. Upon termination, your data will be handled in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">9. Limitation of Liability</h2>
            <p>
              Vizora is provided &quot;as is&quot; without warranties of any kind. We are not liable for any indirect, incidental,
              or consequential damages arising from your use of the service. Our total liability is limited to the amount
              you paid for the service in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">10. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. We will notify you of material changes via email or through
              the platform. Continued use after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">11. Contact</h2>
            <p>
              For questions about these terms, contact us at{' '}
              <a href="mailto:legal@vizora.cloud" className="text-[var(--primary)] hover:underline">
                legal@vizora.cloud
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]/30 py-6 text-center text-xs text-[var(--foreground-tertiary)]">
        <div className="flex items-center justify-center gap-3">
          <Link href="/terms" className="text-[var(--foreground-secondary)]">Terms of Service</Link>
          <span className="text-[var(--border)]">|</span>
          <Link href="/privacy" className="hover:text-[var(--foreground-secondary)] transition-colors">Privacy Policy</Link>
          <span className="text-[var(--border)]">|</span>
          <a href="mailto:support@vizora.cloud" className="hover:text-[var(--foreground-secondary)] transition-colors">Support</a>
        </div>
        <p className="mt-2">&copy; {new Date().getFullYear()} Triveni Digital. All rights reserved.</p>
      </footer>
    </div>
  );
}
