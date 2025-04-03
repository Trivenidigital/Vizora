import axios from 'axios';
import toast from 'react-hot-toast';

// Get API base URL from environment variable (with proper TypeScript declaration)
declare interface ImportMeta {
  env: Record<string, string>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';
const AUTH_TOKEN_KEY = 'token'; // Changed to match the token key used in AuthContext

console.log('API Service initialized with URL:', API_BASE_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Remove withCredentials to avoid CORS preflight issues
  withCredentials: false,
});

// Add request interceptor with debug logging
api.interceptors.request.use(
  (config) => {
    // Get auth token from local storage if available
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    // Also check for isAuthenticated flag
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    
    // Log request details for debugging
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      headers: config.headers,
      withCredentials: config.withCredentials,
      token: token ? 'Present' : 'Not found',
      isAuthenticated
    });
    
    // Add token to headers if it exists
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Authorization header added');
    } else if (isAuthenticated) {
      // If we don't have a token but we have isAuthenticated flag, add a mock token
      config.headers.Authorization = `Bearer mock-token-for-development`;
      console.log('Mock authorization header added');
    } else {
      console.warn('No authentication found in localStorage');
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response (${response.status}):`, {
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    // Handle global error cases
    const message = error.response?.data?.message || 'Something went wrong';
    console.error('API Response Error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: message,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      // Clear auth on auth error
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
      
      // Don't show toast for auth errors - they will be handled by the auth store
      return Promise.reject(error);
    }
    
    if (error.response?.status === 403) {
      // Forbidden
      toast.error('You do not have permission to perform this action');
      return Promise.reject(error);
    }
    
    if (error.response?.status === 422) {
      // Validation error - handle in form
      return Promise.reject(error);
    }
    
    if (error.response?.status === 500) {
      // Server error
      toast.error('Server error. Please try again later.');
      return Promise.reject(error);
    }
    
    if (error.message === 'Network Error') {
      toast.error('Network error. Please check your connection.');
      return Promise.reject(error);
    }
    
    toast.error(message);
    return Promise.reject(error);
  }
);

export default api; 