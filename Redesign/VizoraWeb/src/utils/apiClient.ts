import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { getAuthToken } from '@/utils/auth';

// Get base URL from environment variables - should be http://localhost:3003/api
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

// Simple normalize function - just ensures no trailing slash
const normalizeBaseUrl = (url: string): string => {
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const baseUrl = normalizeBaseUrl(apiUrl);

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: baseUrl,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Check if browser supports cookies
const areCookiesEnabled = (): boolean => {
  try {
    document.cookie = 'testcookie=1; SameSite=Lax; path=/';
    const result = document.cookie.indexOf('testcookie=') !== -1;
    document.cookie = 'testcookie=1; SameSite=Lax; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    return result;
  } catch (e) {
    console.error('Could not check cookies:', e);
    return false;
  }
};

// Debug cookie information
if (import.meta.env.DEV) {
  console.log(`🍪 Cookies enabled in browser: ${areCookiesEnabled()}`);
  try {
    const cookies = document.cookie ? document.cookie.split(';').map(c => c.trim()) : [];
    console.log(`🍪 Current cookies: ${cookies.length ? cookies.join(', ') : 'None'}`);
  } catch (e) {
    console.error('Error reading cookies:', e);
  }
}

// Log only once at initialization
console.log(`🌐 API Client initialized with baseURL: ${apiClient.defaults.baseURL}`);
console.log(`🍪 withCredentials set to: ${apiClient.defaults.withCredentials}`);

// Debug log for authentication
console.log('🔐 Authentication baseURL:', baseUrl + '/auth/login');

// Request interceptor to add auth token to headers
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Ensure withCredentials is set for every request
    config.withCredentials = true;
    
    // Try to read cookies for debugging
    if (import.meta.env.DEV && typeof document !== 'undefined') {
      try {
        const cookies = document.cookie ? document.cookie.split(';').map(c => c.trim()) : [];
        const tokenCookie = cookies.find(c => c.startsWith('token='));
        if (tokenCookie) {
          console.log(`🍪 Found token cookie for request to: ${config.url}`);
        } else if (cookies.length > 0) {
          console.log(`🍪 No token cookie found, but other cookies exist: ${cookies.length}`);
        } else {
          console.log(`🍪 No cookies found when requesting: ${config.url}`);
        }
      } catch (e) {
        console.error('Error reading cookies during request:', e);
      }
    }
    
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Only log in development
    if (import.meta.env.DEV) {
      console.log(`🔄 Request: ${config.method?.toUpperCase()} ${config.baseURL}/${config.url}`, {
        withCredentials: config.withCredentials,
        hasAuthHeader: !!token
      });
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with minimal logging
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Check for Set-Cookie headers for debugging
    if (import.meta.env.DEV) {
      const hasCookieHeader = response.headers['set-cookie'] || 
                             (typeof response.headers.get === 'function' && response.headers.get('set-cookie'));
      
      console.log(`✅ Response [${response.status}]`, {
        url: response.config.url,
        contentType: response.headers['content-type'],
        hasCookieHeader: !!hasCookieHeader
      });
      
      // If there's a Set-Cookie header, log a reminder about cross-origin cookies
      if (hasCookieHeader) {
        console.log(`🍪 Server tried to set a cookie. For this to work in the browser:`);
        console.log(`   1. Server must use credentials: true in CORS config`);
        console.log(`   2. Server cookies must have SameSite=Lax or None`);
        console.log(`   3. If SameSite=None, Secure must also be true (except in localhost)`);
      }
      
      // Check if any cookies were actually set
      setTimeout(() => {
        try {
          const cookies = document.cookie ? document.cookie.split(';').map(c => c.trim()) : [];
          console.log(`🍪 After response, cookies: ${cookies.length ? cookies.join(', ') : 'None'}`);
        } catch (e) {
          console.error('Error reading cookies after response:', e);
        }
      }, 100);
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, config } = error.response;
      const url = config?.url || 'unknown';
      
      // Log authentication failures more verbosely
      if (status === 401) {
        console.error(`🔒 Authentication failure [401]: ${config?.method?.toUpperCase() || ''} ${url}`, {
          withCredentials: config?.withCredentials,
          hasAuthHeader: !!config?.headers?.Authorization,
          token: getAuthToken() ? 'Present' : 'Missing'
        });
        
        // Check cookies for debugging authentication issues
        if (typeof document !== 'undefined') {
          try {
            const cookies = document.cookie ? document.cookie.split(';').map(c => c.trim()) : [];
            console.log(`🍪 Cookies during 401 error: ${cookies.length ? cookies.join(', ') : 'None'}`);
          } catch (e) {
            console.error('Error reading cookies during auth failure:', e);
          }
        }
      }
      // Cleaner error logging
      else if (status === 404) {
        console.error(`📭 Not Found: Endpoint '${url}' doesn't exist`);
      } else {
        console.error(`❌ API Error [${status}]: ${config?.method?.toUpperCase() || ''} ${url}`);
      }
    } else if (error.request) {
      console.error('📡 Network error: No response received');
    } else {
      console.error('⚠️ Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export { apiClient }; 