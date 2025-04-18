import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradientBackground } from '@/components/shared/GradientBackground';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      console.log("Already authenticated, redirecting to dashboard...");
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLoginSuccess = () => {
    console.log("Login successful in LoginPage, redirecting...");
    navigate('/dashboard', { replace: true });
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <GradientBackground>
      <AuthCard onLoginSuccess={handleLoginSuccess} />
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: { background: '#333', color: '#fff' },
          success: { style: { background: '#10B981', color: 'white' } }, 
          error: { style: { background: '#EF4444', color: 'white' } }, 
        }}
      />
    </GradientBackground>
  );
};

export default LoginPage; 