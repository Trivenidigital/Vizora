// Base API Client for Vizora Middleware
// Uses httpOnly cookies for secure JWT token storage

import { devLog, devWarn } from '../logger';

// Use relative URL '/api' so requests go through the Next.js rewrite proxy,
// keeping cookies same-origin. Only fall back to absolute URL for SSR or
// when explicitly configured (e.g., in production with a separate API domain).
export const API_BASE_URL =
  typeof window !== 'undefined'
    ? '/api/v1'  // Client-side: proxy through Next.js rewrite (same-origin cookies)
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1');

// Warn if NEXT_PUBLIC_API_URL is not set in production (SSR requests need an absolute URL)
if (
  typeof window === 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  console.warn(
    '[Vizora] WARNING: NEXT_PUBLIC_API_URL is not set in production. ' +
    'SSR requests will fall back to http://localhost:3000/api/v1. ' +
    'Set NEXT_PUBLIC_API_URL to your middleware API URL for production.',
  );
}

// Type definitions for API responses
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
  organizationId: string;
  organization?: {
    name: string;
    subscriptionTier: string;
    country?: string;
    settings?: Record<string, any>;
    storageUsedBytes?: number;
    storageQuotaBytes?: number;
  };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  screenQuota: number;
  trialEndsAt: string;
  country?: string;
  gstin?: string;
  settings?: Record<string, any>;
}

export interface LoginResponse {
  user: AuthUser;
  expiresIn: number;
}

export interface RegisterResponse {
  user: AuthUser;
  organization: Organization;
  expiresIn: number;
}

export interface ScheduleData {
  name: string;
  playlistId: string;
  displayId?: string;
  displayGroupId?: string;
  startDate: string;
  endDate?: string;
  startTime?: string | number;
  endTime?: string | number;
  daysOfWeek: number[];  // 0-6 (Sunday-Saturday)
  priority?: number;
  isActive?: boolean;
  description?: string;
}

// CSRF cookie name (must match backend)
const CSRF_COOKIE_NAME = 'vizora_csrf_token';

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

export class ApiClient {
  baseUrl: string;
  isAuthenticated = false;
  private csrfInitialized = false;
  private csrfInitPromise: Promise<void> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Ensure a CSRF token cookie is available before making mutating requests.
   * Makes a lightweight GET to the health endpoint to receive the CSRF cookie.
   * Only runs once; subsequent calls resolve immediately.
   */
  private async ensureCsrfToken(): Promise<void> {
    if (this.csrfInitialized || typeof window === 'undefined') return;
    if (getCsrfToken()) {
      this.csrfInitialized = true;
      return;
    }
    if (!this.csrfInitPromise) {
      const healthUrl = typeof window !== 'undefined' ? '/api/v1/health' : `${this.baseUrl}/health`;
      this.csrfInitPromise = fetch(healthUrl, {
        method: 'GET',
        credentials: 'include',
      })
        .then(() => {
          this.csrfInitialized = true;
        })
        .catch(() => {
          // Non-fatal: CSRF cookie may already be set by other means
          this.csrfInitPromise = null;
        });
    }
    await this.csrfInitPromise;
  }

  /**
   * Mark client as authenticated after successful login/register
   * Token is stored in httpOnly cookie by the server
   */
  setAuthenticated(authenticated: boolean): void {
    this.isAuthenticated = authenticated;
  }

  /**
   * Clear authentication state and call logout endpoint
   */
  async clearAuthentication(): Promise<void> {
    this.isAuthenticated = false;
    // Call logout to clear httpOnly cookie server-side
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': getCsrfToken() || '',
        },
      });
    } catch {
      // Ignore errors during logout
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 3
  ): Promise<T> {
    // Ensure CSRF token is available before mutating requests
    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      await this.ensureCsrfToken();
    }

    // Include CSRF token for state-changing requests
    const csrfToken = getCsrfToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...options.headers,
    };

    if (process.env.NODE_ENV === 'development') {
      devLog(`[API] Request: ${options.method || 'GET'} ${this.baseUrl}${endpoint}`);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutMs = 30000; // 30s timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // Always include cookies for httpOnly auth
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (process.env.NODE_ENV === 'development') {
        devLog(`[API] Response status: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[API] Request failed with status ${response.status}`);
        }
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          this.isAuthenticated = false;
          if (typeof window !== 'undefined') {
            // Only redirect from protected routes (dashboard, admin), not public pages
            const currentPath = window.location.pathname;
            if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin')) {
              window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
            }
          }
        }

        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (process.env.NODE_ENV === 'development') {
        devLog('[API] Response received');
      }
      // Auto-unwrap response envelope { success, data } from middleware
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        return data.data as T;
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        if (retries > 0 && (options.method === 'GET' || !options.method)) {
          if (process.env.NODE_ENV === 'development') {
            devWarn(`[API] Request timeout, retrying... (${retries} attempts left)`);
          }
          return this.request<T>(endpoint, options, retries - 1);
        }
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  /**
   * Send a request with FormData (for file uploads).
   * Does NOT set Content-Type — the browser sets it with the boundary.
   */
  async requestFormData<T>(
    endpoint: string,
    formData: FormData,
    method = 'POST',
  ): Promise<T> {
    await this.ensureCsrfToken();

    const csrfToken = getCsrfToken();
    const headers: HeadersInit = {
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    };

    const controller = new AbortController();
    const timeoutMs = 60000; // 60s for file uploads
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: formData,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.isAuthenticated = false;
        }
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        return data.data as T;
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Upload timeout');
      }
      throw error;
    }
  }

  // Generic HTTP methods
  async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async get<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}
