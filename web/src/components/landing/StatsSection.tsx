'use client';

import { Tv, Activity, CalendarClock, MonitorSmartphone } from 'lucide-react';
import { Reveal } from './shared';

/**
 * Every figure here is checkable against the product: the trial length and its
 * screen quota come from the free tier, the SLA figure is the one the SLA page
 * actually commits to (Pro and Enterprise — Free and Basic are best-effort),
 * and the player count is the four platforms that have a client.
 *
 * The band previously counted screens managed, organizations onboarded and "AI
 * systems", none of which any part of the system could substantiate.
 */
const STATS = [
  { value: '30 days', label: 'Free trial, no card required', icon: CalendarClock },
  { value: '5', label: 'Screens on the free trial', icon: Tv },
  { value: '99.9%', label: 'Uptime SLA on Pro and Enterprise', icon: Activity },
  {
    value: '4',
    label: 'Player platforms: Android TV, Windows, macOS, Linux',
    icon: MonitorSmartphone,
  },
];

export default function StatsSection() {
  return (
    <section className="py-14 px-6" aria-label="Vizora at a glance">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-10 px-6 sm:px-8 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,160,0.04) 0%, rgba(0,180,216,0.03) 100%)',
              border: '1px solid var(--mkt-hair)',
            }}
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon size={18} className="mx-auto mb-3" style={{ color: 'var(--mkt-mint)', opacity: 0.7 }} />
                <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--mkt-ink)' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace' }}>{stat.value}</span>
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--mkt-muted)' }}>
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
