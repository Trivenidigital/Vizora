import { renderHook, waitFor } from '@testing-library/react';
import {
  useDeviceMetrics,
  useContentPerformance,
  useUsageTrends,
  useDeviceDistribution,
  useBandwidthUsage,
  usePlaylistPerformance,
} from '../useAnalyticsData';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDeviceMetrics: jest.fn().mockRejectedValue(new Error('Not available')),
    getContentPerformance: jest.fn().mockRejectedValue(new Error('Not available')),
    getUsageTrends: jest.fn().mockRejectedValue(new Error('Not available')),
    getDeviceDistribution: jest.fn().mockRejectedValue(new Error('Not available')),
    getBandwidthUsage: jest.fn().mockRejectedValue(new Error('Not available')),
    getPlaylistPerformance: jest.fn().mockRejectedValue(new Error('Not available')),
  },
}));

describe('useAnalyticsData hooks', () => {
  describe('useDeviceMetrics', () => {
    it('falls back to mock data when API unavailable', async () => {
      const { result } = renderHook(() => useDeviceMetrics('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBe(30);
      expect(result.current.isMockData).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('returns 7 days for week range', async () => {
      const { result } = renderHook(() => useDeviceMetrics('week'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBe(7);
    });
  });

  describe('useContentPerformance', () => {
    it('falls back to mock data', async () => {
      const { result } = renderHook(() => useContentPerformance('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('useUsageTrends', () => {
    it('falls back to mock data', async () => {
      const { result } = renderHook(() => useUsageTrends('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBe(30);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('useDeviceDistribution', () => {
    it('falls back to mock data', async () => {
      const { result } = renderHook(() => useDeviceDistribution());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('useBandwidthUsage', () => {
    it('falls back to mock data', async () => {
      const { result } = renderHook(() => useBandwidthUsage('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('usePlaylistPerformance', () => {
    it('falls back to mock data', async () => {
      const { result } = renderHook(() => usePlaylistPerformance('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.isMockData).toBe(true);
    });
  });
});
