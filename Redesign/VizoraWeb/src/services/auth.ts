import axios from 'axios';
import { API_URL } from '@/config/constants';
import { TokenManager } from '@vizora/common';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  private readonly baseUrl = `${API_URL}/auth`;

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await axios.post(`${this.baseUrl}/login`, {
      email,
      password,
    });
    return response.data;
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const response = await axios.post(`${this.baseUrl}/register`, {
      email,
      password,
      name,
    });
    return response.data;
  }

  async logout(): Promise<void> {
    await axios.post(`${this.baseUrl}/logout`);
  }

  async getCurrentUser(): Promise<User> {
    const response = await axios.get(`${this.baseUrl}/me`);
    return response.data;
  }

  setAuthToken(token: string): void {
    axios.defaults.headers.common['Authorization'] = `Bearer ${TokenManager.getToken()}`;
  }

  removeAuthToken(): void {
    TokenManager.removeToken();
  }
}

export const authService = new AuthService(); 