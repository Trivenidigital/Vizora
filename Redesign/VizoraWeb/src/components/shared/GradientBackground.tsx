import React from 'react';
import { motion } from 'framer-motion';

interface GradientBackgroundProps {
  children: React.ReactNode;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({ children }) => {
  return (
    // Midnight Aurora gradient
    <div className="relative w-full min-h-screen overflow-hidden bg-gradient-to-br from-[#1a2a6c] via-[#b21f1f] to-[#fdbb2d]">
      {/* Adjusted blob colors for new gradient */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, x: '-50%', y: '-50%' }}
        animate={{ scale: [1, 1.1, 1], opacity: 0.2, rotate: [0, 15, -10, 0] }}
        transition={{
          duration: 50, // Slightly slower for mood
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        // Deep blue blob
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900 rounded-full filter blur-3xl opacity-20 pointer-events-none"
        style={{ transformOrigin: 'center center' }}
      />
       <motion.div
        initial={{ scale: 0.7, opacity: 0, x: '-50%', y: '-50%' }}
        animate={{ scale: [1, 1.2, 0.9, 1], opacity: 0.15, rotate: [0, -20, 10, 0] }}
        transition={{
          duration: 60, // Slightly slower
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
          delay: 5,
        }}
        // Warm orange/yellow blob
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500 rounded-full filter blur-3xl opacity-15 pointer-events-none"
        style={{ transformOrigin: 'center center' }}
      />
      
      {/* Content passed as children */} 
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
        {children}
      </div>
    </div>
  );
}; 