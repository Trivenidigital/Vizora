// Base API Client for Vizora Middleware
// Uses httpOnly cookies for secure JWT token storage

import { devLog, devWarn } from '../logger';
import { ApiError } from '../error-handler';

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
  isSuperAdmin?: boolean;
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
  displayId?: string | null;
  displayGroupId?: string | null;
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

function getUserMessageForStatus(statusCode: number, errorMessage: string): string {
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to access this resource.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return errorMessage;
    case 422:
      return 'Please check your input and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'A server error occurred. Please try again later.';
    case 502:
    case 503:
      return 'The service is temporarily unavailable. Please try again later.';
    default:
      return errorMessage;
  }
}

async function buildApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
  const errorData = await response.json().catch(() => ({ message: fallbackMessage }));
  const message = Array.isArray(errorData?.message)
    ? errorData.message.join(', ')
    : errorData?.message || `HTTP ${response.status}`;
  return new ApiError(
    response.status,
    message,
    getUserMessageForStatus(response.status, message),
  );
}

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

  /**
   * Shared in-flight `/auth/refresh` promise. A burst of concurrent 401s (N
   * parallel dashboard requests all hitting an expired access token) must
   * trigger exactly ONE refresh — the refresh token rotates on use, so N
   * parallel refreshes would revoke each other and log the user out. All
   * waiters await this single promise, then replay their own request.
   */
  private refreshInFlight: Promise<boolean> | null = null;

  /**
   * Endpoints where a 401 is a genuine credential/session outcome rather than a
   * "token expired — go refresh" signal. Auto-refresh is skipped for these to
   * (a) avoid an infinite loop on the refresh call itself and (b) let real
   * bad-login / registration errors surface to the caller unchanged.
   */
  private static readonly REFRESH_EXEMPT_PREFIXES = [
    '/auth/refresh',
    '/auth/login',
    '/auth/register',
    '/auth/google',
    '/auth/logout',
  ];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private isRefreshExempt(endpoint: string): boolean {
    return ApiClient.REFRESH_EXEMPT_PREFIXES.some((prefix) => endpoint.startsWith(prefix));
  }

  /**
   * Clear auth state and, from a protected route, bounce to login. Called when
   * a 401 could not be recovered by a refresh (session genuinely expired).
   */
  private handleAuthExpired(): void {
    this.isAuthenticated = false;
    if (typeof window !== 'undefined') {
      // Only redirect from protected routes (dashboard, admin), not public pages.
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin')) {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
  }

  /**
   * Redeem the httpOnly refresh cookie for a fresh access token, at most once
   * concurrently (see `refreshInFlight`). Resolves true on success, false if the
   * refresh token is missing/expired/revoked/reused.
   */
  private async refreshAuth(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async performRefresh(): Promise<boolean> {
    try {
      // allowRefresh=false: a 401 from /auth/refresh must NOT trigger another
      // refresh (it's also on the exempt list, so this is belt-and-suspenders).
      await this.request<{ expiresIn: number }>('/auth/refresh', { method: 'POST' }, 0, false);
      this.isAuthenticated = true;
      return true;
    } catch {
      return false;
    }
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
    retries = 3,
    allowRefresh = true
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
        // Handle expired/invalid sessions. A 403 is a permission boundary,
        // not proof that the user's auth cookie is invalid.
        if (response.status === 401) {
          // Access tokens are short-lived (PR-17b). On the FIRST 401 for a
          // normal API call, silently redeem the rotating refresh cookie and
          // replay the original request exactly ONCE. `allowRefresh` is false on
          // the replay and on the refresh/login calls themselves, so a session
          // that's genuinely gone can't loop.
          if (allowRefresh && typeof window !== 'undefined' && !this.isRefreshExempt(endpoint)) {
            const refreshed = await this.refreshAuth();
            if (refreshed) {
              return this.request<T>(endpoint, options, retries, false);
            }
          }
          // Refresh not possible or it failed — the session is really expired.
          this.handleAuthExpired();
        }

        throw await buildApiError(response, 'Request failed');
      }

      // 204 No Content (e.g. DELETE endpoints with @HttpCode(204)) and 205
      // carry no body — calling response.json() would throw on the empty
      // stream. Return undefined for these successful-but-bodyless responses.
      if (response.status === 204 || response.status === 205) {
        return undefined as T;
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
          return this.request<T>(endpoint, options, retries - 1, allowRefresh);
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
    allowRefresh = true,
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
        if (response.status === 401) {
          // Same short-TTL auto-refresh + single replay as request(); the shared
          // single-flight means an upload's 401 reuses any in-flight refresh.
          if (allowRefresh && typeof window !== 'undefined' && !this.isRefreshExempt(endpoint)) {
            const refreshed = await this.refreshAuth();
            if (refreshed) {
              return this.requestFormData<T>(endpoint, formData, method, false);
            }
          }
          this.handleAuthExpired();
        }
        throw await buildApiError(response, 'Upload failed');
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
