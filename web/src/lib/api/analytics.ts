// Analytics API methods

import type {
  AnalyticsSummary, DeviceMetric, ContentPerformance, UsageTrend,
  DeviceDistribution, BandwidthUsage, PlaylistPerformance, AnalyticsExport,
} from '../types';
import { ApiClient } from './client';

/**
 * Uptime source. `clickhouse_health_samples` = a real measurement over the
 * durable device-health time-series. `insufficient_data` = no history yet
 * (freshly wired, device idle, or ClickHouse unreachable) — `uptimePercent` is
 * `null`, NEVER a fabricated number. Render insufficient data as "—", not 0%.
 */
export type UptimeMetricSource = 'clickhouse_health_samples' | 'insufficient_data';

export interface DeviceUptime {
  deviceId: string;
  measured: boolean;
  uptimePercent: number | null;
  sampleCount: number;
  totalOnlineMinutes: number | null;
  totalOfflineMinutes: number | null;
  lastHeartbeat: string | null;
  windowDays: number;
  metricSource: UptimeMetricSource;
}

export interface UptimeSummary {
  measured: boolean;
  avgUptimePercent: number | null;
  deviceCount: number;
  measuredDeviceCount: number;
  onlineCount: number;
  offlineCount: number;
  devices: Array<{
    id: string;
    nickname: string;
    measured: boolean;
    uptimePercent: number | null;
    sampleCount: number;
  }>;
  windowDays: number;
  metricSource: UptimeMetricSource;
}

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
    getDeviceUptime(deviceId: string, days?: number): Promise<DeviceUptime>;
    getUptimeSummary(days?: number): Promise<UptimeSummary>;
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
): Promise<DeviceUptime> {
  const params = days ? `?days=${days}` : '';
  return this.request<DeviceUptime>(`/analytics/device-uptime/${deviceId}${params}`);
};

ApiClient.prototype.getUptimeSummary = async function (days?: number): Promise<UptimeSummary> {
  const params = days ? `?days=${days}` : '';
  return this.request<UptimeSummary>(`/analytics/uptime-summary${params}`);
};
