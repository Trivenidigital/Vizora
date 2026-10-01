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

/** Feature bullets are limited to what the plans actually grant. */
const FREE_FEATURES = ['Up to 5 screens', '30 days, no credit card', 'Content upload & library', 'Scheduling', '1 GB storage'];
const BASIC_FEATURES = ['Up to 50 screens', 'Analytics dashboard', 'Advanced scheduling', 'Email support', '25 GB storage'];
const PRO_FEATURES = ['Up to 100 screens', 'Everything in Basic', 'API access', 'Priority support', '100 GB storage'];
const ENTERPRISE_FEATURES = ['Unlimited screens', 'Volume pricing', '99.9% uptime SLA', 'Priority support'];

const CSS = `
.lw-pricing{padding:var(--lw-sec-y) 0;background:linear-gradient(180deg,transparent,var(--lw-paper-2) 30%,var(--lw-paper-2) 70%,transparent)}
.lwr-head{text-align:center;max-width:42rem;margin:0 auto 30px}
.lwr-head h2{font-size:clamp(1.9rem,3.4vw,2.9rem);margin:14px 0 10px}
.lwr-head p{color:var(--lw-ink-2)}
.lwr-head .lw-kicker{justify-content:center}
.lwr-toggle{display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:999px;
  background:var(--lw-card);border:1px solid var(--lw-hair)}
.lwr-toggle button{border-radius:999px;padding:7px 16px;font-size:.86rem;font-weight:600;
  color:var(--lw-ink-2);display:flex;align-items:center;gap:8px;transition:background .2s,color .2s}
.lwr-toggle button[aria-pressed="true"]{background:var(--lw-forest);color:var(--lw-on-forest)}
.lwr-save{font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:999px;
  background:var(--lw-brass);color:#2d2208}
.lwr-cur{margin-top:12px;display:flex;justify-content:center;gap:8px;align-items:center;color:var(--lw-muted)}
.lwr-cur button{font-size:.74rem;font-weight:600;padding:3px 10px;border-radius:999px;color:var(--lw-muted)}
.lwr-cur button[aria-pressed="true"]{color:var(--lw-forest);background:rgba(31,66,48,.1)}
.lwr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;align-items:start;margin-top:34px}
.lwr-card{padding:24px;display:flex;flex-direction:column;position:relative}
.lwr-card h3{font-family:var(--lw-serif);font-weight:520;font-size:1.35rem;letter-spacing:-.01em}
.lwr-kind{color:var(--lw-muted);font-size:.76rem;margin:2px 0 18px}
.lwr-price{display:flex;align-items:baseline;gap:5px;margin-bottom:20px}
.lwr-price b{font-family:var(--font-mono),monospace;font-weight:600;font-size:2.6rem;letter-spacing:-.03em}
.lwr-price span{color:var(--lw-muted);font-size:.8rem}
.lwr-feats{display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
.lwr-feats li{display:flex;gap:9px;align-items:flex-start;font-size:.86rem;color:var(--lw-ink-2)}
.lwr-pro{border:1px solid rgba(31,66,48,.35);box-shadow:0 22px 48px rgba(31,66,48,.14)}
.lwr-pop{position:absolute;top:-11px;left:50%;transform:translateX(-50%);
  font-family:var(--font-mono),monospace;font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;
  background:var(--lw-brass);color:#2d2208;font-weight:700;border-radius:999px;padding:4px 12px}
.lwr-note{text-align:center;color:var(--lw-muted);font-size:.76rem;margin-top:26px}
@media (max-width:1023px){.lwr-grid{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.lwr-grid{grid-template-columns:1fr}}
`;

/**
 * The best annual saving on offer, as a whole percentage, or null if there is
 * none to claim.
 *
 * DERIVED, because the badge used to hardcode "Save 20%" and a hardcoded claim
 * about price drifts the moment a price moves. It was already wrong before this
 * change — the real USD saving was 12.5-16.7%, so it OVERSTATED — and after the
 * rise it would have understated instead. Neither failure would have broken a
 * test, which is the problem with a number nothing computes.
 *
 * "Best of the tiers" rather than an average, paired with "up to" in the copy:
 * the tiers differ (USD is 25% on Basic and 30% on Pro), so a single figure is
 * only honest as a ceiling that at least one tier actually reaches. An average
 * would assert a number no tier achieves.
 *
 * Returns null rather than 0 when there is nothing to show, so the caller
 * renders no badge instead of "Save 0%" or NaN. A monthly of 0 is excluded
 * before dividing.
 */
export function annualSavingPercent(pricing: PricingData | null): number | null {
  if (!pricing) return null;
  const savings = [pricing.basic, pricing.pro]
    .filter((tier) => tier.monthly > 0)
    .map((tier) => 1 - tier.annual / tier.monthly)
    .filter((saving) => saving > 0);
  if (savings.length === 0) return null;
  const best = Math.round(Math.max(...savings) * 100);
  return best > 0 ? best : null;
}

