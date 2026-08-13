'use client';

import { useEffect, useRef, RefObject } from 'react';

/**
 * The behaviour `role="dialog" aria-modal="true"` promises.
 *
 * Both of Vizora's dialog shells declared those attributes. Neither delivered
 * them: `Modal` created a `closeButtonRef` and never focused it, and
 * `ConfirmDialog` had no Escape handler, no scroll lock and no focus handling
 * at all. `aria-modal="true"` tells a screen reader the rest of the page is
 * inert — so a dialog that does not actually contain focus is worse than one
 * that never made the claim: the user tabs into content the AT has told them
 * is not there.
 *
 * Shared rather than duplicated because a focus trap written twice is a focus
 * trap maintained once. Only the two shells consume this; their ~45 call sites
 * are untouched.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    // Filter on computed visibility rather than offsetWidth/offsetHeight: an
    // element scrolled out of a container still has zero offsets in some
    // engines yet is perfectly focusable, and jsdom reports 0 for everything.
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  });
}

interface UseDialogOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Element to focus on open. Defaults to the first focusable child. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useDialog({ isOpen, onClose, initialFocusRef }: UseDialogOptions) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Defensive: if the dialog unmounts without its cleanup running (parent
      // removed it outright), the page must not be left unscrollable.
      document.body.style.overflow = 'unset';
      return undefined;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    // Move focus INTO the dialog, so the next Tab starts inside it and screen
    // readers announce the dialog rather than continuing from the page.
    const initial =
      initialFocusRef?.current ?? focusableWithin(containerRef.current)[0] ?? containerRef.current;
    initial?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusableWithin(containerRef.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = containerRef.current?.contains(active) ?? false;

      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      // Return focus where the user left it, or they are dumped at the top of
      // the document with no idea where they are.
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose, initialFocusRef]);

  return containerRef;
}
