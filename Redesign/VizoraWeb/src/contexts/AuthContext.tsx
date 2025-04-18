import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// Define the shape of the user object (adjust as needed based on your API)
interface User {
  id: string;
  email: string;
  // Removed firstName, lastName - replace with businessName if applicable
  businessName?: string; 
  // Add other relevant user fields: role, etc.
}

// Define the shape of the context
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: () => Promise<boolean>; // Mock login for now
  logout: () => void;
  // Update signup function signature to accept new data shape
  signup: (data: SignUpData) => Promise<{ success: boolean; message?: string }>; 
}

// Define the updated shape of the signup data for businesses
interface SignUpData {
  businessName: string; // Renamed from company, made required
  email: string;
  password: string;
  // Removed firstName, lastName
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        console.log('✅ Auth token found, setting authenticated');
        setIsAuthenticated(true);
        // Mock User - adjust if needed for business context
        setUser({ id: '1', email: 'business@example.com', businessName: 'Test Business' }); 
      } else {
        console.log('🛑 No auth token found');
        setIsAuthenticated(false);
        setUser(null);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // Mock Login Function
  const login = async (): Promise<boolean> => {
    setLoading(true);
    console.log('🔌 Attempting mock login...');
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockToken = 'mock-auth-token-' + Date.now();
    localStorage.setItem('authToken', mockToken);
    setIsAuthenticated(true);
    // Update mock user if needed
    setUser({ id: '1', email: 'business@example.com', businessName: 'Test Business' }); 
    setLoading(false);
    console.log('✅ Mock login successful');
    return true;
  };

  // Logout Function
  const logout = () => {
    setLoading(true);
    console.log('🔌 Logging out...');
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setUser(null);
    setLoading(false);
    toast.success('Logged out successfully');
    console.log('✅ Logged out');
    // Navigate to login or home page might happen here or in the component calling logout
  };

  // Signup Function
  const signup = async (data: SignUpData): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    console.log('🔌 Attempting business signup...', data);
    const apiUrl = import.meta.env.VITE_API_URL || '/api';

    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data), // Sends { businessName, email, password }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Signup successful:', result);
        setLoading(false);
        return { success: true };
      } else {
        console.error('❌ Signup failed:', result);
        setLoading(false);
        return { success: false, message: result.message || 'Signup failed' };
      }
    } catch (error) {
      console.error('❌ Signup network/fetch error:', error);
      setLoading(false);
      return { success: false, message: 'Network error during signup. Please try again.' };
    }
  };

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    signup,
  }), [isAuthenticated, user, loading]); // Removed login, logout, signup from deps as they are stable

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 