'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import type { StorageInfo } from '@/lib/api/organizations';
import { useDeviceStatus } from '@/lib/context/DeviceStatusContext';
import UpgradeBanner from '@/components/UpgradeBanner';
import { HelpIcon } from '@/components/Tooltip';
import { isApiError } from '@/lib/error-handler';
import { Icon, type IconName, iconMap } from '@/theme/icons';
import type { AnalyticsSummary } from '@/lib/types';

// Helper to ensure valid icon names
const getValidIconName = (name: string | undefined): IconName => {
 if (!name || !(name in iconMap)) {
 return 'overview'; // fallback to overview icon
 }
 return name as IconName;
};

interface DashboardClientProps {
 initialContent: any[];
 initialPlaylists: any[];
 initialStats?: DashboardStats | null;
 initialContentSampleReady?: boolean;
 initialPlaylistsSampleReady?: boolean;
 initialStorageInfo?: StorageInfo | null;
 initialSystemHealth?: DashboardSystemHealth | null;
}

type DashboardHealthStatus = 'ok' | 'degraded' | 'unhealthy' | 'unknown';

interface DashboardSystemHealth {
 status: DashboardHealthStatus;
 timestamp?: string;
 message?: string;
 checks?: Record<string, { status?: string; message?: string }>;
}

type DashboardListResult = {
 data: any[];
};

type DashboardStats = {
 devices: { total: number; online: number };
 content: { total: number; processing: number };
 playlists: { total: number; active: number };
};

const UNKNOWN_HEALTH: DashboardSystemHealth = {
 status: 'unknown',
 message: 'Readiness unavailable',
};

const EMPTY_STATS: DashboardStats = {
 devices: { total: 0, online: 0 },
 content: { total: 0, processing: 0 },
 playlists: { total: 0, active: 0 },
};

const DASHBOARD_ACTIVITY_LIMIT = 3;

const formatBytes = (bytes: number): string => {
 if (!Number.isFinite(bytes) || bytes <= 0) {
 return '0 B';
 }

 const units = ['B', 'KB', 'MB', 'GB', 'TB'];
 let value = bytes;
 let unitIndex = 0;

 while (value >= 1024 && unitIndex < units.length - 1) {
 value /= 1024;
 unitIndex += 1;
 }

 const valueText = Number.isInteger(value) || value >= 10
 ? value.toFixed(0)
 : value.toFixed(1);
 return `${valueText} ${units[unitIndex]}`;
};

const getStorageUsagePercent = (storageInfo: StorageInfo | null): number => {
 if (!storageInfo || storageInfo.quotaBytes <= 0) {
 return 0;
 }

 const reportedPercent = Number.isFinite(storageInfo.usagePercent)
 ? storageInfo.usagePercent
 : (storageInfo.usedBytes / storageInfo.quotaBytes) * 100;

 return Math.max(0, Math.min(reportedPercent, 100));
};

const getHealthSummary = (health: DashboardSystemHealth | null) => {
 switch (health?.status) {
 case 'ok':
 return {
 label: 'Healthy',
 detail: 'All systems operational',
 dotClassName: 'bg-success-300 animate-pulse',
 cardClassName: 'bg-gradient-to-br from-[#00E5A0] to-[#00B4D8]',
 textClassName: 'text-primary-100',
 iconClassName: 'text-primary-200',
 };
 case 'degraded':
 return {
 label: 'Degraded',
 detail: health.message || 'Some dependencies degraded',
 dotClassName: 'bg-amber-200 animate-pulse',
 cardClassName: 'bg-gradient-to-br from-amber-500 to-orange-500',
 textClassName: 'text-amber-50',
 iconClassName: 'text-amber-100',
 };
 case 'unhealthy':
 return {
 label: 'Critical',
 detail: health.message || 'Core service needs attention',
 dotClassName: 'bg-red-200 animate-pulse',
 cardClassName: 'bg-gradient-to-br from-red-600 to-rose-500',
 textClassName: 'text-red-50',
 iconClassName: 'text-red-100',
 };
 default:
 return {
 label: 'Unknown',
 detail: 'Status unavailable',
 dotClassName: 'bg-slate-300',
 cardClassName: 'bg-gradient-to-br from-slate-600 to-slate-500',
 textClassName: 'text-slate-100',
 iconClassName: 'text-slate-200',
 };
 }
};

