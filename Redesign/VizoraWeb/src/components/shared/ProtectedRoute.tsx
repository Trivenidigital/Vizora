import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  // Allow passing additional props if needed in the future
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // User not authenticated, redirect to login page
    // 'replace' prevents going back to the protected route via browser history
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the child route content
  // Outlet is used by react-router-dom for nested routes
  return <Outlet />;
};

export default ProtectedRoute; 