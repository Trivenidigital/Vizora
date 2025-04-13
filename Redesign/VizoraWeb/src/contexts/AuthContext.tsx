import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService, { tokenManager } from '@/services/authService';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import axios from 'axios';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Debug log in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[AuthContext] AuthProvider initialized');
    }
  }, []);

  // Check if we have a return URL from a login redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get('returnUrl');
    
    // Store return URL in localStorage if present
    if (returnUrl && location.pathname === '/login') {
      localStorage.setItem('returnUrl', returnUrl);
      
      if (import.meta.env.DEV) {
        console.log('[AuthContext] Return URL stored:', returnUrl);
      }
    }
  }, [location]);

  // Initial auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = tokenManager.getToken();
        if (token) {
          if (import.meta.env.DEV) {
            console.log('[AuthContext] Token found, checking authentication');
          }
          
          setIsLoading(true);
          
          try {
            // Add a small delay to ensure any pending auth operations have completed
            // This helps prevent race conditions where the token might be available but not fully processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try to get the current user with the token
            const userData = await authService.getCurrentUser();
            setUser(userData);
            
            if (import.meta.env.DEV) {
              console.log('[AuthContext] User authenticated:', userData);
            }
          } catch (error) {
            console.error('[AuthContext] ❌ Failed to get current user:', error);
            
            // Show a user-friendly error message
            if (axios.isAxiosError(error) && error.response) {
              if (error.response.status === 401) {
                toast.error('Your session has expired. Please log in again.');
              } else if (error.response.status === 404) {
                toast.error('Authentication service is unavailable.');
              } else {
                toast.error('Authentication failed. Please log in again.');
              }
            }
            
            // Clear token if it's invalid
            tokenManager.removeToken();
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('[AuthContext] No token found, user not authenticated');
          }
        }
      } catch (error) {
        console.error('[AuthContext] ❌ Auth check failed:', error);
        tokenManager.removeToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    
    // Create a toast ID for loading notification
    const loadingToast = toast.loading('Signing in...');
    
    try {
      if (import.meta.env.DEV) {
        console.log('[AuthContext] Attempting login with email:', email);
      }
      
      // Call login API
      const response = await authService.login({ email, password });
      
      if (response && response.token) {
        // Store token in localStorage
        tokenManager.setToken(response.token);
        
        // Update user state
        setUser(response.user);
        
        // Verify token by testing the auth/me endpoint
        try {
          // Brief delay to ensure token is properly stored
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Test the auth/me endpoint
          if (import.meta.env.DEV) {
            console.log('[AuthContext] Verifying token with auth/me endpoint');
          }
          
          const verifyUser = await authService.getCurrentUser();
          
          if (import.meta.env.DEV) {
            console.log('[AuthContext] Token verification successful:', verifyUser);
          }
        } catch (verifyError) {
          console.error('[AuthContext] ❌ Token verification failed:', verifyError);
          // Continue the login flow anyway, as we already have user data from login
        }
        
        toast.dismiss(loadingToast);
        toast.success('Signed in successfully');
        
        // Check if we have a return URL from a previous redirect
        const returnUrl = localStorage.getItem('returnUrl');
        if (returnUrl) {
          localStorage.removeItem('returnUrl');
          navigate(returnUrl);
        } else {
          navigate('/dashboard');
        }
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      console.error('[AuthContext] ❌ Login failed:', error);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Show appropriate error message based on error type
      let errorMessage = 'Login failed';
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          if (error.response.status === 404) {
            errorMessage = 'Login service is unavailable. Please try again later.';
          } else if (error.response.status === 401) {
            errorMessage = 'Invalid email or password.';
          } else if (error.response.data?.message) {
            errorMessage = error.response.data.message;
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Show error toast
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (import.meta.env.DEV) {
        console.log('[AuthContext] Logging out user');
      }
      
      // Call the authService logout method which handles the API call
      await authService.logout();
      
      // Clear the token from localStorage
      tokenManager.removeToken();
      
      // Reset user state
      setUser(null);
      
      // Show success message
      toast.success('Logged out successfully');
      
      // Navigate to login page
      navigate('/login');
    } catch (error) {
      // This should rarely happen with our improved authService.logout
      console.error('[AuthContext] ❌ Logout encountered an unexpected error:', error);
      
      // Still clear the token and navigate to login for a consistent experience
      tokenManager.removeToken();
      setUser(null);
      toast.success('Logged out successfully');
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    setIsLoading(true);
    try {
      const loadingToast = toast.loading('Creating your account...');
      
      if (import.meta.env.DEV) {
        console.log('[AuthContext] Registering new user with email:', email);
      }
      
      const response = await authService.register({ email, password, firstName, lastName });
      
      if (response && response.token) {
        // Store token in localStorage
        tokenManager.setToken(response.token);
        
        // Update user state
        setUser(response.user);
        
        toast.dismiss(loadingToast);
        toast.success('Account created successfully');
        
        navigate('/dashboard');
      } else {
        throw new Error('Invalid registration response');
      }
    } catch (error) {
      console.error('[AuthContext] ❌ Registration failed:', error);
      
      // Show appropriate error message
      let errorMessage = 'Registration failed';
      
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.status === 409) {
          errorMessage = 'An account with this email already exists.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        register
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to access the auth context
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 