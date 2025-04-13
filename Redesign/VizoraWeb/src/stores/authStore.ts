import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { TokenManager } from '@vizora/common';

// Get API base URL for logging
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

// Define user type
type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

// Define auth store state
type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<boolean>;
  checkAuth: () => Promise<boolean>;
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        token: null,

        // Login function
        login: async (email: string, password: string) => {
          set({ isLoading: true });
          try {
            console.log('Attempting login with email:', email);
            console.log('API URL being used:', API_BASE_URL);
            console.log('Current window location:', window.location.href);
            
            // Make API call with fetch to see raw response
            try {
              const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Origin': window.location.origin
                },
                body: JSON.stringify({ email, password })
              });
              
              console.log('Raw fetch response status:', response.status);
              const responseBody = await response.text();
              console.log('Raw fetch response body:', responseBody);
              
              // Try to parse the JSON
              try {
                const data = JSON.parse(responseBody);
                console.log('Parsed response data:', data);
                
                if (data.success && data.token) {
                  // Store token in localStorage for API requests
                  // localStorage.setItem('token', data.token);
                  TokenManager.setToken(data.token);
                  console.log('Token stored in localStorage');
                  
                  set({
                    user: data.user,
                    token: data.token,
                    isAuthenticated: true,
                    isLoading: false
                  });
                  
                  toast.success('Login successful');
                  return true;
                }
              } catch (e) {
                console.error('Error parsing response as JSON:', e);
              }
            } catch (fetchError) {
              console.error('Fetch error:', fetchError);
            }
            
            // Fall back to axios
            const response = await api.post('/auth/login', { 
              email, 
              password 
            });
            
            console.log('Login response from axios:', response.data);
            
            if (response.data && response.data.token) {
              const { token, user } = response.data;
              
              // Store token in localStorage for API requests
              // localStorage.setItem('token', token);
              TokenManager.setToken(token);
              console.log('Token stored in localStorage');
              
              set({
                user,
                token,
                isAuthenticated: true,
                isLoading: false
              });
              
              toast.success('Login successful');
              return true;
            }
            
            console.log('Login response missing token:', response.data);
            set({ isLoading: false });
            return false;
          } catch (error: any) {
            console.error('Login error:', error);
            
            if (error.response) {
              console.log('Error response:', error.response.data);
              console.log('Error status:', error.response.status);
              console.log('Error headers:', error.response.headers);
            } else if (error.request) {
              console.log('Error request:', error.request);
            } else {
              console.log('Error message:', error.message);
            }
            
            set({ isLoading: false });
            
            if (error.response?.status === 401) {
              toast.error('Invalid email or password');
            } else {
              toast.error(`Login failed: ${error.message || 'Unknown error'}`);
            }
            
            return false;
          }
        },
        
        // Logout function
        logout: () => {
          // Remove token from localStorage
          // localStorage.removeItem('token');
          
          set({
            user: null,
            token: null,
            isAuthenticated: false
          });
          
          toast.success('Logged out successfully');
        },
        
        // Register function
        register: async (userData) => {
          set({ isLoading: true });
          try {
            const response = await api.post('/auth/register', userData);
            
            if (response.data && response.data.success) {
              // Extract the token and user data from registration response
              const { token, user } = response.data;
              
              if (token) {
                // Automatically log in the user by storing the token and user data
                // localStorage.setItem('token', token);
                TokenManager.setToken(token);
                
                set({
                  user: user,
                  token: token,
                  isAuthenticated: true,
                  isLoading: false
                });
                
                toast.success('Registration successful! You are now logged in.');
                return true;
              } else {
                // If token is not provided, still count registration as successful
                set({ isLoading: false });
                toast.success('Registration successful! Please log in.');
                return true;
              }
            }
            
            set({ isLoading: false });
            return false;
          } catch (error) {
            console.error('Registration error:', error);
            set({ isLoading: false });
            
            if (error.response?.data?.message) {
              toast.error(error.response.data.message);
            } else {
              toast.error('Registration failed. Please try again.');
            }
            
            return false;
          }
        },
        
        // Check if user is authenticated by validating token
        checkAuth: async () => {
          set({ isLoading: true });
          
          // const token = localStorage.getItem('token');
          const token = TokenManager.getToken();
          
          if (!token) {
            set({ 
              user: null, 
              token: null,
              isAuthenticated: false, 
              isLoading: false 
            });
            return false;
          }
          
          try {
            // Call the /me endpoint to validate token and get user info
            const response = await api.get('/auth/me');
            
            if (response.data && response.data.data) {
              set({
                user: response.data.data,
                token,
                isAuthenticated: true,
                isLoading: false
              });
              return true;
            }
            
            // If response isn't valid, clear auth state
            // localStorage.removeItem('token');
            
            set({ 
              user: null, 
              token: null,
              isAuthenticated: false, 
              isLoading: false 
            });
            return false;
          } catch (error) {
            console.error('Auth check error:', error);
            
            // Clear token on auth error
            // localStorage.removeItem('token');
            
            set({ 
              user: null, 
              token: null,
              isAuthenticated: false, 
              isLoading: false 
            });
            return false;
          }
        }
      }),
      {
        name: 'vizora-auth-storage',
        partialize: (state) => ({ 
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated 
        })
      }
    )
  )
); 