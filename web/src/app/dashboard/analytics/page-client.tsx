'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, BarChart, PieChart, AreaChart } from '@/components/charts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/theme/icons';
import { useRealtimeEvents } from '@/lib/hooks';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import type { AnalyticsSummary } from '@/lib/types';
import {
 useDeviceMetrics,
 useContentPerformance,
 useUsageTrends,
 useDeviceDistribution,
 useBandwidthUsage,
 usePlaylistPerformance,
} from '@/lib/hooks/useAnalyticsData';

const EmptyChartState: React.FC<{ message?: string }> = ({ message }) => (
 <div className="h-80 flex flex-col items-center justify-center text-[var(--foreground-tertiary)]">
 <Icon name="analytics" size="lg" className="mb-3 opacity-40" />
 <p className="text-sm">{message || 'No data yet. Analytics will appear as devices report content playback.'}</p>
 </div>
);

const ChartErrorState: React.FC<{ message: string; detail?: string | null }> = ({ message, detail }) => (
 <div
 role="alert"
 className="h-80 flex flex-col items-center justify-center text-center text-[var(--foreground-secondary)] px-6"
 >
 <Icon name="error" size="lg" className="mb-3 text-[var(--error)]" />
 <p className="text-sm font-medium text-[var(--foreground)]">{message}</p>
 {detail && (
 <p className="mt-2 text-xs text-[var(--foreground-tertiary)] max-w-md">
 {detail}
 </p>
 )}
 </div>
);

interface KPICardProps {
 label: string;
 value: string;
 change?: string;
 changeType?: 'positive' | 'negative' | 'neutral';
 icon?: IconName;
}

interface AnalyticsCsvExport {
 summary?: Partial<AnalyticsSummary>;
 deviceMetrics?: Array<{ date: string; availabilityEstimate?: number }>;
 contentPerformance?: Array<{
  title?: string;
  name?: string;
  impressions?: number;
  averageCompletion?: number;
  views?: number;
  engagement?: number;
 }>;
 playlistPerformance?: Array<{
  name: string;
  proofOfPlayImpressions?: number;
  averageCompletion?: number;
  assignedScreens?: number;
  plays?: number;
  engagement?: number;
  uniqueDevices?: number;
  completion?: number;
 }>;
}

const KPICard: React.FC<KPICardProps> = ({
 label,
 value,
 change,
 changeType = 'neutral',
 icon,
}) => (
 <Card className="eh-dash-card">
 <Card.Body className="p-6">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">
 {label}
 </p>
 <p className="text-3xl font-bold font-[var(--font-sora)] text-[var(--foreground)] mt-2">
 {value}
 </p>
 {change && (
 <p
 className={`text-sm mt-2 ${
 changeType === 'positive'
 ? 'text-[var(--success)]'
 : changeType === 'negative'
 ? 'text-[var(--error)]'
 : 'text-[var(--accent-warm)]'
 }`}
 >
 {changeType === 'positive' && '↑ '}
 {changeType === 'negative' && '↓ '}
 {change}
 </p>
 )}
 </div>
 {icon && (
 <Icon
 name={icon}
 size="lg"
 className="text-[var(--foreground-tertiary)]"
 />
 )}
 </div>
 </Card.Body>
 </Card>
);

