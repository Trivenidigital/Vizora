// Users & Team Management API methods

import type { User, AuditLog, PaginatedResponse } from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    getUsers(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<User>>;
    inviteUser(data: { email: string; firstName: string; lastName: string; role: string }): Promise<User & { tempPassword?: string }>;
    updateUser(id: string, data: { firstName?: string; lastName?: string; role?: string; isActive?: boolean }): Promise<User>;
    deactivateUser(id: string): Promise<User>;
    getAuditLogs(params?: { page?: number; limit?: number; action?: string; entityType?: string; userId?: string; startDate?: string; endDate?: string }): Promise<PaginatedResponse<AuditLog>>;
  }
}

ApiClient.prototype.getUsers = async function (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<User>> {
  const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  return this.request<PaginatedResponse<User>>(`/users${query ? `?${query}` : ''}`);
};

ApiClient.prototype.inviteUser = async function (data: { email: string; firstName: string; lastName: string; role: string }): Promise<User & { tempPassword?: string }> {
  return this.request<User & { tempPassword?: string }>('/users/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateUser = async function (id: string, data: { firstName?: string; lastName?: string; role?: string; isActive?: boolean }): Promise<User> {
  return this.request<User>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deactivateUser = async function (id: string): Promise<User> {
  return this.request<User>(`/users/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.getAuditLogs = async function (params?: {
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
};
