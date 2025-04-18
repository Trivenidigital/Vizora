import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom'; // Import Link
import { AuthForm } from './AuthForm';
import { Logo } from '@/components/shared/Logo'; // Adjust path as needed
import { Badge } from '@/components/ui/badge'; // Assuming Badge component exists

// Define props for AuthCard
interface AuthCardProps {
  onLoginSuccess?: () => void; // Add the optional callback prop
}

export const AuthCard: React.FC<AuthCardProps> = ({ onLoginSuccess }) => {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md p-8 sm:p-10 bg-black/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20"
    >
      {/* Header Section */}
      <div className="flex flex-col items-center mb-8">
        <Logo className="h-10 w-auto mb-4 text-white" /> {/* Pass className to Logo */} 
        <h2 className="text-2xl font-bold text-center text-white mb-1">Welcome Back</h2>
        <p className="text-sm text-center text-slate-300 flex items-center gap-1.5">
          Log in to manage your 
          <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs px-2 py-0.5 backdrop-blur-sm">
            AI-Powered Displays
          </Badge>
        </p>
      </div>

      {/* Auth Form */}
      <AuthForm onLoginSuccess={onLoginSuccess} />

      {/* Footer Links */}
      <div className="mt-6 text-center text-xs text-slate-400">
        Don&apos;t have an account?{" "}
        <Link 
          to="/signup" // Point to the signup route
          className="font-medium text-sky-400 hover:text-sky-300 hover:underline"
        > 
          Sign up
        </Link>
      </div>

    </motion.div>
  );
}; 