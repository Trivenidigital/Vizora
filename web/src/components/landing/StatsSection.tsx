'use client';

import { Tv, Activity, Users, Sparkles } from 'lucide-react';
import { Reveal, AnimatedStat } from './shared';

const STATS = [
  { value: 50000, suffix: '+', label: 'Screens Managed', icon: Tv },
  { value: 99.9, suffix: '%', label: 'Platform Uptime', icon: Activity },
  { value: 2500, suffix: '+', label: 'Organizations', icon: Users },
  { value: 6, suffix: '', label: 'AI Systems', icon: Sparkles },
];

export default function StatsSection() {
  return (
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
            {STATS.map((stat) => (
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
  );
}
