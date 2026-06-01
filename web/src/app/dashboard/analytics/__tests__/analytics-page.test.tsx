import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsClient from '../page-client';
import { apiClient } from '@/lib/api';
import { useRealtimeEvents } from '@/lib/hooks';

const mockUseDeviceMetrics = jest.fn();
const mockUseContentPerformance = jest.fn();
const mockUseUsageTrends = jest.fn();
const mockUseDeviceDistribution = jest.fn();
const mockUseBandwidthUsage = jest.fn();
const mockUsePlaylistPerformance = jest.fn();

jest.mock('@/components/charts', () => ({
  LineChart: ({ yAxisLabel, dataKeys }: any) => (
    <div data-testid="line-chart">
      <span>{yAxisLabel}</span>
      {dataKeys?.map((key: any) => <span key={key.key}>{key.name}</span>)}
    </div>
  ),
  BarChart: ({ yAxisLabel, dataKeys }: any) => (
    <div data-testid="bar-chart">
      <span>{yAxisLabel}</span>
      {dataKeys?.map((key: any) => <span key={key.key}>{key.name}</span>)}
    </div>
  ),
  PieChart: () => <div data-testid="pie-chart">PieChart</div>,
  AreaChart: ({ yAxisLabel, dataKeys }: any) => (
    <div data-testid="area-chart">
      <span>{yAxisLabel}</span>
      {dataKeys?.map((key: any) => <span key={key.key}>{key.name}</span>)}
    </div>
  ),
  ComposedChart: ({ yAxisLabel, series }: any) => (
    <div data-testid="composed-chart">
      <span>{yAxisLabel}</span>
      {series?.map((item: any) => <span key={item.key}>{item.name}</span>)}
    </div>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: Object.assign(
    ({ children, className }: any) => <div className={className}>{children}</div>,
    {
      Header: ({ children }: any) => <div>{children}</div>,
      Body: ({ children }: any) => <div>{children}</div>,
    }
  ),
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getAnalyticsSummary: jest.fn().mockResolvedValue({
      totalDevices: 10,
      onlineDevices: 8,
      totalContent: 50,
      totalPlaylists: 5,
      totalContentSize: 1073741824,
      uptimePercent: 98,
      onlineNowPercent: 98,
      uptimePercentSource: 'current_online_ratio',
      uptimePercentIsHistorical: false,
    }),
    exportAnalytics: jest.fn().mockResolvedValue({
      summary: { totalDevices: 10 },
      deviceMetrics: [],
      contentPerformance: [],
      playlistPerformance: [],
    }),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/useAnalyticsData', () => ({
  useDeviceMetrics: (...args: unknown[]) => mockUseDeviceMetrics(...args),
  useContentPerformance: (...args: unknown[]) => mockUseContentPerformance(...args),
  useUsageTrends: (...args: unknown[]) => mockUseUsageTrends(...args),
  useDeviceDistribution: (...args: unknown[]) => mockUseDeviceDistribution(...args),
  useBandwidthUsage: (...args: unknown[]) => mockUseBandwidthUsage(...args),
  usePlaylistPerformance: (...args: unknown[]) => mockUsePlaylistPerformance(...args),
}));

describe('AnalyticsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getAnalyticsSummary as jest.Mock).mockResolvedValue({
      totalDevices: 10,
      onlineDevices: 8,
      totalContent: 50,
      totalPlaylists: 5,
      totalContentSize: 1073741824,
      uptimePercent: 98,
      onlineNowPercent: 98,
      uptimePercentSource: 'current_online_ratio',
      uptimePercentIsHistorical: false,
    });

    const emptyState = { data: [], loading: false, error: null, isMockData: true };
    mockUseDeviceMetrics.mockReturnValue(emptyState);
    mockUseContentPerformance.mockReturnValue(emptyState);
    mockUseUsageTrends.mockReturnValue(emptyState);
    mockUseDeviceDistribution.mockReturnValue(emptyState);
    mockUseBandwidthUsage.mockReturnValue(emptyState);
    mockUsePlaylistPerformance.mockReturnValue(emptyState);
    (useRealtimeEvents as jest.Mock).mockImplementation(() => {});
  });

  const renderLoadedAnalytics = async () => {
    render(<AnalyticsClient />);
    await screen.findByText('10');
  };

  it('renders analytics heading', async () => {
    await renderLoadedAnalytics();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('renders date range buttons', async () => {
    await renderLoadedAnalytics();
    expect(screen.getByText('week')).toBeInTheDocument();
    expect(screen.getByText('month')).toBeInTheDocument();
    expect(screen.getByText('year')).toBeInTheDocument();
  });

  it('renders Export CSV button', async () => {
    await renderLoadedAnalytics();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders KPI cards', async () => {
    await renderLoadedAnalytics();
    expect(screen.getByText('Total Devices')).toBeInTheDocument();
    expect(screen.getByText('Content Items')).toBeInTheDocument();
    expect(screen.getByText('Online Now')).toBeInTheDocument();
    expect(screen.queryByText('System Uptime')).not.toBeInTheDocument();
  });

  it('renders chart section titles', async () => {
    await renderLoadedAnalytics();
    expect(screen.getByText('Estimated Availability Trend')).toBeInTheDocument();
    expect(screen.getByText('Content Proof-of-Play')).toBeInTheDocument();
    expect(screen.getByText('Device Distribution')).toBeInTheDocument();
    expect(screen.getByText('Usage Trends by Reported Content Type')).toBeInTheDocument();
  });

  it('labels current-state and estimated analytics honestly', async () => {
    mockUseDeviceMetrics.mockReturnValue({
      data: [{ date: 'Jan 1', mobile: 85, tablet: 92, desktop: 98, isEstimated: true }],
      loading: false,
      error: null,
      isMockData: false,
    });
    mockUseBandwidthUsage.mockReturnValue({
      data: [{ time: 'Jan 1', current: 10, average: 10, peak: 15, isEstimated: true, unit: 'MB/day' }],
      loading: false,
      error: null,
      isMockData: false,
    });

    await renderLoadedAnalytics();

    expect(screen.queryByText('Real-time performance metrics and insights')).not.toBeInTheDocument();
    expect(screen.getByText('Current device status and proof-of-play reporting')).toBeInTheDocument();
    expect(screen.getByText('Online Now')).toBeInTheDocument();
    expect(screen.getByText(/Current online ratio from display status/i)).toBeInTheDocument();
    expect(screen.getByText('Estimated Availability Trend')).toBeInTheDocument();
    expect(screen.getByText(/Estimated from display inventory/i)).toBeInTheDocument();
    expect(screen.getByText('Estimated Transfer Volume')).toBeInTheDocument();
    expect(screen.getByText(/Estimated from stored content size and assigned screens/i)).toBeInTheDocument();
    expect(screen.getByText('MB/day')).toBeInTheDocument();
    expect(screen.queryByText('MB/s')).not.toBeInTheDocument();
  });

  it('uses proof-of-play labels for content and playlist charts', async () => {
    mockUseContentPerformance.mockReturnValue({
      data: [{ title: 'Promo', impressions: 5, averageCompletion: 80, sharesTracked: false }],
      loading: false,
      error: null,
      isMockData: false,
    });
    mockUsePlaylistPerformance.mockReturnValue({
      data: [{ name: 'Morning Loop', proofOfPlayImpressions: 5, averageCompletion: 80, assignedScreens: 2 }],
      loading: false,
      error: null,
      isMockData: false,
    });

    await renderLoadedAnalytics();

    expect(screen.getByText('Content Proof-of-Play')).toBeInTheDocument();
    expect(screen.getAllByText('Impressions').length).toBeGreaterThan(0);
    expect(screen.getByText('Playlist Playback Summary')).toBeInTheDocument();
    expect(screen.getByText('Average Completion')).toBeInTheDocument();
    expect(screen.queryByText('Shares')).not.toBeInTheDocument();
    expect(screen.queryByText('Top Playlists by Engagement')).not.toBeInTheDocument();
  });

  it('does not imply analytics refreshed on realtime device-status events', async () => {
    const realtimeOptionsRef: { current?: { onDeviceStatusChange?: () => void } } = {};
    (useRealtimeEvents as jest.Mock).mockImplementation((options) => {
      realtimeOptionsRef.current = options as { onDeviceStatusChange?: () => void };
    });

    await renderLoadedAnalytics();
    realtimeOptionsRef.current?.onDeviceStatusChange?.();

    expect(screen.queryByText(/Updated \d+s ago/)).not.toBeInTheDocument();
  });

  it('changes date range when button clicked', async () => {
    await renderLoadedAnalytics();
    fireEvent.click(screen.getByText('week'));
    expect(screen.getByText('week')).toBeInTheDocument();
  });

  it('shows true empty analytics states when API calls succeed with no rows', async () => {
    await renderLoadedAnalytics();

    expect(screen.getByText('No Data Yet')).toBeInTheDocument();
    expect(screen.getByText('No availability estimate available yet.')).toBeInTheDocument();
    expect(screen.getByText('No content proof-of-play data yet. Playback impressions appear as displays report content playback.')).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: /analytics data unavailable/i })).not.toBeInTheDocument();
  });

  it('surfaces chart load failures instead of empty chart states', async () => {
    mockUseDeviceMetrics.mockReturnValue({
      data: [],
      loading: false,
      error: 'Network unavailable',
      isMockData: false,
    });

    await renderLoadedAnalytics();

    expect(screen.getByRole('alert', { name: /analytics data unavailable/i })).toHaveTextContent(
      'Estimated availability trend'
    );
    expect(screen.getByText('Unable to load estimated availability data.').closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.queryByText('No Data Yet')).not.toBeInTheDocument();
    expect(screen.queryByText('No availability estimate available yet.')).not.toBeInTheDocument();
  });

  it('surfaces summary load failures instead of only showing no data notice', async () => {
    (apiClient.getAnalyticsSummary as jest.Mock).mockRejectedValueOnce(new Error('Summary down'));

    render(<AnalyticsClient />);

    const alert = await screen.findByRole('alert', { name: /analytics data unavailable/i });
    expect(alert).toHaveTextContent('Analytics summary');
    expect(screen.queryByText('No Data Yet')).not.toBeInTheDocument();
  });

  it('exports CSV with honest current-state and proof-of-play labels', async () => {
    const originalBlob = global.Blob;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const blobParts: BlobPart[][] = [];
    class MockBlob {
      constructor(parts: BlobPart[]) {
        blobParts.push(parts);
      }
    }
    Object.defineProperty(global, 'Blob', { value: MockBlob, configurable: true });
    Object.defineProperty(URL, 'createObjectURL', { value: jest.fn(() => 'blob:test'), configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: jest.fn(), configurable: true });
    const click = jest.fn();
    let createElementSpy: jest.SpyInstance | null = null;

    try {
      (apiClient.exportAnalytics as jest.Mock).mockResolvedValueOnce({
        summary: { totalDevices: 10, onlineDevices: 8, uptimePercent: 80, onlineNowPercent: 80 },
        deviceMetrics: [{ date: 'Jan 1', mobile: 85, tablet: 92, desktop: 98 }],
        contentPerformance: [{ title: 'Promo', impressions: 3, averageCompletion: 90 }],
        playlistPerformance: [{ name: 'Morning Loop', proofOfPlayImpressions: 3, averageCompletion: 90, assignedScreens: 2 }],
      });

      await renderLoadedAnalytics();
      createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue({
        click,
        set href(_value: string) {},
        get href() { return 'blob:test'; },
        set download(_value: string) {},
      } as unknown as HTMLAnchorElement);
      fireEvent.click(screen.getByText('Export CSV'));

      await waitFor(() => expect(apiClient.exportAnalytics).toHaveBeenCalledWith('month'));
      const csv = String(blobParts[0][0]);
      expect(csv).toContain('"Online Now %","80"');
      expect(csv).not.toContain('"Uptime %"');
      expect(csv).toContain('Proof-of-Play Impressions');
      expect(csv).toContain('Average Completion');
      expect(csv).toContain('Assigned Screens');
      expect(csv).not.toContain('Shares');
      expect(csv).not.toContain('Unique Devices');
      expect(click).toHaveBeenCalled();
    } finally {
      createElementSpy?.mockRestore();
      Object.defineProperty(global, 'Blob', { value: originalBlob, configurable: true });
      Object.defineProperty(URL, 'createObjectURL', { value: originalCreateObjectUrl, configurable: true });
      Object.defineProperty(URL, 'revokeObjectURL', { value: originalRevokeObjectUrl, configurable: true });
    }
  });
});
