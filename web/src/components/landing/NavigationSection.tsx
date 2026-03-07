'use client';

import Link from 'next/link';
import { Menu, X, Monitor } from 'lucide-react';
import { scrollTo } from './shared';

interface NavigationSectionProps {
  scrolled: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  nav: (id: string) => void;
}

const NAV_ITEMS = [
  { id: 'features', label: 'Features' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

export default function NavigationSection({ scrolled, menuOpen, setMenuOpen, nav }: NavigationSectionProps) {
  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b shadow-lg shadow-black/20'
          : 'bg-transparent border-b border-transparent'
      }`}
      style={scrolled ? {
        background: 'rgba(6, 26, 33, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: '#1B3D47',
      } : undefined}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,160,0.2), rgba(0,180,216,0.15))',
              border: '1px solid rgba(0,229,160,0.25)',
            }}
          >
            <Monitor size={14} style={{ color: '#00E5A0' }} />
          </div>
          <span className="text-lg font-bold tracking-[-0.03em] eh-gradient" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>
            VIZORA
          </span>
          <span
            className="hidden sm:inline-flex text-[0.55rem] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
            style={{
              color: '#00E5A0',
              background: 'rgba(0,229,160,0.08)',
              border: '1px solid rgba(0,229,160,0.15)',
            }}
          >
            AI-Powered
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="eh-nav-link text-[0.85rem] font-medium"
              style={{ color: '#B5AEA6' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F0ECE8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#B5AEA6')}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
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

        <button
          className="md:hidden"
          style={{ color: '#B5AEA6' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div
          className="md:hidden px-6 py-4 space-y-3 border-t"
          style={{
            background: 'rgba(6, 26, 33, 0.95)',
            backdropFilter: 'blur(20px)',
            borderColor: '#1B3D47',
          }}
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => nav(item.id)}
              className="block w-full text-left text-sm py-2"
              style={{ color: '#B5AEA6' }}
            >
              {item.label}
            </button>
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
