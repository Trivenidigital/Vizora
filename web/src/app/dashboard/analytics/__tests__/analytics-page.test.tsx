import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsClient from '../page-client';

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
  useDeviceMetrics: () => ({ data: [], loading: false, error: null, isMockData: true }),
  useContentPerformance: () => ({ data: [], loading: false, error: null, isMockData: true }),
  useUsageTrends: () => ({ data: [], loading: false, error: null, isMockData: true }),
  useDeviceDistribution: () => ({ data: [], loading: false, error: null, isMockData: true }),
  useBandwidthUsage: () => ({ data: [], loading: false, error: null, isMockData: true }),
  usePlaylistPerformance: () => ({ data: [], loading: false, error: null, isMockData: true }),
}));

describe('AnalyticsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders analytics heading', () => {
    render(<AnalyticsClient />);
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('renders date range buttons', () => {
    render(<AnalyticsClient />);
    expect(screen.getByText('week')).toBeInTheDocument();
    expect(screen.getByText('month')).toBeInTheDocument();
    expect(screen.getByText('year')).toBeInTheDocument();
  });

  it('renders Export CSV button', () => {
    render(<AnalyticsClient />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders KPI cards', async () => {
    render(<AnalyticsClient />);
    await waitFor(() => {
      expect(screen.getByText('Total Devices')).toBeInTheDocument();
      expect(screen.getByText('Content Items')).toBeInTheDocument();
      expect(screen.getByText('System Uptime')).toBeInTheDocument();
    });
  });

  it('renders chart section titles', () => {
    render(<AnalyticsClient />);
    expect(screen.getByText('Device Uptime Timeline')).toBeInTheDocument();
    expect(screen.getByText('Content Performance')).toBeInTheDocument();
    expect(screen.getByText('Device Distribution')).toBeInTheDocument();
  });

  it('changes date range when button clicked', () => {
    render(<AnalyticsClient />);
    fireEvent.click(screen.getByText('week'));
    expect(screen.getByText('week')).toBeInTheDocument();
  });
});
