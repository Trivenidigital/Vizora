// Auth API methods

import { devLog } from '../logger';
import { ApiClient, LoginResponse, RegisterResponse, AuthUser } from './client';

declare module './client' {
  interface ApiClient {
    login(email: string, password: string): Promise<LoginResponse>;
    register(email: string, password: string, organizationName: string, firstName: string, lastName: string): Promise<RegisterResponse>;
    logout(): Promise<void>;
    refreshToken(): Promise<{ expiresIn: number }>;
    getCurrentUser(): Promise<AuthUser>;
    changePassword(data: { currentPassword: string; newPassword: string }): Promise<void>;
    forgotPassword(email: string): Promise<{ message: string }>;
    validateResetToken(token: string): Promise<{ valid: boolean; email?: string }>;
    resetPassword(token: string, newPassword: string): Promise<{ message: string }>;
    deleteAccount(data: { password: string; confirmation: string }): Promise<{ message: string }>;
    updateProfile(data: { firstName?: string; lastName?: string }): Promise<AuthUser>;
  }
}

ApiClient.prototype.login = async function (email: string, password: string): Promise<LoginResponse> {
  if (process.env.NODE_ENV === 'development') {
    devLog('[API] Login called');
  }
  const response = await this.request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // Mark as authenticated - token is in httpOnly cookie
  this.isAuthenticated = true;
  return response;
};

ApiClient.prototype.register = async function (
  email: string,
  password: string,
  organizationName: string,
  firstName: string,
  lastName: string
): Promise<RegisterResponse> {
  if (process.env.NODE_ENV === 'development') {
    devLog('[API] Register called');
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
};

ApiClient.prototype.logout = async function (): Promise<void> {
  await this.clearAuthentication();
};

ApiClient.prototype.refreshToken = async function (): Promise<{ expiresIn: number }> {
  return this.request<{ expiresIn: number }>('/auth/refresh', {
    method: 'POST',
  });
};

ApiClient.prototype.getCurrentUser = async function (): Promise<AuthUser> {
  const response = await this.request<{ user: AuthUser }>('/auth/me');
  return response.user;
};

ApiClient.prototype.changePassword = async function (data: { currentPassword: string; newPassword: string }): Promise<void> {
  await this.request<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.forgotPassword = async function (email: string): Promise<{ message: string }> {
  return this.request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

ApiClient.prototype.validateResetToken = async function (token: string): Promise<{ valid: boolean; email?: string }> {
  return this.request<{ valid: boolean; email?: string }>(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
};

ApiClient.prototype.resetPassword = async function (token: string, newPassword: string): Promise<{ message: string }> {
  return this.request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
};

ApiClient.prototype.deleteAccount = async function (data: { password: string; confirmation: string }): Promise<{ message: string }> {
  return this.request<{ message: string }>('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateProfile = async function (data: { firstName?: string; lastName?: string }): Promise<AuthUser> {
  const response = await this.request<{ user: AuthUser }>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.user;
};