export default function PricingSection({ billingCycle, setBillingCycle, pricing, setPricing }: PricingSectionProps) {
  const saving = annualSavingPercent(pricing);
  return (
    <section id="pricing" className="lw-pricing scroll-mt-20" aria-labelledby="pricingTitle">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lw-wrap">
        <Reveal>
          <div className="lwr-head">
            <span className="lw-mono lw-kicker">Pricing</span>
            <h2 id="pricingTitle" className="lw-h2">
              Simple, per screen.
            </h2>
            <p style={{ marginBottom: '26px' }}>
              Start with a 30-day free trial and pay only for the screens you actually run.
            </p>

            <div className="lwr-toggle" role="group" aria-label="Billing period">
              <button
                type="button"
                aria-pressed={billingCycle === 'monthly'}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                aria-pressed={billingCycle === 'annual'}
                onClick={() => setBillingCycle('annual')}
              >
                Annual
                {saving !== null && <span className="lwr-save">Save up to {saving}%</span>}
              </button>
            </div>
            {pricing && (
              <div role="group" aria-label="Currency" className="lwr-cur">
                <button
                  type="button"
                  aria-pressed={pricing.region === 'US'}
                  onClick={() =>
                    setPricing((prev) =>
                      prev
                        ? {
                            ...prev,
                            region: 'US',
                            currency: 'USD',
                            symbol: '$',
                            basic: { monthly: 8, annual: 6 },
                            pro: { monthly: 10, annual: 7 },
                          }
                        : prev,
                    )
                  }
                >
                  USD
                </button>
                <span aria-hidden="true">|</span>
                <button
                  type="button"
                  aria-pressed={pricing.region === 'IN'}
                  onClick={() =>
                    setPricing((prev) =>
                      prev
                        ? {
                            ...prev,
                            region: 'IN',
                            currency: 'INR',
                            symbol: '₹',
                            basic: { monthly: 399, annual: 317 },
                            pro: { monthly: 599, annual: 483 },
                          }
                        : prev,
                    )
                  }
                >
                  INR
                </button>
              </div>
            )}
          </div>
        </Reveal>

        <div className="lwr-grid">
          <Reveal delay={0}>
            <div className="lw-card-surface lwr-card">
              <h3>Free trial</h3>
              <p className="lwr-kind">Kick the tyres properly</p>
              <div className="lwr-price">
                <b>$0</b>
                <span>/30 days</span>
              </div>
              <ul className="lwr-feats">
                {FREE_FEATURES.map((f) => (
                  <li key={f}>
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--lw-forest)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="lw-btn lw-btn-ghost w-full !py-2.5 text-sm mt-auto">
                Start free
              </Link>
            </div>
          </Reveal>

          <Reveal delay={70}>
            <div className="lw-card-surface lwr-card">
              <h3>Basic</h3>
              <p className="lwr-kind">Up to 50 screens</p>
              <div className="lwr-price">
                <b>
                  {pricing
                    ? `${pricing.symbol}${billingCycle === 'monthly' ? pricing.basic.monthly : pricing.basic.annual}`
                    : `$${billingCycle === 'monthly' ? '8' : '6'}`}
                </b>
                <span>/screen/mo</span>
              </div>
              <ul className="lwr-feats">
                {BASIC_FEATURES.map((f) => (
                  <li key={f}>
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--lw-forest)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="lw-btn lw-btn-ghost w-full !py-2.5 text-sm mt-auto">
                Start with Basic
              </Link>
            </div>
          </Reveal>

          <Reveal delay={110}>
            <div className="lw-card-surface lwr-card lwr-pro">
              <span className="lwr-pop">Most popular</span>
              <h3>Pro</h3>
              <p className="lwr-kind">Up to 100 screens</p>
              <div className="lwr-price">
                <b style={{ color: 'var(--lw-forest)' }}>
                  {pricing
                    ? `${pricing.symbol}${billingCycle === 'monthly' ? pricing.pro.monthly : pricing.pro.annual}`
                    : `$${billingCycle === 'monthly' ? '10' : '7'}`}
                </b>
                <span>/screen/mo</span>
              </div>
              <ul className="lwr-feats">
                {PRO_FEATURES.map((f) => (
                  <li key={f}>
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--lw-forest)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="lw-btn lw-btn-forest w-full !py-2.5 text-sm mt-auto">
                Go Pro
              </Link>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="lw-card-surface lwr-card">
              <h3>Enterprise</h3>
              <p className="lwr-kind">For large estates</p>
              <div className="lwr-price">
                <b style={{ fontFamily: 'var(--lw-serif)', fontWeight: 500 }}>Custom</b>
              </div>
              <ul className="lwr-feats">
                {ENTERPRISE_FEATURES.map((f) => (
                  <li key={f}>
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--lw-forest)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:sales@vizora.cloud" className="lw-btn lw-btn-ghost w-full !py-2.5 text-sm mt-auto">
                Talk to sales
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <p className="lwr-note">
            Every plan runs over HTTPS with email support. The 99.9% uptime SLA applies to Pro and
            Enterprise.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
