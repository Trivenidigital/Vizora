'use client';

import React, { useState } from 'react';
import { LineChart, BarChart, PieChart, AreaChart, ComposedChart } from '@/components/charts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/theme/icons';
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
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {label}
          </p>
          <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 mt-2">
            {value}
          </p>
          {change && (
            <p
              className={`text-sm mt-2 ${
                changeType === 'positive'
                  ? 'text-success-600 dark:text-success-400'
                  : changeType === 'negative'
                  ? 'text-error-600 dark:text-error-400'
                  : 'text-neutral-600 dark:text-neutral-400'
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
            className="text-neutral-400 dark:text-neutral-600"
          />
        )}
      </div>
    </Card.Body>
  </Card>
);

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  const deviceMetrics = useDeviceMetrics(dateRange);
  const contentPerformance = useContentPerformance(dateRange);
  const usageTrends = useUsageTrends(dateRange);
  const deviceDistribution = useDeviceDistribution();
  const bandwidthUsage = useBandwidthUsage(dateRange);
  const playlistPerformance = usePlaylistPerformance(dateRange);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            Analytics
          </h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Real-time performance metrics and insights
          </p>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                dateRange === range
                  ? 'bg-primary-600 dark:bg-primary-400 text-white'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 hover:bg-neutral-300 dark:hover:bg-neutral-600'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Devices"
          value="366"
          change="12% from last month"
          changeType="positive"
          icon="devices"
        />
        <KPICard
          label="Content Served"
          value="12.5K"
          change="23% from last month"
          changeType="positive"
          icon="content"
        />
        <KPICard
          label="Avg. Bandwidth"
          value="2.4 GB/h"
          change="5% from last month"
          changeType="negative"
          icon="analytics"
        />
        <KPICard
          label="System Uptime"
          value="98.5%"
          change="Above target"
          changeType="positive"
          icon="overview"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Uptime Timeline */}
        <Card className="lg:col-span-2">
          <Card.Header>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
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
                  <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full" />
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
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Content Performance
            </h3>
          </Card.Header>
          <Card.Body>
            {contentPerformance.loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin">
                  <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full" />
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
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Device Distribution
            </h3>
          </Card.Header>
          <Card.Body>
            {deviceDistribution.loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin">
                  <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full" />
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
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Usage Trends by Content Type
            </h3>
          </Card.Header>
          <Card.Body>
            {usageTrends.loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin">
                  <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full" />
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
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Bandwidth Usage (24h)
            </h3>
          </Card.Header>
          <Card.Body>
            {bandwidthUsage.loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin">
                  <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full" />
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
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Top Playlists by Engagement
            </h3>
          </Card.Header>
          <Card.Body>
            {playlistPerformance.loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin">
                  <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full" />
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
