import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUser, clearAuth, isAuthenticated } from '../utils/auth';

// Define the shape of our auth context
interface AuthContextType {
  user: any;
  isLoggedIn: boolean;
  loading: boolean;
  logout: () => void;
  updateUser: (user: any) => void;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: true,
  logout: () => {},
  updateUser: () => {},
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component that wraps the app and makes auth object available
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing user on mount
  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated()) {
        const userData = getUser();
        setUser(userData);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Logout function
  const logout = () => {
    clearAuth();
    setUser(null);
  };

  // Update user data
  const updateUser = (userData: any) => {
    setUser(userData);
  };

  // Context values
  const value = {
    user,
    isLoggedIn: !!user,
    loading,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext; 