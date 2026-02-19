'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, BarChart, PieChart, AreaChart, ComposedChart } from '@/components/charts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/theme/icons';
import { useRealtimeEvents } from '@/lib/hooks';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import {
 useDeviceMetrics,
 useContentPerformance,
 useUsageTrends,
 useDeviceDistribution,
 useBandwidthUsage,
 usePlaylistPerformance,
} from '@/lib/hooks/useAnalyticsData';

interface KPICardProps {
 label: string;
 value: string;
 change?: string;
 changeType?: 'positive' | 'negative' | 'neutral';
 icon?: string;
}

const KPICard: React.FC<KPICardProps> = ({
 label,
 value,
 change,
 changeType = 'neutral',
 icon,
}) => (
 <Card className="hover:shadow-lg transition-shadow">
 <Card.Body>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">
 {label}
 </p>
 <p className="text-3xl font-bold text-[var(--foreground)] mt-2">
 {value}
 </p>
 {change && (
 <p
 className={`text-sm mt-2 ${
 changeType === 'positive'
 ? 'text-success-600 dark:text-success-400'
 : changeType === 'negative'
 ? 'text-error-600 dark:text-error-400'
 : 'text-[var(--foreground-secondary)]'
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
 name={icon as any}
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

export default function AnalyticsClient() {
 const toast = useToast();
 const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
 const [exporting, setExporting] = useState(false);
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline'>('offline');
 const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
 const [summary, setSummary] = useState<any>(null);

 useEffect(() => {
 apiClient.getAnalyticsSummary()
 .then(data => setSummary(data))
 .catch(() => {/* fall back to defaults */});
 }, []);

 const deviceMetrics = useDeviceMetrics(dateRange);
 const contentPerformance = useContentPerformance(dateRange);
 const usageTrends = useUsageTrends(dateRange);
 const deviceDistribution = useDeviceDistribution();
 const bandwidthUsage = useBandwidthUsage(dateRange);
 const playlistPerformance = usePlaylistPerformance(dateRange);

 // Real-time analytics updates
 useRealtimeEvents({
 enabled: true,
 onDeviceStatusChange: () => {
 // Device status changes may affect uptime metrics
 setLastUpdate(new Date());
 },
 onConnectionChange: (connected) => {
 setRealtimeStatus(connected ? 'connected' : 'offline');
 if (connected) {
 toast.info('Real-time analytics enabled');
 }
 },
 });

 const handleExportCSV = async () => {
 try {
 setExporting(true);
 const data = await apiClient.exportAnalytics(dateRange) as any;

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
 data.deviceMetrics.forEach((d: any) => {
 sections.push([`"${d.date}"`, d.mobile?.toFixed(1), d.tablet?.toFixed(1), d.desktop?.toFixed(1)].join(','));
 });
 sections.push('');
 }

 // Content Performance section
 if (data.contentPerformance?.length) {
 sections.push('CONTENT PERFORMANCE');
 sections.push(['Title', 'Views', 'Engagement', 'Shares'].join(','));
 data.contentPerformance.forEach((c: any) => {
 sections.push([`"${String(c.title).replace(/"/g, '""')}"`, c.views, c.engagement, c.shares].join(','));
 });
 sections.push('');
 }

 // Playlist Performance section
 if (data.playlistPerformance?.length) {
 sections.push('PLAYLIST PERFORMANCE');
 sections.push(['Name', 'Plays', 'Engagement', 'Unique Devices', 'Completion'].join(','));
 data.playlistPerformance.forEach((p: any) => {
 sections.push([`"${String(p.name).replace(/"/g, '""')}"`, p.plays, p.engagement, p.uniqueDevices, p.completion].join(','));
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
 } catch (error: any) {
 toast.error(error.message || 'Export failed');
 } finally {
 setExporting(false);
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-3xl font-bold text-[var(--foreground)]">
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
 <div className="flex gap-2">
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
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
 change={summary?.uptimePercent >= 95 ? 'Above target' : 'Below target'}
 changeType={summary?.uptimePercent >= 95 ? 'positive' : 'negative'}
 icon="overview"
 />
 </div>

 {/* Charts Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Device Uptime Timeline */}
 <Card className="lg:col-span-2">
 <Card.Header>
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 Device Uptime Timeline
 </h3>
 <Badge variant="info" size="sm">
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
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
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
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
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
 <Card className="lg:col-span-2">
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
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
 <Card className="lg:col-span-2">
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
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
 <Card className="lg:col-span-2">
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
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
