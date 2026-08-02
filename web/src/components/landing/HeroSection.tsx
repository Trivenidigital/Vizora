'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import Link from 'next/link';
import { scrollTo } from './shared';

interface HeroSectionProps {
  heroRef: RefObject<HTMLElement | null>;
}

const RAIL = ['01 — Content automation', '02 — Smart scheduling', '03 — Fleet operations'];
const TRUST = ['30-day free trial', 'No credit card required', '5-minute setup'];

/* Signal-fibre generator constants — ported from design-samples/05-homepage.html */
const SVG_NS = 'http://www.w3.org/2000/svg';
const FIBRE_COUNT = 38;
const ORIGIN = { x: 470, y: -120 };
/* [x, y, rotation] of the three lit screens the fibres terminate on */
const SCREENS: Array<[number, number, number]> = [
  [324, 470, -7],
  [546, 558, 0],
  [768, 470, 7],
];

export default function HeroSection({ heroRef }: HeroSectionProps) {
  const fibreRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = fibreRef.current;
    if (!svg) return;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="pulse" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00E5A0" stop-opacity="0"/>
        <stop offset="45%" stop-color="#00E5A0" stop-opacity="1"/>
        <stop offset="100%" stop-color="#00B4D8" stop-opacity="0"/>
      </linearGradient>
      <filter id="tipGlow" x="-260%" y="-260%" width="620%" height="620%">
        <feGaussianBlur stdDeviation="7" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="softGlow" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="14"/></filter>`;
    svg.appendChild(defs);

    const gGlow = document.createElementNS(SVG_NS, 'g');
    const gLine = document.createElementNS(SVG_NS, 'g');
    const gPulse = document.createElementNS(SVG_NS, 'g');
    const gTip = document.createElementNS(SVG_NS, 'g');
    gTip.setAttribute('filter', 'url(#tipGlow)');
    svg.append(gGlow, gLine, gPulse, gTip);

    const bloom = document.createElementNS(SVG_NS, 'ellipse');
    bloom.setAttribute('cx', '546');
    bloom.setAttribute('cy', '505');
    bloom.setAttribute('rx', '282');
    bloom.setAttribute('ry', '108');
    bloom.setAttribute('fill', 'rgba(0,229,160,.16)');
    bloom.setAttribute('filter', 'url(#softGlow)');
    gGlow.appendChild(bloom);

    for (let i = 0; i < FIBRE_COUNT; i++) {
      const t = i / (FIBRE_COUNT - 1);
      const sway = Math.sin(t * Math.PI * 2.1) * 16;
      const tx = 268 + 556 * t + sway * 0.7;
      const ty = 430 + 128 * Math.sin(t * Math.PI) + Math.cos(t * 13) * 9;
      const x0 = ORIGIN.x + (t - 0.5) * 54;
      const c1x = x0 + (t - 0.5) * 46;
      const c1y = 150 + t * 70;
      const c2x = tx - 148 + sway * 1.4;
      const c2y = ty - 232 + Math.sin(t * 6) * 24;
      const d = `M${x0.toFixed(1)},${ORIGIN.y} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;
      const offset = (i * 0.11).toFixed(2);

      const core = document.createElementNS(SVG_NS, 'path');
      core.setAttribute('d', d);
      core.setAttribute('fill', 'none');
      core.setAttribute('stroke', 'rgba(58,96,110,.30)');
      core.setAttribute('stroke-width', (1.05 + (i % 3) * 0.35).toFixed(2));
      core.setAttribute('stroke-linecap', 'round');
      gLine.appendChild(core);

      const hi = document.createElementNS(SVG_NS, 'path');
      hi.setAttribute('d', d);
      hi.setAttribute('fill', 'none');
      hi.setAttribute('stroke', 'rgba(255,255,255,.95)');
      hi.setAttribute('stroke-width', '.85');
      hi.setAttribute('stroke-linecap', 'round');
      hi.setAttribute('transform', 'translate(-1.1,-1.1)');
      gLine.appendChild(hi);

      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'url(#pulse)');
      p.setAttribute('stroke-width', '2.1');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-dasharray', '120 1400');
      if (!still) p.style.animation = `mkt-fibre-flow 4.6s linear ${offset}s infinite`;
      gPulse.appendChild(p);

      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', tx.toFixed(1));
      dot.setAttribute('cy', ty.toFixed(1));
      dot.setAttribute('r', (1.9 + (i % 4) * 0.55).toFixed(2));
      dot.setAttribute('fill', i % 3 ? '#00E5A0' : '#7BE9FF');
      if (still) {
        dot.setAttribute('opacity', '.9');
      } else {
        dot.style.animation = `mkt-fibre-breathe 4.6s ease-in-out ${(i * 0.11 + 0.9).toFixed(2)}s infinite`;
      }
      gTip.appendChild(dot);
    }

    SCREENS.forEach(([x, y, rot], idx) => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${rot})`);
      g.innerHTML = `
        <rect x="-21" y="-14" width="42" height="27" rx="3.5" fill="rgba(255,255,255,.82)" stroke="rgba(0,178,124,.5)" stroke-width="1"/>
        <rect x="-16" y="-9" width="32" height="17" rx="2" fill="rgba(0,229,160,.2)"/>
        <path d="M-6 13 h12 M0 13 v5" stroke="rgba(10,34,46,.28)" stroke-width="1.2" stroke-linecap="round"/>`;
      if (!still) {
        g.style.animation = `mkt-fibre-breathe 4.6s ease-in-out ${(1.1 + idx * 0.5).toFixed(2)}s infinite`;
      }
      gTip.appendChild(g);
    });

    return () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    };
  }, []);

  return (
    <div className="mkt-hero-wrap">
      <style>{`
        .mkt-hero-wrap { padding: 84px clamp(10px,1.4vw,20px) 0; }
        .mkt-hero { position: relative; overflow: hidden; height: min(86vh,900px); min-height: 660px; }

        .mkt-hero-rail { position: absolute; left: clamp(22px,3vw,46px); top: 13%; z-index: 4;
          display: flex; flex-direction: column; gap: 13px; }
        .mkt-hero-rail span { color: var(--mkt-muted); display: flex; align-items: center; gap: 10px; }
        .mkt-hero-rail span::before { content: ''; width: 16px; height: 1px; background: currentColor; opacity: .55; }

        .mkt-hero-statement { position: absolute; right: clamp(22px,3.4vw,52px); top: 12.5%; z-index: 4;
          max-width: 33ch; text-align: right; color: var(--mkt-ink-2);
          font-size: clamp(.92rem,1.05vw,1.05rem); line-height: 1.6; }

        .mkt-hero-stage { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; pointer-events: none; }
        .mkt-hero-stage svg { width: min(97%,1080px); height: 100%; overflow: visible; }

        .mkt-hero-copy { position: absolute; left: clamp(22px,3vw,46px); bottom: clamp(28px,4vw,54px); z-index: 5;
          max-width: min(90%,660px); }
        .mkt-hero-micro { display: inline-block; color: var(--mkt-muted); margin-bottom: 15px;
          border: 1px solid var(--mkt-hair); border-radius: 999px; padding: 6px 13px; background: rgba(255,255,255,.5); }
        .mkt-hero h1 { font-size: clamp(2.4rem,5.2vw,4.3rem); font-weight: 600; margin-bottom: 22px; }
        /* Hero-only ramp. The shared .eh-gradient stays two-stop for the nav/footer
           wordmarks, where this blue-violet terminal stop reads wrong at small size. */
        .mkt-hero h1 .eh-gradient { background-image: linear-gradient(120deg,#00A171 0%,#00A6CC 60%,#4F86D4 100%); }
        .mkt-hero-cta { display: flex; gap: 11px; flex-wrap: wrap; margin-bottom: 16px; }
        .mkt-hero-trust { display: flex; gap: 18px; flex-wrap: wrap; font-size: .8rem; color: var(--mkt-muted); }
        .mkt-hero-trust span { display: flex; align-items: center; gap: 6px; }
        .mkt-hero-tick { color: var(--mkt-mint-ink); font-weight: 700; }

        .mkt-hero-chip { position: absolute; right: clamp(22px,3vw,46px); bottom: clamp(28px,4vw,54px); z-index: 5;
          display: flex; align-items: center; gap: 13px; border-radius: 13px; padding: 11px 16px 11px 11px; text-align: left; }
        .mkt-hero-chip .mkt-mono { color: var(--mkt-muted); display: block; margin-bottom: 3px; }
        .mkt-hero-chip strong { display: block; font-family: var(--font-sora), sans-serif;
          font-size: .9rem; font-weight: 600; letter-spacing: -.02em; }
        .mkt-hero-orb { width: 42px; height: 42px; border-radius: 50%; flex: none; position: relative; overflow: hidden;
          display: grid; place-items: center;
          background: radial-gradient(circle at 32% 30%,#B9FFE6 0%,#00E5A0 38%,#00B4D8 78%,#0A6A87 100%);
          box-shadow: 0 0 0 3px rgba(0,229,160,.15), 0 0 20px rgba(0,229,160,.32); }
        .mkt-hero-orb::after { content: ''; position: absolute; inset: 0; mix-blend-mode: overlay;
          background: repeating-linear-gradient(0deg,rgba(255,255,255,.22) 0 1px,transparent 1px 3px); }
        .mkt-hero-orb i { position: relative; z-index: 2; color: #04241B; font-size: .6rem; font-style: normal; padding-left: 2px; }

        @media (max-width: 1080px) {
          .mkt-hero { height: auto; min-height: 0; padding: 96px 24px 34px;
            display: flex; flex-direction: column; gap: 26px; }
          .mkt-hero-rail, .mkt-hero-statement, .mkt-hero-copy, .mkt-hero-chip { position: static; }
          .mkt-hero-copy { max-width: none; order: 1; }
          .mkt-hero-stage { position: relative; inset: auto; height: 250px; opacity: .9; order: 2; }
          .mkt-hero-stage svg { width: 100%; }
          .mkt-hero-statement { text-align: left; max-width: none; order: 3; }
          .mkt-hero-rail { flex-direction: row; flex-wrap: wrap; gap: 10px 20px; order: 4; }
          .mkt-hero-chip { order: 5; width: max-content; max-width: 100%; }
        }

        @keyframes mkt-fibre-flow { from { stroke-dashoffset: 1520 } to { stroke-dashoffset: -140 } }
        @keyframes mkt-fibre-breathe { 0%,72%,100% { opacity: .42 } 84% { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          #fibre * { animation: none !important }
          #fibre circle { opacity: .9 !important }
        }
      `}</style>

      <section ref={heroRef} className="mkt-canvas mkt-hero" aria-labelledby="heroTitle">
        <div className="mkt-hero-rail mkt-mono" aria-hidden="true">
          {RAIL.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <p className="mkt-hero-statement">
          We build the control layer that brings clarity, precision and reliability to every
          screen your business runs.
        </p>

        <div className="mkt-hero-stage" aria-hidden="true">
          <svg ref={fibreRef} id="fibre" viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid meet" />
        </div>

        <div className="mkt-hero-copy">
          <span className="mkt-hero-micro mkt-mono">50,000+ screens orchestrated · since 2024</span>

          <h1 id="heroTitle" className="eh-heading">
            Publish. Schedule.
            <br />
            <span className="eh-gradient">Everywhere.</span>
          </h1>

          <div className="mkt-hero-cta">
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[0.94rem]"
            >
              Start Free — 5 Minutes to Live{' '}
              <span aria-hidden="true" style={{ opacity: 0.5 }}>
                →
              </span>
            </Link>
            <button
              type="button"
              onClick={() => scrollTo('features')}
              className="eh-btn-ghost inline-flex items-center justify-center rounded-full px-[21px] py-[13px] text-[0.94rem]"
            >
              See the platform
            </button>
          </div>

          <div className="mkt-hero-trust">
            {TRUST.map((item) => (
              <span key={item}>
                <b className="mkt-hero-tick" aria-hidden="true">
                  ✓
                </b>{' '}
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mkt-chip mkt-hero-chip">
          <span className="mkt-hero-orb" aria-hidden="true">
            <i>▶</i>
          </span>
          <span>
            <span className="mkt-mono">Watch the product tour</span>
            <strong>Dashboard, templates &amp; pairing · 1:45</strong>
          </span>
        </div>
      </section>
    </div>
  );
}
