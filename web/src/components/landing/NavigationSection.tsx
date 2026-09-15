'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Monitor } from 'lucide-react';
import { anchorProps } from './shared';

interface NavigationSectionProps {
  scrolled: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

const NAV_ITEMS = [
  { id: 'features', label: 'Features' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

export default function NavigationSection({ scrolled, menuOpen, setMenuOpen }: NavigationSectionProps) {
  // Escape closes the mobile menu — it is an expanded overlay covering the page,
  // and the burger is the only other way out of it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, setMenuOpen]);

  return (
    <nav
      aria-label="Primary"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b shadow-lg shadow-[color:rgba(10,34,46,0.08)]'
          : 'bg-transparent border-b border-transparent'
      }`}
      style={scrolled ? {
        background: 'rgba(233, 238, 239, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'var(--mkt-hair)',
      } : undefined}
    >
      {/* Below md: logo | (CTA + burger). At md+: a 3-column grid so the links
          sit centred in the bar rather than drifting with the logo's width. */}
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex items-center gap-2 md:justify-self-start">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,160,0.24), rgba(0,180,216,0.17))',
              border: '1px solid rgba(0,178,124,0.32)',
            }}
          >
            <Monitor size={14} style={{ color: 'var(--mkt-mint-ink)' }} />
          </div>
          <span className="text-lg font-bold tracking-[-0.03em] eh-gradient" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>
            VIZORA
          </span>
          <span
            className="hidden sm:inline-flex text-[0.55rem] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
            style={{
              color: 'var(--mkt-mint-ink)',
              background: 'rgba(0,178,124,0.10)',
              border: '1px solid rgba(0,178,124,0.22)',
            }}
          >
            AI-Powered
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 md:justify-self-center">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              {...anchorProps(item.id)}
              className="eh-nav-link text-[0.85rem] font-medium"
              style={{ color: 'var(--mkt-ink-2)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mkt-ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mkt-ink-2)')}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 md:justify-self-end">
          <Link
            href="/login"
            className="eh-btn-ghost text-[0.8rem] font-medium px-4 py-1.5 rounded-md"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="eh-btn-neon text-[0.8rem] px-4 py-1.5 rounded-md"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile: the primary CTA stays visible next to the burger. Login does
            not — it lives in the menu, where it is not competing with it. */}
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/register" className="eh-btn-neon text-[0.8rem] px-3.5 py-1.5 rounded-md">
            Start Free Trial
          </Link>
          <button
            type="button"
            style={{ color: 'var(--mkt-ink-2)' }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden px-6 py-4 space-y-3 border-t"
          style={{
            background: 'rgba(233, 238, 239, 0.9)',
            backdropFilter: 'blur(20px)',
            borderColor: 'var(--mkt-hair)',
          }}
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              {...anchorProps(item.id, () => setMenuOpen(false))}
              className="block w-full text-left text-sm py-2"
              style={{ color: 'var(--mkt-ink-2)' }}
            >
              {item.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="eh-btn-ghost text-sm px-4 py-1.5 rounded-md">Login</Link>
            <Link href="/register" className="eh-btn-neon text-sm px-4 py-1.5 rounded-md">Start Free Trial</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
