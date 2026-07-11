export interface DeviceMetricDataPoint {
  date: string;
  mobile: number;
  tablet: number;
  desktop: number;
  isEstimated?: boolean;
  metricSource?: 'display_inventory_estimate';
  unit?: 'percent';
}

export interface ContentPerformanceItem {
  title: string;
  impressions: number;
  averageCompletion: number;
  /** @deprecated Legacy alias for impressions. */
  views: number;
  /** @deprecated Legacy alias for averageCompletion. */
  engagement: number;
  /** @deprecated Shares are not tracked; kept as zero for response compatibility. */
  shares: number;
  impressionsSource?: 'content_impressions';
  engagementSource?: 'content_impressions';
  sharesTracked?: boolean;
}

export interface UsageTrendDataPoint {
  date: string;
  video: number;
  image: number;
  text: number;
  interactive: number;
  other: number;
}

export interface DeviceDistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface BandwidthDataPoint {
  time: string;
  current: number;
  average: number;
  peak: number;
  isEstimated?: boolean;
  metricSource?: 'content_size_device_count_estimate';
  unit?: 'MB/day';
}

export interface PlaylistPerformanceItem {
  name: string;
  proofOfPlayImpressions: number;
  averageCompletion: number;
  assignedScreens: number;
  /** @deprecated Legacy alias for proofOfPlayImpressions. */
  plays: number;
  /** @deprecated Legacy alias for averageCompletion. */
  engagement: number;
  /** @deprecated Assigned screen count, not unique playback devices. */
  uniqueDevices: number;
  /** @deprecated Legacy alias for proofOfPlayImpressions. */
  views: number;
  /** @deprecated Legacy alias for averageCompletion. */
  completion: number;
  playsSource?: 'content_impressions';
  completionSource?: 'content_impressions';
  uniqueDevicesSource?: 'assigned_displays';
  uniquePlaybackDevicesTracked?: boolean;
}

export interface AnalyticsSummary {
  totalDevices: number;
  onlineDevices: number;
  totalContent: number;
  processingContent: number;
  totalPlaylists: number;
  activePlaylists: number;
  totalContentSize: number;
  uptimePercent: number;
  onlineNowPercent?: number;
  uptimePercentSource?: 'current_online_ratio';
  uptimePercentIsHistorical?: boolean;
  totalImpressions: number;
}

export interface ContentMetrics {
  totalViews: number;
  avgDuration: number;
  avgCompletion: number;
  dailyTrend: Array<{ date: string; views: number }>;
  topDevices: Array<{ deviceId: string; deviceName: string; views: number }>;
}

/**
 * Uptime source markers. `clickhouse_health_samples` = a real measurement over
 * the durable device-health time-series. `insufficient_data` = no samples yet
 * (freshly wired, device idle, or ClickHouse unreachable) — the percentage is
 * `null`, NEVER a fabricated number. Callers must render insufficient data as
 * "—"/"insufficient", not as a measured percentage.
 */
export type UptimeMetricSource = 'clickhouse_health_samples' | 'insufficient_data';

export interface DeviceUptimeResult {
  deviceId: string;
  /** `true` only when computed from real ClickHouse samples. */
  measured: boolean;
  /** Measured uptime %, or `null` when there is insufficient data. */
  uptimePercent: number | null;
  /** Health samples observed over the window (0 ⇒ insufficient data). */
  sampleCount: number;
  totalOnlineMinutes: number | null;
  totalOfflineMinutes: number | null;
  lastHeartbeat: Date | null;
  windowDays: number;
  metricSource: UptimeMetricSource;
}

export interface UptimeSummaryDevice {
  id: string;
  nickname: string;
  measured: boolean;
  uptimePercent: number | null;
  sampleCount: number;
}

export interface UptimeSummaryResult {
  /** `true` when at least one device has a real measurement. */
  measured: boolean;
  /** Average uptime % across measured devices, or `null` when none have data. */
  avgUptimePercent: number | null;
  deviceCount: number;
  /** Devices with real ClickHouse samples over the window. */
  measuredDeviceCount: number;
  /** Currently-online device count (live Display status — always real). */
  onlineCount: number;
  offlineCount: number;
  devices: UptimeSummaryDevice[];
  windowDays: number;
  metricSource: UptimeMetricSource;
}

export interface ExportAnalyticsResult {
  summary: AnalyticsSummary;
  deviceMetrics: DeviceMetricDataPoint[];
  contentPerformance: ContentPerformanceItem[];
  usageTrends: UsageTrendDataPoint[];
  deviceDistribution: DeviceDistributionItem[];
  bandwidthUsage: BandwidthDataPoint[];
  playlistPerformance: PlaylistPerformanceItem[];
}
