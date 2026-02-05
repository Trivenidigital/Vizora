// API Client for Vizora Middleware
// Uses httpOnly cookies for secure JWT token storage

import type { Display, Content, Playlist, PlaylistItem, Schedule, PaginatedResponse } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  screenQuota: number;
  trialEndsAt: string;
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
  startTime?: string;
  endTime?: string;
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

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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
            // Redirect to login with return URL
            const currentPath = window.location.pathname;
            if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
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
    const response = await this.request<{
      success: boolean;
      data: LoginResponse;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Mark as authenticated - token is in httpOnly cookie
    this.isAuthenticated = true;
    return response.data;
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
    const response = await this.request<{
      success: boolean;
      data: RegisterResponse;
    }>('/auth/register', {
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
    return response.data;
  }

  async logout(): Promise<void> {
    await this.clearAuthentication();
  }

  async refreshToken(): Promise<{ expiresIn: number }> {
    const response = await this.request<{
      success: boolean;
      data: { expiresIn: number };
    }>('/auth/refresh', {
      method: 'POST',
    });
    return response.data;
  }

  async getCurrentUser(): Promise<AuthUser> {
    const response = await this.request<{
      success: boolean;
      data: { user: AuthUser };
    }>('/auth/me');
    return response.data.user;
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
    data: Partial<{ nickname: string; location?: string; currentPlaylistId?: string }>
  ): Promise<Display> {
    const payload: Record<string, string | undefined> = {};
    if (data.nickname !== undefined) payload.name = data.nickname;
    if (data.location !== undefined) payload.location = data.location;
    if (data.currentPlaylistId !== undefined) payload.currentPlaylistId = data.currentPlaylistId;

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
    return this.request<Display>('/devices/pairing/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Content
  async getContent(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  }): Promise<PaginatedResponse<Content>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
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
        return result.content || result;
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
  async getAnalyticsSummary(): Promise<any> {
    return this.request<any>('/analytics/summary');
  }

  async getDeviceMetrics(range: string = 'month'): Promise<any[]> {
    return this.request<any[]>(`/analytics/device-metrics?range=${range}`);
  }

  async getContentPerformance(range: string = 'month'): Promise<any[]> {
    return this.request<any[]>(`/analytics/content-performance?range=${range}`);
  }

  async getUsageTrends(range: string = 'month'): Promise<any[]> {
    return this.request<any[]>(`/analytics/usage-trends?range=${range}`);
  }

  async getDeviceDistribution(): Promise<any[]> {
    return this.request<any[]>('/analytics/device-distribution');
  }

  async getBandwidthUsage(range: string = 'month'): Promise<any[]> {
    return this.request<any[]>(`/analytics/bandwidth?range=${range}`);
  }

  async getPlaylistPerformance(range: string = 'month'): Promise<any[]> {
    return this.request<any[]>(`/analytics/playlist-performance?range=${range}`);
  }

  // Analytics Export
  async exportAnalytics(range: string = 'month'): Promise<any> {
    return this.request<any>(`/analytics/export?range=${range}`);
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
  async reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<any> {
    return this.request<any>(`/playlists/${playlistId}/reorder`, {
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
  async getDisplayGroups(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<any>>(`/display-groups${query ? `?${query}` : ''}`);
  }

  async getDisplayGroup(id: string): Promise<any> {
    return this.request<any>(`/display-groups/${id}`);
  }

  async createDisplayGroup(data: { name: string; description?: string }): Promise<any> {
    return this.request<any>('/display-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDisplayGroup(id: string, data: { name?: string; description?: string }): Promise<any> {
    return this.request<any>(`/display-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDisplayGroup(id: string): Promise<void> {
    return this.request<void>(`/display-groups/${id}`, {
      method: 'DELETE',
    });
  }

  async addDisplaysToGroup(groupId: string, displayIds: string[]): Promise<any> {
    return this.request<any>(`/display-groups/${groupId}/displays`, {
      method: 'POST',
      body: JSON.stringify({ displayIds }),
    });
  }

  async removeDisplaysFromGroup(groupId: string, displayIds: string[]): Promise<any> {
    return this.request<any>(`/display-groups/${groupId}/displays`, {
      method: 'DELETE',
      body: JSON.stringify({ displayIds }),
    });
  }

  // Users / Team Management
  async getUsers(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<PaginatedResponse<any>>(`/users${query ? `?${query}` : ''}`);
  }

  async inviteUser(data: { email: string; firstName: string; lastName: string; role: string }): Promise<any> {
    return this.request<any>('/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: { firstName?: string; lastName?: string; role?: string; isActive?: boolean }): Promise<any> {
    return this.request<any>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deactivateUser(id: string): Promise<any> {
    return this.request<any>(`/users/${id}`, {
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
  }): Promise<PaginatedResponse<any>> {
    const query = params ? new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) as Record<string, string>
    ).toString() : '';
    return this.request<PaginatedResponse<any>>(`/audit-logs${query ? `?${query}` : ''}`);
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
}

export const apiClient = new ApiClient(API_BASE_URL);
