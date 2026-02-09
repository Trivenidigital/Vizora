export interface DeviceMetricDataPoint {
  date: string;
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface ContentPerformanceItem {
  title: string;
  views: number;
  engagement: number;
  shares: number;
}

export interface UsageTrendDataPoint {
  date: string;
  video: number;
  image: number;
  text: number;
  interactive: number;
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
}

export interface PlaylistPerformanceItem {
  name: string;
  plays: number;
  engagement: number;
  uniqueDevices: number;
  views: number;
  completion: number;
}

export interface AnalyticsSummary {
  totalDevices: number;
  onlineDevices: number;
  totalContent: number;
  totalPlaylists: number;
  totalContentSize: number;
  uptimePercent: number;
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
}

export interface UptimeSummaryResult {
  avgUptimePercent: number;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  devices: Array<{ id: string; nickname: string; uptimePercent: number }>;
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
