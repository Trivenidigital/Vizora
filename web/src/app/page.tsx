'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  NavigationSection,
  HeroSection,
  StatsSection,
  AIFeaturesSection,
  FeatureShowcasesSection,
  SolutionsSection,
  SecuritySection,
  PricingSection,
  FAQSection,
  FinalCTASection,
  StickyBottomBar,
  FooterSection,
  scrollTo,
} from '@/components/landing';
import type { PricingData } from '@/components/landing';

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState('realtime');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const finalCtaRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const ids = ['feature-realtime', 'feature-content', 'feature-scheduling'];
    const observers: IntersectionObserver[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveFeatureTab(id.replace('feature-', ''));
          }
        },
        { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' },
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const finalCta = finalCtaRef.current;
    const footer = footerRef.current;
    if (!hero) return;

    let heroVisible = true;
    let bottomVisible = false;

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting;
        setShowStickyBar(!heroVisible && !bottomVisible);
      },
      { threshold: 0.1 },
    );
    heroObserver.observe(hero);

    const bottomObserver = new IntersectionObserver(
      ([entry]) => {
        bottomVisible = entry.isIntersecting;
        setShowStickyBar(!heroVisible && !bottomVisible);
      },
      { threshold: 0.1 },
    );
    if (finalCta) bottomObserver.observe(finalCta);
    if (footer) bottomObserver.observe(footer);

    return () => {
      heroObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    fetch('/api/geo-pricing')
      .then(r => {
        if (!r.ok) throw new Error('geo-pricing failed');
        return r.json();
      })
      .then(setPricing)
      .catch(() => {
        setPricing({
          region: 'US', currency: 'USD', symbol: '$',
          basic: { monthly: 6, annual: 5 },
          pro: { monthly: 8, annual: 7 },
          locale: 'en-US',
        });
      });
  }, []);

  const nav = useCallback((id: string) => {
    scrollTo(id);
    setMenuOpen(false);
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden selection:bg-[#00E5A0]/20"
      style={{
        background: 'linear-gradient(180deg, #061A21 0%, #081E28 40%, #0A222E 100%)',
        color: '#F0ECE8',
      }}
    >
      <NavigationSection scrolled={scrolled} menuOpen={menuOpen} setMenuOpen={setMenuOpen} nav={nav} />
      <HeroSection heroRef={heroRef} />
      <StatsSection />
      <AIFeaturesSection />
      <FeatureShowcasesSection activeFeatureTab={activeFeatureTab} />
      <SolutionsSection />
      <SecuritySection />
      <PricingSection billingCycle={billingCycle} setBillingCycle={setBillingCycle} pricing={pricing} setPricing={setPricing} />
      <FAQSection />
      <FinalCTASection finalCtaRef={finalCtaRef} />
      <StickyBottomBar showStickyBar={showStickyBar} />
      <FooterSection footerRef={footerRef} />
    </div>
  );
}
