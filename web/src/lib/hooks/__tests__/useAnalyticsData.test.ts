import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useDeviceMetrics,
  useContentPerformance,
  useUsageTrends,
  useDeviceDistribution,
  useBandwidthUsage,
  usePlaylistPerformance,
} from '../useAnalyticsData';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/error-handler';

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
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getDeviceMetrics as jest.Mock).mockRejectedValue(new Error('Not available'));
    (apiClient.getContentPerformance as jest.Mock).mockRejectedValue(new Error('Not available'));
    (apiClient.getUsageTrends as jest.Mock).mockRejectedValue(new Error('Not available'));
    (apiClient.getDeviceDistribution as jest.Mock).mockRejectedValue(new Error('Not available'));
    (apiClient.getBandwidthUsage as jest.Mock).mockRejectedValue(new Error('Not available'));
    (apiClient.getPlaylistPerformance as jest.Mock).mockRejectedValue(new Error('Not available'));
  });

  function createDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });
    return { promise, resolve, reject };
  }

  async function expectEmptySuccess(
    useHook: () => { data: any[]; loading: boolean; error: string | null; isMockData: boolean },
    mockMethod: jest.Mock,
  ) {
    mockMethod.mockResolvedValueOnce([]);

    const { result } = renderHook(useHook);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.isMockData).toBe(true);
    expect(result.current.error).toBeNull();
  }

  describe('useDeviceMetrics', () => {
    it('returns an error when API unavailable', async () => {
      const { result } = renderHook(() => useDeviceMetrics('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(false);
      expect(result.current.error).toBe('Not available');
    });

    it('returns empty data when the API succeeds with no rows', async () => {
      await expectEmptySuccess(
        () => useDeviceMetrics('month'),
        apiClient.getDeviceMetrics as jest.Mock,
      );
    });

    it('returns empty data for week range', async () => {
      (apiClient.getDeviceMetrics as jest.Mock).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useDeviceMetrics('week'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
    });

    it('uses user-safe API error messages', async () => {
      (apiClient.getDeviceMetrics as jest.Mock).mockRejectedValueOnce(
        new ApiError(500, 'database connection failed', 'A server error occurred. Please try again later.'),
      );

      const { result } = renderHook(() => useDeviceMetrics('month'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('A server error occurred. Please try again later.');
    });

    it('ignores stale rejected requests after a newer range succeeds', async () => {
      const staleMonth = createDeferred<any[]>();
      const currentWeek = createDeferred<any[]>();
      const currentData = [{ date: 'Mon', mobile: 99, tablet: 98, desktop: 97 }];
      (apiClient.getDeviceMetrics as jest.Mock)
        .mockReturnValueOnce(staleMonth.promise)
        .mockReturnValueOnce(currentWeek.promise);

      const { result, rerender } = renderHook(
        ({ range }) => useDeviceMetrics(range),
        { initialProps: { range: 'month' as const } },
      );

      rerender({ range: 'week' });

      await act(async () => {
        currentWeek.resolve(currentData);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        staleMonth.reject(new Error('Old request failed'));
        await Promise.resolve();
      });

      expect(result.current.dateRange).toBe('week');
      expect(result.current.data).toEqual(currentData);
      expect(result.current.error).toBeNull();
      expect(result.current.isMockData).toBe(false);
    });
  });

  describe('useContentPerformance', () => {
    it('returns an error when API unavailable', async () => {
      const { result } = renderHook(() => useContentPerformance('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(false);
      expect(result.current.error).toBe('Not available');
    });

    it('returns empty data when the API succeeds with no rows', async () => {
      await expectEmptySuccess(
        () => useContentPerformance('month'),
        apiClient.getContentPerformance as jest.Mock,
      );
    });
  });

  describe('useUsageTrends', () => {
    it('returns an error when API unavailable', async () => {
      const { result } = renderHook(() => useUsageTrends('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(false);
      expect(result.current.error).toBe('Not available');
    });

    it('returns empty data when the API succeeds with no rows', async () => {
      await expectEmptySuccess(
        () => useUsageTrends('month'),
        apiClient.getUsageTrends as jest.Mock,
      );
    });
  });

  describe('useDeviceDistribution', () => {
    it('returns an error when API unavailable', async () => {
      const { result } = renderHook(() => useDeviceDistribution());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(false);
      expect(result.current.error).toBe('Not available');
    });

    it('returns empty data when the API succeeds with no rows', async () => {
      await expectEmptySuccess(
        () => useDeviceDistribution(),
        apiClient.getDeviceDistribution as jest.Mock,
      );
    });
  });

  describe('useBandwidthUsage', () => {
    it('returns an error when API unavailable', async () => {
      const { result } = renderHook(() => useBandwidthUsage('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(false);
      expect(result.current.error).toBe('Not available');
    });

    it('returns empty data when the API succeeds with no rows', async () => {
      await expectEmptySuccess(
        () => useBandwidthUsage('month'),
        apiClient.getBandwidthUsage as jest.Mock,
      );
    });
  });

  describe('usePlaylistPerformance', () => {
    it('returns an error when API unavailable', async () => {
      const { result } = renderHook(() => usePlaylistPerformance('month'));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.data).toEqual([]);
      expect(result.current.isMockData).toBe(false);
      expect(result.current.error).toBe('Not available');
    });

    it('returns empty data when the API succeeds with no rows', async () => {
      await expectEmptySuccess(
        () => usePlaylistPerformance('month'),
        apiClient.getPlaylistPerformance as jest.Mock,
      );
    });
  });
});
