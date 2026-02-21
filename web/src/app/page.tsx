'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Menu,
  X,
  ChevronDown,
  Monitor,
  Upload,
  CalendarClock,
  MonitorPlay,
  Radio,
  ShieldCheck,
  Zap,
  BarChart3,
  Globe,
  Lock,
} from 'lucide-react';

/* ─── Scroll reveal ─── */

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

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`eh-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/* ─── FAQ ─── */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <div className="border-b" style={{ borderColor: '#1B3D47' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="text-[0.95rem] font-medium pr-4" style={{ color: open ? '#F0ECE8' : '#B5AEA6', fontFamily: 'var(--font-sora), sans-serif' }}>
          {q}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform duration-300"
          style={{ color: '#00E5A0', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: open ? `${contentRef.current?.scrollHeight || 300}px` : '0px', opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-sm leading-relaxed" style={{ color: '#9A958E' }}>{a}</p>
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden selection:bg-[#00E5A0]/20"
      style={{ background: '#061A21', color: '#F0ECE8' }}
    >
      {/* ── Nav ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'border-b shadow-lg shadow-black/20' : 'border-b border-transparent'
        }`}
        style={scrolled ? {
          background: 'rgba(6, 26, 33, 0.95)',
          backdropFilter: 'blur(20px)',
          borderColor: '#1B3D47',
        } : { background: 'transparent' }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.2)' }}>
              <Monitor size={14} style={{ color: '#00E5A0' }} />
            </div>
            <span className="text-lg font-bold tracking-tight eh-gradient" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>VIZORA</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'FAQ'].map((label) => (
              <button key={label} onClick={() => scrollTo(label.toLowerCase())} className="eh-nav-link text-sm" style={{ color: '#9A958E' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm px-4 py-1.5 rounded-md transition-colors" style={{ color: '#9A958E' }}>
              Log in
            </Link>
            <Link href="/register" className="eh-btn-neon text-sm px-5 py-2 rounded-lg">
              Get Started
            </Link>
          </div>

          <button className="md:hidden" style={{ color: '#9A958E' }} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-3 border-t" style={{ background: 'rgba(6, 26, 33, 0.98)', borderColor: '#1B3D47' }}>
            {['Features', 'Pricing', 'FAQ'].map((label) => (
              <button key={label} onClick={() => { scrollTo(label.toLowerCase()); setMenuOpen(false); }} className="block w-full text-left text-sm py-2" style={{ color: '#9A958E' }}>
                {label}
              </button>
            ))}
            <div className="flex gap-3 pt-2">
              <Link href="/login" className="text-sm px-4 py-1.5 rounded-md" style={{ color: '#9A958E', border: '1px solid #1B3D47' }}>Log in</Link>
              <Link href="/register" className="eh-btn-neon text-sm px-4 py-1.5 rounded-md">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="eh-heading text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Digital signage that <span className="eh-gradient">runs itself</span>
          </h1>
          <p className="text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-10" style={{ color: '#9A958E' }}>
            Upload content, pair your screens, go live. Vizora handles scheduling, monitoring, and updates in real time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link
              href="/register"
              className="eh-btn-neon inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-base font-semibold"
            >
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <button onClick={() => scrollTo('features')} className="eh-btn-ghost inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm">
              See Features
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm" style={{ color: '#6B655D' }}>
            <span className="flex items-center gap-1.5"><Check size={14} style={{ color: '#00E5A0' }} /> Free for 30 days</span>
            <span className="flex items-center gap-1.5"><Check size={14} style={{ color: '#00E5A0' }} /> No credit card</span>
            <span className="hidden sm:flex items-center gap-1.5"><Check size={14} style={{ color: '#00E5A0' }} /> 5-minute setup</span>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6" style={{ background: '#081E28' }}>
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00E5A0' }}>How it works</p>
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold text-center mb-14">Three steps to live screens</h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '01', icon: Upload, title: 'Upload', desc: 'Drag in images, videos, or HTML. Your library organizes everything automatically.', color: '#00E5A0' },
              { num: '02', icon: CalendarClock, title: 'Schedule', desc: 'Build playlists, set timezone-aware schedules, and target specific screens or groups.', color: '#00B4D8' },
              { num: '03', icon: MonitorPlay, title: 'Go Live', desc: 'Push content instantly via WebSocket. Monitor every screen from your dashboard.', color: '#8B5CF6' },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 120}>
                <div className="text-center">
                  <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-5"
                    style={{ background: `${step.color}12`, border: `1px solid ${step.color}25` }}
                  >
                    <step.icon size={22} style={{ color: step.color }} />
                  </div>
                  <div className="text-xs font-mono mb-2" style={{ color: step.color }}>{step.num}</div>
                  <h3 className="eh-heading text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#9A958E' }}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 sm:py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00E5A0' }}>Platform</p>
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold text-center mb-4">Everything you need to manage screens</h2>
            <p className="text-center max-w-lg mx-auto mb-14" style={{ color: '#9A958E' }}>
              From content uploads to fleet monitoring, one platform handles it all.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Radio, title: 'Real-time Control', desc: 'Live WebSocket connections to every screen. See status changes instantly, push content, reboot devices remotely.', color: '#00E5A0' },
              { icon: Upload, title: 'Content Management', desc: 'Upload images, videos, URLs, or HTML. Binary-level validation prevents spoofed files from reaching your screens.', color: '#00B4D8' },
              { icon: CalendarClock, title: 'Smart Scheduling', desc: 'Timezone-aware schedules with playlist builder. Target specific screens or groups, preview before publishing.', color: '#8B5CF6' },
              { icon: BarChart3, title: 'Analytics', desc: 'Track engagement, device uptime, and content performance. Export reports as CSV for stakeholders.', color: '#00E5A0' },
              { icon: ShieldCheck, title: 'Enterprise Security', desc: 'Dual JWT auth, CSRF protection, XSS sanitization, role-based access, and full audit logging.', color: '#00B4D8' },
              { icon: Zap, title: 'Instant Updates', desc: 'Push content to any screen in milliseconds. No polling, no delays. WebSocket-powered live sync.', color: '#8B5CF6' },
            ].map((feature, i) => (
              <Reveal key={feature.title} delay={i * 60}>
                <div className="eh-card rounded-xl p-6 h-full">
                  <div
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                    style={{ background: `${feature.color}12`, border: `1px solid ${feature.color}20` }}
                  >
                    <feature.icon size={20} style={{ color: feature.color }} />
                  </div>
                  <h3 className="eh-heading text-base font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#9A958E' }}>{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 px-6" style={{ background: '#081E28' }}>
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              {[
                { value: '50K+', label: 'Screens managed' },
                { value: '99.9%', label: 'Uptime SLA' },
                { value: '<50ms', label: 'Update latency' },
                { value: '2,500+', label: 'Organizations' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl sm:text-3xl font-bold mb-1 font-mono" style={{ color: '#00E5A0' }}>{stat.value}</div>
                  <div className="text-xs" style={{ color: '#6B655D' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 sm:py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00E5A0' }}>Pricing</p>
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold text-center mb-4">Simple per-screen pricing</h2>
            <p className="text-center max-w-md mx-auto mb-8" style={{ color: '#9A958E' }}>
              Start free, scale as you grow. No hidden fees.
            </p>

            <div className="flex justify-center mb-10">
              <div className="inline-flex items-center gap-1 p-1 rounded-full" style={{ background: '#0C2229', border: '1px solid #1B3D47' }}>
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={billingCycle === 'monthly' ? { background: 'rgba(0,229,160,0.12)', color: '#00E5A0' } : { color: '#9A958E' }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2"
                  style={billingCycle === 'annual' ? { background: 'rgba(0,229,160,0.12)', color: '#00E5A0' } : { color: '#9A958E' }}
                >
                  Annual <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>-20%</span>
                </button>
              </div>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                name: 'Free',
                sub: 'Try it out',
                price: '$0',
                per: '/30 days',
                features: ['Up to 5 screens', '1 GB storage', 'Basic scheduling', 'Content uploads'],
                cta: 'Start Free',
                ghost: true,
              },
              {
                name: 'Basic',
                sub: 'Small teams',
                price: billingCycle === 'monthly' ? '$6' : '$5',
                per: '/screen/mo',
                features: ['Up to 50 screens', '25 GB storage', 'Analytics dashboard', 'Email support'],
                cta: 'Get Basic',
                ghost: true,
              },
              {
                name: 'Pro',
                sub: 'Growing businesses',
                price: billingCycle === 'monthly' ? '$8' : '$7',
                per: '/screen/mo',
                features: ['Up to 100 screens', '100 GB storage', 'API access', 'Priority support', 'Advanced scheduling'],
                cta: 'Get Pro',
                featured: true,
              },
              {
                name: 'Enterprise',
                sub: 'Large organizations',
                price: 'Custom',
                per: '',
                features: ['Unlimited screens', 'SSO integration', 'Dedicated support', 'SLA guarantee', 'On-prem option'],
                cta: 'Contact Sales',
                ghost: true,
                href: 'mailto:sales@vizora.cloud',
              },
            ].map((plan, i) => (
              <Reveal key={plan.name} delay={i * 60}>
                <div
                  className={`rounded-xl p-6 h-full flex flex-col ${plan.featured ? 'relative' : ''}`}
                  style={{
                    background: plan.featured ? 'rgba(12, 34, 41, 0.8)' : 'rgba(12, 34, 41, 0.4)',
                    border: plan.featured ? '1px solid rgba(0,229,160,0.3)' : '1px solid #1B3D47',
                    boxShadow: plan.featured ? '0 0 40px rgba(0,229,160,0.06)' : undefined,
                  }}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[0.7rem] font-bold px-3 py-1 rounded-full" style={{ background: '#00E5A0', color: '#061A21' }}>
                      Popular
                    </span>
                  )}
                  <h3 className="eh-heading text-lg font-semibold mb-0.5">{plan.name}</h3>
                  <p className="text-xs mb-5" style={{ color: '#6B655D' }}>{plan.sub}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold font-mono" style={plan.featured ? { color: '#00E5A0' } : undefined}>{plan.price}</span>
                    {plan.per && <span className="text-sm" style={{ color: '#6B655D' }}>{plan.per}</span>}
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#9A958E' }}>
                        <Check size={15} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.href ? (
                    <a href={plan.href} className={`block w-full text-center text-sm font-medium py-2.5 rounded-lg ${plan.featured ? 'eh-btn-neon' : 'eh-btn-ghost'}`}>
                      {plan.cta}
                    </a>
                  ) : (
                    <Link href="/register" className={`block w-full text-center text-sm font-medium py-2.5 rounded-lg ${plan.featured ? 'eh-btn-neon' : 'eh-btn-ghost'}`}>
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="text-center text-xs mt-8" style={{ color: '#6B655D' }}>
              All plans include SSL encryption, real-time monitoring, and email support.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Security ── */}
      <section className="py-16 px-6" style={{ background: '#081E28' }}>
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
              {[
                { icon: ShieldCheck, label: 'SOC 2 Type II', sub: 'Compliant' },
                { icon: Globe, label: 'GDPR', sub: 'Ready' },
                { icon: Lock, label: '256-bit', sub: 'Encryption' },
                { icon: Monitor, label: '99.9%', sub: 'SLA Available' },
              ].map((badge) => (
                <div key={badge.label} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
                    <badge.icon size={18} style={{ color: '#00E5A0' }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{badge.label}</div>
                    <div className="text-xs" style={{ color: '#6B655D' }}>{badge.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 sm:py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold text-center mb-12">Frequently asked questions</h2>
          </Reveal>

          <Reveal>
            <div>
              <FAQItem q="How long does setup take?" a="Most teams go from sign-up to their first live screen in under 5 minutes. Upload content, pair a device with a code, and push your playlist." />
              <FAQItem q="What hardware do I need?" a="Any screen or TV works. Our apps run on Windows, macOS, Linux, and Android TV. All you need is a display and an internet connection." />
              <FAQItem q="How does real-time monitoring work?" a="Vizora uses persistent WebSocket connections, not polling, to maintain a live link to every display. Status changes show on your dashboard within milliseconds." />
              <FAQItem q="Is it secure enough for enterprise?" a="Yes. Dual JWT authentication, CSRF protection, XSS sanitization, role-based access, binary-level file validation, and full audit logging are all included." />
              <FAQItem q="Can I manage screens across timezones?" a="Yes. Scheduling is fully timezone-aware. Set schedules in each location's local time and the system handles conversions automatically." />
              <FAQItem q="What does the free trial include?" a="5 screens for 30 days, no credit card required. Full access to content uploads, basic scheduling, and real-time monitoring." />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-6">
        <Reveal>
          <div
            className="max-w-3xl mx-auto rounded-2xl p-10 sm:p-16 text-center"
            style={{ background: 'rgba(0,229,160,0.04)', border: '1px solid rgba(0,229,160,0.12)' }}
          >
            <h2 className="eh-heading text-2xl sm:text-3xl font-bold mb-4">Ready to go live?</h2>
            <p className="mb-8 max-w-md mx-auto" style={{ color: '#9A958E' }}>
              Join 2,500+ organizations using Vizora. Deploy your first screen in under 5 minutes.
            </p>
            <Link href="/register" className="eh-btn-neon inline-flex items-center gap-2 px-10 py-3.5 rounded-lg text-base font-semibold">
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <div className="flex items-center justify-center gap-6 text-xs mt-6" style={{ color: '#6B655D' }}>
              <span className="flex items-center gap-1.5"><Check size={13} style={{ color: '#00E5A0' }} /> 30-day trial</span>
              <span className="flex items-center gap-1.5"><Check size={13} style={{ color: '#00E5A0' }} /> No credit card</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="pt-12 pb-8 px-6" style={{ borderTop: '1px solid #1B3D47' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.2)' }}>
                  <Monitor size={12} style={{ color: '#00E5A0' }} />
                </div>
                <span className="text-lg font-bold tracking-tight eh-gradient" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>VIZORA</span>
              </Link>
              <p className="text-sm leading-relaxed" style={{ color: '#6B655D' }}>
                Digital signage that runs itself.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#9A958E' }}>Product</h4>
              <ul className="space-y-2.5">
                {['Features', 'Pricing', 'FAQ'].map((label) => (
                  <li key={label}>
                    <button onClick={() => scrollTo(label.toLowerCase())} className="text-sm hover:text-[#F0ECE8] transition-colors" style={{ color: '#6B655D' }}>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#9A958E' }}>Account</h4>
              <ul className="space-y-2.5">
                {[
                  { href: '/login', label: 'Log in' },
                  { href: '/register', label: 'Sign up' },
                  { href: '/dashboard', label: 'Dashboard' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm hover:text-[#F0ECE8] transition-colors" style={{ color: '#6B655D' }}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#9A958E' }}>Legal</h4>
              <ul className="space-y-2.5">
                {['Privacy Policy', 'Terms of Service', 'Security'].map((label) => (
                  <li key={label}>
                    <span className="text-sm hover:text-[#F0ECE8] transition-colors cursor-pointer" style={{ color: '#6B655D' }}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 text-xs" style={{ color: '#6B655D', borderTop: '1px solid #1B3D47' }}>
            &copy; {new Date().getFullYear()} Vizora. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
