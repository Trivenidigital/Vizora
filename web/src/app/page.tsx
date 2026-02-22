'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  CalendarClock,
  MonitorPlay,
  Radio,
  FolderOpen,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Check,
  Menu,
  X,
  ChevronDown,
  Star,
  Globe,
  Users,
  Zap,
  Tv,
  Play,
  Lock,
  Wifi,
  Building2,
  UtensilsCrossed,
  Stethoscope,
  ShoppingBag,
  Eye,
  FileCheck,
  Activity,
  Layers,
  ListMusic,
  Monitor,
  Sparkles,
  MessageSquare,
  Bot,
  Brain,
} from 'lucide-react';

/* ─── Scroll-triggered fade-in ─── */

function useScrollReveal() {
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

function Reveal({
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

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/* ─── Animated counter ─── */

function AnimatedStat({ value, suffix = '' }: { value: number; suffix?: string }) {
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

/* ─── FAQ Accordion ─── */

function FAQItem({ q, a }: { q: string; a: string }) {
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

/* ─── Page ─── */

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState('realtime');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [pricing, setPricing] = useState<{
    region: string;
    currency: string;
    symbol: string;
    basic: { monthly: number; annual: number };
    pro: { monthly: number; annual: number };
    locale: string;
  } | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const finalCtaRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const ids = ['feature-realtime', 'feature-content', 'feature-scheduling'];
    const observers: IntersectionObserver[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveFeatureTab(id.replace('feature-', ''));
          }
        },
        { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' },
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const finalCta = finalCtaRef.current;
    const footer = footerRef.current;
    if (!hero) return;

    let heroVisible = true;
    let bottomVisible = false;

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting;
        setShowStickyBar(!heroVisible && !bottomVisible);
      },
      { threshold: 0.1 },
    );
    heroObserver.observe(hero);

    const bottomObserver = new IntersectionObserver(
      ([entry]) => {
        bottomVisible = entry.isIntersecting;
        setShowStickyBar(!heroVisible && !bottomVisible);
      },
      { threshold: 0.1 },
    );
    if (finalCta) bottomObserver.observe(finalCta);
    if (footer) bottomObserver.observe(footer);

    return () => {
      heroObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    fetch('/api/geo-pricing')
      .then(r => {
        if (!r.ok) throw new Error('geo-pricing failed');
        return r.json();
      })
      .then(setPricing)
      .catch(() => {
        // Default to USD on error
        setPricing({
          region: 'US', currency: 'USD', symbol: '$',
          basic: { monthly: 6, annual: 5 },
          pro: { monthly: 8, annual: 7 },
          locale: 'en-US',
        });
      });
  }, []);

  const nav = useCallback((id: string) => {
    scrollTo(id);
    setMenuOpen(false);
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden selection:bg-[#00E5A0]/20"
      style={{
        background: 'linear-gradient(180deg, #061A21 0%, #081E28 40%, #0A222E 100%)',
        color: '#F0ECE8',
      }}
    >
      {/* ─── 1. Navigation ─── */}
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
            {[
              { id: 'features', label: 'Features' },
              { id: 'solutions', label: 'Solutions' },
              { id: 'pricing', label: 'Pricing' },
              { id: 'faq', label: 'FAQ' },
            ].map((item) => (
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
            {[
              { id: 'features', label: 'Features' },
              { id: 'solutions', label: 'Solutions' },
              { id: 'pricing', label: 'Pricing' },
              { id: 'faq', label: 'FAQ' },
            ].map((item) => (
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

      {/* ─── 2. Hero ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 pt-16 eh-grain">
        {/* Gradient orbs */}
        <div
          className="absolute top-[-15%] right-[-8%] w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,229,160,0.08) 0%, rgba(0,180,216,0.03) 40%, transparent 65%)',
            animation: 'eh-glow-breathe 6s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-[5%] left-[-8%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,180,216,0.06) 0%, rgba(0,229,160,0.02) 40%, transparent 65%)',
            animation: 'eh-glow-breathe 8s ease-in-out infinite 2s',
          }}
        />

        <div className="relative max-w-6xl mx-auto w-full">
          <div className="text-center mb-14">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
              style={{
                background: 'rgba(0,229,160,0.08)',
                border: '1px solid rgba(0,229,160,0.2)',
                color: '#00E5A0',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#00E5A0',
                  boxShadow: '0 0 6px rgba(0,229,160,0.4)',
                  animation: 'eh-neon-pulse 2s ease-in-out infinite',
                }}
              />
              Trusted by 2,500+ organizations worldwide
            </div>

            <h1
              className="eh-heading text-4xl sm:text-5xl lg:text-[4rem] font-bold mb-6"
            >
              Every screen. Every location.
              <br />
              <span className="eh-gradient">One command center.</span>
            </h1>
            <p
              className="text-base sm:text-lg max-w-[580px] mx-auto leading-relaxed mb-10"
              style={{ color: '#9A958E' }}
            >
              Vizora&apos;s AI engine optimizes content, predicts device issues, and adapts
              to your audience &mdash; so you manage outcomes, not screens.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link
                href="/register"
                className="eh-btn-neon inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-base font-semibold"
                style={{ boxShadow: '0 0 30px rgba(0,229,160,0.2), 0 0 60px rgba(0,229,160,0.08)' }}
              >
                Start Free — 5 Minutes to Live <ArrowRight size={16} />
              </Link>
              <button
                onClick={() => scrollTo('how-it-works')}
                className="eh-btn-ghost inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-[0.9rem]"
              >
                <Play size={14} /> See How It Works
              </button>
            </div>

            {/* Trust line */}
            <div className="flex items-center justify-center gap-6 text-xs" style={{ color: '#6B655D' }}>
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} style={{ color: '#00E5A0' }} />
                AI-Powered
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} style={{ color: '#00E5A0' }} />
                30-day free trial
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <Check size={14} style={{ color: '#00E5A0' }} />
                No credit card required
              </span>
            </div>
          </div>

          {/* Dashboard Mockup */}
          <Reveal delay={200}>
            <div className="overflow-x-auto sm:overflow-visible">
            <div
              className="relative mx-auto max-w-[920px] min-w-[480px] sm:min-w-0 rounded-xl overflow-hidden"
              style={{
                background: '#0C2229',
                border: '1px solid #1B3D47',
                boxShadow: '0 0 80px rgba(0,229,160,0.04), 0 0 160px rgba(0,180,216,0.03), 0 30px 60px rgba(0,0,0,0.3)',
              }}
            >
              {/* Topbar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b"
                style={{
                  borderColor: '#1B3D47',
                  background: 'linear-gradient(90deg, rgba(0,229,160,0.06), transparent)',
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1B3D47', border: '1px solid #264A55' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1B3D47', border: '1px solid #264A55' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1B3D47', border: '1px solid #264A55' }} />
                <span className="ml-auto text-[0.6rem] font-medium" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                  dashboard.vizora.io
                </span>
              </div>

              <div className="flex">
                {/* Sidebar */}
                <div className="hidden sm:block w-[180px] border-r py-3" style={{ borderColor: '#1B3D47' }}>
                  {[
                    { label: 'Fleet', items: [{ name: 'Displays', active: true }, { name: 'Groups' }, { name: 'Map' }] },
                    { label: 'Content', items: [{ name: 'Library' }, { name: 'Playlists' }, { name: 'Templates' }] },
                    { label: 'Ops', items: [{ name: 'Schedules' }, { name: 'Analytics' }] },
                  ].map((section) => (
                    <div key={section.label} className="px-3 mb-1">
                      <div className="text-[0.55rem] font-bold uppercase tracking-wider px-2 py-1.5"
                        style={{ color: '#6B655D', letterSpacing: '0.1em' }}>
                        {section.label}
                      </div>
                      {section.items.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-[0.78rem]"
                          style={item.active ? {
                            color: '#00E5A0',
                            background: 'rgba(0,229,160,0.1)',
                            borderLeft: '2px solid #00E5A0',
                          } : { color: '#9A958E' }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-sm"
                            style={item.active ? {
                              background: 'rgba(0,229,160,0.15)',
                              border: '1px solid #00E5A0',
                              boxShadow: '0 0 4px rgba(0,229,160,0.2)',
                            } : {
                              background: '#122D35',
                              border: '1px solid #1B3D47',
                            }}
                          />
                          {item.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Main */}
                <div className="flex-1 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3.5">
                    <div>
                      <div className="text-[0.95rem] font-bold" style={{ letterSpacing: '-0.01em', fontFamily: 'var(--font-sora), sans-serif' }}>Fleet Overview</div>
                      <div className="text-[0.7rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                        24 devices &bull; 22 online &bull; 2 offline
                      </div>
                    </div>
                    <div className="eh-btn-neon text-[0.7rem] px-3 py-1 rounded" style={{ fontSize: '0.7rem' }}>+ Pair Device</div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3.5">
                    {[
                      { label: 'Online', value: '22', suffix: '/24', change: '91.6% uptime', accent: true },
                      { label: 'Content', value: '148', change: '+12 today' },
                      { label: 'Bandwidth', value: '2.4', suffix: 'GB', change: '48% of quota' },
                      { label: 'Alerts', value: '2', change: '2 offline', warn: true },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg p-3" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                        <div className="text-[0.6rem] font-semibold uppercase tracking-wider mb-1"
                          style={{ color: '#6B655D', letterSpacing: '0.06em' }}>
                          {s.label}
                        </div>
                        <div className="text-xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>
                          <span style={{ color: s.warn ? '#FFB800' : s.accent ? '#00E5A0' : '#F0ECE8' }}>{s.value}</span>
                          {s.suffix && <span className="text-xs" style={{ color: '#6B655D' }}>{s.suffix}</span>}
                        </div>
                        <div className="text-[0.6rem] mt-0.5" style={{
                          color: s.warn ? '#FFB800' : '#00E5A0',
                          fontFamily: 'var(--font-mono), monospace',
                        }}>
                          {s.change}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fleet grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: 'Lobby Main', loc: 'HQ-F1', content: 'Welcome Video', online: true, gradient: 'rgba(0,229,160,0.06)' },
                      { name: 'Cafeteria', loc: 'HQ-F2', content: 'Daily Specials', online: true, gradient: 'rgba(0,180,216,0.06)' },
                      { name: 'Store Window', loc: 'RETAIL-DT', content: 'Summer Sale', online: false, gradient: 'rgba(139,92,246,0.06)' },
                    ].map((d) => (
                      <div key={d.name} className="rounded-lg p-2.5" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[0.72rem] font-semibold">{d.name}</span>
                          <span
                            className="w-[7px] h-[7px] rounded-full"
                            style={d.online ? {
                              background: '#00E5A0',
                              boxShadow: '0 0 6px rgba(0,229,160,0.3)',
                              animation: 'eh-neon-pulse 2s ease-in-out infinite',
                            } : { background: '#FF4D6A' }}
                          />
                        </div>
                        <div className="text-[0.6rem] mb-1.5" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                          {d.loc} &bull; {d.content}
                        </div>
                        <div className="h-9 rounded flex items-center justify-center" style={{
                          background: `linear-gradient(135deg, ${d.gradient}, transparent)`,
                          border: `1px solid ${d.online ? 'rgba(0,229,160,0.08)' : 'rgba(139,92,246,0.08)'}`,
                        }}>
                          <div className="w-8 h-1 rounded-full" style={{ background: 'rgba(240,236,232,0.06)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 3. Stats ─── */}
      <section className="py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-10 px-6 sm:px-8 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(0,229,160,0.04) 0%, rgba(0,180,216,0.03) 100%)',
                border: '1px solid rgba(0,229,160,0.1)',
              }}
            >
              {[
                { value: 50000, suffix: '+', label: 'Screens Managed', icon: Tv },
                { value: 99.9, suffix: '%', label: 'Platform Uptime', icon: Activity },
                { value: 2500, suffix: '+', label: 'Organizations', icon: Users },
                { value: 6, suffix: '', label: 'AI Systems', icon: Sparkles },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <stat.icon size={18} className="mx-auto mb-3" style={{ color: '#00E5A0', opacity: 0.7 }} />
                  <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#F0ECE8' }}>
                    {typeof stat.value === 'number' && stat.value >= 100 ? (
                      <AnimatedStat value={stat.value} suffix={stat.suffix} />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono), monospace' }}>{stat.value}{stat.suffix}</span>
                    )}
                  </div>
                  <div className="text-xs font-medium" style={{ color: '#6B655D' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 3b. AI Features ─── */}
      <section className="py-20 sm:py-28 px-6 eh-neural-grid" style={{ background: '#051518' }}>
        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal>
            <div className="text-center mb-16">
              <span
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1.5 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}
              >
                <Sparkles size={12} />
                Intelligence Engine
              </span>
              <h2 className="eh-heading text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-5">
                AI that works <span className="eh-gradient">while you sleep</span>
              </h2>
              <p style={{ color: '#9A958E' }} className="max-w-xl mx-auto text-base sm:text-lg">
                Six intelligent systems running behind every screen in your network.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Sparkles,
                title: 'AI Content Generation',
                headline: 'Describe it. Deploy it.',
                bullets: [
                  'Generate professional signage from text prompts',
                  'Auto-resize and optimize for any screen resolution',
                  'Brand-consistent designs every time',
                ],
                color: '#00E5A0',
              },
              {
                icon: CalendarClock,
                title: 'Smart Scheduling',
                headline: 'Right content, right moment.',
                bullets: [
                  'Optimal time slot suggestions based on audience patterns',
                  'Auto-schedule by content type and location',
                  'Timezone-intelligent deployment across regions',
                ],
                color: '#00B4D8',
              },
              {
                icon: Activity,
                title: 'Predictive Monitoring',
                headline: 'Fix it before it breaks.',
                bullets: [
                  'Detects device anomalies before failures occur',
                  'Auto-recovery and self-healing network capabilities',
                  'Proactive alerts, not reactive firefighting',
                ],
                color: '#8B5CF6',
              },
              {
                icon: Eye,
                title: 'Audience Intelligence',
                headline: 'Screens that read the room.',
                bullets: [
                  'Real-time audience-aware content adjustment',
                  'Demographic insights and engagement analytics',
                  'Privacy-first, edge-processed data',
                ],
                color: '#00E5A0',
              },
              {
                icon: MessageSquare,
                title: 'AI Analytics',
                headline: 'Ask questions. Get answers.',
                bullets: [
                  'Natural language queries on signage performance',
                  'AI-generated weekly reports and recommendations',
                  'Anomaly detection on engagement metrics',
                ],
                color: '#00B4D8',
              },
              {
                icon: Bot,
                title: 'Autonomous Operations',
                headline: 'Set goals. Walk away.',
                bullets: [
                  'Self-optimizing playlists that improve over time',
                  'Auto-curates content based on performance data',
                  'Hands-off management at any scale',
                ],
                color: '#8B5CF6',
              },
            ].map((feature, i) => (
              <Reveal key={feature.title} delay={i * 80}>
                <div className="eh-ai-card h-full">
                  <div
                    className="eh-ai-icon inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4 transition-shadow duration-300"
                    style={{
                      background: `${feature.color}12`,
                      border: `1px solid ${feature.color}25`,
                    }}
                  >
                    <feature.icon size={20} style={{ color: feature.color }} />
                  </div>
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: feature.color }}>
                    {feature.title}
                  </div>
                  <h3 className="eh-heading text-lg font-semibold mb-3" style={{ color: '#F0ECE8' }}>
                    {feature.headline}
                  </h3>
                  <ul className="space-y-2">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-[0.82rem] leading-relaxed" style={{ color: '#B5AEA6' }}>
                        <Check size={14} className="mt-0.5 shrink-0" style={{ color: feature.color, opacity: 0.7 }} />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Powered by AI badge */}
          <Reveal delay={500}>
            <div className="flex justify-center mt-12">
              <div
                className="eh-ai-badge inline-flex items-center gap-2 px-5 py-2 rounded-full"
                style={{
                  background: 'rgba(0,229,160,0.06)',
                  border: '1px solid rgba(0,229,160,0.2)',
                }}
              >
                <Sparkles size={14} style={{ color: '#00E5A0' }} />
                <span className="text-sm font-semibold" style={{ color: '#00E5A0' }}>
                  Powered by AI
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 4. How It Works (Moved Up) ─── */}
      <section id="how-it-works" className="py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Get Started
              </span>
              <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
                Up and running in <span className="eh-gradient">3 steps</span>
              </h2>
              <p style={{ color: '#9A958E' }} className="max-w-lg mx-auto">
                From sign-up to live screens in under 5 minutes. No technician required.
              </p>
            </div>
          </Reveal>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connecting gradient line */}
            <div className="hidden md:block absolute top-[52px] left-[16.67%] right-[16.67%] h-px overflow-hidden">
              <div
                className="h-full"
                style={{
                  background: 'linear-gradient(90deg, #00E5A0, #00B4D8, #8B5CF6)',
                  opacity: 0.25,
                }}
              />
            </div>

            {[
              { num: '01', icon: Upload, title: 'Upload Content', desc: 'Drag in images, videos, or HTML templates. Your library organizes and validates everything.', color: '#00E5A0' },
              { num: '02', icon: CalendarClock, title: 'Schedule & Target', desc: 'Build playlists, set timezone-aware schedules, and target specific screens or groups.', color: '#00B4D8' },
              { num: '03', icon: MonitorPlay, title: 'Go Live', desc: 'Push to any screen instantly via WebSocket. Monitor status in real-time from your dashboard.', color: '#8B5CF6' },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 150}>
                <div className="eh-card rounded-xl p-6 text-center">
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5"
                    style={{
                      background: `${step.color}15`,
                      border: `1px solid ${step.color}30`,
                    }}
                  >
                    <step.icon size={20} style={{ color: step.color }} />
                  </div>
                  <span className="block text-xs font-medium mb-2" style={{
                    color: step.color,
                    fontFamily: 'var(--font-mono), monospace',
                  }}>
                    {step.num}
                  </span>
                  <h3 className="eh-heading text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#9A958E' }}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. Feature Showcases ─── */}
      <section id="features" className="py-16 sm:py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Platform
              </span>
              <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
                Complete control over
                <br />
                <span className="eh-gradient">every screen</span>
              </h2>
              <p style={{ color: '#9A958E' }} className="max-w-lg mx-auto">
                From content creation to fleet monitoring, Vizora gives you full
                command of every display in your organization.
              </p>
            </div>
          </Reveal>

          {/* Feature Tab Navigation */}
          <div className="sticky top-16 z-20 -mx-6 px-6 py-3 mb-8" style={{
            background: 'rgba(6, 26, 33, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(27,61,71,0.5)',
          }}>
            <div className="flex items-center justify-center gap-2">
              {[
                { id: 'realtime', label: 'Real-time Control', icon: Radio },
                { id: 'content', label: 'Content Management', icon: FolderOpen },
                { id: 'scheduling', label: 'Scheduling & Analytics', icon: CalendarClock },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollTo(`feature-${tab.id}`)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200"
                  style={activeFeatureTab === tab.id ? {
                    background: 'rgba(0,229,160,0.12)',
                    color: '#00E5A0',
                    border: '1px solid rgba(0,229,160,0.25)',
                    boxShadow: '0 0 12px rgba(0,229,160,0.06)',
                  } : {
                    background: 'transparent',
                    color: '#9A958E',
                    border: '1px solid transparent',
                  }}
                >
                  <tab.icon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Showcase 1: Real-time Fleet Command */}
          <div id="feature-realtime" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-28 scroll-mt-32">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,160,0.1)' }}>
                    <Radio size={16} style={{ color: '#00E5A0' }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#00E5A0' }}>Real-time Control</span>
                </div>
                <h3 className="eh-heading text-2xl sm:text-3xl font-bold mb-4">
                  Live fleet command center
                </h3>
                <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#9A958E' }}>
                  See every screen&apos;s status the instant it changes. Push content, reboot
                  devices, and respond to issues in real-time through persistent WebSocket
                  connections &mdash; not polling.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Instant status updates via WebSocket',
                    'Remote device control and diagnostics',
                    'Automatic offline alerts and recovery',
                    'Live content preview across all screens',
                    'Predictive fleet monitoring — AI detects issues early',
                    'AI-powered auto-recovery for self-healing networks',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {item}
                    </li>
                  ))}
                </ul>
                {/* Integrated capability tags */}
                <div className="flex flex-wrap gap-2">
                  {['Display Groups', 'Device Preview', 'Multi-Platform'].map((tag) => (
                    <span key={tag} className="text-[0.7rem] font-medium px-2.5 py-1 rounded-full"
                      style={{ color: '#9A958E', background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.1)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="eh-card rounded-xl p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Fleet Status</span>
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,160,0.1)', color: '#00E5A0' }}>
                    Live
                  </span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { name: 'NYC — Times Square', status: 'online', latency: '12ms', content: 'Brand Campaign' },
                    { name: 'LA — Beverly Hills', status: 'online', latency: '18ms', content: 'Product Launch' },
                    { name: 'CHI — Michigan Ave', status: 'online', latency: '22ms', content: 'Holiday Promo' },
                    { name: 'MIA — Ocean Drive', status: 'updating', latency: '45ms', content: 'Deploying...' },
                    { name: 'SEA — Pike Place', status: 'offline', latency: '—', content: 'Maintenance' },
                  ].map((device) => (
                    <div
                      key={device.name}
                      className="flex items-center gap-3 p-2.5 rounded-lg"
                      style={{
                        background: '#061A21',
                        border: '1px solid #1B3D47',
                        animation: device.status === 'updating' ? 'eh-status-cycle 4s ease-in-out infinite' : undefined,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={device.status === 'online' ? {
                          background: '#00E5A0',
                          boxShadow: '0 0 6px rgba(0,229,160,0.3)',
                          animation: 'eh-neon-pulse 2s ease-in-out infinite',
                        } : device.status === 'updating' ? {
                          background: '#00B4D8',
                          boxShadow: '0 0 6px rgba(0,180,216,0.3)',
                          animation: 'eh-neon-pulse 1s ease-in-out infinite',
                        } : { background: '#FF4D6A' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.75rem] font-medium truncate">{device.name}</div>
                        <div className="text-[0.6rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                          {device.content}
                        </div>
                      </div>
                      <div className="text-[0.6rem] font-medium" style={{
                        color: device.status === 'online' ? '#00E5A0' : device.status === 'updating' ? '#00B4D8' : '#FF4D6A',
                        fontFamily: 'var(--font-mono), monospace',
                      }}>
                        {device.latency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Showcase 2: Content Management (reversed) */}
          <div id="feature-content" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-28 scroll-mt-32">
            <Reveal delay={150} className="order-2 lg:order-1">
              <div className="eh-card rounded-xl p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Content Library</span>
                  <span className="text-[0.65rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                    324 items &bull; 12.4 GB
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Images', count: '186', color: '#00E5A0' },
                    { label: 'Videos', count: '89', color: '#00B4D8' },
                    { label: 'HTML', count: '49', color: '#8B5CF6' },
                  ].map((type) => (
                    <div key={type.label} className="rounded-lg p-2.5 text-center" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                      <div className="text-lg font-bold" style={{ color: type.color, fontFamily: 'var(--font-mono), monospace' }}>{type.count}</div>
                      <div className="text-[0.6rem]" style={{ color: '#6B655D' }}>{type.label}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {[
                    { name: 'holiday-campaign-v3.mp4', size: '48.2 MB', type: 'video', verified: true },
                    { name: 'store-promo-banner.png', size: '2.1 MB', type: 'image', verified: true },
                    { name: 'live-dashboard.html', size: '12 KB', type: 'html', verified: true },
                    { name: 'menu-board-template.html', size: '8.4 KB', type: 'html', verified: true },
                  ].map((file) => (
                    <div key={file.name} className="flex items-center gap-2.5 p-2 rounded" style={{ background: '#061A21' }}>
                      <div className="w-7 h-7 rounded flex items-center justify-center text-[0.55rem] font-bold"
                        style={{
                          background: file.type === 'video' ? 'rgba(0,180,216,0.12)' : file.type === 'html' ? 'rgba(139,92,246,0.12)' : 'rgba(0,229,160,0.12)',
                          color: file.type === 'video' ? '#00B4D8' : file.type === 'html' ? '#8B5CF6' : '#00E5A0',
                        }}
                      >
                        {file.type === 'video' ? 'MP4' : file.type === 'html' ? 'HTM' : 'PNG'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.72rem] font-medium truncate">{file.name}</div>
                        <div className="text-[0.55rem]" style={{ color: '#6B655D' }}>{file.size}</div>
                      </div>
                      {file.verified && (
                        <FileCheck size={13} style={{ color: '#00E5A0', opacity: 0.6 }} />
                      )}
                    </div>
                  ))}
                </div>
                {/* Upload progress bar animation */}
                <div className="mt-3 p-2 rounded" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[0.6rem] font-medium" style={{ color: '#9A958E' }}>Uploading promo-reel-q4.mp4</span>
                    <span className="text-[0.55rem]" style={{ color: '#00B4D8', fontFamily: 'var(--font-mono), monospace' }}>67%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1B3D47' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: '67%',
                        background: 'linear-gradient(90deg, #00B4D8, #00E5A0)',
                        animation: 'eh-subtle-pulse 2s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal className="order-1 lg:order-2">
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,180,216,0.1)' }}>
                    <FolderOpen size={16} style={{ color: '#00B4D8' }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#00B4D8' }}>Content</span>
                </div>
                <h3 className="eh-heading text-2xl sm:text-3xl font-bold mb-4">
                  Smart content management
                </h3>
                <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#9A958E' }}>
                  Upload any media type &mdash; images, videos, URLs, or interactive HTML.
                  Vizora validates every file at the binary level to prevent
                  MIME spoofing and ensure only safe content reaches your screens.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Drag-and-drop upload with folder organization',
                    'Magic number validation blocks spoofed files',
                    'Handlebars template engine for dynamic content',
                    'Automatic expiration with replacement content',
                    'AI content generation from text prompts',
                    'Intelligent format optimization for any screen',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00B4D8' }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {['Playlist Builder', 'API & Webhooks'].map((tag) => (
                    <span key={tag} className="text-[0.7rem] font-medium px-2.5 py-1 rounded-full"
                      style={{ color: '#9A958E', background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.1)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Showcase 3: Scheduling & Analytics */}
          <div id="feature-scheduling" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center scroll-mt-32">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
                    <CalendarClock size={16} style={{ color: '#8B5CF6' }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#8B5CF6' }}>Scheduling</span>
                </div>
                <h3 className="eh-heading text-2xl sm:text-3xl font-bold mb-4">
                  Schedule with precision
                </h3>
                <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#9A958E' }}>
                  Build playlists, set timezone-aware schedules, and target specific
                  devices or groups. Preview the next 10 occurrences before
                  committing. Content always plays where and when it should.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Timezone-aware scheduling across regions',
                    'Drag-and-drop playlist builder with undo/redo',
                    'Device groups and location-based targeting',
                    'Analytics dashboard with CSV export',
                    'AI-optimized time slot suggestions',
                    'Performance-driven auto-scheduling',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#8B5CF6' }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {['Analytics', 'CSV Export'].map((tag) => (
                    <span key={tag} className="text-[0.7rem] font-medium px-2.5 py-1 rounded-full"
                      style={{ color: '#9A958E', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="eh-card rounded-xl p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Weekly Schedule</span>
                  <span className="text-[0.65rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                    3 playlists active
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                    <div key={day} className="text-center">
                      <div className="text-[0.55rem] font-medium mb-1.5" style={{ color: '#6B655D' }}>{day}</div>
                      <div className="space-y-1">
                        <div className="h-3 rounded-sm" style={{ background: 'rgba(0,229,160,0.2)', border: '1px solid rgba(0,229,160,0.15)' }} />
                        {i < 5 && <div className="h-3 rounded-sm" style={{ background: 'rgba(0,180,216,0.2)', border: '1px solid rgba(0,180,216,0.15)' }} />}
                        {(i === 5 || i === 6) && <div className="h-3 rounded-sm" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.15)' }} />}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Morning Greetings', time: '06:00 – 10:00', color: '#00E5A0', devices: '12 screens' },
                    { name: 'Product Showcase', time: '10:00 – 18:00', color: '#00B4D8', devices: '24 screens' },
                    { name: 'Weekend Special', time: 'Sat–Sun all day', color: '#8B5CF6', devices: '8 screens' },
                  ].map((playlist) => (
                    <div key={playlist.name} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                      <div className="w-1 h-8 rounded-full" style={{ background: playlist.color }} />
                      <div className="flex-1">
                        <div className="text-[0.75rem] font-medium">{playlist.name}</div>
                        <div className="text-[0.6rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                          {playlist.time}
                        </div>
                      </div>
                      <span className="text-[0.6rem]" style={{ color: '#6B655D' }}>{playlist.devices}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 6. Mid-page CTA Banner ─── */}
      <section className="py-12 px-6">
        <Reveal>
          <div
            className="max-w-4xl mx-auto rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, rgba(0,229,160,0.06) 0%, rgba(0,180,216,0.04) 50%, rgba(139,92,246,0.03) 100%)',
              border: '1px solid rgba(0,229,160,0.12)',
            }}
          >
            <h2 className="eh-heading text-xl sm:text-2xl font-bold mb-3">
              See the difference in 5 minutes
            </h2>
            <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#9A958E' }}>
              No credit card. No sales call. Just sign up and start managing screens.
            </p>
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center gap-2 px-8 py-3 rounded-lg text-[0.9rem]"
              style={{ boxShadow: '0 0 20px rgba(0,229,160,0.2)' }}
            >
              Try It Free <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ─── 7. Industry Solutions (Condensed to 4) ─── */}
      <section id="solutions" className="py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00B4D8', background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.15)' }}>
                Solutions
              </span>
              <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
                Built for <span className="eh-gradient">your industry</span>
              </h2>
              <p style={{ color: '#9A958E' }} className="max-w-lg mx-auto">
                From retail storefronts to hospital lobbies, Vizora adapts to your use case.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-5 mb-8">
            {[
              {
                icon: ShoppingBag,
                title: 'Retail & Stores',
                desc: 'AI-driven promotions based on foot traffic patterns. Dynamic product showcases and seasonal campaigns that update across all locations simultaneously.',
                color: '#00E5A0',
                bg: 'rgba(0,229,160,0.03)',
              },
              {
                icon: Building2,
                title: 'Corporate Offices',
                desc: 'Intelligent content rotation powered by audience data. Welcome screens, meeting room displays, KPI dashboards, and employee communications at scale.',
                color: '#00B4D8',
                bg: 'rgba(0,180,216,0.03)',
              },
              {
                icon: Stethoscope,
                title: 'Healthcare',
                desc: 'AI-adaptive wayfinding that responds to real-time conditions. Wait time boards, health education displays, and emergency notifications.',
                color: '#8B5CF6',
                bg: 'rgba(139,92,246,0.03)',
              },
              {
                icon: UtensilsCrossed,
                title: 'Restaurants & QSR',
                desc: 'Smart menu optimization by time of day and season. Digital menu boards, specials rotation, kitchen display systems, and drive-thru content.',
                color: '#F59E0B',
                bg: 'rgba(245,158,11,0.03)',
              },
            ].map((industry, i) => (
              <Reveal key={industry.title} delay={i * 100}>
                <div
                  className="eh-card h-full rounded-xl p-6 group cursor-default"
                  style={{ background: industry.bg }}
                >
                  <div
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
                    style={{ background: `${industry.color}15`, border: `1px solid ${industry.color}20` }}
                  >
                    <industry.icon size={20} style={{ color: industry.color }} />
                  </div>
                  <h3 className="eh-heading text-[0.95rem] font-semibold mb-2">{industry.title}</h3>
                  <p className="text-[0.85rem] leading-relaxed" style={{ color: '#9A958E' }}>{industry.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="text-center text-sm" style={{ color: '#6B655D' }}>
              Also used in <span style={{ color: '#9A958E' }}>Education, Manufacturing, Hospitality, Transportation,</span> and <span style={{ color: '#9A958E' }}>Government</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 8. Testimonials ─── */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
                Teams love what Vizora
                <br />
                <span className="eh-gradient">does for them</span>
              </h2>
              <p style={{ color: '#9A958E' }} className="mb-6">
                See why organizations choose Vizora for their digital signage.
              </p>
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full"
                style={{
                  background: 'rgba(0,229,160,0.06)',
                  border: '1px solid rgba(0,229,160,0.15)',
                }}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={14} fill="#00E5A0" style={{ color: '#00E5A0' }} />
                  ))}
                </div>
                <span className="text-sm font-semibold" style={{ color: '#F0ECE8' }}>4.9/5</span>
                <span className="text-xs" style={{ color: '#9A958E' }}>from 200+ reviews</span>
              </div>
            </div>
          </Reveal>

          {/* Asymmetric layout: 1 featured + 2 stacked */}
          <div className="grid lg:grid-cols-5 gap-5">
            {/* Featured testimonial — large */}
            <Reveal className="lg:col-span-3">
              <div className="eh-card h-full rounded-xl p-8 flex flex-col">
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={16} fill="#00E5A0" style={{ color: '#00E5A0' }} />
                  ))}
                </div>
                <p className="text-base leading-relaxed mb-8 flex-1" style={{ color: '#D1CBC5' }}>
                  &ldquo;Vizora&apos;s real-time monitoring changed how we manage our 200+ screens.
                  We know the instant something goes offline &mdash; before anyone in the store
                  notices. The WebSocket architecture is genuinely impressive.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg, #00E5A0, #00B4D8)', color: '#061A21' }}
                  >
                    SC
                  </div>
                  <div>
                    <div className="text-[0.9rem] font-semibold">Sarah Chen</div>
                    <div className="text-[0.75rem]" style={{ color: '#6B655D' }}>
                      VP of Operations, Atlas Retail Group
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Stacked testimonials */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <Reveal delay={100}>
                <div className="eh-card rounded-xl p-6 flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={13} fill="#00E5A0" style={{ color: '#00E5A0' }} />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: '#B5AEA6' }}>
                    &ldquo;We evaluated five signage platforms. Vizora was the only one with
                    WebSocket-based live updates and proper security. The audit logging alone sold our CISO.&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #00B4D8, #8B5CF6)', color: '#061A21' }}
                    >
                      MW
                    </div>
                    <div>
                      <div className="text-[0.82rem] font-semibold">Marcus Williams</div>
                      <div className="text-[0.7rem]" style={{ color: '#6B655D' }}>IT Director, Meridian Health</div>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={200}>
                <div className="eh-card rounded-xl p-6 flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={13} fill="#00E5A0" style={{ color: '#00E5A0' }} />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: '#B5AEA6' }}>
                    &ldquo;Managing menu boards across 85 locations used to be a nightmare.
                    With Vizora, we update pricing across every restaurant in seconds. Paid for itself in month one.&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #8B5CF6, #00E5A0)', color: '#061A21' }}
                    >
                      JP
                    </div>
                    <div>
                      <div className="text-[0.82rem] font-semibold">James Park</div>
                      <div className="text-[0.7rem]" style={{ color: '#6B655D' }}>Regional Manager, Urban Eats</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. Security & Trust (Compact 2-column) ─── */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Security
              </span>
              <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
                Security that <span className="eh-gradient">never sleeps</span>
              </h2>
              <p style={{ color: '#9A958E' }} className="max-w-lg mx-auto">
                Every layer of the platform is designed to protect your organization&apos;s data and devices.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              {/* Security features list */}
              <div className="space-y-5">
                {[
                  {
                    icon: ShieldCheck,
                    title: 'Dual Authentication',
                    desc: 'Separate JWT secrets for users and devices. HttpOnly cookies prevent token theft.',
                    color: '#00E5A0',
                  },
                  {
                    icon: FileCheck,
                    title: 'Content Validation',
                    desc: 'Binary-level file verification rejects spoofed MIME types before they reach any screen.',
                    color: '#00B4D8',
                  },
                  {
                    icon: Users,
                    title: 'Role-Based Access',
                    desc: 'Granular permissions per role. Admins, editors, and viewers see only what they need.',
                    color: '#8B5CF6',
                  },
                  {
                    icon: Eye,
                    title: 'Full Audit Trail',
                    desc: 'Every action logged with user, timestamp, and IP. Complete compliance trail.',
                    color: '#00E5A0',
                  },
                  {
                    icon: Brain,
                    title: 'Privacy-First AI',
                    desc: 'All AI processing respects data boundaries. Edge computing keeps sensitive data on-device. No data leaves your network without permission.',
                    color: '#00B4D8',
                  },
                ].map((feature) => (
                  <div key={feature.title} className="flex gap-4">
                    <div
                      className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${feature.color}12`, border: `1px solid ${feature.color}20` }}
                    >
                      <feature.icon size={18} style={{ color: feature.color }} />
                    </div>
                    <div>
                      <h3 className="text-[0.9rem] font-semibold mb-1" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>{feature.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: '#9A958E' }}>{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Compliance badges */}
              <div
                className="rounded-xl p-8"
                style={{
                  background: 'rgba(0,229,160,0.03)',
                  border: '1px solid rgba(0,229,160,0.1)',
                }}
              >
                <h3 className="text-sm font-bold uppercase tracking-[0.1em] mb-6" style={{ color: '#6B655D' }}>
                  Compliance & Certifications
                </h3>
                <div className="grid grid-cols-2 gap-5">
                  {[
                    { label: 'SOC 2 Type II', sub: 'Compliant', icon: ShieldCheck },
                    { label: 'GDPR', sub: 'Ready', icon: Globe },
                    { label: '256-bit', sub: 'Encryption', icon: Lock },
                    { label: 'SSO', sub: 'Supported', icon: Users },
                  ].map((badge) => (
                    <div key={badge.label} className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}
                      >
                        <badge.icon size={16} style={{ color: '#00E5A0' }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#F0ECE8' }}>{badge.label}</div>
                        <div className="text-[0.65rem]" style={{ color: '#6B655D' }}>{badge.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(0,229,160,0.1)' }}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold" style={{ color: '#00E5A0', fontFamily: 'var(--font-mono), monospace' }}>99.9%</span>
                    <span className="text-sm" style={{ color: '#6B655D' }}>SLA Available</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 10. Pricing ─── */}
      <section id="pricing" className="py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Pricing
              </span>
              <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
                Simple per-screen pricing
              </h2>
              <p style={{ color: '#9A958E' }} className="max-w-lg mx-auto mb-8">
                Start with a 30-day free trial. Scale with transparent per-screen pricing.
              </p>

              {/* Billing toggle */}
              <div className="inline-flex items-center gap-3 p-1 rounded-full" style={{ background: 'rgba(12,34,41,0.6)', border: '1px solid #1B3D47' }}>
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={billingCycle === 'monthly' ? {
                    background: 'rgba(0,229,160,0.12)',
                    color: '#00E5A0',
                  } : { color: '#9A958E' }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2"
                  style={billingCycle === 'annual' ? {
                    background: 'rgba(0,229,160,0.12)',
                    color: '#00E5A0',
                  } : { color: '#9A958E' }}
                >
                  Annual
                  <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                    Save 20%
                  </span>
                </button>
              </div>
              {pricing && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPricing(prev => prev ? { ...prev, region: 'US', currency: 'USD', symbol: '$', basic: { monthly: 6, annual: 5 }, pro: { monthly: 8, annual: 7 } } : prev)}
                    className="text-xs font-medium px-2 py-0.5 rounded-full transition-all"
                    style={pricing.region === 'US' ? { color: '#00E5A0', background: 'rgba(0,229,160,0.12)' } : { color: '#6B655D' }}
                  >
                    USD
                  </button>
                  <span style={{ color: '#3A3530' }}>|</span>
                  <button
                    onClick={() => setPricing(prev => prev ? { ...prev, region: 'IN', currency: 'INR', symbol: '\u20B9', basic: { monthly: 399, annual: 317 }, pro: { monthly: 599, annual: 483 } } : prev)}
                    className="text-xs font-medium px-2 py-0.5 rounded-full transition-all"
                    style={pricing.region === 'IN' ? { color: '#00E5A0', background: 'rgba(0,229,160,0.12)' } : { color: '#6B655D' }}
                  >
                    INR
                  </button>
                </div>
              )}
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {/* Free */}
            <Reveal delay={0}>
              <div className="eh-card rounded-xl p-5 sm:p-6">
                <h3 className="eh-heading text-lg font-semibold mb-1">Free Trial</h3>
                <p className="text-xs mb-5" style={{ color: '#6B655D' }}>Perfect for getting started</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>$0</span>
                  <span className="text-sm" style={{ color: '#6B655D' }}>/30 days</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Up to 5 screens', '30-day free trial', 'Content upload & library', 'Basic scheduling', '1 GB storage'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-lg">
                  Start Free
                </Link>
              </div>
            </Reveal>

            {/* Basic */}
            <Reveal delay={80}>
              <div className="eh-card rounded-xl p-5 sm:p-6">
                <h3 className="eh-heading text-lg font-semibold mb-1">Basic</h3>
                <p className="text-xs mb-5" style={{ color: '#6B655D' }}>Up to 50 screens</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>
                    {pricing ? `${pricing.symbol}${billingCycle === 'monthly' ? pricing.basic.monthly : pricing.basic.annual}` : `$${billingCycle === 'monthly' ? '6' : '5'}`}
                  </span>
                  <span className="text-sm" style={{ color: '#6B655D' }}>/screen/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Up to 50 screens', 'Analytics dashboard', 'Email support', 'Advanced scheduling', '25 GB storage'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-lg">
                  Start with Basic
                </Link>
              </div>
            </Reveal>

            {/* Pro — Featured */}
            <Reveal delay={120}>
              <div
                className="relative eh-card rounded-xl p-5 sm:p-6"
                style={{
                  borderColor: 'rgba(0,229,160,0.35)',
                  boxShadow: '0 0 50px rgba(0,229,160,0.06), 0 0 100px rgba(0,229,160,0.03)',
                }}
              >
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[0.7rem] font-bold px-3.5 py-1 rounded-full"
                  style={{ background: '#F59E0B', color: '#061A21' }}
                >
                  Most Popular
                </span>
                <h3 className="eh-heading text-lg font-semibold mb-1">Pro</h3>
                <p className="text-xs mb-5" style={{ color: '#6B655D' }}>Up to 100 screens</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace', color: '#00E5A0' }}>
                    {pricing ? `${pricing.symbol}${billingCycle === 'monthly' ? pricing.pro.monthly : pricing.pro.annual}` : `$${billingCycle === 'monthly' ? '8' : '7'}`}
                  </span>
                  <span className="text-sm" style={{ color: '#6B655D' }}>/screen/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Up to 100 screens', 'AI-powered features included', 'API access', 'Priority support', 'Advanced scheduling', '100 GB storage'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#F0ECE8' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00B4D8' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="eh-btn-neon block w-full text-center text-sm font-bold py-3 rounded-lg"
                  style={{ boxShadow: '0 0 20px rgba(0,229,160,0.15)' }}
                >
                  Go Pro
                </Link>
                <p className="text-[0.65rem] text-center mt-2" style={{ color: '#6B655D' }}>30-day free trial included</p>
              </div>
            </Reveal>

            {/* Enterprise */}
            <Reveal delay={160}>
              <div className="eh-card rounded-xl p-5 sm:p-6">
                <h3 className="eh-heading text-lg font-semibold mb-1">Enterprise</h3>
                <p className="text-xs mb-5" style={{ color: '#6B655D' }}>For large organizations</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Custom</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Unlimited screens', 'Advanced AI + custom models', 'SLA & dedicated support', 'SSO integration', 'Custom integrations', 'On-prem option'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="mailto:sales@vizora.cloud" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-lg">
                  Talk to Sales
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <p className="text-center text-xs mt-8" style={{ color: '#6B655D' }}>
              All plans include SSL encryption, 99.9% SLA, and email support.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 11. FAQ ─── */}
      <section id="faq" className="py-16 sm:py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
                Frequently asked questions
              </h2>
              <p style={{ color: '#9A958E' }}>
                Everything you need to know about Vizora.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <FAQItem
                q="How long does setup take?"
                a="Most teams go from sign-up to their first live screen in under 5 minutes. Upload your content, pair a device using a simple code, and push your playlist. No technician or special IT knowledge required."
              />
              <FAQItem
                q="What hardware do I need to run Vizora?"
                a="Vizora works with any screen or TV. Our Electron app runs on Windows, macOS, and Linux devices, while our Android TV app supports smart displays and media players. All you need is a screen and an internet connection."
              />
              <FAQItem
                q="How does real-time monitoring work?"
                a="Vizora uses persistent WebSocket connections — not polling — to maintain a live connection with every display. When a screen goes offline, changes content, or encounters an error, your dashboard updates within milliseconds. This is the same technology that powers live chat and trading platforms."
              />
              <FAQItem
                q="Is Vizora secure enough for enterprise use?"
                a="Absolutely. Vizora includes CSRF protection, XSS sanitization on all API responses, dual JWT authentication (separate secrets for users and devices), role-based access control, full audit logging, and rate limiting. Files are validated at the binary level to prevent MIME spoofing."
              />
              <FAQItem
                q="Can I manage screens across different timezones?"
                a="Yes. Vizora's scheduling engine is fully timezone-aware. You can set schedules in each location's local time, and the system automatically handles timezone conversions. Preview the next 10 occurrences of any schedule to verify timing before publishing."
              />
              <FAQItem
                q="What does the free trial include?"
                a="The free trial gives you 5 screens for 30 days with no credit card required. You get full access to content uploads, basic scheduling, and the real-time monitoring dashboard. When you're ready to scale, choose Basic, Pro, or contact us for Enterprise."
              />
              <FAQItem
                q="How does Vizora use AI?"
                a="Vizora integrates AI across the platform — from content generation and smart scheduling to predictive device monitoring and audience-aware content adaptation. Our AI engine continuously optimizes your signage network, suggesting the best times to display content, detecting device anomalies before they cause downtime, and generating performance reports automatically. All AI features are included in Pro plans and above."
              />
            </div>
          </Reveal>

          <Reveal>
            <p className="text-center text-sm mt-8" style={{ color: '#6B655D' }}>
              Still have questions?{' '}
              <a href="mailto:support@vizora.cloud" className="transition-colors hover:text-[#00E5A0]" style={{ color: '#9A958E' }}>
                Contact us &rarr;
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 12. Final CTA ─── */}
      <section ref={finalCtaRef} className="py-16 sm:py-20 px-6">
        <Reveal>
          <div
            className="max-w-4xl mx-auto rounded-2xl p-10 sm:p-16 text-center relative overflow-hidden eh-grain"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,160,0.08) 0%, rgba(0,180,216,0.05) 100%)',
              border: '1px solid rgba(0,229,160,0.18)',
            }}
          >
            <div
              className="absolute top-[-50%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(0,229,160,0.1) 0%, transparent 70%)' }}
            />

            {/* Avatar row */}
            <div className="relative flex items-center justify-center mb-6">
              <div className="flex -space-x-2">
                {[
                  { initials: 'SC', gradient: 'linear-gradient(135deg, #00E5A0, #00B4D8)' },
                  { initials: 'MW', gradient: 'linear-gradient(135deg, #00B4D8, #8B5CF6)' },
                  { initials: 'JP', gradient: 'linear-gradient(135deg, #8B5CF6, #00E5A0)' },
                  { initials: 'LT', gradient: 'linear-gradient(135deg, #F59E0B, #00E5A0)' },
                ].map((avatar) => (
                  <div
                    key={avatar.initials}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[0.6rem] font-bold ring-2 ring-[#0A222E]"
                    style={{ background: avatar.gradient, color: '#061A21' }}
                  >
                    {avatar.initials}
                  </div>
                ))}
              </div>
              <span className="ml-3 text-sm font-medium" style={{ color: '#9A958E' }}>
                +2,500 organizations
              </span>
            </div>

            <h2 className="relative eh-heading text-2xl sm:text-3xl font-bold mb-4">
              Your screens are waiting
            </h2>
            <p className="relative mb-8 max-w-md mx-auto" style={{ color: '#9A958E' }}>
              Join thousands of organizations using Vizora to power their digital signage.
              Deploy your first screen in under 5 minutes.
            </p>
            <div className="relative">
              <Link
                href="/register"
                className="eh-btn-neon inline-flex items-center gap-2 px-10 py-3.5 rounded-lg text-base font-semibold"
                style={{ boxShadow: '0 0 30px rgba(0,229,160,0.2), 0 0 60px rgba(0,229,160,0.08)' }}
              >
                Get Started Free <ArrowRight size={16} />
              </Link>
            </div>
            <div className="relative flex items-center justify-center gap-6 text-xs mt-6" style={{ color: '#6B655D' }}>
              <span className="flex items-center gap-1.5">
                <Check size={13} style={{ color: '#00E5A0' }} />
                30-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={13} style={{ color: '#00E5A0' }} />
                5-minute setup
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <Check size={13} style={{ color: '#00E5A0' }} />
                No credit card
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── Sticky Bottom CTA Bar ─── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 transition-all duration-300"
        style={{
          transform: showStickyBar ? 'translateY(0)' : 'translateY(100%)',
          background: 'rgba(6, 26, 33, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid #1B3D47',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <span className="hidden sm:block text-xs" style={{ color: '#9A958E' }}>
            30-day free trial &middot; No credit card required
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <span className="sm:hidden text-[0.7rem]" style={{ color: '#9A958E' }}>
              Start free, no card
            </span>
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium"
            >
              Start Free Trial <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 13. Footer ─── */}
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
    </div>
  );
}
