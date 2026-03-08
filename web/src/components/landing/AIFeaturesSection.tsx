'use client';

import {
  Sparkles,
  CalendarClock,
  Activity,
  Eye,
  MessageSquare,
  Bot,
  Check,
} from 'lucide-react';
import { Reveal } from './shared';

const AI_FEATURES = [
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
];

export default function AIFeaturesSection() {
  return (
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
          {AI_FEATURES.map((feature, i) => (
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
  );
}