const loadSystemHealth = async (): Promise<DashboardSystemHealth> => {
 try {
 return await apiClient.get<DashboardSystemHealth>('/health/ready');
 } catch (error) {
 if (isApiError(error) && error.statusCode === 503) {
 return {
 status: 'unhealthy',
 message: 'Core service needs attention',
 };
 }

 if (process.env.NODE_ENV === 'development') {
 console.warn('System readiness check failed:', error);
 }
 return UNKNOWN_HEALTH;
 }
};

const statsFromSummary = (summary: AnalyticsSummary): DashboardStats => ({
 devices: {
 total: summary.totalDevices ?? 0,
 online: summary.onlineDevices ?? 0,
 },
 content: {
 total: summary.totalContent ?? 0,
 processing: summary.processingContent ?? 0,
 },
 playlists: {
 total: summary.totalPlaylists ?? 0,
 active: summary.activePlaylists ?? 0,
 },
});

const statsFromDeviceStatuses = (
 statuses: Record<string, any>,
 minimumTotal = 0,
): DashboardStats['devices'] | null => {
 const devicesList = Object.values(statuses);
 if (devicesList.length === 0) {
 return null;
 }

 return {
 total: Math.max(minimumTotal, devicesList.length),
 online: devicesList.filter((d: any) => d.status === 'online').length,
 };
};

const statsFromSamples = (content: any[], playlists: any[]): DashboardStats => ({
 devices: { ...EMPTY_STATS.devices },
 content: {
 total: content.length,
 processing: content.filter((c: any) => c?.status === 'processing').length,
 },
 playlists: {
 total: playlists.length,
 active: playlists.filter((p: any) => (p?.items?.length || 0) > 0 || p?.isDefault === true).length,
 },
});

