'use client';

import {
  ShieldCheck,
  FileCheck,
  Users,
  Eye,
  Brain,
  Globe,
  Lock,
} from 'lucide-react';
import { Reveal } from './shared';

const SECURITY_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Dual Authentication',
    desc: 'Separate JWT secrets for users and devices. HttpOnly cookies prevent token theft.',
    color: '#00E5A0',
  },
  {
    icon: FileCheck,
    title: 'Content Validation',
    desc: 'Binary-level file verification rejects spoofed MIME types before they reach any screen.',
    color: '#00B4D8',
  },
  {
    icon: Users,
    title: 'Role-Based Access',
    desc: 'Granular permissions per role. Admins, editors, and viewers see only what they need.',
    color: '#8B5CF6',
  },
  {
    icon: Eye,
    title: 'Full Audit Trail',
    desc: 'Every action logged with user, timestamp, and IP. Complete compliance trail.',
    color: '#00E5A0',
  },
  {
    icon: Brain,
    title: 'Privacy-First AI',
    desc: 'All AI processing respects data boundaries. Edge computing keeps sensitive data on-device. No data leaves your network without permission.',
    color: '#00B4D8',
  },
];

const COMPLIANCE_BADGES = [
  { label: 'SOC 2 Type II', sub: 'Compliant', icon: ShieldCheck },
  { label: 'GDPR', sub: 'Ready', icon: Globe },
  { label: '256-bit', sub: 'Encryption', icon: Lock },
  { label: 'SSO', sub: 'Supported', icon: Users },
];

export default function SecuritySection() {
  return (
    <section className="py-16 sm:py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
              style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
              Security
            </span>
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
              Security that <span className="eh-gradient">never sleeps</span>
            </h2>
            <p style={{ color: '#9A958E' }} className="max-w-lg mx-auto">
              Every layer of the platform is designed to protect your organization&apos;s data and devices.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Security features list */}
            <div className="space-y-5">
              {SECURITY_FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${feature.color}12`, border: `1px solid ${feature.color}20` }}
                  >
                    <feature.icon size={18} style={{ color: feature.color }} />
                  </div>
                  <div>
                    <h3 className="text-[0.9rem] font-semibold mb-1" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>{feature.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#9A958E' }}>{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Compliance badges */}
            <div
              className="rounded-xl p-8"
              style={{
                background: 'rgba(0,229,160,0.03)',
                border: '1px solid rgba(0,229,160,0.1)',
              }}
            >
              <h3 className="text-sm font-bold uppercase tracking-[0.1em] mb-6" style={{ color: '#6B655D' }}>
                Compliance & Certifications
              </h3>
              <div className="grid grid-cols-2 gap-5">
                {COMPLIANCE_BADGES.map((badge) => (
                  <div key={badge.label} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}
                    >
                      <badge.icon size={16} style={{ color: '#00E5A0' }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#F0ECE8' }}>{badge.label}</div>
                      <div className="text-[0.65rem]" style={{ color: '#6B655D' }}>{badge.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(0,229,160,0.1)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ color: '#00E5A0', fontFamily: 'var(--font-mono), monospace' }}>99.9%</span>
                  <span className="text-sm" style={{ color: '#6B655D' }}>SLA Available</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
