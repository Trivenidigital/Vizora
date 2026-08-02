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
    <section ref={finalCtaRef} className="py-16 sm:py-20 px-6">
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

          {/* Avatar row */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="flex -space-x-2">
              {[
                { initials: 'SC', gradient: 'linear-gradient(135deg, var(--mkt-mint), var(--mkt-cyan))' },
                { initials: 'MW', gradient: 'linear-gradient(135deg, var(--mkt-cyan), var(--mkt-violet))' },
                { initials: 'JP', gradient: 'linear-gradient(135deg, var(--mkt-violet), var(--mkt-mint))' },
                { initials: 'LT', gradient: 'linear-gradient(135deg, var(--mkt-amber), var(--mkt-mint))' },
              ].map((avatar) => (
                <div
                  key={avatar.initials}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[0.6rem] font-bold ring-2 ring-[color:var(--mkt-page)]"
                  style={{ background: avatar.gradient, color: 'var(--mkt-ink)' }}
                >
                  {avatar.initials}
                </div>
              ))}
            </div>
            <span className="ml-3 text-sm font-medium" style={{ color: 'var(--mkt-muted)' }}>
              +2,500 organizations
            </span>
          </div>

          <h2 className="relative eh-heading text-2xl sm:text-3xl font-bold mb-4">
            Your screens are waiting
          </h2>
          <p className="relative mb-8 max-w-md mx-auto" style={{ color: 'var(--mkt-ink-2)' }}>
            Join thousands of organizations using Vizora to power their digital signage.
            Deploy your first screen in under 5 minutes.
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