export default function DashboardClient({
 initialContent,
 initialPlaylists,
 initialStats = null,
 initialContentSampleReady = false,
 initialPlaylistsSampleReady = false,
 initialStorageInfo = null,
 initialSystemHealth = null,
}: DashboardClientProps) {
 const router = useRouter();
 const { deviceStatuses, isInitialized } = useDeviceStatus();
 const [stats, setStats] = useState<DashboardStats>(() => initialStats ?? statsFromSamples(initialContent, initialPlaylists));
 const [recentActivity, setRecentActivity] = useState<any[]>([]);
 const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(initialStorageInfo);
 const [systemHealth, setSystemHealth] = useState<DashboardSystemHealth | null>(
 initialSystemHealth,
 );
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const activityContentRef = useRef(initialContent);
 const activityPlaylistsRef = useRef(initialPlaylists);
 const deviceStatusesRef = useRef(deviceStatuses);
 const initialRefreshCompleteRef = useRef(false);
 const skipInitialAutoRefreshRef = useRef(!!initialStats
  && initialContentSampleReady
  && initialPlaylistsSampleReady
  && !!initialStorageInfo
  && !!initialSystemHealth);
 deviceStatusesRef.current = deviceStatuses;

 // Initialize stats from server-fetched data
 useEffect(() => {
 const content = initialContent;
 const playlists = initialPlaylists;
 activityContentRef.current = content;
 activityPlaylistsRef.current = playlists;

 setStats(prev => initialStats ?? {
 ...prev,
 ...statsFromSamples(content, playlists),
 devices: prev.devices,
 });

 buildRecentActivity(content, playlists, deviceStatusesRef.current);
 }, [initialContent, initialPlaylists, initialStats]);

 useEffect(() => {
 setStorageInfo(initialStorageInfo);
 }, [initialStorageInfo]);

 useEffect(() => {
 setSystemHealth(initialSystemHealth);
 }, [initialSystemHealth]);

 useEffect(() => {
  if (skipInitialAutoRefreshRef.current) {
  initialRefreshCompleteRef.current = true;
  return;
  }
  loadStats(false);
  }, []);

 // Update device stats from context (real-time)
 useEffect(() => {
 if (!isInitialized) return;

 const deviceStats = statsFromDeviceStatuses(deviceStatuses);
 if (!deviceStats) {
 buildRecentActivity(activityContentRef.current, activityPlaylistsRef.current, deviceStatuses);
 return;
 }

 setStats(prev => ({
 ...prev,
 devices: statsFromDeviceStatuses(deviceStatuses, prev.devices.total) ?? prev.devices,
 }));
 buildRecentActivity(activityContentRef.current, activityPlaylistsRef.current, deviceStatuses);
 }, [deviceStatuses, isInitialized]);

 const buildRecentActivity = (content: any[], playlists: any[], statuses = deviceStatuses) => {
 const devicesList = Object.values(statuses);
 const activity = [
 ...devicesList.slice(0, 3).map((d: any) => ({
 type: 'device',
 iconName: getValidIconName('devices'),
 title: d.metadata?.nickname || 'Unnamed Device',
 subtitle: `${d.status || 'unknown'} - ${d.metadata?.location || 'No location'}`,
 time: d.metadata?.lastSeen || new Date().toISOString(),
 })),
 ...content.slice(0, 3).map((c: any) => {
 const contentType = c.type?.toLowerCase() || '';
 const iconName = contentType === 'image' ? 'image'
 : contentType === 'video' ? 'video'
 : 'document';
 return {
 type: 'content',
 iconName: getValidIconName(iconName),
 title: c.title || 'Untitled',
 subtitle: `${c.type || 'file'} - ${c.status || 'ready'}`,
 time: c.createdAt || new Date().toISOString(),
 };
 }),
 ...playlists.slice(0, 3).map((p: any) => ({
 type: 'playlist',
 iconName: getValidIconName('playlists'),
 title: p.name || 'Untitled Playlist',
 subtitle: `${p.items?.length || 0} items`,
 time: p.updatedAt || p.createdAt || new Date().toISOString(),
 })),
 ]
 .filter((item) => item.title && item.time && item.iconName)
 .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
 .slice(0, 8);

 setRecentActivity(activity);
 };

 const loadStats = async (showLoading = true) => {
 try {
 if (showLoading) setLoading(true);
 const isInitialAutoRefresh = !showLoading && !initialRefreshCompleteRef.current;
 if (isInitialAutoRefresh) {
 initialRefreshCompleteRef.current = true;
 }

 const summaryPromise = apiClient.getAnalyticsSummary();
 const contentPromise: Promise<DashboardListResult> = isInitialAutoRefresh && initialContentSampleReady
 ? Promise.resolve({ data: activityContentRef.current })
 : apiClient.getContent({ page: 1, limit: DASHBOARD_ACTIVITY_LIMIT })
 .then((response) => ({ data: response.data ?? [] }));
 const playlistsPromise: Promise<DashboardListResult> = isInitialAutoRefresh && initialPlaylistsSampleReady
 ? Promise.resolve({ data: activityPlaylistsRef.current })
 : apiClient.getPlaylists({ page: 1, limit: DASHBOARD_ACTIVITY_LIMIT })
 .then((response) => ({ data: response.data ?? [] }));

 const results = await Promise.allSettled([
 summaryPromise,
 contentPromise,
 playlistsPromise,
 apiClient.getStorageInfo(),
 loadSystemHealth(),
 ]);

 const summary = results[0].status === 'fulfilled' ? results[0].value : null;
 const content = results[1].status === 'fulfilled' ? results[1].value.data : null;
 const playlists = results[2].status === 'fulfilled' ? results[2].value.data : null;
 if (content) activityContentRef.current = content;
 if (playlists) activityPlaylistsRef.current = playlists;
 if (results[3].status === 'fulfilled') {
 setStorageInfo(results[3].value);
 }
 if (results[4].status === 'fulfilled') {
 setSystemHealth(results[4].value);
 }

 results.slice(0, 3).forEach((result, index) => {
 if (result.status === 'rejected') {
 if (process.env.NODE_ENV === 'development') {
 console.warn(`API call ${index + 1} failed:`, result.reason);
 }
 }
 });

 if (summary) {
 setStats(() => {
 const next = statsFromSummary(summary);
 return {
 ...next,
 devices: statsFromDeviceStatuses(deviceStatusesRef.current, next.devices.total) ?? next.devices,
 };
 });
 }

 if (content || playlists) {
 buildRecentActivity(
 activityContentRef.current,
 activityPlaylistsRef.current,
 deviceStatusesRef.current,
 );
 }

 if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled' && results[2].status === 'fulfilled') {
 setError(null);
 } else {
 setError('Some dashboard data could not refresh');
 }
 } catch (error) {
 if (process.env.NODE_ENV === 'development') {
  console.error('Failed to load stats:', error);
 }
 setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
 } finally {
 if (showLoading) setLoading(false);
 }
 };

 if (loading) {
 return (
 <div className="space-y-6">
 <div>
 <div className="h-8 w-48 bg-[var(--surface)] rounded-lg animate-pulse" />
 <div className="h-4 w-72 bg-[var(--surface)] rounded mt-3 animate-pulse" />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)] animate-pulse">
 <div className="flex items-center justify-between mb-4">
 <div className="h-4 w-24 bg-[var(--background-tertiary)] rounded" />
 <div className="h-8 w-8 bg-[var(--background-tertiary)] rounded" />
 </div>
 <div className="h-10 w-16 bg-[var(--background-tertiary)] rounded mb-2" />
 <div className="h-3 w-20 bg-[var(--background-tertiary)] rounded" />
 </div>
 ))}
 </div>
 <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6 animate-pulse">
 <div className="h-5 w-32 bg-[var(--background-tertiary)] rounded mb-4" />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="h-16 bg-[var(--background-tertiary)] rounded-lg" />
 ))}
 </div>
 </div>
 </div>
 );
 }

 const healthSummary = getHealthSummary(systemHealth);
 const storageUsagePercent = getStorageUsagePercent(storageInfo);
 const hasStorageQuota = !!storageInfo && storageInfo.quotaBytes > 0;
 const storageUsageText = storageInfo
 ? `${formatBytes(storageInfo.usedBytes)} / ${storageInfo.quotaBytes > 0 ? formatBytes(storageInfo.quotaBytes) : 'No quota'}`
 : 'Not reported';
 const storageFooterText = storageInfo
 ? hasStorageQuota
 ? `${storageUsagePercent.toFixed(1)}% used`
 : 'Quota unavailable'
 : 'Storage data unavailable';

 return (
 <div className="space-y-8">
 <div>
 <h2 className="eh-dash-title text-2xl text-[var(--foreground)]">Dashboard Overview</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Welcome to your Vizora dashboard. Here's what's happening.
 </p>
 </div>

 {/* Upgrade Banner (shows when approaching limits) */}
 <UpgradeBanner />

 {/* Error Banner */}
 {error && (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
 <Icon name="error" size="lg" className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
 <div className="flex-1">
 <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
 Error loading dashboard data
 </h3>
 <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
 <button
 onClick={() => loadStats()}
 className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
 >
 Try again
 </button>
 </div>
 </div>
 )}

 {/* Stats Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <Link
 href="/dashboard/devices"
 className="eh-dash-card w-full p-6 text-left hover:-translate-y-[2px] hover:border-[rgba(0,229,160,0.2)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/40 transition-all duration-300 cursor-pointer animate-[fadeIn_0.3s_ease-out]"
 >
 <div className="flex items-center justify-between mb-4">
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">Total Devices</p>
 <Icon name="devices" size="2xl" className="text-[var(--foreground-secondary)]" />
 </div>
 <p className="text-4xl font-bold text-[var(--foreground)] font-[var(--font-sora)] mb-2">{stats.devices.total}</p>
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 bg-success-500 rounded-full"></span>
 <p className="text-sm text-success-600 dark:text-success-400 font-medium">
 {stats.devices.online} online
 </p>
 </div>
 </Link>

 <Link
 href="/dashboard/content"
 className="eh-dash-card w-full p-6 text-left hover:-translate-y-[2px] hover:border-[rgba(0,229,160,0.2)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/40 transition-all duration-300 cursor-pointer animate-[fadeIn_0.4s_ease-out]"
 >
 <div className="flex items-center justify-between mb-4">
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">Content Items</p>
 <Icon name="content" size="2xl" className="text-[var(--foreground-secondary)]" />
 </div>
 <p className="text-4xl font-bold text-[var(--foreground)] font-[var(--font-sora)] mb-2">{stats.content.total}</p>
 <p className="text-sm text-[var(--foreground-tertiary)]">
 {stats.content.processing > 0
 ? `${stats.content.processing} processing`
 : 'All ready'}
 </p>
 </Link>

 <Link
 href="/dashboard/playlists"
 className="eh-dash-card w-full p-6 text-left hover:-translate-y-[2px] hover:border-[rgba(0,229,160,0.2)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/40 transition-all duration-300 cursor-pointer animate-[fadeIn_0.5s_ease-out]"
 >
 <div className="flex items-center justify-between mb-4">
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">Playlists</p>
 <Icon name="playlists" size="2xl" className="text-[var(--foreground-secondary)]" />
 </div>
 <p className="text-4xl font-bold text-[var(--foreground)] font-[var(--font-sora)] mb-2">{stats.playlists.total}</p>
 <p className="text-sm text-[var(--foreground-tertiary)]">
 {stats.playlists.active} ready
 </p>
 </Link>

 <div className={`${healthSummary.cardClassName} p-6 rounded-lg border border-[var(--border)] hover:-translate-y-[2px] hover:shadow-md transition-all duration-300 text-white animate-[fadeIn_0.6s_ease-out]`}>
 <div className="flex items-center justify-between mb-4">
 <p className={`text-sm font-medium ${healthSummary.textClassName}`}>System Status</p>
 <Icon name="power" size="2xl" className={healthSummary.iconClassName} />
 </div>
 <p className="text-4xl font-bold mb-2">{healthSummary.label}</p>
 <div className="flex items-center gap-2">
 <span className={`w-2 h-2 rounded-full ${healthSummary.dotClassName}`}></span>
 <p className={`text-sm ${healthSummary.textClassName}`}>{healthSummary.detail}</p>
 </div>
 </div>
 </div>

 {/* Quick Actions */}
 <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
 <div className="flex items-center gap-2 mb-4">
 <h3 className="eh-dash-subtitle text-lg text-[var(--foreground)]">Quick Actions</h3>
 <HelpIcon content="Common tasks to get started quickly" position="right" />
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <button
 onClick={() => router.push('/dashboard/devices/pair')}
 className="eh-dash-card eh-dash-card-interactive p-5 flex items-center gap-3 transition-all transform hover:scale-105"
 >
 <Icon name="add" size="2xl" className="text-[#00E5A0]" />
 <div className="text-left">
 <div className="font-semibold text-[var(--foreground)]">Pair Device</div>
 <div className="text-xs text-[var(--foreground-secondary)]">Add new display</div>
 </div>
 </button>

 <button
 onClick={() => router.push('/dashboard/content')}
 className="eh-dash-card eh-dash-card-interactive p-5 flex items-center gap-3 transition-all transform hover:scale-105"
 >
 <Icon name="upload" size="2xl" className="text-[#00E5A0]" />
 <div className="text-left">
 <div className="font-semibold text-[var(--foreground)]">Upload Content</div>
 <div className="text-xs text-[var(--foreground-secondary)]">Add new media</div>
 </div>
 </button>

 <button
 onClick={() => router.push('/dashboard/playlists')}
 className="eh-dash-card eh-dash-card-interactive p-5 flex items-center gap-3 transition-all transform hover:scale-105"
 >
 <Icon name="playlists" size="2xl" className="text-[#00E5A0]" />
 <div className="text-left">
 <div className="font-semibold text-[var(--foreground)]">Create Playlist</div>
 <div className="text-xs text-[var(--foreground-secondary)]">Organize content</div>
 </div>
 </button>

 <button
 onClick={() => router.push('/dashboard/schedules')}
 className="eh-dash-card eh-dash-card-interactive p-5 flex items-center gap-3 transition-all transform hover:scale-105"
 >
 <Icon name="schedules" size="2xl" className="text-[#00E5A0]" />
 <div className="text-left">
 <div className="font-semibold text-[var(--foreground)]">Schedule</div>
 <div className="text-xs text-[var(--foreground-secondary)]">Set up timing</div>
 </div>
 </button>
 </div>
 </div>

 {/* Recent Activity */}
 <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
 <h3 className="eh-dash-subtitle text-lg text-[var(--foreground)] mb-4">Recent Activity</h3>
 {recentActivity.length > 0 ? (
 <div className="space-y-3">
 {recentActivity.map((item, idx) => (
 <div
 key={idx}
 className="flex items-center gap-3 px-4 py-3 bg-[var(--background)] rounded-lg hover:bg-[var(--surface-hover)] transition-all duration-200"
 >
 <Icon name={item.iconName || 'overview'} size="lg" className="text-[var(--foreground-secondary)]" />
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium text-[var(--foreground)] truncate">
 {item.title}
 </div>
 <div className="text-xs text-[var(--foreground-tertiary)]">{item.subtitle}</div>
 </div>
 <div className="text-xs text-[var(--foreground-tertiary)] whitespace-nowrap">
 {new Date(item.time).toLocaleString(undefined, {
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 })}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-[var(--foreground-tertiary)]">
 <Icon name="overview" size="3xl" className="mx-auto mb-4 text-[var(--foreground-tertiary)]" />
 <p className="text-sm">No recent activity yet</p>
 <p className="text-xs mt-2">Activity will appear here as you add devices and content</p>
 </div>
 )}
 </div>

 {/* Storage Usage */}
 <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="eh-dash-subtitle text-lg text-[var(--foreground)]">Storage Usage</h3>
 <Icon name="storage" size="xl" className="text-[var(--foreground-secondary)]" />
 </div>
 <div className="space-y-3">
 <div className="flex justify-between text-sm">
 <span className="text-[var(--foreground-secondary)]">Content Storage</span>
 <span className="font-medium text-[var(--foreground)]">
 {storageUsageText}
 </span>
 </div>
 <div className="eh-progress">
 <div
 className="eh-progress-bar transition-all duration-500"
 style={{
 width: `${storageUsagePercent}%`,
 }}
 />
 </div>
 <div className="flex justify-between text-xs text-[var(--foreground-tertiary)]">
 <span>{stats.content.total} {storageInfo ? 'items stored' : 'items tracked'}</span>
 <span>{storageFooterText}</span>
 </div>
 </div>
 </div>

 {/* Getting Started Guide */}
 {stats.devices.total === 0 && (
 <div className="bg-gradient-to-r from-[#00E5A0] to-[#00B4D8] rounded-lg shadow-lg p-8 text-white">
 <h3 className="eh-dash-subtitle text-2xl font-bold mb-4 flex items-center gap-2"><Icon name="power" size="xl" className="text-white" /> Getting Started</h3>
 <p className="mb-6 text-primary-100">
 Welcome to Vizora! Follow these steps to get your digital signage system up and running:
 </p>
 <div className="space-y-4">
 <div className="flex items-start gap-4">
 <div className="w-8 h-8 bg-[var(--surface)] text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
 1
 </div>
 <div>
 <div className="font-semibold mb-1">Pair Your First Device</div>
 <div className="text-sm text-primary-100">
 Connect a display device to start showing content
 </div>
 </div>
 </div>
 <div className="flex items-start gap-4">
 <div className="w-8 h-8 bg-[var(--surface)] text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
 2
 </div>
 <div>
 <div className="font-semibold mb-1">Upload Your Content</div>
 <div className="text-sm text-primary-100">
 Add images, videos, or other media to your library
 </div>
 </div>
 </div>
 <div className="flex items-start gap-4">
 <div className="w-8 h-8 bg-[var(--surface)] text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
 3
 </div>
 <div>
 <div className="font-semibold mb-1">Create a Playlist</div>
 <div className="text-sm text-primary-100">
 Organize your content into playlists
 </div>
 </div>
 </div>
 <div className="flex items-start gap-4">
 <div className="w-8 h-8 bg-[var(--surface)] text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
 4
 </div>
 <div>
 <div className="font-semibold mb-1">Assign & Schedule</div>
 <div className="text-sm text-primary-100">
 Assign playlists to devices and set schedules
 </div>
 </div>
 </div>
 </div>
 <button
 onClick={() => router.push('/dashboard/devices/pair')}
 className="mt-6 eh-btn-neon rounded-xl px-6 py-3 font-semibold transition shadow-md"
 >
 Get Started - Pair Device
 </button>
 </div>
 )}

 </div>
 );
}
