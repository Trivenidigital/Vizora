'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './shared';

export default function MidPageCTASection() {
  return (
    <section className="py-12 px-6">
      <Reveal>
        <div
          className="max-w-4xl mx-auto rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, rgba(0,229,160,0.06) 0%, rgba(0,180,216,0.04) 50%, rgba(139,92,246,0.03) 100%)',
            border: '1px solid rgba(0,229,160,0.12)',
          }}
        >
          <h2 className="eh-heading text-xl sm:text-2xl font-bold mb-3">
            See the difference in 5 minutes
          </h2>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#9A958E' }}>
            No credit card. No sales call. Just sign up and start managing screens.
          </p>
          <Link
            href="/register"
            className="eh-btn-neon inline-flex items-center gap-2 px-8 py-3 rounded-lg text-[0.9rem]"
            style={{ boxShadow: '0 0 20px rgba(0,229,160,0.2)' }}
          >
            Try It Free <ArrowRight size={15} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
