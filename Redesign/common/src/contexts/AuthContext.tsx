import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of our authentication state
interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  userRole: string | null;
  userName: string | null;
}

// Define the shape of our auth context
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: () => boolean;
}

// Placeholder auth service functions
const mockLogin = async (_email: string, _password: string) => {
  // Simple mock authentication for development
  // In a real app, this would call an API
  return {
    user: {
      id: '1',
      name: 'Test User',
      role: 'admin',
      avatar: 'https://example.com/avatar.jpg',
    },
    token: 'mock-token',
  };
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    token: null,
    userRole: null,
    userName: null
  });

  // Login function
  const login = async (email: string, password: string) => {
    try {
      // Call the auth service to perform the login
      const userData = await mockLogin(email, password);
      
      // Update state with the authentication data
      setAuthState({
        isAuthenticated: true,
        userId: userData.user.id,
        token: userData.token,
        userRole: userData.user.role,
        userName: userData.user.name
      });
      
      // Store token in localStorage for persistence
      localStorage.setItem('auth-token', userData.token);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    // Clear authentication state
    setAuthState({
      isAuthenticated: false,
      userId: null,
      token: null,
      userRole: null,
      userName: null
    });
    
    // Remove token from localStorage
    localStorage.removeItem('auth-token');
  };

  // Utility function to check if user is admin
  const isAdmin = () => {
    return authState.userRole === 'admin';
  };

  // Create the context value with state and functions
  const context: AuthContextType = {
    ...authState,
    login,
    logout,
    isAdmin
  };

  return (
    <AuthContext.Provider value={context}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 