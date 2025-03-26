// Authentication utilities

// Get the API URL from environment variables
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

// Local storage keys
const TOKEN_KEY = 'vizora-auth-token';
const USER_KEY = 'vizora-user';

/**
 * Store authentication data in local storage
 * @param token JWT token
 * @param user User data
 */
export const setAuth = (token: string, user: any) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Get the stored authentication token
 * @returns The JWT token or null if not authenticated
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Get the stored user data
 * @returns The user object or null if not authenticated
 */
export const getUser = (): any => {
  const userData = localStorage.getItem(USER_KEY);
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error parsing user data from localStorage', error);
      return null;
    }
  }
  return null;
};

/**
 * Check if user is authenticated
 * @returns true if authenticated, false otherwise
 */
export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};

/**
 * Clear authentication data (logout)
 */
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Fetch wrapper that includes authentication token
 * @param url API endpoint
 * @param options Fetch options
 * @returns Promise with fetch result
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getToken();
  
  // Clone the options to avoid mutating the original
  const fetchOptions = { ...options };
  
  // Set headers with auth token if available
  fetchOptions.headers = {
    ...fetchOptions.headers,
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  
  // Perform the fetch
  return fetch(url, fetchOptions);
};

/**
 * Login to the API
 * @param email User email
 * @param password User password
 * @returns Promise with login result
 */
export const login = async (email: string, password: string): Promise<{ success: boolean, user?: any, token?: string, error?: string }> => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      setAuth(data.token, data.user);
      return { success: true, user: data.user, token: data.token };
    } else {
      return { success: false, error: data.message || 'Login failed' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error or server unavailable' };
  }
};

/**
 * Register a new user
 * @param userData User registration data
 * @returns Promise with registration result
 */
export const register = async (userData: { email: string, password: string, name: string, company?: string }): Promise<{ success: boolean, user?: any, token?: string, error?: string }> => {
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      setAuth(data.token, data.user);
      return { success: true, user: data.user, token: data.token };
    } else {
      return { success: false, error: data.message || 'Registration failed' };
    }
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Network error or server unavailable' };
  }
}; 