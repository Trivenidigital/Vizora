// API Client for Vizora Middleware

import type { Display, Content, Playlist, PlaylistItem, Schedule, PaginatedResponse } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      // Also set as cookie for middleware to access
      document.cookie = `authToken=${token}; path=/; max-age=604800; SameSite=Lax`;
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Token saved securely');
      }
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      // Also clear cookie
      document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Token cleared');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 3
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] Request: ${options.method || 'GET'} ${this.baseUrl}${endpoint}`);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutMs = options.method === 'GET' ? 30000 : 30000; // 30s timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
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
          this.clearToken();
          if (typeof window !== 'undefined') {
            // Redirect to login with return URL
            const currentPath = window.location.pathname;
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
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

  // Auth
  async login(email: string, password: string) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Login called');
    }
    const response = await this.request<{
      success: boolean;
      data: {
        user: any;
        token: string;
        expiresIn: number;
      }
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data && response.data.token) {
      this.setToken(response.data.token);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] Token not found in response');
      }
      throw new Error('Authentication failed: no token received');
    }
    return response.data;
  }

  async register(
    email: string,
    password: string,
    organizationName: string,
    firstName: string,
    lastName: string
  ) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Register called');
    }
    const response = await this.request<{
      success: boolean;
      data: {
        user: any;
        organization: any;
        token: string;
        expiresIn: number;
      }
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

    if (response.data && response.data.token) {
      this.setToken(response.data.token);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] Token not found in register response');
      }
      throw new Error('Registration failed: no token received');
    }
    return response.data;
  }

  // Displays
  async getDisplays(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Display>> {
    const query = new URLSearchParams(params as any).toString();
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
      deviceId: `device-${Date.now()}-${Math.random().toString(36).substring(7)}`, // Generate unique device ID
    };
    return this.request<Display>('/displays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDisplay(id: string, data: Partial<{ nickname: string; location?: string; currentPlaylistId?: string }>): Promise<Display> {
    // Backend expects 'name', frontend uses 'nickname'
    const payload: any = {};
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

  async completePairing(data: { code: string; nickname: string; location?: string }): Promise<any> {
    return this.request<any>('/devices/pairing/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Content
  async getContent(params?: { page?: number; limit?: number; type?: string; status?: string }): Promise<PaginatedResponse<Content>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<Content>>(`/content${query ? `?${query}` : ''}`);
  }

  async getContentItem(id: string): Promise<Content> {
    return this.request<Content>(`/content/${id}`);
  }

  async createContent(data: {
    title: string;
    type: string;
    url?: string;
    metadata?: any;
  }): Promise<Content> {
    // Backend expects 'name' instead of 'title'
    const payload = {
      name: data.title,
      type: data.type === 'pdf' ? 'url' : data.type, // Map pdf to url type
      url: data.url || '',
      metadata: data.metadata,
    };
    return this.request<Content>('/content', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateContent(id: string, data: Partial<{ title: string; metadata?: any }>): Promise<Content> {
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
    const query = new URLSearchParams(params as any).toString();
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

  async updatePlaylist(id: string, data: Partial<{
    name: string;
    description?: string;
  }>): Promise<Playlist> {
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

  async addPlaylistItem(playlistId: string, contentId: string, duration?: number): Promise<PlaylistItem> {
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

  async updatePlaylistItem(playlistId: string, itemId: string, data: { duration?: number }): Promise<PlaylistItem> {
    return this.request<PlaylistItem>(`/playlists/${playlistId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Schedules
  async getSchedules(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any>(`/schedules${query ? `?${query}` : ''}`);
  }

  async createSchedule(data: any) {
    return this.request<any>('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSchedule(id: string, data: any) {
    return this.request<any>(`/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSchedule(id: string) {
    return this.request<any>(`/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  // Generic HTTP methods
  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
