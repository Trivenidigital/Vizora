import { render, screen } from '@testing-library/react';

import PricingSection, { annualSavingPercent } from '../PricingSection';
import type { PricingData } from '../PricingSection';

/**
 * The badge is a CLAIM ABOUT PRICE, so it is pinned to the data rather than to a
 * string.
 *
 * It used to read a hardcoded "Save 20%", which was already false before the
 * October price change (the real USD saving was 12.5-16.7%, so it overstated) and
 * would have been false in the other direction afterwards. No test failed either
 * time, because nothing connected the claim to the numbers. These cases exist so
 * that a future price edit which makes the badge wrong fails here instead of
 * shipping.
 *
 * The expectations are written as computed arithmetic, not as copied constants,
 * so a reader can check them without trusting the implementation.
 */
const USD: PricingData = {
  region: 'US',
  currency: 'USD',
  symbol: '$',
  basic: { monthly: 8, annual: 6 },
  pro: { monthly: 10, annual: 7 },
  locale: 'en-US',
};

const INR: PricingData = {
  region: 'IN',
  currency: 'INR',
  symbol: '₹',
  basic: { monthly: 499, annual: 375 },
  pro: { monthly: 749, annual: 525 },
  locale: 'en-IN',
};

/*
 * SYNTHETIC, and deliberately not a real region.
 *
 * Both live regions now have Pro as their best tier, so the real fixtures can no
 * longer prove that the function takes a MAXIMUM rather than reading a fixed
 * index — a `pricing.pro` hardcode would pass every USD and INR case above.
 * Pinning that against invented numbers is also stronger than relying on two
 * real regions happening to disagree, which is a property of this quarter prices
 * rather than of the code.
 */
const BASIC_WINS: PricingData = {
  region: 'US',
  currency: 'USD',
  symbol: '$',
  basic: { monthly: 10, annual: 5 },
  pro: { monthly: 10, annual: 8 },
  locale: 'en-US',
};

const pct = (annual: number, monthly: number) => Math.round((1 - annual / monthly) * 100);

describe('annualSavingPercent', () => {
  it('takes the BEST tier for USD, which is Pro', () => {
    // basic 25%, pro 30% -> the ceiling the copy claims is 30.
    expect(pct(6, 8)).toBe(25);
    expect(pct(7, 10)).toBe(30);
    expect(annualSavingPercent(USD)).toBe(30);
  });

  it('takes the BEST tier for INR, which is Pro, and lands on the same ceiling', () => {
    // basic 24.85% rounds to 25, pro 29.91% rounds to 30 — the same pair of
    // figures USD gives, which is the point: the page must not advertise a
    // different best saving depending on where the visitor is.
    expect(pct(375, 499)).toBe(25);
    expect(pct(525, 749)).toBe(30);
    expect(annualSavingPercent(INR)).toBe(30);
    expect(annualSavingPercent(INR)).toBe(annualSavingPercent(USD));
  });

  it('takes BASIC when basic is the better tier, so it is a maximum not an index', () => {
    expect(pct(5, 10)).toBe(50);
    expect(pct(8, 10)).toBe(20);
    expect(annualSavingPercent(BASIC_WINS)).toBe(50);
  });

  it('claims nothing when there is no pricing to claim it from', () => {
    expect(annualSavingPercent(null)).toBeNull();
  });

  it('claims nothing rather than dividing by a zero monthly', () => {
    const free: PricingData = { ...USD, basic: { monthly: 0, annual: 0 }, pro: { monthly: 0, annual: 0 } };
    expect(annualSavingPercent(free)).toBeNull();
  });

  it('claims nothing when annual is not actually cheaper', () => {
    const flat: PricingData = { ...USD, basic: { monthly: 8, annual: 8 }, pro: { monthly: 10, annual: 12 } };
    expect(annualSavingPercent(flat)).toBeNull();
  });

  it('ignores a tier with no saving and still reports the one that has it', () => {
    const mixed: PricingData = { ...USD, basic: { monthly: 8, annual: 8 }, pro: { monthly: 10, annual: 7 } };
    expect(annualSavingPercent(mixed)).toBe(30);
  });
});

describe('the rendered badge matches the data it was computed from', () => {
  const noop = () => {};

  it('reads 30% for a US visitor', () => {
    render(
      <PricingSection billingCycle="monthly" setBillingCycle={noop} pricing={USD} setPricing={noop} />,
    );
    expect(screen.getByText(`Save up to ${annualSavingPercent(USD)}%`)).toBeInTheDocument();
    expect(screen.getByText('Save up to 30%')).toBeInTheDocument();
  });

  it('reads 30% for an India visitor too, from the same code path', () => {
    render(
      <PricingSection billingCycle="monthly" setBillingCycle={noop} pricing={INR} setPricing={noop} />,
    );
    expect(screen.getByText(`Save up to ${annualSavingPercent(INR)}%`)).toBeInTheDocument();
    expect(screen.getByText('Save up to 30%')).toBeInTheDocument();
  });

  it('renders NO badge before the pricing arrives, rather than a zero', () => {
    render(
      <PricingSection billingCycle="monthly" setBillingCycle={noop} pricing={null} setPricing={noop} />,
    );
    // Prove the component rendered before trusting three absences: all three
    // would pass just as happily against an empty tree.
    expect(screen.getByRole('button', { name: /Annual/ })).toBeInTheDocument();
    expect(screen.queryByText(/Save up to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Save 0%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('never shows the old hardcoded claim', () => {
    render(
      <PricingSection billingCycle="monthly" setBillingCycle={noop} pricing={USD} setPricing={noop} />,
    );
    expect(screen.queryByText('Save 20%')).not.toBeInTheDocument();
  });
});
