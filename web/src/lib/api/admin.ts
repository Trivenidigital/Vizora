// Admin API methods

import type {
  AdminPlan, Promotion, AdminOrganization, AdminUser,
  PlatformStats, SystemConfig, AdminAuditLog,
  SystemAnnouncement, IpBlocklistEntry, PlatformHealth,
} from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    // Admin - Plans
    getAdminPlans(): Promise<AdminPlan[]>;
    createPlan(data: Partial<AdminPlan>): Promise<AdminPlan>;
    updatePlan(id: string, data: Partial<AdminPlan>): Promise<AdminPlan>;
    deletePlan(id: string): Promise<void>;
    // Admin - Promotions
    getAdminPromotions(): Promise<Promotion[]>;
    createPromotion(data: Partial<Promotion>): Promise<Promotion>;
    updatePromotion(id: string, data: Partial<Promotion>): Promise<Promotion>;
    deletePromotion(id: string): Promise<void>;
    // Admin - Organizations
    getAdminOrganizations(params?: { search?: string; status?: string }): Promise<{ data: AdminOrganization[]; total: number }>;
    getAdminOrganization(id: string): Promise<AdminOrganization>;
    suspendOrganization(id: string): Promise<void>;
    unsuspendOrganization(id: string): Promise<void>;
    extendTrial(id: string, days: number): Promise<void>;
    // Admin - Users
    getAdminUsers(params?: { search?: string }): Promise<{ data: AdminUser[]; total: number }>;
    getAdminUser(id: string): Promise<AdminUser>;
    disableUser(id: string): Promise<void>;
    enableUser(id: string): Promise<void>;
    // Admin - Stats & Health
    getPlatformStats(): Promise<PlatformStats>;
    getPlatformHealth(): Promise<PlatformHealth>;
    // Health Monitor
    getHealthSelfTest(): Promise<Record<string, unknown>>;
    triggerHealthSelfTest(): Promise<Record<string, unknown>>;
    getHealthMonitorCurrent(): Promise<Record<string, unknown>>;
    getHealthMonitorHistory(): Promise<Record<string, unknown>[]>;
    getHealthMonitorMetrics(): Promise<Record<string, unknown>>;
    // Admin - Config
    getSystemConfigs(): Promise<SystemConfig[]>;
    updateSystemConfig(key: string, value: string | number | boolean): Promise<void>;
    // Admin - Security
    getAdminAuditLogs(): Promise<AdminAuditLog[]>;
    getIpBlocklist(): Promise<IpBlocklistEntry[]>;
    blockIp(ip: string, reason: string): Promise<void>;
    unblockIp(id: string): Promise<void>;
    // Admin - Announcements
    getAnnouncements(): Promise<SystemAnnouncement[]>;
    createAnnouncement(data: Partial<SystemAnnouncement>): Promise<SystemAnnouncement>;
    updateAnnouncement(id: string, data: Partial<SystemAnnouncement>): Promise<SystemAnnouncement>;
    deleteAnnouncement(id: string): Promise<void>;
  }
}

// Admin - Plans
ApiClient.prototype.getAdminPlans = async function (): Promise<AdminPlan[]> {
  return this.request<AdminPlan[]>('/admin/plans');
};

ApiClient.prototype.createPlan = async function (data: Partial<AdminPlan>): Promise<AdminPlan> {
  return this.request<AdminPlan>('/admin/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updatePlan = async function (id: string, data: Partial<AdminPlan>): Promise<AdminPlan> {
  return this.request<AdminPlan>(`/admin/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deletePlan = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/plans/${id}`, {
    method: 'DELETE',
  });
};

// Admin - Promotions
ApiClient.prototype.getAdminPromotions = async function (): Promise<Promotion[]> {
  return this.request<Promotion[]>('/admin/promotions');
};

ApiClient.prototype.createPromotion = async function (data: Partial<Promotion>): Promise<Promotion> {
  return this.request<Promotion>('/admin/promotions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updatePromotion = async function (id: string, data: Partial<Promotion>): Promise<Promotion> {
  return this.request<Promotion>(`/admin/promotions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deletePromotion = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/promotions/${id}`, {
    method: 'DELETE',
  });
};

// Admin - Organizations
ApiClient.prototype.getAdminOrganizations = async function (params?: { search?: string; status?: string }): Promise<{ data: AdminOrganization[]; total: number }> {
  const query = params
    ? `?${new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) as Record<string, string>
      ).toString()}`
    : '';
  return this.request<{ data: AdminOrganization[]; total: number }>(`/admin/organizations${query}`);
};

ApiClient.prototype.getAdminOrganization = async function (id: string): Promise<AdminOrganization> {
  return this.request<AdminOrganization>(`/admin/organizations/${id}`);
};

ApiClient.prototype.suspendOrganization = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/organizations/${id}/suspend`, {
    method: 'POST',
  });
};

ApiClient.prototype.unsuspendOrganization = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/organizations/${id}/unsuspend`, {
    method: 'POST',
  });
};

