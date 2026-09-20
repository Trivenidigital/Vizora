'use client';

import MiniDashboard from './MiniDashboard';

interface ValuePanelProps {
  variant: 'register' | 'login' | 'forgot-password' | 'reset-password';
}

const content = {
  register: {
    headline: 'Every screen, managed.',
    subtext: 'Create your account and pair your first screen.',
  },
  login: {
    headline: 'Welcome back.',
    subtext: 'Your screens are waiting.',
  },
  'forgot-password': {
    headline: "Don't worry.",
    subtext: "It happens to the best of us. We'll help you get back into your account.",
  },
  'reset-password': {
    headline: 'Almost there.',
    subtext: 'Choose a strong, unique password to keep your account secure.',
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
    text: 'Templates and scheduling built in',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    text: 'Encrypted connections, role-based access',
  },
];

export default function ValuePanel({ variant }: ValuePanelProps) {
  const { headline, subtext } = content[variant];

  /*
   * LIGHT. This panel is Vizora's own chrome, not a viewport onto customer
   * media, so it follows the settled chrome-goes-light rule
   * (`tasks/redesign-colour-map.json` notes.darkPanelDecision). It used to
   * carry `mkt-dark-panel`, which re-declared the whole dark token family
   * locally so that `var(--foreground)` would not resolve to dark-on-dark —
   * that scaffolding is no longer needed and the class is gone with it.
   *
   * Ground is `--background-secondary`, not `--lw-stone`, and that is a
   * measured choice rather than a taste one: this panel paints small text in
   * `--foreground-tertiary`, which is 4.47:1 on stone (#e4dccb) and therefore
   * below AA, against 5.04:1 on `--background-secondary`. The recessed
   * panel / raised card relationship is the same one the dashboard rail uses.
   *
   * The two animated neon-and-cyan glow blobs are deleted rather than
   * re-tinted. They existed to give a near-black slab some depth; on ivory
   * they have nothing to do, and Little Worlds is calm by construction.
   * `eh-grain` stays — it is a 3% neutral noise, not a colour.
   */
  return (
    <div className="relative hidden md:flex flex-col p-10 lg:p-12 bg-[var(--background-secondary)] border-r border-[var(--border)] overflow-hidden">
      <div className="absolute inset-0 eh-grain" />

      {/* Content */}
      <div className="relative z-10 space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
            <span className="text-[var(--lw-on-forest)] font-bold text-sm font-mono">V</span>
          </div>
          <span className="text-[var(--foreground)] font-semibold tracking-tight">Vizora</span>
        </div>

        {/* Headline */}
        <div>
          <h2 className="text-3xl lg:text-4xl font-bold text-[var(--foreground)] eh-heading leading-tight">
            {headline}
          </h2>
          <p className="mt-3 text-[var(--foreground-secondary)] text-sm lg:text-base leading-relaxed max-w-sm">
            {subtext}
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-4">
          {benefits.map((b) => (
            <div key={b.text} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary-ink)]">
                {b.icon}
              </div>
              <span className="text-sm text-[var(--foreground-secondary)]">{b.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard preview - only on register */}
      <div className="relative z-10 mt-6">
        {variant === 'register' && (
          <div className="transform scale-[0.96] origin-bottom-left">
            <MiniDashboard />
          </div>
        )}

        {variant === 'login' && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary-ink)]" />
              <span className="text-xs font-medium text-[var(--foreground)]">Your fleet is online</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { value: '24', label: 'Screens' },
                { value: '148', label: 'Content' },
                { value: '6', label: 'Playlists' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-lg font-bold font-mono text-[var(--primary-ink)]">{s.value}</p>
                  <p className="text-[10px] text-[var(--foreground-tertiary)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {variant === 'forgot-password' && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 64 64"
                  fill="none"
                  className="relative z-10"
                >
                  {/* Key body */}
                  <circle cx="22" cy="24" r="10" className="stroke-[var(--lw-forest)]" strokeWidth="2" fill="none" opacity="0.9" />
                  <circle cx="22" cy="24" r="4" className="fill-[var(--lw-forest)]" opacity="0.2" />
                  <line x1="32" y1="24" x2="52" y2="24" className="stroke-[var(--lw-forest)]" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
                  <line x1="48" y1="24" x2="48" y2="32" className="stroke-[var(--lw-forest)]" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                  <line x1="42" y1="24" x2="42" y2="30" className="stroke-[var(--lw-forest)]" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                  {/* Decorative dots */}
                  <circle cx="22" cy="24" r="1.5" className="fill-[var(--lw-forest)]" opacity="0.6" />
                </svg>
              </div>
            </div>
            <p className="text-center text-xs text-[var(--foreground-tertiary)] mt-4">
              A secure reset link will be sent to your email
            </p>
          </div>
        )}

        {variant === 'reset-password' && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 64 64"
                  fill="none"
                  className="relative z-10"
                >
                  {/* Shield */}
                  <path
                    d="M32 8L12 18v14c0 12.4 8.5 24 20 28 11.5-4 20-15.6 20-28V18L32 8z"
                    className="stroke-[var(--lw-forest)] fill-[var(--badge-brand-bg)]"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {/* Checkmark inside shield */}
                  <polyline
                    points="22,32 29,39 42,26"
                    className="stroke-[var(--lw-forest)]"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
            <p className="text-center text-xs text-[var(--foreground-tertiary)] mt-4">
              Your account will be protected with your new password
            </p>
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
