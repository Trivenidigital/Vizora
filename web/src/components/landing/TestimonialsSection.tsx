'use client';

import { Star } from 'lucide-react';
import { Reveal } from './shared';

/**
 * ⚠️  DO NOT MOUNT — UNVERIFIED CONTENT.
 *
 * This component is deliberately not rendered anywhere. Before it goes on a
 * public page, every claim below must be verified as real and attributable:
 *   - three named quotes: "Sarah Chen / Atlas Retail Group",
 *     "Marcus Williams / Meridian Health", "James Park / Urban Eats"
 *   - the aggregate rating strip: "4.9/5" and "from 200+ reviews"
 * None of these are backed by a source in this repo. Publishing unattributed
 * testimonials or an invented review score is a legal and trust problem, not a
 * copy problem. Replace with real, permissioned quotes or delete the file.
 *
 * Styling has been converted to the light `.mkt` substrate so that mounting it
 * (once the content is cleared) does not also surface a dark-on-light bug.
 * Colour rules: solid colours from `--mkt-*` tokens; neon #00E5A0 only inside
 * translucent tints — never text, never borders; small mint text uses
 * `--mkt-mint-ink`. Star glyphs are fills, so they take `--mkt-mint` via
 * currentColor, which resolves even if this is ever mounted outside `.mkt`.
 */
export default function TestimonialsSection() {
  return (
    <section className="py-16 sm:py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
              Teams love what Vizora
              <br />
              <span className="eh-gradient">does for them</span>
            </h2>
            <p style={{ color: 'var(--mkt-ink-2)' }} className="mb-6">
              See why organizations choose Vizora for their digital signage.
            </p>
            <div
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full"
              style={{
                background: 'rgba(0,229,160,0.10)',
                border: '1px solid rgba(0,178,124,0.22)',
              }}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={14} fill="currentColor" style={{ color: 'var(--mkt-mint)' }} />
                ))}
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--mkt-ink)' }}>4.9/5</span>
              <span className="text-xs" style={{ color: 'var(--mkt-muted)' }}>from 200+ reviews</span>
            </div>
          </div>
        </Reveal>

        {/* Asymmetric layout: 1 featured + 2 stacked */}
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Featured testimonial -- large */}
          <Reveal className="lg:col-span-3">
            <div className="eh-card h-full rounded-xl p-8 flex flex-col">
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={16} fill="currentColor" style={{ color: 'var(--mkt-mint)' }} />
                ))}
              </div>
              <p className="text-base leading-relaxed mb-8 flex-1" style={{ color: 'var(--mkt-ink-2)' }}>
                &ldquo;Vizora&apos;s real-time monitoring changed how we manage our 200+ screens.
                We know the instant something goes offline &mdash; before anyone in the store
                notices. The WebSocket architecture is genuinely impressive.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: 'linear-gradient(135deg, var(--mkt-mint), var(--mkt-cyan))',
                    color: '#04241B',
                  }}
                >
                  SC
                </div>
                <div>
                  <div className="text-[0.9rem] font-semibold" style={{ color: 'var(--mkt-ink)' }}>Sarah Chen</div>
                  <div className="text-[0.75rem]" style={{ color: 'var(--mkt-muted)' }}>
                    VP of Operations, Atlas Retail Group
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Stacked testimonials */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <Reveal delay={100}>
              <div className="eh-card rounded-xl p-6 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={13} fill="currentColor" style={{ color: 'var(--mkt-mint)' }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: 'var(--mkt-ink-2)' }}>
                  &ldquo;We evaluated five signage platforms. Vizora was the only one with
                  WebSocket-based live updates and proper security. The audit logging alone sold our CISO.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: 'linear-gradient(135deg, var(--mkt-cyan), var(--mkt-violet))',
                      color: '#04241B',
                    }}
                  >
                    MW
                  </div>
                  <div>
                    <div className="text-[0.82rem] font-semibold" style={{ color: 'var(--mkt-ink)' }}>Marcus Williams</div>
                    <div className="text-[0.7rem]" style={{ color: 'var(--mkt-muted)' }}>IT Director, Meridian Health</div>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <div className="eh-card rounded-xl p-6 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={13} fill="currentColor" style={{ color: 'var(--mkt-mint)' }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: 'var(--mkt-ink-2)' }}>
                  &ldquo;Managing menu boards across 85 locations used to be a nightmare.
                  With Vizora, we update pricing across every restaurant in seconds. Paid for itself in month one.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: 'linear-gradient(135deg, var(--mkt-violet), var(--mkt-mint))',
                      color: '#04241B',
                    }}
                  >
                    JP
                  </div>
                  <div>
                    <div className="text-[0.82rem] font-semibold" style={{ color: 'var(--mkt-ink)' }}>James Park</div>
                    <div className="text-[0.7rem]" style={{ color: 'var(--mkt-muted)' }}>Regional Manager, Urban Eats</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
