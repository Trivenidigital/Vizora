'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, BarChart, PieChart, AreaChart, ComposedChart } from '@/components/charts';
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
 deviceMetrics?: Array<{ date: string; mobile?: number; tablet?: number; desktop?: number }>;
 contentPerformance?: Array<{ title?: string; name?: string; views?: number; engagement?: number; shares?: number }>;
 playlistPerformance?: Array<{ name: string; plays?: number; engagement?: number; uniqueDevices?: number; completion?: number }>;
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

export default function AnalyticsClient() {
 const toast = useToast();
 const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
 const [exporting, setExporting] = useState(false);
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline'>('offline');
 const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
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
 { label: 'Device uptime timeline', error: deviceMetrics.error },
 { label: 'Content performance', error: contentPerformance.error },
 { label: 'Device distribution', error: deviceDistribution.error },
 { label: 'Usage trends', error: usageTrends.error },
 { label: 'Bandwidth usage', error: bandwidthUsage.error },
 { label: 'Playlist performance', error: playlistPerformance.error },
 ].filter((section) => Boolean(section.error));

 const hasAnalyticsErrors = analyticsErrorSections.length > 0;

 const allMockData = !hasAnalyticsErrors &&
   deviceMetrics.isMockData && contentPerformance.isMockData &&
   usageTrends.isMockData && deviceDistribution.isMockData &&
   bandwidthUsage.isMockData && playlistPerformance.isMockData;

 // Real-time analytics updates
 useRealtimeEvents({
 enabled: true,
 onDeviceStatusChange: () => {
 // Device status changes may affect uptime metrics
 setLastUpdate(new Date());
 },
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
 sections.push(`"Uptime %","${data.summary.uptimePercent}"`);
 sections.push('');
 }

 // Device Metrics section
 if (data.deviceMetrics?.length) {
 sections.push('DEVICE METRICS');
 sections.push(['Date', 'Mobile', 'Tablet', 'Desktop'].join(','));
 data.deviceMetrics.forEach((d) => {
 sections.push([csvCell(d.date), fixedCell(d.mobile), fixedCell(d.tablet), fixedCell(d.desktop)].join(','));
 });
 sections.push('');
 }

 // Content Performance section
 if (data.contentPerformance?.length) {
 sections.push('CONTENT PERFORMANCE');
 sections.push(['Title', 'Views', 'Engagement', 'Shares'].join(','));
 data.contentPerformance.forEach((c) => {
 sections.push([csvCell(c.title ?? c.name), c.views ?? '', c.engagement ?? '', c.shares ?? ''].join(','));
 });
 sections.push('');
 }

 // Playlist Performance section
 if (data.playlistPerformance?.length) {
 sections.push('PLAYLIST PERFORMANCE');
 sections.push(['Name', 'Plays', 'Engagement', 'Unique Devices', 'Completion'].join(','));
 data.playlistPerformance.forEach((p) => {
 sections.push([csvCell(p.name), p.plays ?? '', p.engagement ?? '', p.uniqueDevices ?? '', p.completion ?? ''].join(','));
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
 Real-time performance metrics and insights
 {realtimeStatus === 'connected' && (
 <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
 <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
 Real-time active
 </span>
 )}
 {lastUpdate && (
 <span className="ml-2 text-xs text-[var(--foreground-tertiary)]">
 Updated {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
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
 label="System Uptime"
 value={summary ? `${summary.uptimePercent}%` : '---'}
 change={summary ? (summary.uptimePercent >= 95 ? 'Above target' : 'Below target') : summaryError ? 'Unavailable' : ''}
 changeType={summary ? (summary.uptimePercent >= 95 ? 'positive' : 'negative') : 'neutral'}
 icon="overview"
 />
 </div>

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
 {/* Device Uptime Timeline */}
 <Card className="eh-dash-card lg:col-span-2">
 <Card.Header>
 <div className="flex items-center justify-between">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Device Uptime Timeline
 </h3>
 <Badge variant="info" size="sm" className="eh-badge">
 Last 30 Days
 </Badge>
 </div>
 </Card.Header>
 <Card.Body>
 {deviceMetrics.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : deviceMetrics.error ? (
 <ChartErrorState message="Unable to load device uptime data." detail={deviceMetrics.error} />
 ) : deviceMetrics.data.length === 0 ? (
 <EmptyChartState message="No device uptime data available yet." />
 ) : (
 <LineChart
 data={deviceMetrics.data}
 dataKeys={[
 { key: 'mobile', name: 'Mobile Displays' },
 { key: 'tablet', name: 'Tablets' },
 { key: 'desktop', name: 'Desktop Screens' },
 ]}
 xAxisKey="date"
 yAxisLabel="Uptime %"
 height={300}
 />
 )}
 </Card.Body>
 </Card>

 {/* Content Performance */}
 <Card className="eh-dash-card">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Content Performance
 </h3>
 </Card.Header>
 <Card.Body>
 {contentPerformance.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : contentPerformance.error ? (
 <ChartErrorState message="Unable to load content performance data." detail={contentPerformance.error} />
 ) : contentPerformance.data.length === 0 ? (
 <EmptyChartState message="No content performance data yet. Upload content to track views." />
 ) : (
 <BarChart
 data={contentPerformance.data}
 dataKeys={[{ key: 'views', name: 'Views' }]}
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
 Usage Trends by Content Type
 </h3>
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
 { key: 'video', name: 'Video' },
 { key: 'image', name: 'Images' },
 { key: 'text', name: 'Text' },
 { key: 'interactive', name: 'Interactive' },
 ]}
 xAxisKey="date"
 yAxisLabel="Views"
 height={300}
 stacked={true}
 />
 )}
 </Card.Body>
 </Card>

 {/* Bandwidth Usage */}
 <Card className="eh-dash-card lg:col-span-2">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Bandwidth Usage (24h)
 </h3>
 </Card.Header>
 <Card.Body>
 {bandwidthUsage.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : bandwidthUsage.error ? (
 <ChartErrorState message="Unable to load bandwidth usage." detail={bandwidthUsage.error} />
 ) : bandwidthUsage.data.length === 0 ? (
 <EmptyChartState message="No bandwidth data yet. Usage will be tracked as devices stream content." />
 ) : (
 <ComposedChart
 data={bandwidthUsage.data}
 series={[
 { type: 'line', key: 'current', name: 'Current Usage' },
 { type: 'line', key: 'average', name: 'Average' },
 { type: 'bar', key: 'peak', name: 'Peak' },
 ]}
 xAxisKey="time"
 yAxisLabel="MB/s"
 height={300}
 />
 )}
 </Card.Body>
 </Card>

 {/* Playlist Performance */}
 <Card className="eh-dash-card lg:col-span-2">
 <Card.Header>
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)]">
 Top Playlists by Engagement
 </h3>
 </Card.Header>
 <Card.Body>
 {playlistPerformance.loading ? (
 <div className="h-80 flex items-center justify-center">
 <div className="animate-spin">
 <div className="w-8 h-8 border-4 border-[var(--border)] border-t-primary-600 dark:border-t-primary-400 rounded-full" />
 </div>
 </div>
 ) : playlistPerformance.error ? (
 <ChartErrorState message="Unable to load playlist performance data." detail={playlistPerformance.error} />
 ) : playlistPerformance.data.length === 0 ? (
 <EmptyChartState message="No playlist data yet. Create playlists and assign them to devices." />
 ) : (
 <BarChart
 data={playlistPerformance.data}
 dataKeys={[
 { key: 'views', name: 'Views' },
 { key: 'completion', name: 'Completion %' },
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
