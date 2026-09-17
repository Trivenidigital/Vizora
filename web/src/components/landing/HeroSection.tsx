'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { anchorProps } from './shared';
import WorldsScene, { type WorldPlace } from './WorldsScene';

interface HeroSectionProps {
  /** Jump to the Places section with this place selected. */
  onExplore: (place: WorldPlace) => void;
}

/**
 * Dot hues match the Places section's location swatches. `px`/`py` are the
 * pin's position as a percentage of the SCENE BOX, sitting at the front rim of
 * that vignette's plinth — the same slots a prerendered image per vignette
 * would occupy, so swapping the CSS scene for artwork needs no relayout.
 */
const PLACES: Array<{ id: WorldPlace; label: string; dot: string; px: number; py: number }> = [
  { id: 'cafe', label: 'Café', dot: 'var(--lw-brass)', px: 28.2, py: 76.9 },
  { id: 'hotel', label: 'Hotel', dot: 'var(--lw-forest)', px: 53.2, py: 65.8 },
  { id: 'retail', label: 'Retail', dot: 'var(--lw-coral)', px: 79.2, py: 75.8 },
];

const HERO_CSS = `
.lw-hero{padding:118px 0 30px;position:relative}
.lw-hero-grid{display:grid;grid-template-columns:minmax(320px,30fr) 70fr;gap:clamp(12px,1.4vw,24px);
  align-items:center}
/* The copy is allowed to OVERFLOW its grid cell to the right and sit on top of
   the scene's empty left margin — the board does exactly this, the headline
   ending just over the cafe plinth's pale edge. Without it a 70% scene column
   forces the headline onto three lines. */
.lw-hero-copy{position:relative;z-index:2}

/* Board typography: the kicker is two tracked lines with a short rule to its
   RIGHT, and BOTH headline lines are forest green and upright — the italic
   second line was ours, not the concept's. */
.lw-hero-kicker{display:flex;align-items:flex-end;gap:12px;color:var(--lw-brass-ink);
  font-family:var(--font-mono),ui-monospace,monospace;text-transform:uppercase;
  letter-spacing:.2em;font-size:.6rem;font-weight:500;line-height:1.7}
.lw-hero-kicker i{display:block;width:26px;height:1px;background:currentColor;opacity:.55;
  margin-bottom:.55em;flex:none}
.lw-hero h1{font-size:clamp(2.6rem,3.9vw,3.6rem);margin:20px 0 22px;color:var(--lw-forest);
  font-weight:420;letter-spacing:-.03em;line-height:1.02}
.lw-hero h1 em{font-style:normal;font-weight:420;color:inherit}
.lw-hero-sub{color:var(--lw-ink-2);font-size:clamp(1.05rem,1.3vw,1.22rem);line-height:1.62;
  max-width:31rem;margin-bottom:30px}

/* Editorial margin note, top-right, like the board's. Decorative. */
.lw-hero-note{display:none}
@media (min-width:1280px){
  .lw-hero-note{display:block;position:absolute;top:132px;right:clamp(20px,3.6vw,48px);
    text-align:left;color:var(--lw-ink-2);font-family:var(--lw-serif);font-size:.92rem;
    line-height:1.5;letter-spacing:-.005em;z-index:2;pointer-events:none}
  .lw-hero-note i{display:block;width:34px;height:1px;background:var(--lw-hair);
    margin-top:12px}
}
.lw-hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.lw-hero-trust{color:var(--lw-muted);font-size:.82rem;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.lw-hero-trust b{color:var(--lw-brass-ink);font-weight:700}

.lw-hero-scene{position:relative}
.lw-hero-stage{position:relative}
.lw-hero-places{display:flex;justify-content:center;gap:clamp(10px,2vw,26px);margin-top:2px;flex-wrap:wrap}
.lw-place-btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 15px;
  font-size:.82rem;font-weight:600;color:var(--lw-ink-2);border:1px solid transparent;
  transition:color .2s,border-color .2s,background .2s}
.lw-place-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dot)}
.lw-place-line{display:none}
.lw-place-btn:hover,.lw-place-btn:focus-visible,.lw-place-btn[data-on="true"]{
  color:var(--lw-ink);border-color:var(--lw-hair);background:rgba(255,253,244,.75)}
.lw-place-btn small{font-family:var(--font-mono),monospace;font-size:.56rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--lw-muted)}

/* >=1200px the SAME buttons become the board's on-scene markers: a coral pin
   at the plinth's front rim, a thin leader line, and a serif label under it.
   One set of buttons, two layouts — a second set would duplicate the group for
   assistive tech and break the getByRole('group') query in jsdom, where no
   media query applies. */
@media (min-width:1200px){
  .lw-hero-places{position:absolute;inset:0;display:block;margin:0;pointer-events:none}
  .lw-place-btn{position:absolute;left:var(--x);top:var(--y);transform:translateX(-50%);
    pointer-events:auto;flex-direction:column;align-items:center;gap:0;
    min-width:52px;min-height:46px;padding:0 10px 6px;border:0;background:none;border-radius:10px}
  .lw-place-btn:hover,.lw-place-btn:focus-visible,.lw-place-btn[data-on="true"]{background:none;border-color:transparent}
  .lw-place-dot{width:7px;height:7px;background:var(--lw-coral);
    box-shadow:0 0 0 3px rgba(217,106,76,.16);transition:box-shadow .2s}
  .lw-place-line{display:block;width:1px;height:17px;background:rgba(35,38,31,.32);flex:none}
  .lw-place-name{font-family:var(--lw-serif);font-size:1.02rem;font-weight:500;letter-spacing:-.01em;
    color:var(--lw-ink);margin-top:5px;transition:color .2s}
  .lw-place-btn small{display:none}
  .lw-place-btn:hover .lw-place-name,.lw-place-btn:focus-visible .lw-place-name,
  .lw-place-btn[data-on="true"] .lw-place-name{color:var(--lw-forest)}
  .lw-place-btn:hover .lw-place-dot,.lw-place-btn[data-on="true"] .lw-place-dot{
    box-shadow:0 0 0 5px rgba(217,106,76,.2)}
  .lw-place-btn:focus-visible{outline:2px solid var(--lw-forest);outline-offset:3px}
}

/* Panorama bleed. RIGHT is the gutter outside the 1280px wrap, capped so it can
   never exceed the viewport (checked: scrollWidth - clientWidth === 0). LEFT is
   a fixed nudge back over the copy column, which is empty there. */
@media (min-width:1200px){
  .lw-hero-scene{margin-right:calc(-1 * clamp(0px,(100vw - 1330px)/2,96px));margin-left:-34px}
  /* A fixed width, NOT min(30rem,100%): inside a grid item a percentage width
     resolves against the CELL, which is ~349px at 1440, so the headline kept
     breaking onto three lines. */
  .lw-hero-copy{width:30rem}
  /* Only the HEADLINE is allowed near the scene. The sub, CTAs and trust line
     stay inside the copy column so nothing but display type ever sits over the
     diorama. */
  .lw-hero-sub{max-width:24rem}
}

/* Single column below 1200px: the two-column scene column got as small as
   560x383 at 1024, which is the cramped version this redesign exists to kill. */
@media (max-width:1199px){
  .lw-hero{padding-top:96px}
  .lw-hero-grid{grid-template-columns:1fr;gap:20px}
  .lw-hero-copy{max-width:38rem}
  .lw-hero-scene{max-width:760px;margin-inline:auto;width:100%}
}
@media (max-width:420px){
  .lw-hero-places{gap:6px}
  .lw-place-btn{padding:8px 11px}
  .lw-place-btn small{display:none}
}
@media (max-width:360px){
  .lw-hero h1{font-size:2rem}
}
`;