ApiClient.prototype.extendTrial = async function (id: string, days: number): Promise<void> {
  await this.request<void>(`/admin/organizations/${id}/extend-trial`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
};

// Admin - Users
ApiClient.prototype.getAdminUsers = async function (params?: { search?: string }): Promise<{ data: AdminUser[]; total: number }> {
  const query = params?.search ? `?search=${encodeURIComponent(params.search)}` : '';
  return this.request<{ data: AdminUser[]; total: number }>(`/admin/users${query}`);
};

ApiClient.prototype.getAdminUser = async function (id: string): Promise<AdminUser> {
  return this.request<AdminUser>(`/admin/users/${id}`);
};

ApiClient.prototype.disableUser = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/users/${id}/disable`, {
    method: 'POST',
  });
};

ApiClient.prototype.enableUser = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/users/${id}/enable`, {
    method: 'POST',
  });
};

// Admin - Stats & Health
ApiClient.prototype.getPlatformStats = async function (): Promise<PlatformStats> {
  return this.request<PlatformStats>('/admin/stats');
};

ApiClient.prototype.getPlatformHealth = async function (): Promise<PlatformHealth> {
  return this.request<PlatformHealth>('/admin/health');
};

// Health Monitor endpoints
ApiClient.prototype.getHealthSelfTest = async function (): Promise<Record<string, unknown>> {
  return this.request<Record<string, unknown>>('/health/self-test');
};
ApiClient.prototype.triggerHealthSelfTest = async function (): Promise<Record<string, unknown>> {
  return this.request<Record<string, unknown>>('/health/self-test', { method: 'POST' });
};
ApiClient.prototype.getHealthMonitorCurrent = async function (): Promise<Record<string, unknown>> {
  return this.request<Record<string, unknown>>('/health/monitor/current');
};
ApiClient.prototype.getHealthMonitorHistory = async function (): Promise<Record<string, unknown>[]> {
  return this.request<Record<string, unknown>[]>('/health/monitor/history');
};
ApiClient.prototype.getHealthMonitorMetrics = async function (): Promise<Record<string, unknown>> {
  return this.request<Record<string, unknown>>('/health/monitor/metrics');
};

// Admin - Config
ApiClient.prototype.getSystemConfigs = async function (): Promise<SystemConfig[]> {
  return this.request<SystemConfig[]>('/admin/config');
};

ApiClient.prototype.updateSystemConfig = async function (key: string, value: string | number | boolean): Promise<void> {
  await this.request<void>(`/admin/config/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
};

// Admin - Security
ApiClient.prototype.getAdminAuditLogs = async function (): Promise<AdminAuditLog[]> {
  return this.request<AdminAuditLog[]>('/admin/audit-logs');
};

ApiClient.prototype.getIpBlocklist = async function (): Promise<IpBlocklistEntry[]> {
  return this.request<IpBlocklistEntry[]>('/admin/security/ip-blocklist');
};

ApiClient.prototype.blockIp = async function (ip: string, reason: string): Promise<void> {
  await this.request<void>('/admin/security/ip-blocklist', {
    method: 'POST',
    body: JSON.stringify({ ipAddress: ip, reason }),
  });
};

ApiClient.prototype.unblockIp = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/security/ip-blocklist/${id}`, {
    method: 'DELETE',
  });
};

// Admin - Announcements
ApiClient.prototype.getAnnouncements = async function (): Promise<SystemAnnouncement[]> {
  return this.request<SystemAnnouncement[]>('/admin/announcements');
};

ApiClient.prototype.createAnnouncement = async function (data: Partial<SystemAnnouncement>): Promise<SystemAnnouncement> {
  return this.request<SystemAnnouncement>('/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateAnnouncement = async function (id: string, data: Partial<SystemAnnouncement>): Promise<SystemAnnouncement> {
  return this.request<SystemAnnouncement>(`/admin/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deleteAnnouncement = async function (id: string): Promise<void> {
  await this.request<void>(`/admin/announcements/${id}`, {
    method: 'DELETE',
  });
};
