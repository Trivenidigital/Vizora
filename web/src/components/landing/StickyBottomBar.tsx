'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface StickyBottomBarProps {
  showStickyBar: boolean;
}

export default function StickyBottomBar({ showStickyBar }: StickyBottomBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 transition-all duration-300"
      style={{
        transform: showStickyBar ? 'translateY(0)' : 'translateY(100%)',
        background: 'rgba(233, 238, 239, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--mkt-hair)',
        boxShadow: '0 -4px 20px rgba(10,34,46,0.08)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <span className="hidden sm:block text-xs" style={{ color: 'var(--mkt-muted)' }}>
          30-day free trial &middot; No credit card required
        </span>
        <div className="flex items-center gap-3 ml-auto">
          <span className="sm:hidden text-[0.7rem]" style={{ color: 'var(--mkt-muted)' }}>
            Start free, no card
          </span>
          <Link
            href="/register"
            className="eh-btn-neon inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium"
          >
            Start Free Trial <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
