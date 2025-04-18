import React from 'react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { Testimonials } from '@/components/landing/Testimonials';
import { Footer } from '@/components/landing/Footer';
import { Toaster } from 'react-hot-toast'; // Keep toaster if needed globally

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#1a2a6c] via-[#b21f1f] to-[#fdbb2d] text-white">
      <LandingHeader />
      <main className="flex-grow">
        <HeroSection />
        <HowItWorks />
        <FeaturesGrid />
        <Testimonials /> 
        {/* Add more sections like Pricing, CTA Section etc. later */}
      </main>
      <Footer />
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          style: { background: '#333', color: '#fff' },
          success: { style: { background: '#10B981', color: 'white' } },
          error: { style: { background: '#EF4444', color: 'white' } },
        }}
      />
    </div>
  );
};

export default LandingPage; 