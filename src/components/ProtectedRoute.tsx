import React from 'react';
import { Navigate } from 'react-router-dom';

// Mock authentication state - in a real app, this would come from a context or state management
const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
