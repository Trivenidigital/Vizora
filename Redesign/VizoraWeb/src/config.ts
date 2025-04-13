/**
 * Application Configuration
 * 
 * This file centralizes all configuration variables from environment.
 * Always use this config object instead of accessing import.meta.env directly.
 * 
 * IMPORTANT ARCHITECTURE NOTE:
 * - The frontend NEVER connects directly to MongoDB Atlas
 * - All database access MUST go through VizoraMiddleware
 * - Data flow: VizoraWeb → VizoraMiddleware → MongoDB Atlas
 */

// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3003';

// Authentication
export const AUTH_TOKEN_KEY = import.meta.env.VITE_AUTH_TOKEN_KEY || 'token';
export const AUTH_USER_KEY = import.meta.env.VITE_AUTH_USER_KEY || 'vizora_user';
export const AUTH_EXPIRE_DAYS = Number(import.meta.env.VITE_AUTH_EXPIRE_DAYS || 7);

// Database (Documentation only - frontend doesn't connect directly)
export const DB_PROVIDER = import.meta.env.VITE_DB_PROVIDER || 'atlas';
export const IS_USING_ATLAS = DB_PROVIDER === 'atlas';

// Feature Flags
export const ENABLE_ANALYTICS = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
export const ENABLE_NOTIFICATIONS = import.meta.env.VITE_ENABLE_NOTIFICATIONS === 'true';

// Branding
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Vizora';
export const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'Vizora, Inc.';
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'support@vizora.com';

// Environment Detection
export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;

// Version
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Error Reporting
export const ENABLE_ERROR_REPORTING = IS_PRODUCTION;

// Display Configuration
export const DISPLAY_REFRESH_INTERVAL = 30000; // 30 seconds
export const DISPLAY_OFFLINE_THRESHOLD = 300000; // 5 minutes

// Content Configuration
export const CONTENT_TYPES = ['image', 'video', 'text', 'html'] as const;
export const CONTENT_STATUS = ['draft', 'published', 'archived'] as const;
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
};

// Analytics Configuration
export const ANALYTICS_REFRESH_INTERVAL = 60000; // 1 minute
export const ANALYTICS_RETENTION_DAYS = 30;

// Socket Configuration
export const SOCKET_RECONNECTION_ATTEMPTS = 5;
export const SOCKET_RECONNECTION_DELAY = 1000;

// UI Configuration
export const TOAST_DURATION = 5000;
export const ITEMS_PER_PAGE = 10;
export const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Feature Flags
export const FEATURES = {
  ANALYTICS: true,
  CONTENT_SCHEDULING: true,
  DISPLAY_GROUPS: true,
  USER_MANAGEMENT: true,
  AUDIT_LOGS: true,
  API_ACCESS: true,
  BACKUP_RESTORE: true,
  SYSTEM_HEALTH: true,
} as const;

// Default export for convenience
export default {
  api: {
    url: API_URL,
    baseUrl: API_BASE_URL,
    socketUrl: SOCKET_URL,
  },
  auth: {
    tokenKey: AUTH_TOKEN_KEY,
    userKey: AUTH_USER_KEY,
    expireDays: AUTH_EXPIRE_DAYS,
  },
  db: {
    provider: DB_PROVIDER,
    isUsingAtlas: IS_USING_ATLAS,
  },
  features: {
    enableAnalytics: ENABLE_ANALYTICS,
    enableNotifications: ENABLE_NOTIFICATIONS,
  },
  branding: {
    appName: APP_NAME,
    companyName: COMPANY_NAME,
    contactEmail: CONTACT_EMAIL,
  },
  environment: {
    isProduction: IS_PRODUCTION,
    isDevelopment: IS_DEVELOPMENT,
  },
  version: APP_VERSION,
  enableErrorReporting: ENABLE_ERROR_REPORTING,
}; 