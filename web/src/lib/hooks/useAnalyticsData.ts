'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { devLog } from '@/lib/logger';

type DateRange = 'week' | 'month' | 'year';

// apiClient now has proper analytics methods

/**
 * Device Metrics Hook - Real API Integration
 * Fetches device uptime/status metrics over time
 */
export function useDeviceMetrics(dateRange: DateRange = 'month') {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsMockData(false);

        // Map date range to days
        const daysMap: Record<DateRange, number> = {
          week: 7,
          month: 30,
          year: 365,
        };
        const days = daysMap[dateRange];

        // Try to fetch from API
        try {
          const response = await apiClient.getDeviceMetrics(dateRange);
          if (response && response.length > 0) {
            setData(response);
            return;
          }
        } catch (apiError) {
          // Fall through to empty state if API not available
          if (process.env.NODE_ENV === 'development') {
            devLog('Analytics API not available, showing empty state');
          }
        }

        // No real data available — show empty state
        setIsMockData(true);
        setData([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch device metrics');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return { data, loading, error, dateRange, isMockData };
}

/**
 * Content Performance Hook - Real API Integration
 */
export function useContentPerformance(dateRange: DateRange = 'month') {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsMockData(false);

        // Try to fetch from API
        try {
          const response = await apiClient.getContentPerformance(dateRange);
          if (response && response.length > 0) {
            setData(response);
            return;
          }
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            devLog('Content performance API not available, showing empty state');
          }
        }

        // No real data available — show empty state
        setIsMockData(true);
        setData([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch content performance');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return { data, loading, error, dateRange, isMockData };
}

/**
 * Usage Trends Hook - Real API Integration
 */
export function useUsageTrends(dateRange: DateRange = 'month') {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsMockData(false);

        const daysMap: Record<DateRange, number> = {
          week: 7,
          month: 30,
          year: 365,
        };
        const days = daysMap[dateRange];

        // Try to fetch from API
        try {
          const response = await apiClient.getUsageTrends(dateRange);
          if (response && response.length > 0) {
            setData(response);
            return;
          }
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            devLog('Usage trends API not available, showing empty state');
          }
        }

        // No real data available — show empty state
        setIsMockData(true);
        setData([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch usage trends');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return { data, loading, error, dateRange, isMockData };
}

/**
 * Device Distribution Hook - Real API Integration
 */
export function useDeviceDistribution() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsMockData(false);

        // Try to fetch from API
        try {
          const response = await apiClient.getDeviceDistribution();
          if (response && response.length > 0) {
            setData(response);
            return;
          }
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            devLog('Device distribution API not available, showing empty state');
          }
        }

        // No real data available — show empty state
        setIsMockData(true);
        setData([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch device distribution');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error, isMockData };
}

/**
 * Bandwidth Usage Hook - Real API Integration
 */
export function useBandwidthUsage(dateRange: DateRange = 'month') {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsMockData(false);

        const daysMap: Record<DateRange, number> = {
          week: 7,
          month: 30,
          year: 365,
        };
        const days = daysMap[dateRange];

        // Try to fetch from API
        try {
          const response = await apiClient.getBandwidthUsage(dateRange);
          if (response && response.length > 0) {
            setData(response);
            return;
          }
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            devLog('Bandwidth usage API not available, showing empty state');
          }
        }

        // No real data available — show empty state
        setIsMockData(true);
        setData([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bandwidth usage');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return { data, loading, error, dateRange, isMockData };
}

/**
 * Playlist Performance Hook - Real API Integration
 */
export function usePlaylistPerformance(dateRange: DateRange = 'month') {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsMockData(false);

        // Try to fetch from API
        try {
          const response = await apiClient.getPlaylistPerformance(dateRange);
          if (response && response.length > 0) {
            setData(response);
            return;
          }
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            devLog('Playlist performance API not available, showing empty state');
          }
        }

        // No real data available — show empty state
        setIsMockData(true);
        setData([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch playlist performance');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return { data, loading, error, dateRange, isMockData };
}
