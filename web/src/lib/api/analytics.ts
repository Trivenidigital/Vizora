// Analytics API methods

import type {
  AnalyticsSummary, DeviceMetric, ContentPerformance, UsageTrend,
  DeviceDistribution, BandwidthUsage, PlaylistPerformance, AnalyticsExport,
} from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    getAnalyticsSummary(): Promise<AnalyticsSummary>;
    getDeviceMetrics(range?: string): Promise<DeviceMetric[]>;
    getContentPerformance(range?: string): Promise<ContentPerformance[]>;
    getUsageTrends(range?: string): Promise<UsageTrend[]>;
    getDeviceDistribution(): Promise<DeviceDistribution[]>;
    getBandwidthUsage(range?: string): Promise<BandwidthUsage[]>;
    getPlaylistPerformance(range?: string): Promise<PlaylistPerformance[]>;
    exportAnalytics(range?: string): Promise<AnalyticsExport>;
    getDeviceUptime(deviceId: string, days?: number): Promise<{ deviceId: string; uptimePercent: number; totalOnlineMinutes: number; totalOfflineMinutes: number; lastHeartbeat: string | null }>;
    getUptimeSummary(days?: number): Promise<{ avgUptimePercent: number; deviceCount: number; onlineCount: number; offlineCount: number; devices: Array<{ id: string; nickname: string; uptimePercent: number }> }>;
  }
}

ApiClient.prototype.getAnalyticsSummary = async function (): Promise<AnalyticsSummary> {
  return this.request<AnalyticsSummary>('/analytics/summary');
};

ApiClient.prototype.getDeviceMetrics = async function (range: string = 'month'): Promise<DeviceMetric[]> {
  return this.request<DeviceMetric[]>(`/analytics/device-metrics?range=${range}`);
};

ApiClient.prototype.getContentPerformance = async function (range: string = 'month'): Promise<ContentPerformance[]> {
  return this.request<ContentPerformance[]>(`/analytics/content-performance?range=${range}`);
};

ApiClient.prototype.getUsageTrends = async function (range: string = 'month'): Promise<UsageTrend[]> {
  return this.request<UsageTrend[]>(`/analytics/usage-trends?range=${range}`);
};

ApiClient.prototype.getDeviceDistribution = async function (): Promise<DeviceDistribution[]> {
  return this.request<DeviceDistribution[]>('/analytics/device-distribution');
};

ApiClient.prototype.getBandwidthUsage = async function (range: string = 'month'): Promise<BandwidthUsage[]> {
  return this.request<BandwidthUsage[]>(`/analytics/bandwidth?range=${range}`);
};

ApiClient.prototype.getPlaylistPerformance = async function (range: string = 'month'): Promise<PlaylistPerformance[]> {
  return this.request<PlaylistPerformance[]>(`/analytics/playlist-performance?range=${range}`);
};

ApiClient.prototype.exportAnalytics = async function (range: string = 'month'): Promise<AnalyticsExport> {
  return this.request<AnalyticsExport>(`/analytics/export?range=${range}`);
};

ApiClient.prototype.getDeviceUptime = async function (
  deviceId: string,
  days?: number,
): Promise<{
  deviceId: string;
  uptimePercent: number;
  totalOnlineMinutes: number;
  totalOfflineMinutes: number;
  lastHeartbeat: string | null;
}> {
  const params = days ? `?days=${days}` : '';
  return this.request<{
    deviceId: string;
    uptimePercent: number;
    totalOnlineMinutes: number;
    totalOfflineMinutes: number;
    lastHeartbeat: string | null;
  }>(`/analytics/device-uptime/${deviceId}${params}`);
};

ApiClient.prototype.getUptimeSummary = async function (days?: number): Promise<{
  avgUptimePercent: number;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  devices: Array<{ id: string; nickname: string; uptimePercent: number }>;
}> {
  const params = days ? `?days=${days}` : '';
  return this.request<{
    avgUptimePercent: number;
    deviceCount: number;
    onlineCount: number;
    offlineCount: number;
    devices: Array<{ id: string; nickname: string; uptimePercent: number }>;
  }>(`/analytics/uptime-summary${params}`);
};
