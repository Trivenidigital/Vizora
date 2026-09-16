'use client';

import type { ReactNode } from 'react';

/**
 * From content to playback: Create → Organize → Schedule → Display.
 * Every sentence here is checkable against the product: byte-level upload
 * validation, playlists, per-display timezone-aware schedules with a
 * next-ten-runs preview, code pairing, live status and cached offline
 * playback are all shipped behavior.
 */

const STEPS: Array<{ n: string; title: string; copy: string; art: ReactNode }> = [
  {
    n: '01',
    title: 'Create',
    copy: 'Upload images, video, web pages, or build HTML boards from templates. Every file is checked by its bytes — not its file extension — before it can reach a screen.',
    art: (
      <div className="lwq-art">
        {['JPG', 'MP4', 'HTML'].map((t) => (
          <span key={t} className="lwq-file">
            <b>{t}</b>
            <i className="lwq-tick" aria-hidden="true">
              ✓
            </i>
          </span>
        ))}
      </div>
    ),
  },
  {
    n: '02',
    title: 'Organize',
    copy: 'Drag content into playlists, keep the library tidy with folders and tags, and reuse the same piece across as many places as it belongs.',
    art: (
      <div className="lwq-art lwq-stack">
        {['Morning Menu', 'Lunch Specials', 'Good Food Mood'].map((t, i) => (
          <span key={t} className="lwq-row" style={{ opacity: 1 - i * 0.18 }}>
            <i className="lwq-grip" aria-hidden="true">
              ⠿
            </i>
            {t}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: '03',
    title: 'Schedule',
    copy: 'Daypart by each location’s own local time and preview the next ten runs before you commit — so the breakfast board never plays at dinner.',
    art: (
      <div className="lwq-art lwq-sched">
        <span className="lwq-slot" style={{ ['--w' as never]: '34%', background: 'var(--lw-brass)' }}>
          06–11
        </span>
        <span className="lwq-slot" style={{ ['--w' as never]: '40%', background: 'var(--lw-forest)' }}>
          11–17
        </span>
        <span className="lwq-slot" style={{ ['--w' as never]: '26%', background: 'var(--lw-coral)' }}>
          17–22
        </span>
      </div>
    ),
  },
  {
    n: '04',
    title: 'Display',
    copy: 'Pair a screen with the short code it shows, and it plays what you scheduled while reporting status live. If the network drops, it keeps playing from its cache.',
    art: (
      <div className="lwq-art">
        <span className="lwq-pair">
          <small>Pairing code</small>
          <b>7F2K</b>
        </span>
      </div>
    ),
  },
];

const CSS = `
.lw-pipe{padding:clamp(56px,7vw,104px) 0;background:linear-gradient(180deg,transparent,var(--lw-paper-2) 30%,var(--lw-paper-2) 70%,transparent)}
.lwq-head{max-width:44rem;margin-bottom:38px}
.lwq-head h2{font-size:clamp(1.9rem,3.4vw,2.9rem);margin:14px 0 12px}
.lwq-head p{color:var(--lw-ink-2);line-height:1.65;max-width:34rem}
.lwq-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.lwq-card{background:var(--lw-card);border:1px solid var(--lw-hair-2);border-radius:18px;
  padding:22px;display:flex;flex-direction:column;gap:12px;
  box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 16px 36px rgba(35,38,31,.06)}
.lwq-n{font-family:var(--font-mono),monospace;font-size:.66rem;letter-spacing:.16em;color:var(--lw-brass-ink)}
.lwq-t{font-family:var(--lw-serif);font-weight:520;font-size:1.5rem;letter-spacing:-.01em}
.lwq-c{color:var(--lw-ink-2);font-size:.875rem;line-height:1.6}
.lwq-art{margin-top:auto;padding-top:12px;display:flex;gap:8px;align-items:center;min-height:64px}
.lwq-file{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--lw-hair);
  border-radius:9px;padding:7px 9px;background:var(--lw-paper);font-family:var(--font-mono),monospace;
  font-size:.62rem;letter-spacing:.08em}
.lwq-tick{font-style:normal;color:var(--lw-forest);font-weight:700}
.lwq-stack{flex-direction:column;align-items:stretch;gap:6px}
.lwq-row{display:flex;align-items:center;gap:8px;border:1px solid var(--lw-hair-2);border-radius:9px;
  padding:7px 10px;background:var(--lw-paper);font-size:.78rem;font-weight:550}
.lwq-grip{font-style:normal;color:var(--lw-muted);font-size:.7rem}
.lwq-sched{gap:4px;align-items:stretch}
.lwq-slot{width:var(--w);border-radius:7px;color:#f2efe4;font-family:var(--font-mono),monospace;
  font-size:.58rem;letter-spacing:.06em;display:grid;place-items:center;padding:10px 0}
.lwq-pair{display:inline-flex;flex-direction:column;gap:2px;border:1px dashed var(--lw-hair);
  border-radius:12px;padding:10px 18px;background:var(--lw-paper)}
.lwq-pair small{font-family:var(--font-mono),monospace;font-size:.56rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--lw-muted)}
.lwq-pair b{font-family:var(--font-mono),monospace;font-size:1.3rem;letter-spacing:.34em;color:var(--lw-forest)}
@media (max-width:1023px){.lwq-grid{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.lwq-grid{grid-template-columns:1fr}}
`;

export default function PipelineSection() {
  return (
    <section id="how-it-works" className="lw-pipe scroll-mt-20" aria-labelledby="pipeTitle">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lw-wrap">
        <div className="lwq-head">
          <span className="lw-mono lw-kicker">From content to playback</span>
          <h2 id="pipeTitle" className="lw-h2">
            Make it once. It plays everywhere you meant.
          </h2>
          <p>
            Four steps between an idea and every screen it belongs on — and nothing on a screen
            you didn&apos;t put there.
          </p>
        </div>
        <ol className="lwq-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STEPS.map((s) => (
            <li key={s.n} className="lwq-card">
              <span className="lwq-n">{s.n}</span>
              <h3 className="lwq-t">{s.title}</h3>
              <p className="lwq-c">{s.copy}</p>
              <div aria-hidden="true">{s.art}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
