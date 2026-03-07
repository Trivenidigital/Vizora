'use client';

import { Upload, CalendarClock, MonitorPlay } from 'lucide-react';
import { Reveal } from './shared';

const STEPS = [
  { num: '01', icon: Upload, title: 'Upload Content', desc: 'Drag in images, videos, or HTML templates. Your library organizes and validates everything.', color: '#00E5A0' },
  { num: '02', icon: CalendarClock, title: 'Schedule & Target', desc: 'Build playlists, set timezone-aware schedules, and target specific screens or groups.', color: '#00B4D8' },
  { num: '03', icon: MonitorPlay, title: 'Go Live', desc: 'Push to any screen instantly via WebSocket. Monitor status in real-time from your dashboard.', color: '#8B5CF6' },
];

export default function HowItWorksSection() {
  return (
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

          {STEPS.map((step, i) => (
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
  );
}
