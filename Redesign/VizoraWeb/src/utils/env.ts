/**
 * Environment variables utility to safely handle environment variable access
 * This prevents TypeScript errors when using import.meta.env
 */

// API URL to use for backend requests
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

// Whether to use mock data instead of real API calls
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true' || true;

// Whether to enable detailed logging
export const ENABLE_LOGGING = import.meta.env.VITE_ENABLE_LOGGING === 'true' || false;

// Whether to use Fake API for authentication (for development)
export const USE_FAKE_API = import.meta.env.VITE_USE_FAKE_API === 'true' || true;

// Log environment configuration on startup if logging is enabled
if (ENABLE_LOGGING) {
  console.log('Environment Configuration:', {
    API_URL,
    USE_MOCK_DATA,
    USE_FAKE_API,
  });
} 