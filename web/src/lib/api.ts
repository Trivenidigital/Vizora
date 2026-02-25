// API Client for Vizora Middleware
// Uses httpOnly cookies for secure JWT token storage

import type {
  Display, DisplayOrientation, Content, Playlist, PlaylistItem, Schedule,
  PaginatedResponse, ContentFolder, AppNotification, ApiKey, CreateApiKeyResponse,
  SubscriptionStatus, Plan, QuotaUsage, Invoice, CheckoutResponse, BillingPortalResponse,
  AdminPlan, Promotion, AdminOrganization, AdminUser, PlatformStats, SystemConfig,
  AdminAuditLog, SystemAnnouncement, IpBlocklistEntry,
  AnalyticsSummary, DeviceMetric, ContentPerformance, UsageTrend, DeviceDistribution,
  BandwidthUsage, PlaylistPerformance, AnalyticsExport,
  User, AuditLog, DisplayGroup,
  TemplateSearchResult, TemplateCategory, TemplateSummary, TemplateDetail, AIGenerateResponse,
  WidgetType, Widget, LayoutPreset, LayoutZone, Layout, ResolvedLayout, QrOverlayConfig,
  PlatformHealth,
} from './types';

// Use relative URL '/api' so requests go through the Next.js rewrite proxy,
// keeping cookies same-origin. Only fall back to absolute URL for SSR or
// when explicitly configured (e.g., in production with a separate API domain).
const API_BASE_URL =
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
interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organization?: {
    name: string;
    subscriptionTier: string;
    country?: string;
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  screenQuota: number;
  trialEndsAt: string;
  country?: string;
  gstin?: string;
}

interface LoginResponse {
  user: AuthUser;
  expiresIn: number;
}

interface RegisterResponse {
  user: AuthUser;
  organization: Organization;
  expiresIn: number;
}

