'use client';

import type { Dispatch, SetStateAction } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Reveal } from './shared';

export interface PricingData {
  region: string;
  currency: string;
  symbol: string;
  basic: { monthly: number; annual: number };
  pro: { monthly: number; annual: number };
  locale: string;
}

interface PricingSectionProps {
  billingCycle: 'monthly' | 'annual';
  setBillingCycle: (cycle: 'monthly' | 'annual') => void;
  pricing: PricingData | null;
  setPricing: Dispatch<SetStateAction<PricingData | null>>;
}

export default function PricingSection({ billingCycle, setBillingCycle, pricing, setPricing }: PricingSectionProps) {
  return (
    <section id="pricing" className="py-16 sm:py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
              style={{ color: '#2563EB', background: 'rgba(37, 99, 235,0.08)', border: '1px solid rgba(37, 99, 235,0.15)' }}>
              Pricing
            </span>
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
              Simple per-screen pricing
            </h2>
            <p style={{ color: '#6B7280' }} className="max-w-lg mx-auto mb-8">
              Start with a 30-day free trial. Scale with transparent per-screen pricing.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 p-1 rounded-full" style={{ background: 'rgba(12,34,41,0.6)', border: '1px solid #E5E7EB' }}>
              <button
                onClick={() => setBillingCycle('monthly')}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={billingCycle === 'monthly' ? {
                  background: 'rgba(37, 99, 235,0.12)',
                  color: '#2563EB',
                } : { color: '#6B7280' }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2"
                style={billingCycle === 'annual' ? {
                  background: 'rgba(37, 99, 235,0.12)',
                  color: '#2563EB',
                } : { color: '#6B7280' }}
              >
                Annual
                <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                  Save 20%
                </span>
              </button>
            </div>
            {pricing && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPricing(prev => prev ? { ...prev, region: 'US', currency: 'USD', symbol: '$', basic: { monthly: 6, annual: 5 }, pro: { monthly: 8, annual: 7 } } : prev)}
                  className="text-xs font-medium px-2 py-0.5 rounded-full transition-all"
                  style={pricing.region === 'US' ? { color: '#2563EB', background: 'rgba(37, 99, 235,0.12)' } : { color: '#6B655D' }}
                >
                  USD
                </button>
                <span style={{ color: '#3A3530' }}>|</span>
                <button
                  onClick={() => setPricing(prev => prev ? { ...prev, region: 'IN', currency: 'INR', symbol: '\u20B9', basic: { monthly: 399, annual: 317 }, pro: { monthly: 599, annual: 483 } } : prev)}
                  className="text-xs font-medium px-2 py-0.5 rounded-full transition-all"
                  style={pricing.region === 'IN' ? { color: '#2563EB', background: 'rgba(37, 99, 235,0.12)' } : { color: '#6B655D' }}
                >
                  INR
                </button>
              </div>
            )}
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* Free */}
          <Reveal delay={0}>
            <div className="eh-card rounded-xl p-5 sm:p-6">
              <h3 className="eh-heading text-lg font-semibold mb-1">Free Trial</h3>
              <p className="text-xs mb-5" style={{ color: '#6B655D' }}>Perfect for getting started</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>$0</span>
                <span className="text-sm" style={{ color: '#6B655D' }}>/30 days</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Up to 5 screens', '30-day free trial', 'Content upload & library', 'Basic scheduling', '1 GB storage'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#6B7280' }}>
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#2563EB' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-lg">
                Start Free
              </Link>
            </div>
          </Reveal>

          {/* Basic */}
          <Reveal delay={80}>
            <div className="eh-card rounded-xl p-5 sm:p-6">
              <h3 className="eh-heading text-lg font-semibold mb-1">Basic</h3>
              <p className="text-xs mb-5" style={{ color: '#6B655D' }}>Up to 50 screens</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace' }}>
                  {pricing ? `${pricing.symbol}${billingCycle === 'monthly' ? pricing.basic.monthly : pricing.basic.annual}` : `$${billingCycle === 'monthly' ? '6' : '5'}`}
                </span>
                <span className="text-sm" style={{ color: '#6B655D' }}>/screen/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Up to 50 screens', 'Analytics dashboard', 'Email support', 'Advanced scheduling', '25 GB storage'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#6B7280' }}>
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#2563EB' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-lg">
                Start with Basic
              </Link>
            </div>
          </Reveal>

          {/* Pro -- Featured */}
          <Reveal delay={120}>
            <div
              className="relative eh-card rounded-xl p-5 sm:p-6"
              style={{
                borderColor: 'rgba(37, 99, 235,0.35)',
                boxShadow: '0 0 50px rgba(37, 99, 235,0.06), 0 0 100px rgba(37, 99, 235,0.03)',
              }}
            >
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-[0.7rem] font-bold px-3.5 py-1 rounded-full"
                style={{ background: '#F59E0B', color: '#111827' }}
              >
                Most Popular
              </span>
              <h3 className="eh-heading text-lg font-semibold mb-1">Pro</h3>
              <p className="text-xs mb-5" style={{ color: '#6B655D' }}>Up to 100 screens</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-mono), monospace', color: '#2563EB' }}>
                  {pricing ? `${pricing.symbol}${billingCycle === 'monthly' ? pricing.pro.monthly : pricing.pro.annual}` : `$${billingCycle === 'monthly' ? '8' : '7'}`}
                </span>
                <span className="text-sm" style={{ color: '#6B655D' }}>/screen/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Up to 100 screens', 'Core signage workflows included', 'API access', 'Priority support', 'Advanced scheduling', '100 GB storage'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#F9FAFB' }}>
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#1E3A8A' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="eh-btn-neon block w-full text-center text-sm font-bold py-3 rounded-lg"
                style={{ boxShadow: '0 0 20px rgba(37, 99, 235,0.15)' }}
              >
                Go Pro
              </Link>
              <p className="text-[0.65rem] text-center mt-2" style={{ color: '#6B655D' }}>30-day free trial included</p>
            </div>
          </Reveal>

          {/* Enterprise */}
          <Reveal delay={160}>
            <div className="eh-card rounded-xl p-5 sm:p-6">
              <h3 className="eh-heading text-lg font-semibold mb-1">Enterprise</h3>
              <p className="text-xs mb-5" style={{ color: '#6B655D' }}>For large organizations</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Custom</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Unlimited screens', 'Advanced AI + custom models', 'SLA & dedicated support', 'SSO integration', 'Custom integrations', 'On-prem option'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#6B7280' }}>
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#2563EB' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:sales@vizora.cloud" className="eh-btn-ghost block w-full text-center text-sm font-medium py-2.5 rounded-lg">
                Talk to Sales
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <p className="text-center text-xs mt-8" style={{ color: '#6B655D' }}>
            All plans include SSL encryption, 99.9% SLA, and email support.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
