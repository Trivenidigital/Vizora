'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import ProductTourDialog from './ProductTourDialog';

/**
 * The proof section: the real dashboard capture (demo workspace, synthetic
 * data — web/public/product/README.md documents how it is taken) plus the
 * handful of strengths the repository actually backs. No AI claims, no
 * counts, no certifications.
 */

const STRENGTHS: Array<{ title: string; copy: string }> = [
  {
    title: 'Status you can trust',
    copy: 'Every screen reports over a live connection, and the dashboard shows when it last checked in — freshness is displayed, never guessed.',
  },
  {
    title: 'Roles that match a team',
    copy: 'Admins, managers and viewers each see what they need, and every change lands in an audit log with user, time and IP.',
  },
  {
    title: 'Content that checks in clean',
    copy: 'Uploads are validated by their bytes before they can reach a screen, so a mislabelled file never makes it to the shop floor.',
  },
  {
    title: 'The screens you already have',
    copy: 'An Android TV app plus desktop players for Windows, macOS and Linux. Pro plans add API access for your own integrations.',
  },
];

const CSS = `
.lw-work{padding:clamp(56px,7vw,104px) 0}
.lww-head{max-width:44rem;margin-bottom:34px}
.lww-head h2{font-size:clamp(1.9rem,3.4vw,2.9rem);margin:14px 0 12px}
.lww-head p{color:var(--lw-ink-2);line-height:1.65;max-width:34rem}
.lww-grid{display:grid;grid-template-columns:56fr 44fr;gap:clamp(26px,4vw,56px);align-items:center}
/* The capture is the app's real dark theme — seated in a deep-forest bezel it
   reads as a framed device view rather than a palette clash on the ivory page. */
.lww-shot{border-radius:18px;overflow:hidden;padding:10px;background:var(--lw-forest-deep);
  box-shadow:0 30px 70px rgba(20,44,32,.28)}
.lww-shot img{border-radius:10px}
.lww-cap{margin-top:10px;color:var(--lw-muted);font-size:.72rem}
.lww-list{display:flex;flex-direction:column;gap:20px}
.lww-item h3{font-family:var(--lw-serif);font-weight:520;font-size:1.18rem;letter-spacing:-.01em;margin-bottom:5px}
.lww-item p{color:var(--lw-ink-2);font-size:.9rem;line-height:1.62}
.lww-item{padding-left:16px;border-left:2px solid var(--lw-stone)}
.lww-tour{display:inline-flex;align-items:center;gap:10px;margin-top:6px;border:1px solid var(--lw-hair);
  border-radius:999px;padding:9px 18px 9px 10px;background:var(--lw-card);font-size:.84rem;font-weight:600;
  transition:border-color .2s,box-shadow .2s}
.lww-tour:hover{border-color:rgba(35,38,31,.28);box-shadow:0 10px 24px rgba(35,38,31,.1)}
.lww-tour i{width:28px;height:28px;border-radius:50%;background:var(--lw-forest);color:var(--lw-on-forest);
  display:grid;place-items:center;font-style:normal;font-size:.6rem;padding-left:2px}
.lww-tour small{color:var(--lw-muted);font-weight:500}
@media (max-width:1023px){.lww-grid{grid-template-columns:1fr}}
`;

export default function WorkspaceSection() {
  const [tourOpen, setTourOpen] = useState(false);
  const closeTour = useCallback(() => setTourOpen(false), []);

  return (
    <section id="product" className="lw-work scroll-mt-20" aria-labelledby="workTitle">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lw-wrap">
        <div className="lww-head">
          <span className="lw-mono lw-kicker">The workspace</span>
          <h2 id="workTitle" className="lw-h2">
            A workspace that makes sense.
          </h2>
          <p>
            One place to see every screen, what it is playing, and when it last checked in —
            built for the person who runs the place, not for a control room.
          </p>
        </div>

        <div className="lww-grid">
          <div>
            <figure className="m-0">
              <div className="lww-shot">
                <Image
                  src="/product/dashboard-fleet.png"
                  alt="The Vizora devices view: a fleet of displays across Seattle-area locations, each row showing its connection status, the playlist assigned to it, and when it last checked in."
                  width={2880}
                  height={1800}
                  sizes="(min-width: 1280px) 560px, (min-width: 1024px) 48vw, 92vw"
                  className="block h-auto w-full"
                />
              </div>
              <figcaption className="lww-cap">
                Actual product UI — demo workspace, synthetic data.
              </figcaption>
            </figure>
          </div>

          <div className="lww-list">
            {STRENGTHS.map((s) => (
              <div key={s.title} className="lww-item">
                <h3>{s.title}</h3>
                <p>{s.copy}</p>
              </div>
            ))}
            <div>
              <button type="button" className="lww-tour" onClick={() => setTourOpen(true)} aria-haspopup="dialog">
                <i aria-hidden="true">▶</i>
                Watch the tour
                <small>1:45</small>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ProductTourDialog open={tourOpen} onClose={closeTour} />
    </section>
  );
}
