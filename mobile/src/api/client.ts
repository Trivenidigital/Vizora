import { config } from '../constants/config';
import { useAuthStore } from '../stores/auth';
import type {
  Display,
  Content,
  Playlist,
  PlaylistItem,
  UpdateDisplayData,
  ContentFilterParams,
  PaginationParams,
} from '../types';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

class ApiClient {
  private baseUrl = config.apiUrl;

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;
    const token = useAuthStore.getState().token;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, error.message ?? 'Request failed');
    }

    const json = await res.json();

    // Unwrap response envelope: { success, data, meta } → data
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return json.data as T;
    }

    return json as T;
  }

  // ---------- Auth ----------

  async login(email: string, password: string) {
    return this.request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async register(data: RegisterData) {
    return this.request<LoginResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async getMe() {
    return this.request<MeResponse>('/api/v1/auth/me');
  }

  // ---------- Displays ----------

  async getDisplays() {
    return this.request<Display[]>('/api/v1/displays');
  }

  async getDisplay(id: string) {
    return this.request<Display>(`/api/v1/displays/${id}`);
  }

  async updateDisplay(id: string, data: UpdateDisplayData) {
    return this.request<Display>(`/api/v1/displays/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteDisplay(id: string) {
    return this.request<void>(`/api/v1/displays/${id}`, {
      method: 'DELETE',
    });
  }

  async pushContent(displayId: string, contentId: string, duration?: number) {
    return this.request<void>(`/api/v1/displays/${displayId}/push-content`, {
      method: 'POST',
      body: { contentId, ...(duration ? { duration } : {}) },
    });
  }

  async requestScreenshot(displayId: string) {
    return this.request<{ message: string }>(`/api/v1/displays/${displayId}/screenshot`, {
      method: 'POST',
    });
  }

  async getScreenshot(displayId: string) {
    return this.request<{ url: string; timestamp: string }>(`/api/v1/displays/${displayId}/screenshot`);
  }

  // ---------- Content ----------

  async getContent(params?: ContentFilterParams) {
    const query = params ? '?' + buildQuery(params) : '';
    return this.request<Content[]>(`/api/v1/content${query}`);
  }

  async getContentItem(id: string) {
    return this.request<Content>(`/api/v1/content/${id}`);
  }

  async deleteContent(id: string) {
    return this.request<void>(`/api/v1/content/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Upload a file using XMLHttpRequest for progress tracking.
   * `uri` is the local file URI from expo-image-picker.
   */
  async uploadFile(
    uri: string,
    name: string,
    mimeType: string,
    onProgress?: (percent: number) => void,
  ): Promise<Content> {
    const token = useAuthStore.getState().token;
    const formData = new FormData();

    formData.append('file', {
      uri,
      name,
      type: mimeType,
    } as unknown as Blob);

    formData.append('name', name);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/api/v1/content/upload`);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const json = JSON.parse(xhr.responseText);
            // Unwrap envelope
            const data = json?.data ?? json;
            resolve(data as Content);
          } else {
            const json = JSON.parse(xhr.responseText);
            reject(new ApiError(xhr.status, json.message ?? 'Upload failed'));
          }
        } catch {
          reject(new ApiError(xhr.status || 0, 'Invalid server response'));
        }
      };

      xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'));
      xhr.send(formData);
    });
  }

  // ---------- Playlists ----------

  async getPlaylists(params?: PaginationParams) {
    const query = params ? '?' + buildQuery(params) : '';
    return this.request<Playlist[]>(`/api/v1/playlists${query}`);
  }

  async getPlaylist(id: string) {
    return this.request<Playlist>(`/api/v1/playlists/${id}`);
  }

  async addPlaylistItem(playlistId: string, contentId: string, duration?: number) {
    return this.request<PlaylistItem>(`/api/v1/playlists/${playlistId}/items`, {
      method: 'POST',
      body: { contentId, ...(duration ? { duration } : {}) },
    });
  }

  async removePlaylistItem(playlistId: string, itemId: string) {
    return this.request<void>(`/api/v1/playlists/${playlistId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async reorderPlaylist(playlistId: string, itemIds: string[]) {
    return this.request<void>(`/api/v1/playlists/${playlistId}/reorder`, {
      method: 'POST',
      body: { itemIds },
    });
  }

  // ---------- Pairing ----------

  async completePairing(code: string, nickname?: string) {
    return this.request<PairingCompleteResponse>('/api/v1/devices/pairing/complete', {
      method: 'POST',
      body: { code, ...(nickname ? { nickname } : {}) },
    });
  }
}

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null);
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const api = new ApiClient();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Response types (auth — not wrapped in envelope)
export type LoginResponse = {
  access_token?: string;
  token?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
  };
};

export type RegisterData = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
};

export type MeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
};

export type PairingCompleteResponse = {
  success: boolean;
  display: Display;
};
