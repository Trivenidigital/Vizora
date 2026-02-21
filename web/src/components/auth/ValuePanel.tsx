'use client';

import MiniDashboard from './MiniDashboard';

interface ValuePanelProps {
  variant: 'register' | 'login';
}

const content = {
  register: {
    headline: 'Every screen, managed.',
    subtext: 'Join 2,500+ organizations running their displays on Vizora.',
  },
  login: {
    headline: 'Welcome back.',
    subtext: 'Your screens are waiting.',
  },
};

const benefits = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    text: 'Live screens in under 5 minutes',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    text: 'AI-powered content & scheduling',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    text: '99.9% uptime, enterprise security',
  },
];

export default function ValuePanel({ variant }: ValuePanelProps) {
  const { headline, subtext } = content[variant];

  return (
    <div className="relative hidden md:flex flex-col justify-between p-10 lg:p-12 bg-[#061A21] overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 eh-grain" />
      <div
        className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(0,229,160,0.15) 0%, transparent 70%)',
          animation: 'eh-glow-breathe 6s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(0,180,216,0.15) 0%, transparent 70%)',
          animation: 'eh-glow-breathe 8s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div className="relative z-10 space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex items-center justify-center">
            <span className="text-[#00E5A0] font-bold text-sm font-mono">V</span>
          </div>
          <span className="text-[var(--foreground)] font-semibold tracking-tight">Vizora</span>
        </div>

        {/* Headline */}
        <div>
          <h2 className="text-3xl lg:text-4xl font-bold text-[var(--foreground)] eh-heading leading-tight">
            {headline}
          </h2>
          <p className="mt-3 text-[var(--foreground-tertiary)] text-sm lg:text-base leading-relaxed max-w-sm">
            {subtext}
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-4">
          {benefits.map((b) => (
            <div key={b.text} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#00E5A0]/8 border border-[#00E5A0]/15 flex items-center justify-center text-[#00E5A0]">
                {b.icon}
              </div>
              <span className="text-sm text-[var(--foreground-secondary)]">{b.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard preview - only on register */}
      <div className="relative z-10 mt-8">
        {variant === 'register' && (
          <div className="transform scale-[0.92] origin-bottom-left">
            <MiniDashboard />
          </div>
        )}

        {variant === 'login' && (
          <div className="rounded-xl border border-[#1B3D47] bg-[#0C2229]/60 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00E5A0] animate-pulse" />
              <span className="text-xs font-medium text-[var(--foreground)]">Your fleet is online</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { value: '24', label: 'Screens' },
                { value: '148', label: 'Content' },
                { value: '99.9%', label: 'Uptime' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-lg font-bold font-mono text-[#00E5A0]">{s.value}</p>
                  <p className="text-[10px] text-[var(--foreground-tertiary)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Free trial note */}
        <p className="mt-4 text-xs text-[var(--foreground-tertiary)]">
          Free for 30 days. No credit card required.
        </p>
      </div>
    </div>
  );
}
