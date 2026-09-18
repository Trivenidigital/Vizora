'use client';

import { useEffect, useState } from 'react';
import {
  NavigationSection,
  HeroSection,
  LocationsSection,
  PlacesSection,
  PipelineSection,
  WorkspaceSection,
  PricingSection,
  FAQSection,
  FinalCTASection,
  FooterSection,
  scrollTo,
} from '@/components/landing';
import type { PricingData, WorldPlace } from '@/components/landing';

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [place, setPlace] = useState<WorldPlace>('cafe');

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    fetch('/api/geo-pricing')
      .then((r) => {
        if (!r.ok) throw new Error('geo-pricing failed');
        return r.json();
      })
      .then(setPricing)
      .catch(() => {
        setPricing({
          region: 'US',
          currency: 'USD',
          symbol: '$',
          basic: { monthly: 6, annual: 5 },
          pro: { monthly: 8, annual: 7 },
          locale: 'en-US',
        });
      });
  }, []);

  const explore = (p: WorldPlace) => {
    setPlace(p);
    scrollTo('places');
  };

  // Fraunces is loaded in the root layout, so `--font-fraunces` is already on
  // <html> and this wrapper no longer carries its variable class.
  return (
    <div className="mkt lw relative min-h-screen overflow-x-hidden">
      <NavigationSection scrolled={scrolled} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main id="main-content">
        <HeroSection onExplore={explore} />
        <LocationsSection onView={explore} />
        <PlacesSection place={place} onPlaceChange={setPlace} />
        <PipelineSection />
        <WorkspaceSection />
        <PricingSection
          billingCycle={billingCycle}
          setBillingCycle={setBillingCycle}
          pricing={pricing}
          setPricing={setPricing}
        />
        <FAQSection />
        <FinalCTASection />
      </main>
      <FooterSection />
    </div>
  );
}