const formatBytes = (bytes: number) => {
 if (!bytes || bytes === 0) return '0 B';
 const k = 1024;
 const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const csvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
const fixedCell = (value: number | undefined): string => typeof value === 'number' ? value.toFixed(1) : '';
const rangeBadgeLabel = (range: 'week' | 'month' | 'year') => {
 if (range === 'week') return 'Last 7 Days';
 if (range === 'year') return '30 sampled days';
 return 'Last 30 Days';
};

export default function AnalyticsClient() {
 const toast = useToast();
 const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
 const [exporting, setExporting] = useState(false);
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline'>('offline');
 const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
 const [summaryError, setSummaryError] = useState<string | null>(null);

 useEffect(() => {
 let cancelled = false;
 apiClient.getAnalyticsSummary()
 .then(data => {
 if (!cancelled) {
 setSummary(data);
 setSummaryError(null);
 }
 })
 .catch(() => {
 if (!cancelled) {
 setSummary(null);
 setSummaryError('Unable to load analytics summary.');
 }
 });

 return () => {
 cancelled = true;
 };
 }, []);

 const deviceMetrics = useDeviceMetrics(dateRange);
 const contentPerformance = useContentPerformance(dateRange);
 const usageTrends = useUsageTrends(dateRange);
 const deviceDistribution = useDeviceDistribution();
 const bandwidthUsage = useBandwidthUsage(dateRange);
 const playlistPerformance = usePlaylistPerformance(dateRange);

 const analyticsErrorSections = [
 { label: 'Analytics summary', error: summaryError },
 { label: 'Estimated availability trend', error: deviceMetrics.error },
 { label: 'Content proof-of-play', error: contentPerformance.error },
 { label: 'Device distribution', error: deviceDistribution.error },
 { label: 'Usage trends', error: usageTrends.error },
 { label: 'Estimated storage footprint', error: bandwidthUsage.error },
 { label: 'Playlist playback summary', error: playlistPerformance.error },
 ].filter((section) => Boolean(section.error));

 const hasAnalyticsErrors = analyticsErrorSections.length > 0;

 const allMockData = !hasAnalyticsErrors &&
   deviceMetrics.isMockData && contentPerformance.isMockData &&
   usageTrends.isMockData && deviceDistribution.isMockData &&
   bandwidthUsage.isMockData && playlistPerformance.isMockData;

 // Real-time analytics updates
 useRealtimeEvents({
 enabled: true,
 onConnectionChange: (connected) => {
 setRealtimeStatus(connected ? 'connected' : 'offline');
 },
 });

 const handleExportCSV = async () => {
 try {
 setExporting(true);
 const data = await apiClient.exportAnalytics(dateRange) as unknown as AnalyticsCsvExport;

 // Build CSV sections
 const sections: string[] = [];

 // Summary section
 if (data.summary) {
 sections.push('SUMMARY');
 sections.push(['Metric', 'Value'].join(','));
 sections.push(`"Total Devices","${data.summary.totalDevices}"`);
 sections.push(`"Online Devices","${data.summary.onlineDevices}"`);
 sections.push(`"Total Content","${data.summary.totalContent}"`);
 sections.push(`"Total Playlists","${data.summary.totalPlaylists}"`);
 sections.push(`"Online Now %","${data.summary.onlineNowPercent ?? data.summary.uptimePercent}"`);
 sections.push('');
 }

 // Device Metrics section
 if (data.deviceMetrics?.length) {
 sections.push('ESTIMATED AVAILABILITY');
 sections.push(['Date', 'Estimated Availability %'].join(','));
 data.deviceMetrics.forEach((d) => {
 sections.push([csvCell(d.date), fixedCell(d.availabilityEstimate)].join(','));
 });
 sections.push('');
 }

 // Content Performance section
 if (data.contentPerformance?.length) {
 sections.push('CONTENT PROOF-OF-PLAY');
 sections.push(['Title', 'Proof-of-Play Impressions', 'Average Completion'].join(','));
 data.contentPerformance.forEach((c) => {
 sections.push([
  csvCell(c.title ?? c.name),
  c.impressions ?? c.views ?? '',
  c.averageCompletion ?? c.engagement ?? '',
 ].join(','));
 });
 sections.push('');
 }

 // Playlist Performance section
 if (data.playlistPerformance?.length) {
 sections.push('PLAYLIST PLAYBACK SUMMARY');
 sections.push(['Name', 'Proof-of-Play Impressions', 'Average Completion', 'Assigned Screens'].join(','));
 data.playlistPerformance.forEach((p) => {
 sections.push([
  csvCell(p.name),
  p.proofOfPlayImpressions ?? p.plays ?? '',
  p.averageCompletion ?? p.completion ?? p.engagement ?? '',
  p.assignedScreens ?? p.uniqueDevices ?? '',
 ].join(','));
 });
 sections.push('');
 }

 const csvContent = sections.join('\n');
 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
 link.click();
 URL.revokeObjectURL(link.href);

 toast.success('Analytics exported successfully');
 } catch (error: unknown) {
 toast.error(error instanceof Error && error.message ? error.message : 'Export failed');
 } finally {
 setExporting(false);
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="eh-dash-title font-[var(--font-sora)] text-2xl text-[var(--foreground)]">
 Analytics
 </h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Current device status and proof-of-play reporting
 {realtimeStatus === 'connected' && (
 <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
 <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
 Realtime connection active
 </span>
 )}
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={handleExportCSV}
 disabled={exporting}
 className="px-4 py-2 rounded-lg font-medium transition-colors bg-[var(--background-tertiary)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50 flex items-center gap-2"
 >
 {exporting ? 'Exporting...' : 'Export CSV'}
 </button>
 <div className="flex gap-3">
 {(['week', 'month', 'year'] as const).map((range) => (
 <button
 key={range}
 onClick={() => setDateRange(range)}
 className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
 dateRange === range
 ? 'bg-primary-600 dark:bg-primary-400 text-white'
 : 'bg-[var(--background-tertiary)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
 }`}
 >
 {range}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
 <KPICard
 label="Total Devices"
 value={summary ? String(summary.totalDevices) : '---'}
 change={summary ? `${summary.onlineDevices} online` : ''}
 changeType="positive"
 icon="devices"
 />
 <KPICard
 label="Content Items"
 value={summary ? String(summary.totalContent) : '---'}
 change={summary ? `${summary.totalPlaylists} playlists` : ''}
 changeType="positive"
 icon="content"
 />
 <KPICard
 label="Total Size"
 value={summary ? formatBytes(summary.totalContentSize) : '---'}
 change=""
 changeType="neutral"
 icon="analytics"
 />
 <KPICard
 label="Online Now"
 value={summary ? `${summary.onlineNowPercent ?? summary.uptimePercent}%` : '---'}
 change={summary ? `${summary.onlineDevices}/${summary.totalDevices} devices online` : summaryError ? 'Unavailable' : ''}
 changeType="neutral"
 icon="overview"
 />
 </div>

 {summary && (
 <p className="text-xs text-[var(--foreground-tertiary)]">
 Current online ratio from display status. Historical uptime is not tracked by this KPI.
 </p>
 )}

 {hasAnalyticsErrors && (
 <div
 role="alert"
 aria-label="Analytics data unavailable"
 className="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-lg px-4 py-3 flex flex-col gap-2"
 >
 <div className="flex items-center gap-2">
 <Icon name="error" size="sm" className="text-[var(--error)]" />
 <span className="text-sm font-medium text-[var(--foreground)]">
 Analytics data unavailable
 </span>
 </div>
 <p className="text-sm text-[var(--foreground-secondary)]">
 Some analytics could not be loaded. Showing any available sections, but do not treat missing charts as no data.
 </p>
 <p className="text-xs text-[var(--foreground-tertiary)]">
 Unavailable: {analyticsErrorSections.map((section) => section.label).join(', ')}
 </p>
 </div>
 )}

 {/* Empty data notice */}
 {allMockData && (
   <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
     <span className="text-blue-400 text-sm font-medium">No Data Yet</span>
     <span className="text-sm text-[var(--foreground-secondary)]">
       Analytics will appear as devices report content playback. Connect devices and upload content to get started.
     </span>
   </div>
 )}

 {/* Charts Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Estimated Availability Trend */}
 <Card className="eh-dash-card lg:col-span-2">
 <Card.Header>
 <div className="flex items-center justify-between">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Estimated Availability Trend
 </h3>
 <Badge variant="info" size="sm" className="eh-badge">
 {rangeBadgeLabel(dateRange)}
 </Badge>
 </div>
 <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
 Measured from device health check-ins: the share of 5-minute windows each day with at least one heartbeat. Days with no telemetry show as 0%.
 </p>
 </Card.Header>
 <Card.Body>
 {deviceMetrics.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : deviceMetrics.error ? (
 <ChartErrorState message="Unable to load estimated availability data." detail={deviceMetrics.error} />
 ) : deviceMetrics.data.length === 0 ? (
 <EmptyChartState message="No availability estimate available yet." />
 ) : (
 <LineChart
 data={deviceMetrics.data}
 dataKeys={[
 { key: 'availabilityEstimate', name: 'Estimated availability' },
 ]}
 xAxisKey="date"
 yAxisLabel="Estimated availability %"
 height={300}
 />
 )}
 </Card.Body>
 </Card>

 {/* Content Proof-of-Play */}
 <Card className="eh-dash-card">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Content Proof-of-Play
 </h3>
 <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
 Impressions and completion are measured from display playback reports. Shares are not tracked.
 </p>
 </Card.Header>
 <Card.Body>
 {contentPerformance.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : contentPerformance.error ? (
 <ChartErrorState message="Unable to load content proof-of-play data." detail={contentPerformance.error} />
 ) : contentPerformance.data.length === 0 ? (
 <EmptyChartState message="No content proof-of-play data yet. Playback impressions appear as displays report content playback." />
 ) : (
 <BarChart
 data={contentPerformance.data}
 dataKeys={[{ key: 'impressions', name: 'Impressions' }]}
 xAxisKey="title"
 height={300}
 layout="vertical"
 />
 )}
 </Card.Body>
 </Card>

 {/* Device Distribution */}
 <Card className="eh-dash-card">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Device Distribution
 </h3>
 </Card.Header>
 <Card.Body>
 {deviceDistribution.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : deviceDistribution.error ? (
 <ChartErrorState message="Unable to load device distribution data." detail={deviceDistribution.error} />
 ) : deviceDistribution.data.length === 0 ? (
 <EmptyChartState message="No devices registered yet. Pair devices to see distribution." />
 ) : (
 <PieChart
 data={deviceDistribution.data}
 dataKey="value"
 nameKey="name"
 height={300}
 showLabel={true}
 />
 )}
 </Card.Body>
 </Card>

 {/* Usage Trends */}
 <Card className="eh-dash-card lg:col-span-2">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Usage Trends by Reported Content Type
 </h3>
 <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
 Proof-of-play impressions grouped into video, image, HTML, URL, and other content types.
 </p>
 </Card.Header>
 <Card.Body>
 {usageTrends.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : usageTrends.error ? (
 <ChartErrorState message="Unable to load usage trends." detail={usageTrends.error} />
 ) : usageTrends.data.length === 0 ? (
 <EmptyChartState message="No usage data yet. Trends will appear as content is played on devices." />
 ) : (
 <AreaChart
 data={usageTrends.data}
 dataKeys={[
 { key: 'video', name: 'Video impressions' },
 { key: 'image', name: 'Image impressions' },
 { key: 'text', name: 'HTML impressions' },
 { key: 'interactive', name: 'URL impressions' },
 { key: 'other', name: 'Other impressions' },
 ]}
 xAxisKey="date"
 yAxisLabel="Impressions"
 height={300}
 stacked={true}
 />
 )}
 </Card.Body>
 </Card>

 {/* Estimated Storage Footprint */}
 <Card className="eh-dash-card lg:col-span-2">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Estimated Storage Footprint
 </h3>
 <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
 Cumulative size of stored content by date, summed from real file sizes. Deleted content is not included; this is not measured network transfer.
 </p>
 </Card.Header>
 <Card.Body>
 {bandwidthUsage.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : bandwidthUsage.error ? (
 <ChartErrorState message="Unable to load estimated storage footprint." detail={bandwidthUsage.error} />
 ) : bandwidthUsage.data.length === 0 ? (
 <EmptyChartState message="No stored content yet. Upload content to see the storage footprint over time." />
 ) : (
 <AreaChart
 data={bandwidthUsage.data}
 dataKeys={[
 { key: 'storageMb', name: 'Stored content size (MB)' },
 ]}
 xAxisKey="time"
 yAxisLabel="MB"
 height={300}
 />
 )}
 </Card.Body>
 </Card>

 {/* Playlist Playback Summary */}
 <Card className="eh-dash-card lg:col-span-2">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Playlist Playback Summary
 </h3>
 <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
 Plays and completion come from proof-of-play reports. Assigned screens are not unique playback devices.
 </p>
 </Card.Header>
 <Card.Body>
 {playlistPerformance.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : playlistPerformance.error ? (
 <ChartErrorState message="Unable to load playlist playback data." detail={playlistPerformance.error} />
 ) : playlistPerformance.data.length === 0 ? (
 <EmptyChartState message="No playlist playback data yet. Assign playlists and wait for proof-of-play reports." />
 ) : (
 <BarChart
 data={playlistPerformance.data}
 dataKeys={[
 { key: 'proofOfPlayImpressions', name: 'Impressions' },
 { key: 'averageCompletion', name: 'Average Completion' },
 ]}
 xAxisKey="name"
 height={300}
 layout="vertical"
 />
 )}
 </Card.Body>
 </Card>
 </div>
 </div>
 );
}
