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
    it('returns empty data when API unavailable', async () => {
      const { result } = renderHook(() => useDeviceMetrics('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('returns empty data for week range', async () => {
      const { result } = renderHook(() => useDeviceMetrics('week'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
    });
  });

  describe('useContentPerformance', () => {
    it('returns empty data when API unavailable', async () => {
      const { result } = renderHook(() => useContentPerformance('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('useUsageTrends', () => {
    it('returns empty data when API unavailable', async () => {
      const { result } = renderHook(() => useUsageTrends('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('useDeviceDistribution', () => {
    it('returns empty data when API unavailable', async () => {
      const { result } = renderHook(() => useDeviceDistribution());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('useBandwidthUsage', () => {
    it('returns empty data when API unavailable', async () => {
      const { result } = renderHook(() => useBandwidthUsage('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(true);
    });
  });

  describe('usePlaylistPerformance', () => {
    it('returns empty data when API unavailable', async () => {
      const { result } = renderHook(() => usePlaylistPerformance('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(true);
    });
  });
});
