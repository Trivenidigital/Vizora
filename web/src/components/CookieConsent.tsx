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

/**
 * Cookie consent bar.
 *
 * Rendered from the ROOT layout, so it appears over BOTH the light public
 * marketing pages and the dark authenticated app. It is a sibling of the page
 * content rather than a descendant of `.mkt`, so it cannot inherit the
 * marketing tokens — it carries its own `.consent-bar` token pair instead
 * (dark by default; `body:has(.mkt) .consent-bar` swaps in the light values).
 *
 * Theme selection lives entirely in CSS, in globals.css. The JS alternative
 * (`document.querySelector('.mkt')` in an effect keyed on `usePathname()`) was
 * tried first and was never shown to misbehave — see the longer note in
 * globals.css before assuming there was a bug here. CSS is preferred because
 * it removes the failure mode by construction rather than depending on commit
 * ordering: `:has()` holds no state, so it cannot latch a stale answer in a
 * component that stays mounted across every route change.
 *
 * Colours come from CSS custom properties applied via Tailwind arbitrary
 * values. Two deliberate choices:
 *   - the explicit `text-[color:var(--x)]` type hint. NOTE: the bare
 *     `text-[var(--x)]` form does compile correctly on the tailwindcss 3.4.19
 *     this repo pins — verified in the production bundle, where the existing
 *     `text-[var(--foreground-tertiary)]` emits `color: var(--foreground-tertiary)`.
 *     The hint is used because it states the intended type outright rather
 *     than relying on Tailwind's inference, not because the short form is
 *     broken. Do not "fix" the ~40 bare call sites elsewhere in the app.
 *     The inference is namespace-specific, though: inside colour namespaces a
 *     bare `var()` can only land on colour, but OUTSIDE them it can silently
 *     pick the wrong property — `font-[var(--font-sora)]` currently compiles
 *     to `font-weight` and is dropped, at 35 call sites on main.
 *   - classes, not inline `style`. Inline styles outrank classes, which would
 *     silently kill every `hover:`/`focus:` variant below.
 */
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
        consent-bar
        fixed bottom-0 left-0 right-0 z-[1030]
        transition-[transform,visibility] duration-500 ease-in-out
        ${visible ? 'translate-y-0 visible' : 'translate-y-full invisible'}
      `}
      role="dialog"
      aria-label="Cookie consent"
      aria-hidden={!visible}
    >
      <div className="mx-auto max-w-4xl px-4 pb-4 sm:px-6">
        <div className="rounded-xl border border-[color:var(--consent-hair)] bg-[color:var(--consent-surface)] px-6 py-5 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Text */}
            <div className="flex-1 text-sm leading-relaxed text-[color:var(--consent-ink-2)]">
              <p>
                We use cookies to improve your experience and analyze site usage.{' '}
                <Link
                  href="/privacy"
                  className="font-medium text-[color:var(--consent-accent)] underline decoration-[color:var(--consent-accent)] underline-offset-2 transition-colors hover:text-[color:var(--consent-accent-hover)] hover:decoration-[color:var(--consent-accent-hover)]"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={() => handleConsent('essential')}
                className="rounded-lg border border-[color:var(--consent-hair)] px-4 py-2 text-sm font-medium text-[color:var(--consent-ink-2)] transition-colors hover:border-[color:var(--consent-hair-strong)] hover:text-[color:var(--consent-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--consent-fill)] focus:ring-offset-2 focus:ring-offset-[color:var(--consent-surface)]"
              >
                Essential Only
              </button>
              <button
                onClick={() => handleConsent('all')}
                className="rounded-lg bg-[color:var(--consent-fill)] px-4 py-2 text-sm font-semibold text-[color:var(--consent-on-fill)] transition-colors hover:bg-[color:var(--consent-fill-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--consent-fill)] focus:ring-offset-2 focus:ring-offset-[color:var(--consent-surface)]"
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
