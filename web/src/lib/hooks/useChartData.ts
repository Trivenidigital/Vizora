'use client';

import { useState, useEffect } from 'react';

/**
 * Device Metrics Hook
 * Returns device uptime/status over time
 */
export function useDeviceMetrics() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // In production, fetch from real API
        // For now, generate mock data
        const mockData = Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          mobile: 85 + Math.random() * 10,
          tablet: 92 + Math.random() * 8,
          desktop: 98 + Math.random() * 2,
        }));
        setData(mockData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch device metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Content Performance Hook
 * Returns content views and engagement metrics
 */
export function useContentPerformance() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const mockData = [
          { title: 'Welcome Video', views: 1240, engagement: 87, shares: 45 },
          { title: 'Product Demo', views: 980, engagement: 76, shares: 32 },
          { title: 'Tutorial Series', views: 2100, engagement: 92, shares: 58 },
          { title: 'Company Overview', views: 650, engagement: 64, shares: 18 },
          { title: 'Customer Testimonials', views: 1580, engagement: 89, shares: 42 },
          { title: 'FAQ Section', views: 420, engagement: 45, shares: 12 },
        ];
        setData(mockData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch content performance');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Usage Trends Hook
 * Returns overall usage patterns by content type
 */
export function useUsageTrends() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const mockData = Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          video: 2400 + Math.random() * 800,
          image: 1200 + Math.random() * 400,
          text: 600 + Math.random() * 300,
          interactive: 800 + Math.random() * 400,
        }));
        setData(mockData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch usage trends');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Device Distribution Hook
 * Returns device type breakdown
 */
export function useDeviceDistribution() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const mockData = [
          { name: 'Mobile Displays', value: 35, count: 128 },
          { name: 'Tablets', value: 25, count: 92 },
          { name: 'Desktop Screens', value: 20, count: 73 },
          { name: 'Smart TVs', value: 15, count: 55 },
          { name: 'Kiosks', value: 5, count: 18 },
        ];
        setData(mockData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch device distribution');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Bandwidth Usage Hook
 * Returns network usage over time
 */
export function useBandwidthUsage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const mockData = Array.from({ length: 24 }, (_, i) => {
          const hour = String(i).padStart(2, '0');
          return {
            time: `${hour}:00`,
            current: 45 + Math.random() * 50,
            average: 42,
            peak: 85,
          };
        });
        setData(mockData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bandwidth usage');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Playlist Performance Hook
 * Returns top playlists by engagement
 */
export function usePlaylistPerformance() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const mockData = [
          { name: 'Morning Briefing', views: 3200, avgWatchTime: 12, completion: 78 },
          { name: 'Product Launch', views: 2800, avgWatchTime: 15, completion: 85 },
          { name: 'Weekly Updates', views: 2400, avgWatchTime: 10, completion: 72 },
          { name: 'Training Series', views: 1900, avgWatchTime: 25, completion: 65 },
          { name: 'Event Coverage', views: 1200, avgWatchTime: 8, completion: 55 },
        ];
        setData(mockData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch playlist performance');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}
