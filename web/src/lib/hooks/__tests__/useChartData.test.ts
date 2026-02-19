import { renderHook, waitFor } from '@testing-library/react';
import {
  useDeviceMetrics,
  useContentPerformance,
  useUsageTrends,
  useDeviceDistribution,
  useBandwidthUsage,
  usePlaylistPerformance,
} from '../useChartData';

describe('useChartData hooks', () => {
  describe('useDeviceMetrics', () => {
    it('returns data array', async () => {
      const { result } = renderHook(() => useDeviceMetrics());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });

    it('returns 30 data points by default', async () => {
      const { result } = renderHook(() => useDeviceMetrics());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBe(30);
    });

    it('data points have expected shape', async () => {
      const { result } = renderHook(() => useDeviceMetrics());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      const item = result.current.data[0];
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('mobile');
      expect(item).toHaveProperty('tablet');
      expect(item).toHaveProperty('desktop');
    });
  });

  describe('useContentPerformance', () => {
    it('returns content performance data', async () => {
      const { result } = renderHook(() => useContentPerformance());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.data[0]).toHaveProperty('title');
      expect(result.current.data[0]).toHaveProperty('views');
    });
  });

  describe('useUsageTrends', () => {
    it('returns usage trend data', async () => {
      const { result } = renderHook(() => useUsageTrends());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.data[0]).toHaveProperty('date');
      expect(result.current.data[0]).toHaveProperty('video');
    });
  });

  describe('useDeviceDistribution', () => {
    it('returns device distribution data', async () => {
      const { result } = renderHook(() => useDeviceDistribution());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.data[0]).toHaveProperty('name');
      expect(result.current.data[0]).toHaveProperty('value');
    });
  });

  describe('useBandwidthUsage', () => {
    it('returns bandwidth usage data', async () => {
      const { result } = renderHook(() => useBandwidthUsage());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
    });
  });

  describe('usePlaylistPerformance', () => {
    it('returns playlist performance data', async () => {
      const { result } = renderHook(() => usePlaylistPerformance());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.data[0]).toHaveProperty('name');
    });
  });
});