interface ScheduleData {
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
function getCsrfToken(): string | null {
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

class ApiClient {
  private baseUrl: string;
  private isAuthenticated = false;
  private csrfInitialized = false;
  private csrfInitPromise: Promise<void> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
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

  private async request<T>(
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
      console.log(`[API] Request: ${options.method || 'GET'} ${this.baseUrl}${endpoint}`);
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
        console.log(`[API] Response status: ${response.status} ${response.statusText}`);
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
        console.log('[API] Response received');
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
            console.warn(`[API] Request timeout, retrying... (${retries} attempts left)`);
          }
          return this.request<T>(endpoint, options, retries - 1);
        }
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  // Auth - token is set as httpOnly cookie by server
  async login(email: string, password: string): Promise<LoginResponse> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Login called');
    }
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Mark as authenticated - token is in httpOnly cookie
    this.isAuthenticated = true;
    return response;
  }

  async register(
    email: string,
    password: string,
    organizationName: string,
    firstName: string,
    lastName: string
  ): Promise<RegisterResponse> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Register called');
    }
    const response = await this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        organizationName,
        firstName,
        lastName,
      }),
    });

    // Mark as authenticated - token is in httpOnly cookie
    this.isAuthenticated = true;
    return response;
  }

  async logout(): Promise<void> {
    await this.clearAuthentication();
  }

  async refreshToken(): Promise<{ expiresIn: number }> {
    return this.request<{ expiresIn: number }>('/auth/refresh', {
      method: 'POST',
    });
  }

  async getCurrentUser(): Promise<AuthUser> {
    const response = await this.request<{ user: AuthUser }>('/auth/me');
    return response.user;
  }

  async getOrganization(): Promise<Organization> {
    return this.request<Organization>('/organizations/current');
  }

  async updateOrganization(id: string, data: Partial<{ name: string; country: string; gstin: string }>): Promise<Organization> {
    return this.request<Organization>(`/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    return this.request<{ valid: boolean; email?: string }>(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  // Displays
  async getDisplays(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Display>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<Display>>(`/displays${query ? `?${query}` : ''}`);
  }

  async getDisplay(id: string): Promise<Display> {
    return this.request<Display>(`/displays/${id}`);
  }

  async createDisplay(data: { nickname: string; location?: string }): Promise<Display> {
    // Backend expects 'name' and 'deviceId', frontend uses 'nickname'
    const payload = {
      name: data.nickname,
      location: data.location,
      deviceId: `device-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
    return this.request<Display>('/displays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDisplay(
    id: string,
    data: Partial<{ nickname: string; location?: string; currentPlaylistId?: string | null; orientation?: DisplayOrientation }>
  ): Promise<Display> {
    const payload: Record<string, string | undefined | null> = {};
    if (data.nickname !== undefined) payload.name = data.nickname;
    if (data.location !== undefined) payload.location = data.location;
    if (data.currentPlaylistId !== undefined) payload.currentPlaylistId = data.currentPlaylistId;
    if (data.orientation !== undefined) payload.orientation = data.orientation;

    return this.request<Display>(`/displays/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteDisplay(id: string): Promise<void> {
    return this.request<void>(`/displays/${id}`, {
      method: 'DELETE',
    });
  }

  async generatePairingToken(id: string): Promise<{ pairingCode: string }> {
    return this.request<{ pairingCode: string }>(`/displays/${id}/pair`, {
      method: 'POST',
    });
  }

  async completePairing(data: { code: string; nickname: string; location?: string }): Promise<Display> {
    // Only send fields the backend DTO accepts (code, nickname)
    const { code, nickname } = data;
    return this.request<Display>('/devices/pairing/complete', {
      method: 'POST',
      body: JSON.stringify({ code, nickname }),
    });
  }

  // Content
  async getContent(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    templateOrientation?: 'landscape' | 'portrait' | 'both';
  }): Promise<PaginatedResponse<Content>> {
    const query = params ? new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) as Record<string, string>
    ).toString() : '';
    return this.request<PaginatedResponse<Content>>(`/content${query ? `?${query}` : ''}`);
  }

  async getContentItem(id: string): Promise<Content> {
    return this.request<Content>(`/content/${id}`);
  }

  async createContent(data: {
    title: string;
    type: string;
    url?: string;
    file?: File;
    metadata?: Record<string, unknown>;
  }): Promise<Content> {
    // If file is provided, use multipart upload endpoint
    if (data.file) {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('name', data.title);
      formData.append('type', data.type);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[API] Request: POST ${this.baseUrl}/content/upload (multipart/form-data)`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for uploads

      // Get CSRF token for the upload request
      const csrfToken = getCsrfToken();

      try {
        const response = await fetch(`${this.baseUrl}/content/upload`, {
          method: 'POST',
          body: formData,
          credentials: 'include', // Include httpOnly cookie
          signal: controller.signal,
          headers: {
            // Don't set Content-Type - browser will set it with boundary for FormData
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
          },
        });

        clearTimeout(timeoutId);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[API] Response status: ${response.status} ${response.statusText}`);
        }

        if (!response.ok) {
          // Log the actual error for debugging
          const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
          if (process.env.NODE_ENV === 'development') {
            console.error('[API] Upload error:', response.status, errorData);
          }

          if (response.status === 401 || response.status === 403) {
            // Don't immediately redirect on 403 - could be CSRF issue
            // Only redirect on 401 (truly unauthorized)
            if (response.status === 401) {
              this.isAuthenticated = false;
              if (typeof window !== 'undefined') {
                const currentPath = window.location.pathname;
                window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
              }
            }
          }
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        if (process.env.NODE_ENV === 'development') {
          console.log('[API] File upload successful');
        }
        // Unwrap response envelope { success, data: { content, fileHash } }
        const unwrapped = (result && typeof result === 'object' && 'success' in result && 'data' in result) ? result.data : result;
        return unwrapped.content || unwrapped;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Upload timeout');
        }
        throw error;
      }
    }

    // Otherwise use JSON endpoint (for URLs)
    const payload = {
      name: data.title,
      type: data.type === 'pdf' ? 'url' : data.type,
      url: data.url || '',
      metadata: data.metadata,
    };
    return this.request<Content>('/content', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateContent(
    id: string,
    data: Partial<{ title: string; metadata?: Record<string, unknown> }>
  ): Promise<Content> {
    return this.request<Content>(`/content/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteContent(id: string): Promise<void> {
    return this.request<void>(`/content/${id}`, {
      method: 'DELETE',
    });
  }

  async archiveContent(id: string): Promise<Content> {
    return this.request<Content>(`/content/${id}/archive`, {
      method: 'POST',
    });
  }

  /**
   * Get a download URL for content
   * For MinIO-stored content, returns a presigned URL with expiration
   * For local content, returns the direct URL
   */
  async getContentDownloadUrl(id: string, expirySeconds?: number): Promise<{ url: string; expiresIn: number }> {
    const query = expirySeconds ? `?expirySeconds=${expirySeconds}` : '';
    return this.request<{ url: string; expiresIn: number }>(`/content/${id}/download${query}`);
  }

  // Playlists
  async getPlaylists(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Playlist>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<Playlist>>(`/playlists${query ? `?${query}` : ''}`);
  }

  async getPlaylist(id: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}`);
  }

  async createPlaylist(data: {
    name: string;
    description?: string;
    items?: Array<{ contentId: string; duration?: number }>;
  }): Promise<Playlist> {
    return this.request<Playlist>('/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlaylist(
    id: string,
    data: Partial<{ name: string; description?: string }>
  ): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    return this.request<void>(`/playlists/${id}`, {
      method: 'DELETE',
    });
  }

  async duplicatePlaylist(id: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async addPlaylistItem(
    playlistId: string,
    contentId: string,
    duration?: number
  ): Promise<PlaylistItem> {
    return this.request<PlaylistItem>(`/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ contentId, duration }),
    });
  }

  async removePlaylistItem(playlistId: string, itemId: string): Promise<void> {
    return this.request<void>(`/playlists/${playlistId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async updatePlaylistItem(
    playlistId: string,
    itemId: string,
    data: { duration?: number }
  ): Promise<PlaylistItem> {
    return this.request<PlaylistItem>(`/playlists/${playlistId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Schedules
  async getSchedules(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Schedule>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<Schedule>>(`/schedules${query ? `?${query}` : ''}`);
  }

  async createSchedule(data: ScheduleData): Promise<Schedule> {
    return this.request<Schedule>('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSchedule(id: string, data: Partial<ScheduleData>): Promise<Schedule> {
    return this.request<Schedule>(`/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    return this.request<void>(`/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  async duplicateSchedule(id: string): Promise<Schedule> {
    return this.request<Schedule>(`/schedules/${id}/duplicate`, {
      method: 'POST',
    });
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

  // Analytics
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.request<AnalyticsSummary>('/analytics/summary');
  }

  async getDeviceMetrics(range: string = 'month'): Promise<DeviceMetric[]> {
    return this.request<DeviceMetric[]>(`/analytics/device-metrics?range=${range}`);
  }

  async getContentPerformance(range: string = 'month'): Promise<ContentPerformance[]> {
    return this.request<ContentPerformance[]>(`/analytics/content-performance?range=${range}`);
  }

  async getUsageTrends(range: string = 'month'): Promise<UsageTrend[]> {
    return this.request<UsageTrend[]>(`/analytics/usage-trends?range=${range}`);
  }

  async getDeviceDistribution(): Promise<DeviceDistribution[]> {
    return this.request<DeviceDistribution[]>('/analytics/device-distribution');
  }

  async getBandwidthUsage(range: string = 'month'): Promise<BandwidthUsage[]> {
    return this.request<BandwidthUsage[]>(`/analytics/bandwidth?range=${range}`);
  }

  async getPlaylistPerformance(range: string = 'month'): Promise<PlaylistPerformance[]> {
    return this.request<PlaylistPerformance[]>(`/analytics/playlist-performance?range=${range}`);
  }

  // Analytics Export
  async exportAnalytics(range: string = 'month'): Promise<AnalyticsExport> {
    return this.request<AnalyticsExport>(`/analytics/export?range=${range}`);
  }

  // Device Uptime Analytics
  async getDeviceUptime(
    deviceId: string,
    days?: number,
  ): Promise<{
    deviceId: string;
    uptimePercent: number;
    totalOnlineMinutes: number;
    totalOfflineMinutes: number;
    lastHeartbeat: string | null;
  }> {
    const params = days ? `?days=${days}` : '';
    return this.request<{
      deviceId: string;
      uptimePercent: number;
      totalOnlineMinutes: number;
      totalOfflineMinutes: number;
      lastHeartbeat: string | null;
    }>(`/analytics/device-uptime/${deviceId}${params}`);
  }

  async getUptimeSummary(days?: number): Promise<{
    avgUptimePercent: number;
    deviceCount: number;
    onlineCount: number;
    offlineCount: number;
    devices: Array<{ id: string; nickname: string; uptimePercent: number }>;
  }> {
    const params = days ? `?days=${days}` : '';
    return this.request<{
      avgUptimePercent: number;
      deviceCount: number;
      onlineCount: number;
      offlineCount: number;
      devices: Array<{ id: string; nickname: string; uptimePercent: number }>;
    }>(`/analytics/uptime-summary${params}`);
  }

  // Push content directly to display (temporary override)
  async pushContentToDisplay(
    displayId: string,
    contentId: string,
    duration: number = 30,
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/displays/${displayId}/push-content`,
      {
        method: 'POST',
        body: JSON.stringify({ contentId, duration }),
      },
    );
  }

  // Playlist reorder
  async reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<{ reordered: boolean }> {
    return this.request<{ reordered: boolean }>(`/playlists/${playlistId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    });
  }

  // Schedule conflict checking
  async checkScheduleConflicts(data: {
    displayId?: string;
    displayGroupId?: string;
    daysOfWeek: number[];
    startTime?: string;
    endTime?: string;
    excludeScheduleId?: string;
  }): Promise<{ hasConflicts: boolean; conflicts: any[] }> {
    return this.request<{ hasConflicts: boolean; conflicts: any[] }>('/schedules/check-conflicts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Display Groups
  async getDisplayGroups(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<DisplayGroup>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<DisplayGroup>>(`/display-groups${query ? `?${query}` : ''}`);
  }

  async getDisplayGroup(id: string): Promise<DisplayGroup> {
    return this.request<DisplayGroup>(`/display-groups/${id}`);
  }

  async createDisplayGroup(data: { name: string; description?: string }): Promise<DisplayGroup> {
    return this.request<DisplayGroup>('/display-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDisplayGroup(id: string, data: { name?: string; description?: string }): Promise<DisplayGroup> {
    return this.request<DisplayGroup>(`/display-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDisplayGroup(id: string): Promise<void> {
    return this.request<void>(`/display-groups/${id}`, {
      method: 'DELETE',
    });
  }

  async addDisplaysToGroup(groupId: string, displayIds: string[]): Promise<{ added: number }> {
    return this.request<{ added: number }>(`/display-groups/${groupId}/displays`, {
      method: 'POST',
      body: JSON.stringify({ displayIds }),
    });
  }

  async removeDisplaysFromGroup(groupId: string, displayIds: string[]): Promise<{ removed: number }> {
    return this.request<{ removed: number }>(`/display-groups/${groupId}/displays`, {
      method: 'DELETE',
      body: JSON.stringify({ displayIds }),
    });
  }

  // Users / Team Management
  async getUsers(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<User>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<User>>(`/users${query ? `?${query}` : ''}`);
  }

  async inviteUser(data: { email: string; firstName: string; lastName: string; role: string }): Promise<User & { tempPassword?: string }> {
    return this.request<User & { tempPassword?: string }>('/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: { firstName?: string; lastName?: string; role?: string; isActive?: boolean }): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deactivateUser(id: string): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Audit Logs
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<AuditLog>> {
    const query = params ? new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) as Record<string, string>
    ).toString() : '';
    return this.request<PaginatedResponse<AuditLog>>(`/audit-logs${query ? `?${query}` : ''}`);
  }

  // Bulk Display Operations
  async bulkDeleteDisplays(displayIds: string[]): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>('/displays/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ displayIds }),
    });
  }

  async bulkAssignPlaylist(displayIds: string[], playlistId: string): Promise<{ updated: number }> {
    return this.request<{ updated: number }>('/displays/bulk/assign-playlist', {
      method: 'POST',
      body: JSON.stringify({ displayIds, playlistId }),
    });
  }

  async bulkAssignGroup(displayIds: string[], displayGroupId: string): Promise<{ added: number }> {
    return this.request<{ added: number }>('/displays/bulk/assign-group', {
      method: 'POST',
      body: JSON.stringify({ displayIds, displayGroupId }),
    });
  }

  // Content Folders
  async getFolders(params?: { format?: 'flat' | 'tree' }): Promise<ContentFolder[]> {
    const query = params?.format ? `?format=${params.format}` : '';
    return this.request<ContentFolder[]>(`/folders${query}`);
  }

  async getFolder(id: string): Promise<ContentFolder> {
    return this.request<ContentFolder>(`/folders/${id}`);
  }

  async createFolder(data: { name: string; parentId?: string }): Promise<ContentFolder> {
    return this.request<ContentFolder>('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFolder(id: string, data: { name?: string; parentId?: string }): Promise<ContentFolder> {
    return this.request<ContentFolder>(`/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFolder(id: string): Promise<void> {
    return this.request<void>(`/folders/${id}`, {
      method: 'DELETE',
    });
  }

  async moveContentToFolder(folderId: string, contentIds: string[]): Promise<{ moved: number }> {
    return this.request<{ moved: number }>(`/folders/${folderId}/content`, {
      method: 'POST',
      body: JSON.stringify({ contentIds }),
    });
  }

  async getFolderContent(folderId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Content>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<Content>>(`/folders/${folderId}/content${query ? `?${query}` : ''}`);
  }

  // Notifications
  async getNotifications(params?: {
    read?: boolean;
    severity?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AppNotification>> {
    const queryParams: Record<string, string> = {};
    if (params?.read !== undefined) queryParams.read = String(params.read);
    if (params?.severity) queryParams.severity = params.severity;
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    const query = Object.keys(queryParams).length > 0
      ? `?${new URLSearchParams(queryParams).toString()}`
      : '';
    return this.request<PaginatedResponse<AppNotification>>(`/notifications${query}`);
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/notifications/unread-count');
  }

  async markNotificationAsRead(id: string): Promise<AppNotification> {
    return this.request<AppNotification>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    return this.request<void>('/notifications/read-all', {
      method: 'POST',
    });
  }

  async dismissNotification(id: string): Promise<void> {
    return this.request<void>(`/notifications/${id}/dismiss`, {
      method: 'PATCH',
    });
  }

  // Device Screenshots
  async requestDeviceScreenshot(displayId: string): Promise<{ requestId: string; status: string }> {
    return this.request<{ requestId: string; status: string }>(
      `/displays/${displayId}/screenshot`,
      {
        method: 'POST',
      },
    );
  }

  async getDeviceScreenshot(displayId: string): Promise<{ url: string; capturedAt: string; width?: number; height?: number } | null> {
    return this.request<{ url: string; capturedAt: string; width?: number; height?: number } | null>(
      `/displays/${displayId}/screenshot`,
    );
  }

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>('/api-keys');
  }

  async createApiKey(data: { name: string; scopes?: string[]; expiresAt?: string }): Promise<CreateApiKeyResponse> {
    return this.request<CreateApiKeyResponse>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  // Billing
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return this.request<SubscriptionStatus>('/billing/subscription');
  }

  async getPlans(country?: string): Promise<Plan[]> {
    const params = country ? `?country=${country}` : '';
    return this.request<Plan[]>(`/billing/plans${params}`);
  }

  async getQuotaUsage(): Promise<QuotaUsage> {
    return this.request<QuotaUsage>('/billing/quota');
  }

  async createCheckout(planId: string, interval: 'monthly' | 'yearly'): Promise<CheckoutResponse> {
    return this.request<CheckoutResponse>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, interval }),
    });
  }

  async cancelSubscription(immediately = false): Promise<void> {
    await this.request(`/billing/cancel?immediately=${immediately}`, {
      method: 'POST',
    });
  }

  async reactivateSubscription(): Promise<void> {
    await this.request('/billing/reactivate', { method: 'POST' });
  }

  async getBillingPortalUrl(returnUrl: string): Promise<BillingPortalResponse> {
    return this.request<BillingPortalResponse>(`/billing/portal?returnUrl=${encodeURIComponent(returnUrl)}`);
  }

  async getInvoices(limit?: number): Promise<Invoice[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request<Invoice[]>(`/billing/invoices${params}`);
  }

  // ========== Admin API Methods ==========

  // Admin - Plans
  async getAdminPlans(): Promise<AdminPlan[]> {
    return this.request<AdminPlan[]>('/admin/plans');
  }

  async createPlan(data: Partial<AdminPlan>): Promise<AdminPlan> {
    return this.request<AdminPlan>('/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlan(id: string, data: Partial<AdminPlan>): Promise<AdminPlan> {
    return this.request<AdminPlan>(`/admin/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePlan(id: string): Promise<void> {
    await this.request<void>(`/admin/plans/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Promotions
  async getAdminPromotions(): Promise<Promotion[]> {
    return this.request<Promotion[]>('/admin/promotions');
  }

  async createPromotion(data: Partial<Promotion>): Promise<Promotion> {
    return this.request<Promotion>('/admin/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePromotion(id: string, data: Partial<Promotion>): Promise<Promotion> {
    return this.request<Promotion>(`/admin/promotions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePromotion(id: string): Promise<void> {
    await this.request<void>(`/admin/promotions/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Organizations
  async getAdminOrganizations(params?: { search?: string; status?: string }): Promise<{ data: AdminOrganization[]; total: number }> {
    const query = params
      ? `?${new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) as Record<string, string>
        ).toString()}`
      : '';
    return this.request<{ data: AdminOrganization[]; total: number }>(`/admin/organizations${query}`);
  }

  async getAdminOrganization(id: string): Promise<AdminOrganization> {
    return this.request<AdminOrganization>(`/admin/organizations/${id}`);
  }

  async suspendOrganization(id: string): Promise<void> {
    await this.request<void>(`/admin/organizations/${id}/suspend`, {
      method: 'POST',
    });
  }

  async unsuspendOrganization(id: string): Promise<void> {
    await this.request<void>(`/admin/organizations/${id}/unsuspend`, {
      method: 'POST',
    });
  }

  async extendTrial(id: string, days: number): Promise<void> {
    await this.request<void>(`/admin/organizations/${id}/extend-trial`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  }

  // Admin - Users
  async getAdminUsers(params?: { search?: string }): Promise<{ data: AdminUser[]; total: number }> {
    const query = params?.search ? `?search=${encodeURIComponent(params.search)}` : '';
    return this.request<{ data: AdminUser[]; total: number }>(`/admin/users${query}`);
  }

  async getAdminUser(id: string): Promise<AdminUser> {
    return this.request<AdminUser>(`/admin/users/${id}`);
  }

  async disableUser(id: string): Promise<void> {
    await this.request<void>(`/admin/users/${id}/disable`, {
      method: 'POST',
    });
  }

  async enableUser(id: string): Promise<void> {
    await this.request<void>(`/admin/users/${id}/enable`, {
      method: 'POST',
    });
  }

  // Admin - Stats & Health
  async getPlatformStats(): Promise<PlatformStats> {
    return this.request<PlatformStats>('/admin/stats');
  }

  async getPlatformHealth(): Promise<PlatformHealth> {
    return this.request<PlatformHealth>('/admin/health');
  }

  // Admin - Config
  async getSystemConfigs(): Promise<SystemConfig[]> {
    return this.request<SystemConfig[]>('/admin/config');
  }

  async updateSystemConfig(key: string, value: any): Promise<void> {
    await this.request<void>(`/admin/config/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  }

  // Admin - Security
  async getAdminAuditLogs(): Promise<AdminAuditLog[]> {
    return this.request<AdminAuditLog[]>('/admin/audit-logs');
  }

  async getIpBlocklist(): Promise<IpBlocklistEntry[]> {
    return this.request<IpBlocklistEntry[]>('/admin/security/ip-blocklist');
  }

  async blockIp(ip: string, reason: string): Promise<void> {
    await this.request<void>('/admin/security/ip-blocklist', {
      method: 'POST',
      body: JSON.stringify({ ipAddress: ip, reason }),
    });
  }

  async unblockIp(id: string): Promise<void> {
    await this.request<void>(`/admin/security/ip-blocklist/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Announcements
  async getAnnouncements(): Promise<SystemAnnouncement[]> {
    return this.request<SystemAnnouncement[]>('/admin/announcements');
  }

  async createAnnouncement(data: Partial<SystemAnnouncement>): Promise<SystemAnnouncement> {
    return this.request<SystemAnnouncement>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAnnouncement(id: string, data: Partial<SystemAnnouncement>): Promise<SystemAnnouncement> {
    return this.request<SystemAnnouncement>(`/admin/announcements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await this.request<void>(`/admin/announcements/${id}`, {
      method: 'DELETE',
    });
  }

  // ========== Template Library ==========

  async searchTemplates(params?: {
    search?: string;
    category?: string;
    tag?: string;
    orientation?: string;
    difficulty?: string;
    page?: number;
    limit?: number;
  }): Promise<TemplateSearchResult> {
    const query = params ? new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    ).toString() : '';
    return this.request<TemplateSearchResult>(`/template-library${query ? `?${query}` : ''}`);
  }

  async getTemplateCategories(): Promise<TemplateCategory[]> {
    return this.request<TemplateCategory[]>('/template-library/categories');
  }

  async getFeaturedTemplates(): Promise<TemplateSummary[]> {
    return this.request<TemplateSummary[]>('/template-library/featured');
  }

  async getSeasonalTemplates(): Promise<TemplateSummary[]> {
    return this.request<TemplateSummary[]>('/template-library/seasonal');
  }

  async getPopularTemplates(): Promise<TemplateSummary[]> {
    return this.request<TemplateSummary[]>('/template-library/popular');
  }

  async getUserTemplates(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<TemplateSearchResult> {
    const query = params ? new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    ).toString() : '';
    return this.request<TemplateSearchResult>(`/template-library/user-templates${query ? `?${query}` : ''}`);
  }

  async aiGenerateTemplate(data: {
    prompt: string;
    category?: string;
    orientation?: string;
    style?: string;
  }): Promise<AIGenerateResponse> {
    return this.request<AIGenerateResponse>('/template-library/ai-generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTemplateDetail(id: string): Promise<TemplateDetail> {
    return this.request<TemplateDetail>(`/template-library/${id}`);
  }

  async getTemplatePreview(id: string): Promise<{ html: string }> {
    return this.request<{ html: string }>(`/template-library/${id}/preview`);
  }

  async cloneTemplate(id: string, data?: { name?: string; description?: string }): Promise<Content> {
    return this.request<Content>(`/template-library/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async createBlankDesign(orientation?: 'landscape' | 'portrait'): Promise<Content> {
    return this.request<Content>('/template-library/create-blank', {
      method: 'POST',
      body: JSON.stringify({ orientation: orientation || 'landscape' }),
    });
  }

  // ========== Template Admin API Methods ==========

  async createTemplate(data: {
    name: string;
    description?: string;
    templateHtml: string;
    category: string;
    difficulty?: string;
    orientation?: string;
    tags?: string[];
    sampleData?: Record<string, any>;
    thumbnailUrl?: string;
    duration?: number;
  }): Promise<any> {
    return this.request<any>('/template-library', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTemplate(id: string, data: {
    name?: string;
    description?: string;
    templateHtml?: string;
    category?: string;
    difficulty?: string;
    orientation?: string;
    tags?: string[];
    sampleData?: Record<string, any>;
    thumbnailUrl?: string;
    duration?: number;
  }): Promise<any> {
    return this.request<any>(`/template-library/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.request<void>(`/template-library/${id}`, {
      method: 'DELETE',
    });
  }

  async publishTemplate(templateId: string, data: {
    renderedHtml: string;
    displayIds: string[];
    name: string;
    duration?: number;
  }): Promise<{ contentId: string; displayCount: number }> {
    return this.request<{ contentId: string; displayCount: number }>(`/template-library/${templateId}/publish`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========== Widget API Methods ==========

  async getWidgetTypes(): Promise<WidgetType[]> {
    return this.request<WidgetType[]>('/content/widgets/types');
  }

  async createWidget(data: { name: string; widgetType: string; widgetConfig?: Record<string, unknown>; description?: string }): Promise<Widget> {
    return this.request<Widget>('/content/widgets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWidget(id: string, data: Partial<Widget>): Promise<Widget> {
    return this.request<Widget>(`/content/widgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async refreshWidget(id: string): Promise<Widget> {
    return this.request<Widget>(`/content/widgets/${id}/refresh`, {
      method: 'POST',
    });
  }

  // ========== Layout API Methods ==========

  async getLayoutPresets(): Promise<LayoutPreset[]> {
    return this.request<LayoutPreset[]>('/content/layouts/presets');
  }

  async createLayout(data: { name: string; layoutType: string; zones?: LayoutZone[]; description?: string }): Promise<Layout> {
    return this.request<Layout>('/content/layouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLayout(id: string, data: Partial<Layout>): Promise<Layout> {
    return this.request<Layout>(`/content/layouts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getResolvedLayout(id: string): Promise<ResolvedLayout> {
    return this.request<ResolvedLayout>(`/content/layouts/${id}/resolved`);
  }

  // ========== QR Overlay API Methods ==========

  async updateQrOverlay(displayId: string, config: QrOverlayConfig): Promise<QrOverlayConfig> {
    return this.request<QrOverlayConfig>(`/displays/${displayId}/qr-overlay`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  async removeQrOverlay(displayId: string): Promise<void> {
    return this.request<void>(`/displays/${displayId}/qr-overlay`, {
      method: 'DELETE',
    });
  }

  /**
   * Trigger thumbnail generation for a content item.
   */
  async generateThumbnail(contentId: string): Promise<{ thumbnail: string }> {
    return this.request<{ thumbnail: string }>(`/content/${contentId}/thumbnail`, {
      method: 'POST',
    });
  }

  /**
   * Upload content with progress tracking via XMLHttpRequest.
   * Returns the created content and reports upload progress via callback.
   */
  uploadContentWithProgress(
    data: { title: string; type: string; file: any },
    onProgress?: (percent: number) => void,
  ): Promise<Content> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('name', data.title);
      formData.append('type', data.type);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/content/upload`);
      xhr.withCredentials = true;

      const csrfToken = getCsrfToken();
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            // Unwrap response envelope
            const unwrapped = result?.success !== undefined && result?.data !== undefined
              ? result.data
              : result;
            resolve(unwrapped.content || unwrapped);
          } catch {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      xhr.timeout = 120000;

      xhr.send(formData);
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
