'use client';

import { ShoppingBag, Building2, Stethoscope, UtensilsCrossed } from 'lucide-react';
import { Reveal } from './shared';

const INDUSTRIES = [
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
];

export default function SolutionsSection() {
  return (
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
          {INDUSTRIES.map((industry, i) => (
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
  );
}
