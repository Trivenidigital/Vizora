import { vi } from 'vitest';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Mock auth service
export const authService = {
  login: vi.fn().mockResolvedValue({ token: 'fake-token', user: { id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' } }),
  logout: vi.fn().mockResolvedValue({}),
  register: vi.fn().mockResolvedValue({ token: 'fake-token', user: { id: '1', email: 'test@example.com', name: 'Test User', role: 'user' } }),
  getCurrentUser: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' }),
  updateProfile: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Updated User', role: 'admin' }),
  changePassword: vi.fn().mockResolvedValue({}),
  resetPassword: vi.fn().mockResolvedValue({}),
  setAuthToken: vi.fn(),
  removeAuthToken: vi.fn(),
}; 