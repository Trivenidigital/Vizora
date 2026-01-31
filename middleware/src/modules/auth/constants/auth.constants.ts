/**
 * Authentication constants
 * Centralizes magic numbers and configuration values
 */
export const AUTH_CONSTANTS = {
  // Token expiry in seconds (7 days)
  TOKEN_EXPIRY_SECONDS: 7 * 24 * 60 * 60, // 604800

  // Token expiry in milliseconds (7 days)
  TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,

  // Cookie name for JWT token
  COOKIE_NAME: 'vizora_auth_token',

  // CSRF token header name
  CSRF_HEADER_NAME: 'x-csrf-token',

  // CSRF cookie name
  CSRF_COOKIE_NAME: 'vizora_csrf_token',

  // Minimum JWT secret length
  MIN_JWT_SECRET_LENGTH: 32,

  // Default bcrypt rounds (OWASP 2025+ recommendation)
  DEFAULT_BCRYPT_ROUNDS: 14,

  // Trial period in days
  TRIAL_PERIOD_DAYS: 7,

  // Default screen quota for free tier
  DEFAULT_SCREEN_QUOTA: 5,

  // Pairing code expiry in minutes
  PAIRING_CODE_EXPIRY_MINUTES: 15,

  // Device token expiry string
  DEVICE_TOKEN_EXPIRY: '30d',
} as const;

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

// Subscription status
export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
