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

export interface DeviceUptimeResult {
  deviceId: string;
  uptimePercent: number;
  totalOnlineMinutes: number;
  totalOfflineMinutes: number;
  lastHeartbeat: Date | null;
  isEstimated?: boolean;
  metricSource?: 'heartbeat_status_heuristic';
}

export interface UptimeSummaryResult {
  avgUptimePercent: number;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  devices: Array<{ id: string; nickname: string; uptimePercent: number }>;
  isEstimated?: boolean;
  metricSource?: 'heartbeat_status_heuristic';
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
