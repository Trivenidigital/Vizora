import { TokenManager, parseJwt } from '@vizora/common';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';

/**
 * Vizora Authentication Service
 * 
 * ARCHITECTURE NOTE:
 * All authentication MUST go through VizoraMiddleware, which connects to MongoDB Atlas.
 * The frontend should NEVER attempt to connect directly to MongoDB.
 * 
 * Data flow: VizoraWeb → VizoraMiddleware → MongoDB Atlas
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  token: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// For testing without API
const FALLBACK_USERS = [
  {
    id: '1',
    email: 'admin@vizora.ai',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  {
    id: '2',
    email: 'user@vizora.ai',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
  },
];

// For testing without API, set to current time + 1 day
const TEST_JWT_SECRET = 'vizora-test-jwt-secret';

// Create token manager instance
const tokenManager = new TokenManager(
  {
    storageKey: 'auth_token',
    autoRefresh: true,
    validateOnLoad: true,
  },
  {
    url: '/api/auth/refresh',
    method: 'POST',
    credentials: 'include',
  },
  'AuthService'
);

// Initialize authentication state from token
const initialToken = tokenManager.loadToken();
let currentUser = initialToken ? getUserFromToken(initialToken) : null;

// Export token manager for other services
export { tokenManager };

/**
 * Authentication service for user login, logout, and token management
 */
class AuthService {
  constructor() {
    // Debug log in development to verify authentication service configuration
    if (import.meta.env.DEV) {
      console.log('[AuthService] Initialized');
    }
  }

  /**
   * Login user with email and password
   * @param credentials User credentials
   * @returns Login response
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      if (import.meta.env.DEV) {
        console.log('[AuthService] Attempting login for:', credentials.email);
        console.log(`[AuthService] API Endpoint: ${apiClient.defaults.baseURL} (base URL)`);
        console.log(`[AuthService] Using endpoint: /auth/login (apiClient will handle the full path)`);
      }

      const response = await apiClient.post<AuthResponse>(`/auth/login`, credentials);
      
      const data = response.data;
      
      if (data.success && data.token) {
        // Store token
        tokenManager.setToken(data.token);
        
        // Update current user
        currentUser = data.user || getUserFromToken(data.token);
        
        if (import.meta.env.DEV) {
          console.log('[AuthService] ✅ Login successful:', data);
        }
        
        return data;
      }
      
      throw new Error(data.message || 'Login failed');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      
      if (axios.isAxiosError(error) && error.response) {
        const data = error.response.data as { message?: string, readyState?: number };
        
        // Handle database connection errors (503 status code)
        if (error.response.status === 503 && data.readyState !== undefined) {
          console.error('[AuthService] ❌ Database connection error during login:', data);
          throw new Error('Database is currently unavailable. Please try again in a few moments.');
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  async register({ email, password, firstName, lastName }: { 
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string 
  }): Promise<AuthResponse> {
    try {
      if (import.meta.env.DEV) {
        console.log('[AuthService] Attempting registration for:', email);
      }

      // Use /auth/register directly
      const response = await apiClient.post<AuthResponse>(`/auth/register`, {
        email,
        password,
        firstName,
        lastName
      });
      
      if (response.data && response.data.success && response.data.token) {
        // Store token in localStorage
        tokenManager.setToken(response.data.token);
        
        if (import.meta.env.DEV) {
          console.log('[AuthService] ✅ Registration successful:', response.data);
        }
        
        return response.data;
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const data = error.response.data as { message?: string };
        throw new Error(data.message || `Registration failed with status ${error.response.status}`);
      }
      throw new Error('Registration failed: Network or server error');
    }
  }

  /**
   * Logout user
   */
  logout(): void {
    // Clear token
    tokenManager.removeToken();
    
    // Clear current user
    currentUser = null;
    
    // Make API call to invalidate token on server (best effort)
    apiClient.post(`/auth/logout`).catch(() => {
      // Ignore error, client-side logout is still successful
    });
  }
  
  /**
   * Get current authentication token
   * @returns Current token or null if not logged in
   */
  getToken(): string | null {
    return tokenManager.getToken();
  }
  
  /**
   * Check if user is logged in
   * @returns Whether user is logged in
   */
  isLoggedIn(): boolean {
    return tokenManager.isValid();
  }
  
  /**
   * Get current user
   * @returns Current user or null if not logged in
   */
  getCurrentUser(): User | null {
    return currentUser;
  }
  
  /**
   * Check if current token is expired
   * @returns Whether token is expired
   */
  isTokenExpired(): boolean {
    return tokenManager.isExpired();
  }
  
  /**
   * Check if user has specified role
   * @param role Role to check
   * @returns Whether user has role
   */
  hasRole(role: string): boolean {
    return !!currentUser && currentUser.role === role;
  }
  
  /**
   * Check if user is admin
   * @returns Whether user is admin
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    try {
      // FIXED: Use /auth/profile directly
      const response = await apiClient.put<{ user: User }>(`/auth/profile`, data);
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.put(`/auth/password`, {
          currentPassword,
          newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await apiClient.post(`/auth/reset-password`, { email });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyResetToken(token: string): Promise<boolean> {
    try {
      const response = await apiClient.get(`/auth/verify-reset-token/${token}`);
      return response.data.success;
    } catch (error) {
      return false;
    }
  }

  async setNewPassword(token: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post(`/auth/set-new-password`, {
          token,
          newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    // Add more detailed error logging
    if (import.meta.env.DEV) {
    console.error('Auth service error:', error);
    }
    
    if (axios.isAxiosError(error) && error.response) {
      const message = error.response.data?.message || `Request failed with status ${error.response.status}`;
      
      if (error.response.status === 401) {
        localStorage.removeItem('token');
      }
      
      return new Error(message);
    }
    
    return error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Extract user information from JWT token
 * @param token JWT token
 * @returns User information
 */
function getUserFromToken(token: string): User | null {
  try {
    const decoded = parseJwt(token);
    if (!decoded || !decoded.sub) return null;
    
    return {
      id: decoded.sub,
      email: decoded.email || '',
      firstName: decoded.firstName || '',
      lastName: decoded.lastName || '',
      role: decoded.role || 'user',
    };
  } catch (error) {
    console.error('[AuthService] ❌ Error parsing token:', error);
    return null;
  }
}

/**
 * Hook to handle authentication redirects
 */
export function useAuth() {
  const navigate = useNavigate();
  const authService = new AuthService();
  
  const login = async (credentials: LoginCredentials) => {
    const result = await authService.login(credentials);
    
    if (result.success) {
      navigate('/dashboard');
    }
    
    return result;
  };
  
  const logout = () => {
    authService.logout();
    navigate('/login');
  };
  
  return {
    login,
    logout,
    isLoggedIn: authService.isLoggedIn(),
    currentUser: authService.getCurrentUser(),
    isAdmin: authService.isAdmin(),
  };
}

// Create and export singleton instance
const authService = new AuthService();
export { authService };
export default authService; 