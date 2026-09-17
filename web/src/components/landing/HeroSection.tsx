'use client';

import { useState } from 'react';
import Link from 'next/link';
import { anchorProps } from './shared';
import WorldsScene, { type WorldPlace } from './WorldsScene';

interface HeroSectionProps {
  /** Jump to the Places section with this place selected. */
  onExplore: (place: WorldPlace) => void;
}

/* Dot hues match the Places section's location swatches. */
const PLACES: Array<{ id: WorldPlace; label: string; dot: string }> = [
  { id: 'cafe', label: 'Café', dot: 'var(--lw-brass)' },
  { id: 'hotel', label: 'Hotel', dot: 'var(--lw-forest)' },
  { id: 'retail', label: 'Retail', dot: 'var(--lw-coral)' },
];

const HERO_CSS = `
.lw-hero{padding:118px 0 30px}
.lw-hero-grid{display:grid;grid-template-columns:minmax(360px,38fr) 62fr;gap:clamp(24px,3vw,48px);align-items:center}
.lw-hero-copy{max-width:34rem}
.lw-hero h1{font-size:clamp(2.35rem,4.5vw,3.7rem);margin:18px 0 20px}
.lw-hero-sub{color:var(--lw-ink-2);font-size:clamp(1rem,1.15vw,1.13rem);line-height:1.65;max-width:30rem;margin-bottom:28px}
.lw-hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.lw-hero-trust{color:var(--lw-muted);font-size:.82rem;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.lw-hero-trust b{color:var(--lw-brass-ink);font-weight:700}

.lw-hero-scene{position:relative}
.lw-hero-places{display:flex;justify-content:center;gap:clamp(10px,2vw,26px);margin-top:2px;flex-wrap:wrap}
.lw-place-btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 15px;
  font-size:.82rem;font-weight:600;color:var(--lw-ink-2);border:1px solid transparent;
  transition:color .2s,border-color .2s,background .2s}
.lw-place-btn i{width:7px;height:7px;border-radius:50%;flex:none}
.lw-place-btn:hover,.lw-place-btn:focus-visible,.lw-place-btn[data-on="true"]{
  color:var(--lw-ink);border-color:var(--lw-hair);background:rgba(255,253,244,.75)}
.lw-place-btn small{font-family:var(--font-mono),monospace;font-size:.56rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--lw-muted)}

/* ≥1280px: let the diorama run past the text wrap toward the right edge. The
   bleed is derived from the gutter OUTSIDE the 1280px wrap and capped, so it
   can never exceed the viewport (checked: scrollWidth - clientWidth === 0). */
@media (min-width:1280px){
  .lw-hero-scene{margin-right:calc(-1 * clamp(0px,(100vw - 1330px)/2,88px))}
}

@media (max-width:1023px){
  .lw-hero{padding-top:96px}
  .lw-hero-grid{grid-template-columns:1fr;gap:20px}
  .lw-hero-copy{max-width:38rem}
  .lw-hero-scene{max-width:720px;margin-inline:auto;width:100%}
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
      <div className="lw-wrap lw-hero-grid">
        <div className="lw-hero-copy">
          <span className="lw-mono lw-kicker">Screens bring people together</span>
          <h1 id="heroTitle" className="lw-display">
            Your world.
            <br />
            <em>Perfectly in sync.</em>
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
                onMouseEnter={() => setPreview(p.id)}
                onFocus={() => setPreview(p.id)}
                onBlur={() => setPreview(null)}
                onClick={() => onExplore(p.id)}
              >
                <i aria-hidden="true" style={{ background: p.dot }} />
                {p.label}
                <small aria-hidden="true">explore</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
