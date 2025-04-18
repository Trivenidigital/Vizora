import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/shared/Logo';
import { SignUpForm } from '@/features/auth/components/SignUpForm';
import { motion } from 'framer-motion';

export const SignUpPage: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      console.log('🔄 User already authenticated, redirecting from Signup to Dashboard...');
      navigate('/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSignUpSuccess = () => {
    navigate('/login');
  };

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1a2a6c] via-[#b21f1f] to-[#fdbb2d] p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 sm:p-10 bg-black/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20"
      >
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-10 w-auto mb-4 text-white" />
          <h2 className="text-2xl font-bold text-center text-white mb-1">Create Your Account</h2>
          <p className="text-sm text-center text-slate-300">
            Join Vizora to manage your displays.
          </p>
        </div>

        <SignUpForm onSignUpSuccess={handleSignUpSuccess} />

        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link 
            to="/login"
            className="font-medium text-sky-400 hover:text-sky-300 hover:underline"
          > 
            Log In
          </Link>
        </div>

      </motion.div>
    </div>
  );
};

export default SignUpPage; 