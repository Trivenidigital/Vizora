'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/* ---- Scroll-triggered fade-in ---- */

export function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('eh-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`eh-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function scrollTo(id: string) {
  if (typeof window === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
  el.scrollIntoView({ behavior });
  // Reflect the section in the URL so the position is shareable and the back
  // button behaves — replaceState rather than pushState, because a smooth
  // scroll is not a navigation the user expects to undo one step at a time.
  window.history.replaceState(null, '', `#${id}`);
}

/**
 * In-page links must be real `<a href="#id">`: they work with JS disabled, they
 * are deep-linkable, and assistive tech announces them as links rather than as
 * buttons that do something unspecified. The handler only upgrades the jump to
 * a smooth scroll.
 */
export function anchorProps(
  id: string,
  after?: () => void,
): Pick<React.ComponentProps<'a'>, 'href' | 'onClick'> {
  return {
    href: `#${id}`,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      // A modified click (new tab / new window) is a deliberate request for
      // the native link; only the plain click is upgraded to a smooth scroll.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      scrollTo(id);
      after?.();
    },
  };
}

/* ---- FAQ Accordion ---- */

export function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const id = useId();

  return (
    <div
      className="relative border-b transition-colors"
      style={{ borderColor: 'var(--mkt-hair, #1B3D47)' }}
    >
      <button
        type="button"
        id={`${id}-q`}
        aria-expanded={open}
        aria-controls={`${id}-a`}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span
          className="text-[0.95rem] font-medium pr-4 transition-colors"
          style={{
            color: open ? 'var(--mkt-ink, #F0ECE8)' : 'var(--mkt-ink-2, #B5AEA6)',
            fontFamily: 'var(--font-sora), sans-serif',
          }}
        >
          {q}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform duration-300"
          style={{
            color: 'var(--mkt-mint-ink, #00E5A0)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <div
        ref={contentRef}
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        // A collapsed answer is still in the DOM for the max-height animation.
        // It holds no focusable content, so hiding it from the a11y tree is
        // enough — nothing can be tabbed into an aria-hidden subtree here.
        aria-hidden={!open}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? `${contentRef.current?.scrollHeight || 300}px` : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <p className="pb-5 text-sm leading-relaxed" style={{ color: 'var(--mkt-ink-2, #9A958E)' }}>
          {a}
        </p>
      </div>
      {open && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full"
          style={{ background: 'var(--mkt-mint, #00E5A0)' }}
        />
      )}
    </div>
  );
}
