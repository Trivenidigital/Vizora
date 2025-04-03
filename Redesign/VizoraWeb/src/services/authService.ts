import { apiService } from './apiService';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  permissions: string[];
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      displayAlerts: boolean;
      contentUpdates: boolean;
      systemUpdates: boolean;
    };
  };
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignUpData extends LoginCredentials {
  name: string;
  confirmPassword: string;
}

class AuthService {
  private token: string | null = null;

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>('/auth/login', credentials);
      this.setToken(response.token);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async signUp(data: SignUpData): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>('/auth/signup', data);
      this.setToken(response.token);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
      this.clearToken();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await apiService.get<{ user: User }>('/auth/me');
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    try {
      const response = await apiService.put<{ user: User }>('/auth/profile', data);
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiService.put('/auth/password', {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await apiService.post('/auth/reset-password', { email });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyResetToken(token: string): Promise<boolean> {
    try {
      await apiService.get(`/auth/verify-reset-token/${token}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async setNewPassword(token: string, newPassword: string): Promise<void> {
    try {
      await apiService.post('/auth/set-new-password', {
        token,
        newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private setToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token);
  }

  private clearToken(): void {
    this.token = null;
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred');
  }
}

export const authService = new AuthService(); 