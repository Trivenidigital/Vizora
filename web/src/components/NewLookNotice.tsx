'use client';

import { useEffect, useState } from 'react';

/**
 * One-time "Vizora has a new look" dismissal.
 *
 * Decision D2 in `docs/plans/2026-09-17-full-web-little-worlds-redesign.md` §3:
 * existing users with no saved preference get light, with a one-time notice —
 * silent flips are the thing to avoid.
 *
 * It is a PLAIN DISMISSAL, not a theme offer, and that follows from D1 rather
 * than being a separate choice: dark was removed, so there is nothing to switch
 * to. Offering "switch back to dark" would be a button that cannot work. The
 * original recommendation in the plan said "New look — switch to dark"; that
 * wording predates the decision to drop dark and would be a broken promise.
 *
 * Shown once per browser, then never again — the only state is the dismissal
 * flag below.
 *
 * It deliberately does NOT try to exclude brand-new accounts, because it
 * cannot: the old default was dark with nothing persisted, so "no `theme-mode`
 * key" describes a first-time visitor and a long-standing user who never opened
 * the toggle identically — and the second of those is exactly who this notice is
 * for. Distinguishing them needs a server-side signal (account age), which is
 * not worth a migration for one dismissible card. A new user sees one extra
 * card once; an existing user is not silently re-themed. That trade is the
 * right way round.
 *
 * Mounted in the dashboard layout only, so it never reaches the public
 * marketing or legal pages, where "your data and settings are unchanged" would
 * be addressed to someone who has neither.
 */
const SEEN_KEY = 'vizora_new_look_seen';

export function NewLookNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) === '1') return;
      setVisible(true);
    } catch {
      /* private mode: skip rather than nag on every page load */
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /*
       * Sits ABOVE the support-chat FAB, not on top of it. That corner is
       * already occupied twice over: `SupportChatButton` is `fixed bottom-6
       * right-6 z-40` (24px up, 56px tall, so it fills 24-80px) and the
       * CommandPalette's Ctrl-K hint is `fixed bottom-4 right-4 z-40`. At
       * `bottom-4 right-4` this card covered BOTH — and since it outranks them
       * at z-70, support became unreachable until the card was dismissed.
       * Blocking a live control with a cosmetic announcement is the wrong way
       * round. bottom-24 clears the FAB entirely.
       */
      className="fixed bottom-24 right-6 z-[70] max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <p className="text-sm font-semibold text-[var(--foreground)]">Vizora has a new look</p>
      <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
        We&apos;ve refreshed the interface with a lighter, calmer design. Your data and settings are
        unchanged.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="eh-btn-neon mt-3 rounded-lg px-3 py-1.5 text-sm"
      >
        Got it
      </button>
    </div>
  );
}

export default NewLookNotice;
