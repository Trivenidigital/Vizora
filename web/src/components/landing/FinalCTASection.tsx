'use client';

import type { RefObject } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Reveal } from './shared';

interface FinalCTASectionProps {
  finalCtaRef: RefObject<HTMLElement | null>;
}

export default function FinalCTASection({ finalCtaRef }: FinalCTASectionProps) {
  return (
    <section ref={finalCtaRef} className="py-16 sm:py-20 px-6" aria-labelledby="finalCtaTitle">
      <Reveal>
        <div
          className="max-w-4xl mx-auto rounded-2xl p-10 sm:p-16 text-center relative overflow-hidden eh-grain"
          style={{
            background: 'linear-gradient(135deg, rgba(0,229,160,0.11) 0%, rgba(0,180,216,0.07) 100%)',
            border: '1px solid rgba(0,178,124,0.22)',
          }}
        >
          <div
            className="absolute top-[-50%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(0,229,160,0.1) 0%, transparent 70%)' }}
          />

          {/* The avatar row that stood here spelled out the initials of the
              fabricated testimonial names, beside an organization count
              nothing could substantiate. */}
          <h2 id="finalCtaTitle" className="relative eh-heading text-2xl sm:text-3xl font-bold mb-4">
            Your screens are waiting
          </h2>
          <p className="relative mb-8 max-w-md mx-auto" style={{ color: 'var(--mkt-ink-2)' }}>
            Pair a screen with a code, assign a playlist, and it is live. Your first screen is up in
            about five minutes.
          </p>
          <div className="relative">
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center gap-2 px-10 py-3.5 rounded-lg text-base font-semibold"
              style={{ boxShadow: '0 10px 30px rgba(0,178,124,0.26), 0 18px 60px rgba(0,178,124,0.14)' }}
            >
              Get Started Free <ArrowRight size={16} />
            </Link>
          </div>
          <div className="relative flex items-center justify-center gap-6 text-xs mt-6" style={{ color: 'var(--mkt-muted)' }}>
            <span className="flex items-center gap-1.5">
              <Check size={13} style={{ color: 'var(--mkt-mint-ink)' }} />
              30-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={13} style={{ color: 'var(--mkt-mint-ink)' }} />
              5-minute setup
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Check size={13} style={{ color: 'var(--mkt-mint-ink)' }} />
              No credit card
            </span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
