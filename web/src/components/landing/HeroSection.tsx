'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { anchorProps } from './shared';
import WorldsScene, { THREAD_DESKTOP, THREAD_MOBILE, type WorldPlace } from './WorldsScene';
import { WORLD_ASSETS } from './worldAssets';

interface HeroSectionProps {
  /** Jump to the Places section with this place selected. */
  onExplore: (place: WorldPlace) => void;
}

/**
 * Dot hues match the Places section's location swatches.
 *
 * `px`/`py` place the pin as a percentage of the SCENE BOX, at the front rim of
 * that vignette's plinth. `slot` is the aspect-reserved 4:3 box a prerendered
 * render drops into for the same place.
 *
 * The two are tied together by one convention, documented for the renders in
 * `web/public/landing/worlds/README.md`: an asset frames its plinth's front rim
 * at 75% of the image height. A 34%-wide slot is 42.5% of the stage tall to
 * that line, so `slot.top = py - 42.5` puts an image's plinth exactly where the
 * CSS vignette's is, and a mixed row stays on one ground line.
 */
const PLACES: Array<{
  id: WorldPlace;
  label: string;
  dot: string;
  px: number;
  py: number;
  slot: { left: number; top: number; width: number };
  /** Same idea for the <=640px cluster, which is a different arrangement. */
  mslot: { left: number; top: number; width: number };
}> = [
  {
    id: 'cafe',
    label: 'Café',
    dot: 'var(--lw-brass)',
    px: 28.2,
    py: 76.9,
    slot: { left: 11.2, top: 34.4, width: 34 },
    mslot: { left: 12.3, top: 63.9, width: 40 },
  },
  {
    id: 'hotel',
    label: 'Hotel',
    dot: 'var(--lw-forest)',
    px: 53.2,
    py: 65.8,
    slot: { left: 36.2, top: 23.3, width: 34 },
    mslot: { left: 35.6, top: 22.2, width: 40 },
  },
  {
    id: 'retail',
    label: 'Retail',
    dot: 'var(--lw-coral)',
    px: 79.2,
    py: 75.8,
    slot: { left: 62.2, top: 33.3, width: 34 },
    mslot: { left: 53.8, top: 57.8, width: 40 },
  },
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

/* Image slots. One per place, aspect-RESERVED at 4:3 so switching a place
   between CSS and image causes no layout shift and a mixed row stays aligned.
   object-fit:contain means an asset is letterboxed, never stretched or
   cropped. A CSS filter here is safe — it lands on an img, not on a
   preserve-3d group. */
.lw-slot{position:absolute;left:var(--x);top:var(--y);width:var(--w);aspect-ratio:4/3;
  pointer-events:none;transition:transform .5s cubic-bezier(.22,.7,.3,1),filter .4s ease}
.lw-slot img{width:100%;height:100%;object-fit:contain;object-position:50% 50%}
.lw-slot[data-matte="ivory"] img{
  -webkit-mask-image:radial-gradient(62% 60% at 50% 52%,#000 62%,rgba(0,0,0,0) 100%);
  mask-image:radial-gradient(62% 60% at 50% 52%,#000 62%,rgba(0,0,0,0) 100%)}
.lw-hero-stage[data-active="cafe"] .lw-slot[data-place="cafe"],
.lw-hero-stage[data-active="hotel"] .lw-slot[data-place="hotel"],
.lw-hero-stage[data-active="retail"] .lw-slot[data-place="retail"]{
  transform:translateY(-10px);filter:drop-shadow(0 18px 26px rgba(44,38,24,.22))}

/* The sync thread lives in PAGE space over the stage, not inside the 3D world,
   so it is identical whether a place is CSS or a prerendered image. */
.lw-thread{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;
  overflow:visible;filter:drop-shadow(0 1px 0 rgba(255,255,255,.8))}
.lw-thread-m{display:none}
.lw-thread path{fill:none;stroke:#274c37;stroke-width:1.6;stroke-linecap:round;opacity:.82}
.lw-thread .lw-flow{stroke:#3d7a55;stroke-width:2.6;stroke-dasharray:30 620;opacity:.95;
  animation:lw-thread-flow 6s linear infinite}
.lw-thread circle{fill:#274c37;stroke:#f7f3ea;stroke-width:1.6}
@keyframes lw-thread-flow{from{stroke-dashoffset:650}to{stroke-dashoffset:-30}}
/* <=640px the CSS scene switches to its cluster arrangement, so the image
   slots have to follow it or a mixed row would sit in the desktop positions
   inside the taller mobile canvas. */
@media (max-width:640px){
  .lw-thread-d{display:none}
  .lw-thread-m{display:block}
  .lw-slot{left:var(--mx);top:var(--my);width:var(--mw)}
}
@media (prefers-reduced-motion:reduce){
  .lw-thread .lw-flow{animation:none;display:none}
  .lw-slot{transition:none}
}
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

/** Places delivered as a prerendered image today; empty while all are null. */
const imagePlaces = PLACES.filter((p) => WORLD_ASSETS[p.id]).map((p) => p.id);

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
          <div
            className="lw-hero-stage"
            data-active={preview ?? undefined}
            onMouseLeave={() => setPreview(null)}
          >
            <div aria-hidden="true">
              <WorldsScene active={preview} hidden={imagePlaces} />
            </div>
            {PLACES.filter((p) => WORLD_ASSETS[p.id]).map((p) => {
              const a = WORLD_ASSETS[p.id]!;
              return (
                <div
                  key={`slot-${p.id}`}
                  className="lw-slot"
                  data-place={p.id}
                  data-matte={a.matte}
                  aria-hidden="true"
                  style={
                    {
                      '--x': `${p.slot.left}%`,
                      '--y': `${p.slot.top}%`,
                      '--w': `${p.slot.width}%`,
                      '--mx': `${p.mslot.left}%`,
                      '--my': `${p.mslot.top}%`,
                      '--mw': `${p.mslot.width}%`,
                    } as CSSProperties
                  }
                >
                  <Image
                    src={a.src}
                    alt={a.alt ?? ''}
                    width={a.width}
                    height={a.height}
                    priority
                    sizes="(min-width:1200px) 22vw, (min-width:641px) 26vw, 44vw"
                  />
                </div>
              );
            })}
            <svg
              className="lw-thread lw-thread-d"
              viewBox="0 0 1000 450"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={THREAD_DESKTOP} />
              <path className="lw-flow" d={THREAD_DESKTOP} />
              <circle cx="282" cy="404" r="3" />
              <circle cx="532" cy="355" r="3" />
              <circle cx="792" cy="400" r="3" />
            </svg>
            <svg
              className="lw-thread lw-thread-m"
              viewBox="0 0 540 560"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={THREAD_MOBILE} />
              <path className="lw-flow" d={THREAD_MOBILE} />
              <circle cx="150" cy="486" r="3" />
              <circle cx="430" cy="448" r="3" />
              <circle cx="468" cy="214" r="3" />
            </svg>
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
