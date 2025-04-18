import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, PlayCircle } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative pt-32 pb-12 lg:pt-40 lg:pb-16 overflow-hidden min-h-[50vh] flex items-center">
      {/* Background elements can be added here if specific to hero */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Animated Headline */} 
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6"
          >
            AI-Powered Digital Signage Platform
          </motion.h1>
          
          {/* Animated Subheadline */} 
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="text-lg sm:text-xl text-slate-300 max-w-xl mx-auto mb-10"
          >
            Transform your displays with intelligent content management, automated scheduling, and performance insights.
          </motion.p>
          
          {/* Animated CTAs */} 
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <Button size="lg" className="bg-sky-500 hover:bg-sky-600 text-white shadow-lg px-8 py-3 text-base">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="bg-transparent border-slate-300 hover:bg-slate-800 text-slate-200 hover:text-white shadow-lg px-8 py-3 text-base backdrop-blur-sm">
              <PlayCircle className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}; 