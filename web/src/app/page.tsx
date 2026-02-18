'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  CalendarClock,
  MonitorPlay,
  Radio,
  FolderOpen,
  ListMusic,
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
  Layers,
  Wifi,
  Building2,
  GraduationCap,
  UtensilsCrossed,
  Stethoscope,
  Factory,
  ShoppingBag,
  Eye,
  FileCheck,
  Activity,
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
      { threshold: 0.12 },
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
  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: '#1B3D47' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-[0.95rem] font-medium pr-4" style={{ color: '#F0ECE8' }}>
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
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '200px' : '0px', opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-sm leading-relaxed" style={{ color: '#8A8278' }}>
          {a}
        </p>
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState('realtime');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const finalCtaRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // IntersectionObserver for feature tab auto-highlighting
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

  // Sticky bottom CTA bar visibility
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

  const nav = useCallback((id: string) => {
    scrollTo(id);
    setMenuOpen(false);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-[#00E5A0]/20"
      style={{
        background: 'linear-gradient(180deg, #061A21 0%, #081E28 40%, #0A222E 100%)',
        color: '#F0ECE8',
        fontFeatureSettings: '"ss01"',
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
          background: 'rgba(6, 26, 33, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: '#1B3D47',
        } : undefined}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-[-0.02em] eh-gradient">
            VIZORA
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
                className="eh-nav-link text-[0.85rem] font-medium transition-colors"
                style={{ color: '#8A8278' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F0ECE8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#8A8278')}
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
            style={{ color: '#8A8278' }}
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
                style={{ color: '#8A8278' }}
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
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 pt-14">
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(27,61,71,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(27,61,71,0.25) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse at center, black 25%, transparent 65%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 25%, transparent 65%)',
          }}
        />

        {/* Gradient orbs */}
        <div
          className="absolute top-[-15%] right-[-8%] w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,229,160,0.1) 0%, rgba(0,180,216,0.04) 40%, transparent 65%)',
            animation: 'eh-glow-breathe 6s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-[0%] left-[-8%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,180,216,0.07) 0%, rgba(0,229,160,0.03) 40%, transparent 65%)',
            animation: 'eh-glow-breathe 8s ease-in-out infinite 2s',
          }}
        />

        <div className="relative max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold mb-8"
              style={{
                background: 'rgba(0,229,160,0.12)',
                border: '1px solid rgba(0,229,160,0.25)',
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
              Real-time fleet monitoring &middot; Built for scale
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.8rem] font-bold leading-[1.05] mb-5"
              style={{ letterSpacing: '-0.04em' }}
            >
              The <span className="eh-gradient">modern platform</span>
              <br />
              for digital signage
            </h1>
            <p className="text-base sm:text-lg max-w-[560px] mx-auto leading-relaxed mb-8"
              style={{ color: '#8A8278' }}
            >
              Deploy screens in minutes, push content instantly, and monitor every
              display in real-time. From a single lobby TV to thousands of locations.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link
                href="/register"
                className="eh-btn-neon inline-flex items-center gap-2 px-8 py-3.5 rounded-md text-base"
                style={{ boxShadow: '0 0 24px rgba(0,229,160,0.25), 0 0 48px rgba(0,229,160,0.1)' }}
              >
                Start Free Trial <ArrowRight size={15} />
              </Link>
              <button
                onClick={() => scrollTo('how-it-works')}
                className="eh-btn-ghost inline-flex items-center gap-2 px-7 py-3.5 rounded-md text-[0.9rem]"
              >
                <Play size={14} /> Watch Demo
              </button>
            </div>

            {/* Trust line */}
            <div className="flex items-center justify-center gap-6 text-xs" style={{ color: '#5A5248' }}>
              <span className="flex items-center gap-1.5">
                <Check size={14} style={{ color: '#00E5A0' }} />
                30-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} style={{ color: '#00E5A0' }} />
                No credit card required
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <Check size={14} style={{ color: '#00E5A0' }} />
                Cancel anytime
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
                <span className="ml-auto text-[0.6rem] font-medium" style={{ color: '#5A5248', fontFamily: 'var(--font-mono), monospace' }}>
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
                        style={{ color: '#5A5248', letterSpacing: '0.1em' }}>
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
                          } : { color: '#8A8278' }}
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
                      <div className="text-[0.95rem] font-bold" style={{ letterSpacing: '-0.01em' }}>Fleet Overview</div>
                      <div className="text-[0.7rem]" style={{ color: '#5A5248', fontFamily: 'var(--font-mono), monospace' }}>
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
                          style={{ color: '#5A5248', letterSpacing: '0.06em' }}>
                          {s.label}
                        </div>
                        <div className="text-xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>
                          <span style={{ color: s.warn ? '#FFB800' : s.accent ? '#00E5A0' : '#F0ECE8' }}>{s.value}</span>
                          {s.suffix && <span className="text-xs" style={{ color: '#5A5248' }}>{s.suffix}</span>}
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
                        <div className="text-[0.6rem] mb-1.5" style={{ color: '#5A5248', fontFamily: 'var(--font-mono), monospace' }}>
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

      {/* ─── 3. Trusted By ─── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.12em] font-bold mb-8" style={{ color: '#5A5248' }}>
            Trusted by forward-thinking teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
            {[
              { name: 'Meridian Health', icon: Stethoscope },
              { name: 'Atlas Retail', icon: ShoppingBag },
              { name: 'Apex Logistics', icon: Building2 },
              { name: 'BrightPath Schools', icon: GraduationCap },
              { name: 'NovaTech', icon: Zap },
              { name: 'Urban Eats', icon: UtensilsCrossed },
            ].map((brand) => (
              <div key={brand.name} className="flex items-center gap-2 opacity-40 hover:opacity-60 transition-opacity">
                <brand.icon size={16} style={{ color: '#8A8278' }} />
                <span className="text-sm font-semibold tracking-wide" style={{ color: '#8A8278' }}>
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. Stats Bar ─── */}
      <section className="py-12 px-6">
        <Reveal>
          <div
            className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-10 px-6 sm:px-8 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,160,0.04) 0%, rgba(0,180,216,0.03) 100%)',
              border: '1px solid rgba(0,229,160,0.1)',
            }}
          >
            {[
              { value: 50000, suffix: '+', label: 'Screens Managed', icon: Tv },
              { value: 99.9, suffix: '%', label: 'Platform Uptime', icon: Activity },
              { value: 2500, suffix: '+', label: 'Organizations', icon: Users },
              { value: 45, suffix: '+', label: 'Countries', icon: Globe },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center">
                <stat.icon size={18} className="mx-auto mb-3 sm:w-5 sm:h-5" style={{ color: '#00E5A0', opacity: 0.7 }} />
                <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#F0ECE8' }}>
                  {typeof stat.value === 'number' && stat.value >= 100 ? (
                    <AnimatedStat value={stat.value} suffix={stat.suffix} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono), monospace' }}>{stat.value}{stat.suffix}</span>
                  )}
                </div>
                <div className="text-xs font-medium" style={{ color: '#5A5248' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ─── 5. Feature Showcases (Alternating) ─── */}
      <section id="features" className="py-28 sm:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-20">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Platform
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
                Everything you need to run
                <br />
                <span className="eh-gradient">world-class digital signage</span>
              </h2>
              <p style={{ color: '#8A8278' }} className="max-w-lg mx-auto">
                From content creation to fleet monitoring, Vizora gives you complete
                control over every screen in your organization.
              </p>
            </div>
          </Reveal>

          {/* Feature Tab Navigation */}
          <div className="sticky top-14 z-20 -mx-6 px-6 py-3 mb-8" style={{
            background: 'rgba(6, 26, 33, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(27,61,71,0.5)',
          }}>
            <div className="flex items-center justify-center gap-2">
              {[
                { id: 'realtime', label: 'Real-time Control' },
                { id: 'content', label: 'Content Management' },
                { id: 'scheduling', label: 'Scheduling & Analytics' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollTo(`feature-${tab.id}`)}
                  className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200"
                  style={activeFeatureTab === tab.id ? {
                    background: 'rgba(0,229,160,0.15)',
                    color: '#00E5A0',
                    border: '1px solid rgba(0,229,160,0.3)',
                  } : {
                    background: 'transparent',
                    color: '#8A8278',
                    border: '1px solid transparent',
                  }}
                >
                  {tab.label}
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
                <h3 className="text-2xl sm:text-3xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
                  Live fleet command center
                </h3>
                <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#8A8278' }}>
                  See every screen&apos;s status the instant it changes. Push content, reboot
                  devices, and respond to issues in real-time through persistent WebSocket
                  connections &mdash; not polling.
                </p>
                <ul className="space-y-3">
                  {[
                    'Instant status updates via WebSocket',
                    'Remote device control and diagnostics',
                    'Automatic offline alerts and recovery',
                    'Live content preview across all screens',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#8A8278' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="eh-card rounded-xl p-5 relative overflow-hidden">
                {/* Mini fleet status mockup */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold">Fleet Status</span>
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
                    <div key={device.name} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
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
                        <div className="text-[0.6rem]" style={{ color: '#5A5248', fontFamily: 'var(--font-mono), monospace' }}>
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
                {/* Content library mockup */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold">Content Library</span>
                  <span className="text-[0.65rem]" style={{ color: '#5A5248', fontFamily: 'var(--font-mono), monospace' }}>
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
                      <div className="text-[0.6rem]" style={{ color: '#5A5248' }}>{type.label}</div>
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
                        <div className="text-[0.55rem]" style={{ color: '#5A5248' }}>{file.size}</div>
                      </div>
                      {file.verified && (
                        <FileCheck size={13} style={{ color: '#00E5A0', opacity: 0.6 }} />
                      )}
                    </div>
                  ))}
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
                <h3 className="text-2xl sm:text-3xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
                  Smart content management
                </h3>
                <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#8A8278' }}>
                  Upload any media type &mdash; images, videos, URLs, or interactive HTML.
                  Vizora validates every file at the binary level to prevent
                  MIME spoofing and ensure only safe content reaches your screens.
                </p>
                <ul className="space-y-3">
                  {[
                    'Drag-and-drop upload with folder organization',
                    'Magic number validation blocks spoofed files',
                    'Handlebars template engine for dynamic content',
                    'Automatic expiration with replacement content',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#8A8278' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00B4D8' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* Showcase 3: Scheduling & Analytics */}
          <div id="feature-scheduling" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-28 scroll-mt-32">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
                    <CalendarClock size={16} style={{ color: '#8B5CF6' }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#8B5CF6' }}>Scheduling</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
                  Schedule with precision
                </h3>
                <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#8A8278' }}>
                  Build playlists, set timezone-aware schedules, and target specific
                  devices or groups. Preview the next 10 occurrences before
                  committing. Content always plays where and when it should.
                </p>
                <ul className="space-y-3">
                  {[
                    'Timezone-aware scheduling across regions',
                    'Drag-and-drop playlist builder with undo/redo',
                    'Device groups and location-based targeting',
                    'Analytics dashboard with CSV export',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#8A8278' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#8B5CF6' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="eh-card rounded-xl p-5 relative overflow-hidden">
                {/* Schedule mockup */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold">Weekly Schedule</span>
                  <span className="text-[0.65rem]" style={{ color: '#5A5248', fontFamily: 'var(--font-mono), monospace' }}>
                    3 playlists active
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                    <div key={day} className="text-center">
                      <div className="text-[0.55rem] font-medium mb-1.5" style={{ color: '#5A5248' }}>{day}</div>
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
                        <div className="text-[0.6rem]" style={{ color: '#5A5248', fontFamily: 'var(--font-mono), monospace' }}>
                          {playlist.time}
                        </div>
                      </div>
                      <span className="text-[0.6rem]" style={{ color: '#5A5248' }}>{playlist.devices}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
          {/* More Capabilities */}
          <Reveal>
            <div className="text-center mb-10 mt-4">
              <h3 className="text-2xl sm:text-3xl font-bold mb-3" style={{ letterSpacing: '-0.03em' }}>
                More capabilities
              </h3>
              <p style={{ color: '#8A8278' }} className="text-sm">
                Every tool you need to manage signage at scale.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Layers, title: 'Display Groups', desc: 'Organize screens by location, purpose, or team. Push content to groups instantly.' },
              { icon: ListMusic, title: 'Playlist Builder', desc: 'Drag-and-drop playlists with duration control, ordering, and live preview.' },
              { icon: Wifi, title: 'Multi-Platform', desc: 'Electron for desktop, Android TV for smart displays. One platform, every screen.' },
              { icon: BarChart3, title: 'Analytics', desc: 'Track uptime, content performance, and engagement. Export reports as CSV.' },
              { icon: Eye, title: 'Device Preview', desc: 'See exactly what\'s playing on any screen without leaving the dashboard.' },
              { icon: Zap, title: 'API & Webhooks', desc: 'Full REST API with API key management. Integrate Vizora into your workflows.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="eh-card h-full rounded-xl p-5">
                  <div
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3"
                    style={{ background: 'rgba(0,229,160,0.08)' }}
                  >
                    <f.icon size={16} style={{ color: '#00E5A0' }} />
                  </div>
                  <h3 className="text-[0.9rem] font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-[0.82rem] leading-relaxed" style={{ color: '#8A8278' }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Mid-page CTA Banner ─── */}
      <section className="py-16 px-6">
        <Reveal>
          <div
            className="max-w-4xl mx-auto rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,160,0.08) 0%, rgba(0,180,216,0.05) 50%, rgba(139,92,246,0.04) 100%)',
              border: '1px solid rgba(0,229,160,0.12)',
            }}
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-3" style={{ letterSpacing: '-0.02em' }}>
              Ready to see it in action?
            </h2>
            <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#8A8278' }}>
              Start your free trial today. No credit card required, no strings attached.
            </p>
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center gap-2 px-8 py-3 rounded-md text-[0.9rem]"
              style={{ boxShadow: '0 0 20px rgba(0,229,160,0.2)' }}
            >
              Start Free Trial <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ─── 7. Industry Solutions ─── */}
      <section id="solutions" className="py-28 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00B4D8', background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.15)' }}>
                Solutions
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
                Built for every industry
              </h2>
              <p style={{ color: '#8A8278' }} className="max-w-lg mx-auto">
                From retail storefronts to hospital lobbies, Vizora adapts to your use case.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: ShoppingBag, title: 'Retail & Stores', desc: 'Dynamic promotions, product showcases, and seasonal campaigns that update across all locations simultaneously.', color: '#00E5A0' },
              { icon: Building2, title: 'Corporate Offices', desc: 'Welcome screens, meeting room displays, KPI dashboards, and employee communications at scale.', color: '#00B4D8' },
              { icon: Stethoscope, title: 'Healthcare', desc: 'Patient wayfinding, wait time boards, health education displays, and emergency notifications.', color: '#8B5CF6' },
              { icon: GraduationCap, title: 'Education', desc: 'Campus announcements, event boards, cafeteria menus, and emergency alerts across buildings.', color: '#00E5A0' },
              { icon: UtensilsCrossed, title: 'Restaurants & QSR', desc: 'Digital menu boards, specials rotation, kitchen display systems, and drive-thru content.', color: '#00B4D8' },
              { icon: Factory, title: 'Manufacturing', desc: 'Production dashboards, safety metrics, shift schedules, and real-time KPI displays on the floor.', color: '#8B5CF6' },
            ].map((industry, i) => (
              <Reveal key={industry.title} delay={i * 80}>
                <div className="eh-card h-full rounded-xl p-6 group cursor-default">
                  <div
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 transition-colors"
                    style={{ background: `${industry.color}10`, border: `1px solid ${industry.color}20` }}
                  >
                    <industry.icon size={20} style={{ color: industry.color }} />
                  </div>
                  <h3 className="text-[0.95rem] font-semibold mb-2">{industry.title}</h3>
                  <p className="text-[0.82rem] leading-relaxed" style={{ color: '#8A8278' }}>{industry.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 8. Security & Trust ─── */}
      <section className="py-28 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Security
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
                Enterprise-grade security,
                <br />
                <span className="eh-gradient">built in from day one</span>
              </h2>
              <p style={{ color: '#8A8278' }} className="max-w-lg mx-auto">
                We don&apos;t bolt on security as an afterthought. Every layer of the
                platform is designed to protect your organization&apos;s data and devices.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              { icon: Lock, title: 'CSRF & XSS Protection', desc: 'Global sanitization interceptor on all API responses. CSRF middleware on every mutating request.' },
              { icon: ShieldCheck, title: 'Dual JWT Authentication', desc: 'Separate secrets for users and devices. HttpOnly cookies prevent token theft via XSS.' },
              { icon: FileCheck, title: 'Content Validation', desc: 'Magic number verification at the binary level. Reject spoofed MIME types before they reach any screen.' },
              { icon: Eye, title: 'Audit Logging', desc: 'Every action is logged with user, timestamp, and IP. Full audit trail for compliance.' },
              { icon: Users, title: 'Role-Based Access', desc: 'Granular permissions per role. Admins, editors, and viewers see only what they need.' },
              { icon: Globe, title: 'Helmet & Rate Limiting', desc: 'Security headers via Helmet. 3-tier rate limiting (short, medium, long burst) protects against abuse.' },
            ].map((feature, i) => (
              <Reveal key={feature.title} delay={i * 60}>
                <div className="eh-card h-full rounded-xl p-5">
                  <feature.icon size={18} className="mb-3" style={{ color: '#00E5A0' }} />
                  <h3 className="text-[0.9rem] font-semibold mb-1.5">{feature.title}</h3>
                  <p className="text-[0.82rem] leading-relaxed" style={{ color: '#8A8278' }}>{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Trust badges row */}
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
              {[
                { label: 'SOC 2 Type II', sub: 'Compliant' },
                { label: 'GDPR', sub: 'Ready' },
                { label: '256-bit', sub: 'Encryption' },
                { label: 'SSO', sub: 'Supported' },
                { label: '99.9%', sub: 'SLA Available' },
              ].map((badge) => (
                <div key={badge.label} className="text-center">
                  <div className="text-sm font-bold" style={{ color: '#00E5A0' }}>{badge.label}</div>
                  <div className="text-[0.65rem]" style={{ color: '#5A5248' }}>{badge.sub}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 9. How It Works ─── */}
      <section id="how-it-works" className="py-28 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Get Started
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
                Up and running in 3 steps
              </h2>
              <p style={{ color: '#8A8278' }} className="max-w-lg mx-auto">
                From sign-up to live screens in under 5 minutes. No technician required.
              </p>
            </div>
          </Reveal>

          <div className="relative grid md:grid-cols-3 gap-8">
            <div className="hidden md:block absolute top-[52px] left-[16.67%] right-[16.67%] h-px"
              style={{ background: 'linear-gradient(90deg, #00E5A0, #00B4D8)', opacity: 0.15 }} />

            {[
              { num: '01', icon: Upload, title: 'Upload Content', desc: 'Drag in images, videos, URLs, or HTML templates. Your content library organizes and validates everything automatically.' },
              { num: '02', icon: CalendarClock, title: 'Schedule & Target', desc: 'Build playlists, set timezone-aware schedules, and target specific screens, groups, or locations.' },
              { num: '03', icon: MonitorPlay, title: 'Go Live', desc: 'Push to any screen instantly via WebSocket. Monitor status in real-time from your dashboard.' },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 150}>
                <div className="eh-card rounded-xl p-6 text-center">
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5"
                    style={{
                      background: 'rgba(0,229,160,0.1)',
                      border: '1px solid rgba(0,229,160,0.2)',
                    }}
                  >
                    <step.icon size={20} style={{ color: '#00E5A0' }} />
                  </div>
                  <span className="block text-xs font-medium mb-2" style={{
                    color: '#00E5A0',
                    fontFamily: 'var(--font-mono), monospace',
                  }}>
                    {step.num}
                  </span>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#8A8278' }}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 10. Testimonials ─── */}
      <section className="py-28 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
                Loved by teams everywhere
              </h2>
              <p style={{ color: '#8A8278' }} className="mb-6">
                See why organizations choose Vizora for their digital signage.
              </p>
              {/* Aggregate rating badge */}
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
                <span className="text-xs" style={{ color: '#8A8278' }}>from 200+ reviews</span>
              </div>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'Vizora\'s real-time monitoring changed how we manage our 200+ screens. We know the instant something goes offline — before anyone in the store notices.',
                name: 'Sarah Chen',
                role: 'VP of Operations',
                company: 'Atlas Retail Group',
              },
              {
                quote: 'We evaluated five signage platforms. Vizora was the only one with WebSocket-based live updates and proper security built in. The audit logging alone sold our CISO.',
                name: 'Marcus Williams',
                role: 'IT Director',
                company: 'Meridian Health Systems',
              },
              {
                quote: 'Setting up 40 screens across our campus took less than an afternoon. The scheduling system handles different timezones perfectly for our satellite offices.',
                name: 'Dr. Emily Rodriguez',
                role: 'Communications Director',
                company: 'BrightPath University',
              },
              {
                quote: 'Managing digital menu boards across 85 locations used to be a nightmare. With Vizora, we update pricing and specials across every restaurant in seconds. It paid for itself in the first month.',
                name: 'James Park',
                role: 'Regional Manager',
                company: 'Urban Eats Group',
              },
              {
                quote: 'Deploying Vizora across our 12 offices was seamless. The device pairing is dead simple, and centralized content management means our IT team spends zero time on signage maintenance.',
                name: 'Lisa Thompson',
                role: 'IT Systems Administrator',
                company: 'NovaTech Solutions',
              },
              {
                quote: 'Our production floor KPI dashboards update in real-time now. Shift managers can see output metrics the moment they change. The WebSocket architecture makes all the difference for manufacturing.',
                name: 'Robert Hernandez',
                role: 'Operations Lead',
                company: 'Apex Logistics',
              },
            ].map((testimonial, i) => (
              <Reveal key={testimonial.name} delay={i * 100}>
                <div className="eh-card h-full rounded-xl p-6 flex flex-col">
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={14} fill="#00E5A0" style={{ color: '#00E5A0' }} />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: '#C4BFB8' }}>
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div>
                    <div className="text-[0.85rem] font-semibold">{testimonial.name}</div>
                    <div className="text-[0.75rem]" style={{ color: '#5A5248' }}>
                      {testimonial.role}, {testimonial.company}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 11. Pricing ─── */}
      <section id="pricing" className="py-28 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
                style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
                Simple per-screen pricing
              </h2>
              <p style={{ color: '#8A8278' }} className="max-w-lg mx-auto">
                Start with a 30-day free trial. Scale with transparent per-screen pricing.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 items-start">
            {/* Free */}
            <Reveal delay={0}>
              <div className="eh-card rounded-xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-1">Free Trial</h3>
                <p className="text-xs mb-4" style={{ color: '#5A5248' }}>Perfect for getting started</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>$0</span>
                  <span className="text-sm" style={{ color: '#5A5248' }}>/30 days</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Up to 5 screens', '30-day free trial', 'Content upload & library', 'Basic scheduling', '1 GB storage'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#8A8278' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-md">
                  Start Free Trial
                </Link>
              </div>
            </Reveal>

            {/* Basic */}
            <Reveal delay={100}>
              <div className="eh-card rounded-xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-1">Basic</h3>
                <p className="text-xs mb-4" style={{ color: '#5A5248' }}>Up to 50 screens</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>$6</span>
                  <span className="text-sm" style={{ color: '#5A5248' }}>/screen/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Up to 50 screens', 'Analytics dashboard', 'Email support', 'Advanced scheduling', '25 GB storage'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#8A8278' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-md">
                  Get Started
                </Link>
              </div>
            </Reveal>

            {/* Pro */}
            <Reveal delay={150}>
              <div
                className="relative eh-card rounded-xl p-4 sm:p-6"
                style={{
                  borderColor: 'rgba(0,229,160,0.3)',
                  boxShadow: '0 0 40px rgba(0,229,160,0.06)',
                }}
              >
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[0.7rem] font-semibold px-3 py-0.5 rounded-full"
                  style={{ background: '#00E5A0', color: '#061A21' }}
                >
                  Most Popular
                </span>
                <h3 className="text-lg font-semibold mb-1">Pro</h3>
                <p className="text-xs mb-4" style={{ color: '#5A5248' }}>Up to 100 screens</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>$8</span>
                  <span className="text-sm" style={{ color: '#5A5248' }}>/screen/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Up to 100 screens', 'API access', 'Priority support', 'Advanced scheduling', '100 GB storage'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#F0ECE8' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00B4D8' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="eh-btn-neon block w-full text-center text-sm font-semibold py-3 rounded-md"
                  style={{ boxShadow: '0 0 20px rgba(0,229,160,0.15)' }}
                >
                  Get Started
                </Link>
                <p className="text-[0.65rem] text-center mt-2" style={{ color: '#5A5248' }}>30-day free trial included</p>
              </div>
            </Reveal>

            {/* Enterprise */}
            <Reveal delay={200}>
              <div className="eh-card rounded-xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-1">Enterprise</h3>
                <p className="text-xs mb-4" style={{ color: '#5A5248' }}>For large organizations</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold">Custom</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Unlimited screens', 'SLA & dedicated support', 'SSO integration', 'Custom integrations', 'On-prem option'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#8A8278' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-md">
                  Contact Sales
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 12. FAQ ─── */}
      <section id="faq" className="py-28 sm:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
                Frequently asked questions
              </h2>
              <p style={{ color: '#8A8278' }}>
                Everything you need to know about Vizora.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <FAQItem
                q="What hardware do I need to run Vizora?"
                a="Vizora works with any screen or TV. Our Electron app runs on Windows, macOS, and Linux devices, while our Android TV app supports smart displays and media players. All you need is a screen and an internet connection."
              />
              <FAQItem
                q="How does real-time monitoring work?"
                a="Vizora uses persistent WebSocket connections — not polling — to maintain a live connection with every display. When a screen goes offline, changes content, or encounters an error, your dashboard updates within milliseconds. This is the same technology that powers live chat and trading platforms."
              />
              <FAQItem
                q="Can I manage screens across different timezones?"
                a="Yes. Vizora's scheduling engine is fully timezone-aware. You can set schedules in each location's local time, and the system automatically handles timezone conversions. Preview the next 10 occurrences of any schedule to verify timing before publishing."
              />
              <FAQItem
                q="Is Vizora secure enough for enterprise use?"
                a="Absolutely. Vizora includes CSRF protection, XSS sanitization on all API responses, dual JWT authentication (separate secrets for users and devices), role-based access control, full audit logging, and rate limiting. Files are validated at the binary level to prevent MIME spoofing."
              />
              <FAQItem
                q="How long does setup take?"
                a="Most teams go from sign-up to their first live screen in under 5 minutes. Upload your content, pair a device using a simple code, and push your playlist. No technician or special IT knowledge required."
              />
              <FAQItem
                q="Can I try Vizora before committing?"
                a="Yes — our Free trial gives you 5 screens for 30 days with no credit card required. When you're ready to scale, choose Basic ($6/screen up to 50 screens), Pro ($8/screen up to 100 screens), or contact us for Enterprise."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 13. Final CTA ─── */}
      <section ref={finalCtaRef} className="py-28 sm:py-32 px-6">
        <Reveal>
          <div
            className="max-w-4xl mx-auto rounded-2xl p-10 sm:p-16 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,160,0.06) 0%, rgba(0,180,216,0.04) 100%)',
              border: '1px solid rgba(0,229,160,0.15)',
            }}
          >
            <div
              className="absolute top-[-50%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(0,229,160,0.08) 0%, transparent 70%)' }}
            />
            <h2 className="relative text-2xl sm:text-3xl font-bold mb-4" style={{ letterSpacing: '-0.03em' }}>
              Ready to modernize your screens?
            </h2>
            <p className="relative mb-4 max-w-md mx-auto" style={{ color: '#8A8278' }}>
              Join thousands of organizations using Vizora to power their digital signage.
              Start free — no credit card required.
            </p>
            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Link
                href="/register"
                className="eh-btn-neon inline-flex items-center gap-2 px-8 py-3 rounded-md text-[0.9rem]"
              >
                Start Free Trial <ArrowRight size={15} />
              </Link>
              <Link
                href="/login"
                className="eh-btn-ghost inline-flex items-center gap-2 px-8 py-3 rounded-md text-[0.9rem]"
              >
                Sign In
              </Link>
            </div>
            <div className="relative flex items-center justify-center gap-6 text-xs" style={{ color: '#5A5248' }}>
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
          <span className="hidden sm:block text-xs" style={{ color: '#8A8278' }}>
            30-day free trial &middot; No credit card required
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <span className="sm:hidden text-[0.7rem]" style={{ color: '#8A8278' }}>
              30-day free, no card
            </span>
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium"
            >
              Start Free Trial <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 14. Footer ─── */}
      <footer ref={footerRef} className="pt-16 pb-8 px-6" style={{ borderTop: '1px solid #1B3D47' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <Link href="/" className="text-lg font-bold tracking-[-0.02em] eh-gradient mb-3 block">
                VIZORA
              </Link>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#5A5248' }}>
                The modern digital signage platform.
                Real-time control for every screen.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] mb-4" style={{ color: '#8A8278' }}>Product</h4>
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
                      style={{ color: '#5A5248' }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] mb-4" style={{ color: '#8A8278' }}>Company</h4>
              <ul className="space-y-2.5">
                {[
                  { href: '/login', label: 'Login' },
                  { href: '/register', label: 'Sign Up' },
                  { href: '/dashboard', label: 'Dashboard' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm transition-colors hover:text-[#F0ECE8]" style={{ color: '#5A5248' }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] mb-4" style={{ color: '#8A8278' }}>Support</h4>
              <ul className="space-y-2.5 text-sm" style={{ color: '#5A5248' }}>
                <li className="flex items-center gap-2">
                  <ShieldCheck size={14} style={{ color: '#00E5A0' }} />
                  SOC 2 Compliant
                </li>
                <li className="flex items-center gap-2">
                  <Globe size={14} style={{ color: '#00E5A0' }} />
                  GDPR Ready
                </li>
                <li className="flex items-center gap-2">
                  <Lock size={14} style={{ color: '#00E5A0' }} />
                  256-bit Encryption
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: '#5A5248', borderTop: '1px solid #1B3D47' }}>
            <span>&copy; {new Date().getFullYear()} Vizora. All rights reserved.</span>
            <div className="flex gap-6">
              <span className="hover:text-[#F0ECE8] transition-colors cursor-pointer">Privacy Policy</span>
              <span className="hover:text-[#F0ECE8] transition-colors cursor-pointer">Terms of Service</span>
              <span className="hover:text-[#F0ECE8] transition-colors cursor-pointer">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
