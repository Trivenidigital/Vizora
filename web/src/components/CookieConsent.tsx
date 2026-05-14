'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'vizora_cookie_consent';

/**
 * Check if the user has consented to a specific cookie category.
 * Returns true if user accepted 'all', or if checking 'essential' (always allowed).
 * Returns false if no consent has been given yet (for non-essential cookies).
 */
export function hasConsentFor(category: 'essential' | 'all'): boolean {
  if (typeof window === 'undefined') return false;
  if (category === 'essential') return true;
  const consent = localStorage.getItem(STORAGE_KEY);
  return consent === 'all';
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      // Small delay for smooth slide-up appearance
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleConsent = (type: 'all' | 'essential') => {
    localStorage.setItem(STORAGE_KEY, type);
    setVisible(false);
  };

  // Don't render anything server-side or before mount
  if (!mounted) return null;

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-[1030]
        transition-transform duration-500 ease-in-out
        ${visible ? 'translate-y-0' : 'translate-y-full'}
      `}
      role="dialog"
      aria-label="Cookie consent"
      aria-hidden={!visible}
    >
      <div className="mx-auto max-w-4xl px-4 pb-4 sm:px-6">
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-5 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Text */}
            <div className="flex-1 text-sm leading-relaxed text-[#4B5563]">
              <p>
                We use cookies to improve your experience and analyze site usage.{' '}
                <Link
                  href="/privacy"
                  className="font-medium text-[#2563EB] underline decoration-[#2563EB]/30 underline-offset-2 transition-colors hover:text-[#1D4ED8] hover:decoration-[#1D4ED8]/50"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={() => handleConsent('essential')}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#4B5563] transition-colors hover:border-[#D1D5DB] hover:text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-white"
              >
                Essential Only
              </button>
              <button
                onClick={() => handleConsent('all')}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-white"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