export default function HeroSection({ onExplore }: HeroSectionProps) {
  const [preview, setPreview] = useState<WorldPlace | null>(null);

  return (
    <section className="lw-hero" aria-labelledby="heroTitle">
      <style dangerouslySetInnerHTML={{ __html: HERO_CSS }} />
      <p className="lw-hero-note" aria-hidden="true">
        Different places.
        <br />
        A brighter tomorrow.
        <i />
      </p>
      <div className="lw-wrap lw-hero-grid">
        <div className="lw-hero-copy">
          <span className="lw-hero-kicker">
            <span>
              Screens bring
              <br />
              people together
            </span>
            <i aria-hidden="true" />
          </span>
          <h1 id="heroTitle" className="lw-display">
            Your world.
            <br />
            Perfectly in sync.
          </h1>
          <p className="lw-hero-sub">
            Vizora runs the screens in the places you run. Make the content once, schedule when it
            plays, and every screen — café menu, hotel lobby, shop window — stays exactly on
            script.
          </p>
          <div className="lw-hero-cta">
            <Link href="/register" className="lw-btn lw-btn-forest">
              Start free
              <span aria-hidden="true" style={{ opacity: 0.6 }}>
                →
              </span>
            </Link>
            <a {...anchorProps('how-it-works')} className="lw-btn lw-btn-ghost">
              See how it works
            </a>
          </div>
          <p className="lw-hero-trust">
            <b aria-hidden="true">✓</b> 30-day free trial
            <span aria-hidden="true">·</span> up to 5 screens
            <span aria-hidden="true">·</span> no credit card
          </p>
        </div>

        <div className="lw-hero-scene">
          <div className="lw-hero-stage">
            <div aria-hidden="true" onMouseLeave={() => setPreview(null)}>
              <WorldsScene active={preview} />
            </div>
            <div className="lw-hero-places" role="group" aria-label="Explore a place">
              {PLACES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="lw-place-btn"
                  data-on={preview === p.id}
                  style={
                    { '--dot': p.dot, '--x': `${p.px}%`, '--y': `${p.py}%` } as CSSProperties
                  }
                  onMouseEnter={() => setPreview(p.id)}
                  onFocus={() => setPreview(p.id)}
                  onBlur={() => setPreview(null)}
                  onClick={() => onExplore(p.id)}
                >
                  <i className="lw-place-dot" aria-hidden="true" />
                  <i className="lw-place-line" aria-hidden="true" />
                  <span className="lw-place-name">{p.label}</span>
                  <small aria-hidden="true">explore</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
