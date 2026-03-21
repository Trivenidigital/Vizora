'use client';

import type { RefObject } from 'react';
import Link from 'next/link';
import { Monitor, ShieldCheck, Globe, Lock } from 'lucide-react';
import { scrollTo } from './shared';

interface FooterSectionProps {
  footerRef: RefObject<HTMLElement | null>;
}

export default function FooterSection({ footerRef }: FooterSectionProps) {
  return (
    <footer ref={footerRef} className="pt-12 pb-8 px-6" style={{ borderTop: '1px solid #1B3D47' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,229,160,0.2), rgba(0,180,216,0.15))',
                  border: '1px solid rgba(0,229,160,0.25)',
                }}
              >
                <Monitor size={12} style={{ color: '#00E5A0' }} />
              </div>
              <span className="text-lg font-bold tracking-[-0.03em] eh-gradient" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>
                VIZORA
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B655D' }}>
              AI-powered digital signage platform.
              Intelligent control for every screen.
            </p>
            <div className="flex items-center gap-4">
              {[
                { label: 'SOC 2', icon: ShieldCheck },
                { label: 'GDPR', icon: Globe },
                { label: '256-bit', icon: Lock },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-1.5 text-[0.7rem]" style={{ color: '#6B655D' }}>
                  <badge.icon size={12} style={{ color: '#00E5A0' }} />
                  {badge.label}
                </div>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.1em] mb-4" style={{ color: '#9A958E' }}>Product</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Features', action: () => scrollTo('features') },
                { label: 'Pricing', action: () => scrollTo('pricing') },
                { label: 'Solutions', action: () => scrollTo('solutions') },
                { label: 'FAQ', action: () => scrollTo('faq') },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={item.action}
                    className="text-sm transition-colors hover:text-[#F0ECE8]"
                    style={{ color: '#6B655D' }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.1em] mb-4" style={{ color: '#9A958E' }}>Resources</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/login', label: 'Login' },
                { href: '/register', label: 'Sign Up' },
                { href: '/dashboard', label: 'Dashboard' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm transition-colors hover:text-[#F0ECE8]" style={{ color: '#6B655D' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.1em] mb-4" style={{ color: '#9A958E' }}>Legal</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms of Service' },
                { href: '/refund', label: 'Refund Policy' },
                { href: '/sla', label: 'SLA' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm transition-colors hover:text-[#F0ECE8]" style={{ color: '#6B655D' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: '#6B655D', borderTop: '1px solid #1B3D47' }}>
          <span>&copy; {new Date().getFullYear()} Vizora. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
