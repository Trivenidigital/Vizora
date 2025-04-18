import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/shared/Logo'; // Assuming Logo exists
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom'; // Import Link

export const LandingHeader: React.FC = () => {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 py-4 px-6 sm:px-10 bg-slate-900/50 backdrop-blur-md border-b border-white/10 shadow-sm"
    >
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo - Wrap with Link to home? */}
        <Link to="/">
          <Logo className="h-8 w-auto" /> 
        </Link>

        {/* Navigation / Actions - Use light text colors */} 
        <nav className="flex items-center space-x-3 sm:space-x-4">
          {/* Wrap Buttons with Link */}
          <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:bg-white/10 hover:text-white px-3">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild variant="default" size="sm" className="bg-sky-500 hover:bg-sky-600 text-white px-4 shadow-sm">
            <Link to="/signup">Sign Up</Link>
          </Button>
          {/* Add dark mode toggle later */} 
        </nav>
      </div>
    </motion.header>
  );
}; 