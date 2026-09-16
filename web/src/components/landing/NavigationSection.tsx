'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { anchorProps } from './shared';

interface NavigationSectionProps {
  scrolled: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

const NAV_ITEMS = [
  { id: 'places', label: 'Places' },
  { id: 'how-it-works', label: 'How it works' },
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
        scrolled ? 'border-b' : 'bg-transparent border-b border-transparent'
      }`}
      style={
        scrolled
          ? {
              background: 'rgba(245, 241, 232, 0.88)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              borderColor: 'var(--lw-hair)',
              boxShadow: '0 10px 30px rgba(35,38,31,0.06)',
            }
          : undefined
      }
    >
      {/* Below md: wordmark | (CTA + burger). At md+: a 3-column grid so the
          links sit centred in the bar rather than drifting with logo width. */}
      <div className="lw-wrap h-[68px] flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          className="md:justify-self-start text-[1.45rem] font-medium lowercase"
          style={{ fontFamily: 'var(--lw-serif)', color: 'var(--lw-forest)', letterSpacing: '-0.01em' }}
        >
          vizora
        </Link>

        <div className="hidden md:flex items-center gap-7 md:justify-self-center">
          {NAV_ITEMS.map((item) => (
            <a key={item.id} {...anchorProps(item.id)} className="lw-link text-[0.88rem] font-medium">
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-5 md:justify-self-end">
          <Link href="/login" className="lw-link text-[0.88rem] font-medium">
            Sign in
          </Link>
          <Link href="/register" className="lw-btn lw-btn-forest !py-2 !px-5 text-[0.84rem]">
            Get started
            <span aria-hidden="true" style={{ opacity: 0.6 }}>
              →
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <Link href="/register" className="lw-btn lw-btn-forest !py-1.5 !px-4 text-[0.8rem]">
            Get started
          </Link>
          <button
            type="button"
            style={{
              color: 'var(--lw-ink)',
              border: '1px solid var(--lw-hair)',
              borderRadius: '10px',
              padding: '7px',
              background: 'rgba(253,251,245,0.7)',
            }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden lw-wrap py-4 space-y-1 border-t"
          style={{
            background: 'rgba(245, 241, 232, 0.96)',
            backdropFilter: 'blur(18px)',
            borderColor: 'var(--lw-hair)',
          }}
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              {...anchorProps(item.id, () => setMenuOpen(false))}
              className="block w-full text-left text-[0.95rem] py-2.5"
              style={{ color: 'var(--lw-ink-2)' }}
            >
              {item.label}
            </a>
          ))}
          <div className="flex items-center gap-4 pt-3">
            <Link href="/login" className="lw-link text-sm font-medium">
              Sign in
            </Link>
            <Link href="/register" className="lw-btn lw-btn-forest !py-2 !px-5 text-sm flex-1 text-center">
              Get started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
