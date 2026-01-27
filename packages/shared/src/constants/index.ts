/**
 * Common constants for Vizora digital signage system
 */

export const PAIRING_CODE_EXPIRY_MINUTES = 15;
export const PAIRING_CODE_LENGTH = 6;
export const DEFAULT_CONTENT_DURATION = 10; // seconds
export const MAX_SCHEDULE_ITEMS = 100;
export const DISPLAY_HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const DISPLAY_OFFLINE_THRESHOLD = 60000; // 1 minute

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
  },
  USERS: '/users',
  DISPLAYS: '/displays',
  CONTENT: '/content',
  SCHEDULES: '/schedules',
  PAIRINGS: '/pairings',
} as const;

export const WS_EVENTS = {
  DISPLAY_CONNECTED: 'display:connected',
  DISPLAY_DISCONNECTED: 'display:disconnected',
  SCHEDULE_UPDATED: 'schedule:updated',
  CONTENT_UPDATED: 'content:updated',
  PAIRING_REQUESTED: 'pairing:requested',
  PAIRING_CONFIRMED: 'pairing:confirmed',
} as const;
