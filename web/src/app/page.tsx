'use client';

import { useEffect, useRef, useState } from 'react';
import {
  NavigationSection,
  LittleWorldsHero,
  LocationShowcase,
  ContentToPlayback,
  CapabilitiesShowcase,
  PricingSection,
  FAQSection,
  FinalCTASection,
  StickyBottomBar,
  FooterSection,
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

  return (
    <div className="mkt lw relative min-h-screen overflow-x-hidden selection:bg-[#1f4230]/15">
      <NavigationSection scrolled={scrolled} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main id="main-content">
        {/* Little Worlds + Studio Redesign */}
        <LittleWorldsHero heroRef={heroRef} />
        <LocationShowcase />
        <ContentToPlayback />
        <CapabilitiesShowcase />
        <PricingSection billingCycle={billingCycle} setBillingCycle={setBillingCycle} pricing={pricing} setPricing={setPricing} />
        <FAQSection />
        <FinalCTASection finalCtaRef={finalCtaRef} />
      </main>
      <StickyBottomBar showStickyBar={showStickyBar} />
      <FooterSection footerRef={footerRef} />
    </div>
  );
}
