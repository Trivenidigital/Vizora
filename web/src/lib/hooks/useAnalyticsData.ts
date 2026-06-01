'use client';

import { useEffect, useState, type DependencyList } from 'react';
import { apiClient } from '@/lib/api';
import { getUserFriendlyMessage } from '@/lib/error-handler';
import { devLog } from '@/lib/logger';

type DateRange = 'week' | 'month' | 'year';

interface AnalyticsDatasetState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  isMockData: boolean;
}

function useAnalyticsDataset<T>(
  fetcher: () => Promise<T[]>,
  dependencies: DependencyList,
  logMessage: string,
): AnalyticsDatasetState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsMockData(false);

        const response = await fetcher();
        if (cancelled) return;

        if (response && response.length > 0) {
          setData(response);
          return;
        }

        setIsMockData(true);
        setData([]);
      } catch (err) {
        if (cancelled) return;

        if (process.env.NODE_ENV === 'development') {
          devLog(logMessage);
        }
        setError(getUserFriendlyMessage(err));
        setIsMockData(false);
        setData([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, dependencies);

  return { data, loading, error, isMockData };
}

/**
 * Device Metrics Hook - Real API Integration
 * Fetches device uptime/status metrics over time
 */
export function useDeviceMetrics(dateRange: DateRange = 'month') {
  return {
    ...useAnalyticsDataset(
      () => apiClient.getDeviceMetrics(dateRange),
      [dateRange],
      'Analytics API not available',
    ),
    dateRange,
  };
}

/**
 * Content Performance Hook - Real API Integration
 */
export function useContentPerformance(dateRange: DateRange = 'month') {
  return {
    ...useAnalyticsDataset(
      () => apiClient.getContentPerformance(dateRange),
      [dateRange],
      'Content performance API not available',
    ),
    dateRange,
  };
}

/**
 * Usage Trends Hook - Real API Integration
 */
export function useUsageTrends(dateRange: DateRange = 'month') {
  return {
    ...useAnalyticsDataset(
      () => apiClient.getUsageTrends(dateRange),
      [dateRange],
      'Usage trends API not available',
    ),
    dateRange,
  };
}

/**
 * Device Distribution Hook - Real API Integration
 */
export function useDeviceDistribution() {
  return useAnalyticsDataset(
    () => apiClient.getDeviceDistribution(),
    [],
    'Device distribution API not available',
  );
}

/**
 * Bandwidth Usage Hook - Real API Integration
 */
export function useBandwidthUsage(dateRange: DateRange = 'month') {
  return {
    ...useAnalyticsDataset(
      () => apiClient.getBandwidthUsage(dateRange),
      [dateRange],
      'Bandwidth usage API not available',
    ),
    dateRange,
  };
}

/**
 * Playlist Performance Hook - Real API Integration
 */
export function usePlaylistPerformance(dateRange: DateRange = 'month') {
  return {
    ...useAnalyticsDataset(
      () => apiClient.getPlaylistPerformance(dateRange),
      [dateRange],
      'Playlist performance API not available',
    ),
    dateRange,
  };
}
