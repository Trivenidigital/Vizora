import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, // AI / Speed
  LayoutGrid, // Grid/Layout 
  CalendarCheck, // Scheduling
  Users, // Collaboration
  BarChart3, // Analytics
  CloudCog, // Cloud / Integration
  Sparkles, // AI
  ScreenShare // Multi-device
} from 'lucide-react';

const features = [
  {
    icon: Sparkles,
    title: 'AI Content Suggestions',
    description: 'Get intelligent recommendations for content based on display context and performance data.'
  },
  {
    icon: CalendarCheck,
    title: 'Automated Scheduling',
    description: 'Let AI optimize your content schedules for maximum impact and minimal effort.'
  },
  {
    icon: ScreenShare,
    title: 'Multi-Device Management',
    description: 'Control and sync content across diverse screen types and locations effortlessly.'
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Understand content effectiveness with clear, AI-summarized insights and reports.'
  },
  {
    icon: LayoutGrid,
    title: 'Flexible Layouts & Templates',
    description: 'Create stunning display layouts quickly with pre-built templates or custom designs.'
  },
  {
    icon: CloudCog,
    title: 'Cloud-Based & Scalable',
    description: 'Manage everything from anywhere with our reliable and scalable cloud platform.'
  }
];

// Animation variants (can reuse or customize)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

export const FeaturesGrid: React.FC = () => {
  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-6">
        {/* Section Header */} 
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-3">Powerful Features, Intelligently Delivered</h2>
          <p className="text-lg text-slate-200 max-w-2xl mx-auto">
            Everything you need to manage digital signage, enhanced with AI.
          </p>
        </div>

        {/* Features Grid */} 
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }} // Animate when 20% is in view
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index} 
              className="p-6 bg-black/25 backdrop-blur-lg rounded-xl shadow-lg border border-white/10 flex flex-col items-start"
              variants={itemVariants}
              whileHover={{ scale: 1.03, backgroundColor: 'rgba(0, 0, 0, 0.4)' }} // Darker semi-transparent black on hover
              transition={{ duration: 0.2 }}
            >
              <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-amber-500/20 to-red-500/20 inline-block">
                <feature.icon className="h-6 w-6 text-amber-300" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-300 flex-grow">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}; 