'use client';

import { Reveal } from './shared';

/**
 * Light-substrate (`.mkt`) product-demo section.
 *
 * Colour rules this file follows (see the MARKETING SCOPE block in globals.css):
 * - Solid colours come from `--mkt-*` tokens, never literals.
 * - Neon `--mkt-mint-hot` (#00E5A0) is 1.8:1 on this substrate — it appears
 *   only inside translucent glows/tints, never as text and never as a border.
 *   Small mint text uses `--mkt-mint-ink`.
 * - Translucent tints/rings stay rgba literals, matching the ACCENTS idiom in
 *   SecuritySection — tokens are for solid values.
 *
 * NOTE: not currently mounted on the homepage. Restyled so it renders correctly
 * the moment it is, rather than surfacing as dark-on-light.
 */
export default function DemoVideoSection() {
  return (
    <section className="py-20 px-6 relative overflow-hidden">
      {/* Subtle mint glow — translucent only, never a text or border colour */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(0,229,160,0.10) 0%, transparent 60%)',
        }}
      />
      <div className="max-w-4xl mx-auto relative z-10">
        <Reveal>
          <div className="text-center mb-10">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-5"
              style={{
                background: 'rgba(0,229,160,0.10)',
                color: 'var(--mkt-mint-ink)',
                border: '1px solid rgba(0,178,124,0.22)',
              }}
            >
              Product Demo
            </span>
            <h2
              className="eh-heading text-3xl sm:text-4xl font-bold mb-4"
              style={{ color: 'var(--mkt-ink)' }}
            >
              See Vizora In Action
            </h2>
            <p
              className="text-base sm:text-lg max-w-2xl mx-auto"
              style={{ color: 'var(--mkt-ink-2)' }}
            >
              From beautiful templates to real-time device management — watch how Vizora transforms your digital signage workflow in under two minutes.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div
            className="relative rounded-2xl overflow-hidden group"
            style={{
              border: '1px solid var(--mkt-hair)',
              boxShadow: '0 30px 70px rgba(10,34,46,0.13)',
            }}
          >
            <video
              className="w-full aspect-video"
              style={{ background: 'var(--mkt-canvas-2)' }}
              controls
              preload="metadata"
              poster="/videos/vizora-demo-poster.jpg"
              playsInline
            >
              <source src="/videos/vizora-demo.mp4" type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>
          <p className="text-center mt-4 text-xs" style={{ color: 'var(--mkt-muted)' }}>
            1:45 · No sound required · See dashboard, templates &amp; device pairing
          </p>
        </Reveal>
      </div>
    </section>
  );
}
