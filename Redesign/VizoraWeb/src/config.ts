// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// Authentication Configuration
export const AUTH_TOKEN_KEY = 'vizora_auth_token';
export const AUTH_USER_KEY = 'vizora_user';
export const AUTH_REFRESH_TOKEN_KEY = 'vizora_refresh_token';

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