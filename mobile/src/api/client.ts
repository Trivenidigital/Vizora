import { config } from '../constants/config';
import { useAuthStore } from '../stores/auth';

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

    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async register(data: RegisterData) {
    return this.request<LoginResponse>('/api/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async getMe() {
    return this.request<MeResponse>('/api/auth/me');
  }

  // Devices
  async getDisplays() {
    return this.request<DisplayListResponse>('/api/displays');
  }

  async completePairing(code: string, nickname?: string) {
    return this.request<PairingCompleteResponse>('/api/devices/pairing/complete', {
      method: 'POST',
      body: { code, ...(nickname ? { nickname } : {}) },
    });
  }
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

// Response types
export type LoginResponse = {
  access_token?: string;
  token?: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
  };
};

export type RegisterData = {
  email: string;
  password: string;
  name: string;
  organizationName: string;
};

export type MeResponse = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};

export type Display = {
  id: string;
  nickname: string;
  deviceIdentifier: string;
  status: 'online' | 'offline' | 'pairing';
  location?: string;
  orientation?: string;
  lastSeen?: string;
  createdAt: string;
};

export type DisplayListResponse = {
  data?: Display[];
  displays?: Display[];
  items?: Display[];
};

export type PairingCompleteResponse = {
  success: boolean;
  display: Display;
};
