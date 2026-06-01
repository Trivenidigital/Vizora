import { render, screen, fireEvent } from '@testing-library/react';
import AnalyticsClient from '../page-client';
import { apiClient } from '@/lib/api';

const mockUseDeviceMetrics = jest.fn();
const mockUseContentPerformance = jest.fn();
const mockUseUsageTrends = jest.fn();
const mockUseDeviceDistribution = jest.fn();
const mockUseBandwidthUsage = jest.fn();
const mockUsePlaylistPerformance = jest.fn();

jest.mock('@/components/charts', () => ({
  LineChart: () => <div data-testid="line-chart">LineChart</div>,
  BarChart: () => <div data-testid="bar-chart">BarChart</div>,
  PieChart: () => <div data-testid="pie-chart">PieChart</div>,
  AreaChart: () => <div data-testid="area-chart">AreaChart</div>,
  ComposedChart: () => <div data-testid="composed-chart">ComposedChart</div>,
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
    });

    const emptyState = { data: [], loading: false, error: null, isMockData: true };
    mockUseDeviceMetrics.mockReturnValue(emptyState);
    mockUseContentPerformance.mockReturnValue(emptyState);
    mockUseUsageTrends.mockReturnValue(emptyState);
    mockUseDeviceDistribution.mockReturnValue(emptyState);
    mockUseBandwidthUsage.mockReturnValue(emptyState);
    mockUsePlaylistPerformance.mockReturnValue(emptyState);
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
    expect(screen.getByText('System Uptime')).toBeInTheDocument();
  });

  it('renders chart section titles', async () => {
    await renderLoadedAnalytics();
    expect(screen.getByText('Device Uptime Timeline')).toBeInTheDocument();
    expect(screen.getByText('Content Performance')).toBeInTheDocument();
    expect(screen.getByText('Device Distribution')).toBeInTheDocument();
  });

  it('changes date range when button clicked', async () => {
    await renderLoadedAnalytics();
    fireEvent.click(screen.getByText('week'));
    expect(screen.getByText('week')).toBeInTheDocument();
  });

  it('shows true empty analytics states when API calls succeed with no rows', async () => {
    await renderLoadedAnalytics();

    expect(screen.getByText('No Data Yet')).toBeInTheDocument();
    expect(screen.getByText('No device uptime data available yet.')).toBeInTheDocument();
    expect(screen.getByText('No content performance data yet. Upload content to track views.')).toBeInTheDocument();
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
      'Device uptime timeline'
    );
    expect(screen.getByText('Unable to load device uptime data.').closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.queryByText('No Data Yet')).not.toBeInTheDocument();
    expect(screen.queryByText('No device uptime data available yet.')).not.toBeInTheDocument();
  });

  it('surfaces summary load failures instead of only showing no data notice', async () => {
    (apiClient.getAnalyticsSummary as jest.Mock).mockRejectedValueOnce(new Error('Summary down'));

    render(<AnalyticsClient />);

    const alert = await screen.findByRole('alert', { name: /analytics data unavailable/i });
    expect(alert).toHaveTextContent('Analytics summary');
    expect(screen.queryByText('No Data Yet')).not.toBeInTheDocument();
  });
});
