'use client';

import { Reveal, FAQItem } from './shared';

/**
 * Every answer here is written from shipped behavior: pairing by code,
 * Android TV + desktop players, cached offline playback, per-display
 * timezone schedules with the next-ten-runs preview, the trial terms in the
 * billing constants, and the security measures the middleware enforces.
 */
const FAQ_DATA = [
  {
    q: 'How long does it take to get a screen live?',
    a: 'About five minutes. Install the player, enter the pairing code the screen shows, and assign a playlist. The screen joins your workspace and starts reporting its status.',
  },
  {
    q: 'What hardware do I need?',
    a: 'Any screen you can plug a player into. Vizora has an Android TV app and desktop players for Windows, macOS and Linux — a TV and an internet connection is enough.',
  },
  {
    q: 'What happens if a screen loses its connection?',
    a: 'It keeps playing. Players cache their content, so an offline screen continues with its last playlist; when it reconnects it picks up whatever you scheduled in the meantime. The dashboard always shows when each screen last checked in.',
  },
  {
    q: 'Can I schedule in each location’s local time?',
    a: 'Yes. Schedules are timezone-aware per display, so the breakfast board flips at six wherever the café actually is — and you can preview the next ten runs of any schedule before committing it.',
  },
  {
    q: 'How does billing work?',
    a: 'Per screen, per month. Start with a 30-day free trial for up to 5 screens with no credit card. Basic covers up to 50 screens; Pro covers up to 100 and adds API access. Beyond that, talk to us.',
  },
  {
    q: 'Is my content and data secure?',
    a: 'Users and screens authenticate with separate credentials, uploads are validated by their bytes rather than their file extension, access is role-scoped (admin, manager, viewer), and every change lands in an audit log with user, time and IP.',
  },
];

const CSS = `
.lw-faq{padding:clamp(56px,7vw,104px) 0}
.lwx-head{text-align:center;max-width:40rem;margin:0 auto 40px}
.lwx-head h2{font-size:clamp(1.9rem,3.4vw,2.9rem);margin:14px 0 10px}
.lwx-head p{color:var(--lw-ink-2)}
.lwx-head .lw-kicker{justify-content:center}
.lwx-list{max-width:46rem;margin-inline:auto}
.lwx-contact{text-align:center;color:var(--lw-muted);font-size:.88rem;margin-top:30px}
.lwx-contact a{color:var(--lw-forest);font-weight:600}
`;

export default function FAQSection() {
  return (
    <section id="faq" className="lw-faq scroll-mt-20" aria-labelledby="faqTitle">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lw-wrap">
        <Reveal>
          <div className="lwx-head">
            <span className="lw-mono lw-kicker">Useful questions</span>
            <h2 id="faqTitle" className="lw-h2">
              Questions, answered.
            </h2>
            <p>The short version of how Vizora actually behaves.</p>
          </div>
        </Reveal>

        <Reveal>
          <div className="lwx-list">
            {FAQ_DATA.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </Reveal>

        <Reveal>
          <p className="lwx-contact">
            Something else on your mind? <a href="mailto:support@vizora.cloud">Write to support</a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
