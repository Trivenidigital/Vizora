import React from 'react';
import { motion } from 'framer-motion';
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar" // Add Avatar later if needed

// Placeholder data
const testimonials = [
  {
    quote: "Vizora transformed how we manage content. The AI scheduling is a game-changer!",
    name: "Jane Doe",
    title: "Marketing Manager, TechCorp",
    // avatar: "/avatars/jane.png"
  },
  {
    quote: "Finally, a digital signage platform that feels modern and intelligent. Highly recommended.",
    name: "John Smith",
    title: "Operations Lead, Retail Hub",
    // avatar: "/avatars/john.png"
  },
    {
    quote: "The analytics helped us double engagement on our lobby displays.",
    name: "Alice Brown",
    title: "Comms Director, Innovate Inc.",
    // avatar: "/avatars/alice.png"
  }
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.2,
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

export const Testimonials: React.FC = () => {
  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-6">
        {/* Section Header */} 
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-3">Trusted by Businesses Worldwide</h2>
          <p className="text-lg text-slate-200 max-w-2xl mx-auto">
            See what our customers are saying about Vizora.
          </p>
        </div>

        {/* Testimonials Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div 
              key={index} 
              className="p-6 bg-black/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/10 flex flex-col"
              variants={itemVariants}
            >
              <blockquote className="text-slate-200 italic mb-4 flex-grow">“{testimonial.quote}”</blockquote>
              <div className="flex items-center mt-auto pt-4 border-t border-white/15">
                {/* <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                  <AvatarFallback>{testimonial.name.substring(0, 1)}</AvatarFallback>
                </Avatar> */}
                <div className="w-10 h-10 mr-3 rounded-full bg-gradient-to-br from-red-500/30 to-amber-500/30"></div> 
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-slate-400">{testimonial.title}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}; 