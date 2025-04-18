import React from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, CalendarCog, Tv, Sparkles } from 'lucide-react'; // Example icons

const steps = [
  {
    icon: UploadCloud,
    title: 'Upload Content',
    description: 'Easily upload images, videos, or connect dynamic web content.'
  },
  {
    icon: Sparkles, // AI Icon
    title: 'AI Auto-Schedule',
    description: 'Let Vizora intelligently schedule content based on goals and performance.'
  },
  {
    icon: CalendarCog,
    title: 'Customize & Refine',
    description: 'Manually adjust schedules and target specific displays or groups.'
  },
  {
    icon: Tv,
    title: 'Display Anywhere',
    description: 'Publish your content seamlessly across all connected screens.'
  }
];

// Animation variants for staggering
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2, // Stagger the animation of children
      delayChildren: 0.3,   // Delay the start of children animation
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

export const HowItWorks: React.FC = () => {
  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-6">
        {/* Section Header */} 
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-3">How Vizora Works</h2>
          <p className="text-lg text-slate-200 max-w-2xl mx-auto">
            Get your content on screen in just a few simple steps, powered by AI.
          </p>
        </div>

        {/* Steps Grid - using motion for container staggering */} 
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible" // Trigger animation when in view
          viewport={{ once: true, amount: 0.3 }} // Animation settings
        >
          {steps.map((step, index) => (
            <motion.div 
              key={index} 
              className="text-center p-6 bg-black/20 backdrop-blur-lg rounded-xl shadow-lg border border-white/10"
              variants={itemVariants} // Apply item animation variants
            >
              <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-indigo-500/30 to-blue-500/30">
                <step.icon className="h-6 w-6 text-indigo-200" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-300">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}; 