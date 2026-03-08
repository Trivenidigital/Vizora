'use client';

import { Reveal, FAQItem } from './shared';

const FAQ_DATA = [
  {
    q: 'How long does setup take?',
    a: 'Most teams go from sign-up to their first live screen in under 5 minutes. Upload your content, pair a device using a simple code, and push your playlist. No technician or special IT knowledge required.',
  },
  {
    q: 'What hardware do I need to run Vizora?',
    a: 'Vizora works with any screen or TV. Our Electron app runs on Windows, macOS, and Linux devices, while our Android TV app supports smart displays and media players. All you need is a screen and an internet connection.',
  },
  {
    q: 'How does real-time monitoring work?',
    a: "Vizora uses persistent WebSocket connections — not polling — to maintain a live connection with every display. When a screen goes offline, changes content, or encounters an error, your dashboard updates within milliseconds. This is the same technology that powers live chat and trading platforms.",
  },
  {
    q: 'Is Vizora secure enough for enterprise use?',
    a: "Absolutely. Vizora includes CSRF protection, XSS sanitization on all API responses, dual JWT authentication (separate secrets for users and devices), role-based access control, full audit logging, and rate limiting. Files are validated at the binary level to prevent MIME spoofing.",
  },
  {
    q: 'Can I manage screens across different timezones?',
    a: "Yes. Vizora's scheduling engine is fully timezone-aware. You can set schedules in each location's local time, and the system automatically handles timezone conversions. Preview the next 10 occurrences of any schedule to verify timing before publishing.",
  },
  {
    q: 'What does the free trial include?',
    a: 'The free trial gives you 5 screens for 30 days with no credit card required. You get full access to content uploads, basic scheduling, and the real-time monitoring dashboard. When you\'re ready to scale, choose Basic, Pro, or contact us for Enterprise.',
  },
  {
    q: 'How does Vizora use AI?',
    a: "Vizora integrates AI across the platform — from content generation and smart scheduling to predictive device monitoring and audience-aware content adaptation. Our AI engine continuously optimizes your signage network, suggesting the best times to display content, detecting device anomalies before they cause downtime, and generating performance reports automatically. All AI features are included in Pro plans and above.",
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="py-16 sm:py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
              Frequently asked questions
            </h2>
            <p style={{ color: '#9A958E' }}>
              Everything you need to know about Vizora.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div>
            {FAQ_DATA.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </Reveal>

        <Reveal>
          <p className="text-center text-sm mt-8" style={{ color: '#6B655D' }}>
            Still have questions?{' '}
            <a href="mailto:support@vizora.cloud" className="transition-colors hover:text-[#00E5A0]" style={{ color: '#9A958E' }}>
              Contact us &rarr;
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
