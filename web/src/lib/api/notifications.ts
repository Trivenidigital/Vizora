// Notifications API methods

import type { AppNotification, PaginatedResponse } from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    getNotifications(params?: { read?: boolean; severity?: string; page?: number; limit?: number }): Promise<PaginatedResponse<AppNotification>>;
    getUnreadNotificationCount(): Promise<{ count: number }>;
    markNotificationAsRead(id: string): Promise<AppNotification>;
    markAllNotificationsAsRead(): Promise<void>;
    dismissNotification(id: string): Promise<void>;
  }
}

ApiClient.prototype.getNotifications = async function (params?: {
  read?: boolean;
  severity?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<AppNotification>> {
  const queryParams: Record<string, string> = {};
  if (params?.read !== undefined) queryParams.read = String(params.read);
  if (params?.severity) queryParams.severity = params.severity;
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  const query = Object.keys(queryParams).length > 0
    ? `?${new URLSearchParams(queryParams).toString()}`
    : '';
  return this.request<PaginatedResponse<AppNotification>>(`/notifications${query}`);
};

ApiClient.prototype.getUnreadNotificationCount = async function (): Promise<{ count: number }> {
  return this.request<{ count: number }>('/notifications/unread-count');
};

ApiClient.prototype.markNotificationAsRead = async function (id: string): Promise<AppNotification> {
  return this.request<AppNotification>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
};

ApiClient.prototype.markAllNotificationsAsRead = async function (): Promise<void> {
  return this.request<void>('/notifications/read-all', {
    method: 'POST',
  });
};

ApiClient.prototype.dismissNotification = async function (id: string): Promise<void> {
  return this.request<void>(`/notifications/${id}/dismiss`, {
    method: 'PATCH',
  });
};
