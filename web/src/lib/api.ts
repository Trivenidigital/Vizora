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
      console.log('[API] Token saved to both localStorage and cookie');
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      // Also clear cookie
      document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      console.log('[API] Token cleared from both localStorage and cookie');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    console.log(`[API] Request: ${options.method || 'GET'} ${this.baseUrl}${endpoint}`);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    console.log(`[API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[API] Request failed with status ${response.status}`);
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
    console.log('[API] Response data:', data);
    return data;
  }

  // Auth
  async login(email: string, password: string) {
    console.log('[API] Login called with email:', email);
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
    console.log('[API] Login response received:', response);
    console.log('[API] Response structure:', {
      hasSuccess: 'success' in response,
      hasData: 'data' in response,
      dataType: typeof response.data,
      hasToken: response.data?.token !== undefined,
      tokenValue: response.data?.token ? response.data.token.substring(0, 30) + '...' : 'MISSING'
    });
    
    if (response.data && response.data.token) {
      console.log('[API] ✅ Token found, calling setToken()');
      this.setToken(response.data.token);
      console.log('[API] ✅ Token saved to localStorage');
    } else {
      console.error('[API] ❌ TOKEN NOT FOUND in response!');
      console.error('[API] Response:', JSON.stringify(response, null, 2));
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
    console.log('[API] Register called');
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
    console.log('[API] Register response received:', response);
    console.log('[API] Response structure:', {
      hasSuccess: 'success' in response,
      hasData: 'data' in response,
      hasToken: response.data?.token !== undefined,
      tokenValue: response.data?.token ? response.data.token.substring(0, 30) + '...' : 'MISSING'
    });
    
    if (response.data && response.data.token) {
      console.log('[API] ✅ Token found in register, calling setToken()');
      this.setToken(response.data.token);
      console.log('[API] ✅ Token saved to localStorage');
    } else {
      console.error('[API] ❌ TOKEN NOT FOUND in register response!');
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
