'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Reveal } from './shared';

interface FinalCTASectionProps {
  finalCtaRef: React.RefObject<HTMLElement | null>;
}

export default function FinalCTASection({ finalCtaRef }: FinalCTASectionProps) {
  return (
    <section ref={finalCtaRef} className="py-16 sm:py-20 px-6">
      <Reveal>
        <div
          className="max-w-4xl mx-auto rounded-2xl p-10 sm:p-16 text-center relative overflow-hidden eh-grain"
          style={{
            background: 'linear-gradient(135deg, rgba(0,229,160,0.08) 0%, rgba(0,180,216,0.05) 100%)',
            border: '1px solid rgba(0,229,160,0.18)',
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
                { initials: 'SC', gradient: 'linear-gradient(135deg, #00E5A0, #00B4D8)' },
                { initials: 'MW', gradient: 'linear-gradient(135deg, #00B4D8, #8B5CF6)' },
                { initials: 'JP', gradient: 'linear-gradient(135deg, #8B5CF6, #00E5A0)' },
                { initials: 'LT', gradient: 'linear-gradient(135deg, #F59E0B, #00E5A0)' },
              ].map((avatar) => (
                <div
                  key={avatar.initials}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[0.6rem] font-bold ring-2 ring-[#0A222E]"
                  style={{ background: avatar.gradient, color: '#061A21' }}
                >
                  {avatar.initials}
                </div>
              ))}
            </div>
            <span className="ml-3 text-sm font-medium" style={{ color: '#9A958E' }}>
              +2,500 organizations
            </span>
          </div>

          <h2 className="relative eh-heading text-2xl sm:text-3xl font-bold mb-4">
            Your screens are waiting
          </h2>
          <p className="relative mb-8 max-w-md mx-auto" style={{ color: '#9A958E' }}>
            Join thousands of organizations using Vizora to power their digital signage.
            Deploy your first screen in under 5 minutes.
          </p>
          <div className="relative">
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center gap-2 px-10 py-3.5 rounded-lg text-base font-semibold"
              style={{ boxShadow: '0 0 30px rgba(0,229,160,0.2), 0 0 60px rgba(0,229,160,0.08)' }}
            >
              Get Started Free <ArrowRight size={16} />
            </Link>
          </div>
          <div className="relative flex items-center justify-center gap-6 text-xs mt-6" style={{ color: '#6B655D' }}>
            <span className="flex items-center gap-1.5">
              <Check size={13} style={{ color: '#00E5A0' }} />
              30-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={13} style={{ color: '#00E5A0' }} />
              5-minute setup
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Check size={13} style={{ color: '#00E5A0' }} />
              No credit card
            </span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
