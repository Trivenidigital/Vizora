'use client';

import { useEffect, useRef, useState } from 'react';
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
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/* ---- Animated counter ---- */

export function AnimatedStat({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.floor(eased * value));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} style={{ fontFamily: 'var(--font-mono), monospace' }}>
      {display.toLocaleString()}{suffix}
    </span>
  );
}

/* ---- FAQ Accordion ---- */

export function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: '#1B3D47' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span
          className="text-[0.95rem] font-medium pr-4 transition-colors"
          style={{ color: open ? '#F0ECE8' : '#B5AEA6', fontFamily: 'var(--font-sora), sans-serif' }}
        >
          {q}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform duration-300"
          style={{
            color: '#00E5A0',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? `${contentRef.current?.scrollHeight || 300}px` : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <p className="pb-5 text-sm leading-relaxed" style={{ color: '#9A958E' }}>
          {a}
        </p>
      </div>
      {open && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full"
          style={{ background: '#00E5A0' }}
        />
      )}
    </div>
  );
}
