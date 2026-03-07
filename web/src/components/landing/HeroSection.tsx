'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Play, Sparkles } from 'lucide-react';
import { Reveal, scrollTo } from './shared';

interface HeroSectionProps {
  heroRef: React.RefObject<HTMLElement | null>;
}

export default function HeroSection({ heroRef }: HeroSectionProps) {
  return (
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
  );
}
