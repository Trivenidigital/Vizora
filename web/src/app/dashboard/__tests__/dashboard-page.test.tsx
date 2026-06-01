import { act, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import DashboardClient from '../page-client';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/error-handler';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: jest.fn().mockResolvedValue({ data: [] }),
    getPlaylists: jest.fn().mockResolvedValue({ data: [] }),
    getAnalyticsSummary: jest.fn().mockResolvedValue({
      totalDevices: 0,
      onlineDevices: 0,
      totalContent: 0,
      processingContent: 0,
      totalPlaylists: 0,
      activePlaylists: 0,
      totalImpressions: 0,
      totalContentSize: 0,
      uptimePercent: 0,
    }),
    getQuotaUsage: jest.fn().mockResolvedValue({ screensUsed: 0, screenQuota: 5, remaining: 5, percentUsed: 0 }),
    getStorageInfo: jest.fn().mockResolvedValue({ usedBytes: 0, quotaBytes: 1073741824, availableBytes: 1073741824, usagePercent: 0 }),
    get: jest.fn().mockResolvedValue({ status: 'ok' }),
    setAuthenticated: jest.fn(),
  },
}));

let mockDeviceStatusContext = {
  deviceStatuses: {},
  isInitialized: true,
};
jest.mock('@/lib/context/DeviceStatusContext', () => ({
  useDeviceStatus: () => ({
    deviceStatuses: mockDeviceStatusContext.deviceStatuses,
    isInitialized: mockDeviceStatusContext.isInitialized,
  }),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
  iconMap: { overview: true, devices: true, content: true, playlists: true, power: true, add: true, upload: true, schedules: true, error: true, storage: true },
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

jest.mock('@/components/Tooltip', () => ({
  HelpIcon: () => <span>?</span>,
}));

jest.mock('@/components/UpgradeBanner', () => {
  return function MockUpgradeBanner() { return <div data-testid="upgrade-banner" />; };
});

async function renderDashboardClient(props: Partial<ComponentProps<typeof DashboardClient>> = {}) {
  const view = render(
    <DashboardClient
      initialContent={props.initialContent ?? []}
      initialPlaylists={props.initialPlaylists ?? []}
      initialStats={props.initialStats}
      initialContentSampleReady={props.initialContentSampleReady}
      initialPlaylistsSampleReady={props.initialPlaylistsSampleReady}
      initialStorageInfo={props.initialStorageInfo}
      initialSystemHealth={props.initialSystemHealth}
    />,
  );
  await waitFor(() => {
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
  return view;
}

describe('DashboardClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getContent as jest.Mock).mockReset().mockResolvedValue({ data: [] });
    (apiClient.getPlaylists as jest.Mock).mockReset().mockResolvedValue({ data: [] });
    (apiClient.getAnalyticsSummary as jest.Mock).mockReset().mockResolvedValue({
      totalDevices: 0,
      onlineDevices: 0,
      totalContent: 0,
      processingContent: 0,
      totalPlaylists: 0,
      activePlaylists: 0,
      totalImpressions: 0,
      totalContentSize: 0,
      uptimePercent: 0,
    });
    (apiClient.getQuotaUsage as jest.Mock)
      .mockReset()
      .mockResolvedValue({ screensUsed: 0, screenQuota: 5, remaining: 5, percentUsed: 0 });
    (apiClient.getStorageInfo as jest.Mock)
      .mockReset()
      .mockResolvedValue({
        usedBytes: 0,
        quotaBytes: 1073741824,
        availableBytes: 1073741824,
        usagePercent: 0,
      });
    (apiClient.get as jest.Mock).mockReset().mockResolvedValue({ status: 'ok' });
    mockDeviceStatusContext = {
      deviceStatuses: {},
      isInitialized: true,
    };
  });

  it('renders dashboard overview heading', async () => {
    await renderDashboardClient();
    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    await renderDashboardClient();
    expect(screen.getByText('Total Devices')).toBeInTheDocument();
    expect(screen.getByText('Content Items')).toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('renders quick actions section', async () => {
    await renderDashboardClient();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('renders recent activity section', async () => {
    await renderDashboardClient();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders storage usage section', async () => {
    await renderDashboardClient();
    expect(screen.getByText('Storage Usage')).toBeInTheDocument();
  });

  it('renders real storage usage from the organization storage endpoint', async () => {
    (apiClient.getStorageInfo as jest.Mock).mockResolvedValueOnce({
      usedBytes: 536870912,
      quotaBytes: 1073741824,
      availableBytes: 536870912,
      usagePercent: 50,
    });

    render(<DashboardClient initialContent={[{ id: 'c1' }]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(apiClient.getStorageInfo).toHaveBeenCalledTimes(1);
      expect(screen.getByText('512 MB / 1 GB')).toBeInTheDocument();
      expect(screen.getByText('50.0% used')).toBeInTheDocument();
    });
  });

  it('does not show a normal percentage when storage quota is unavailable', async () => {
    (apiClient.getStorageInfo as jest.Mock).mockResolvedValueOnce({
      usedBytes: 1048576,
      quotaBytes: 0,
      availableBytes: 0,
      usagePercent: 0,
    });

    render(<DashboardClient initialContent={[{ id: 'c1' }]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(screen.getByText('1 MB / No quota')).toBeInTheDocument();
      expect(screen.getByText('Quota unavailable')).toBeInTheDocument();
      expect(screen.queryByText('0.0% used')).not.toBeInTheDocument();
    });
  });

  it('renders degraded system readiness instead of a fixed healthy state', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      status: 'degraded',
      message: 'Some dependencies degraded',
    });

    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/health/ready');
      expect(screen.getByText('Degraded')).toBeInTheDocument();
      expect(screen.getByText('Some dependencies degraded')).toBeInTheDocument();
    });
  });

  it('renders critical system readiness when the readiness endpoint returns unavailable', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(
      new ApiError(503, 'Service unavailable', 'The service is temporarily unavailable.'),
    );

    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('Core service needs attention')).toBeInTheDocument();
    });
  });

  it('shows getting started guide when no devices', async () => {
    await renderDashboardClient();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Assign & Schedule')).toBeInTheDocument();
    expect(screen.queryByText('Publish & Schedule')).not.toBeInTheDocument();
  });

  it('does not refetch content and playlists on mount when server summary is present', async () => {
    (apiClient.getAnalyticsSummary as jest.Mock).mockResolvedValueOnce({
      totalDevices: 2,
      onlineDevices: 1,
      totalContent: 12,
      processingContent: 3,
      totalPlaylists: 4,
      activePlaylists: 2,
      totalImpressions: 0,
      totalContentSize: 0,
      uptimePercent: 0,
    });

    await renderDashboardClient({
      initialContent: [{ id: 'c1' }],
      initialPlaylists: [{ id: 'p1', items: [{ id: 'item-1' }] }],
      initialStats: {
        devices: { total: 2, online: 1 },
        content: { total: 12, processing: 3 },
        playlists: { total: 4, active: 2 },
      },
      initialContentSampleReady: true,
      initialPlaylistsSampleReady: true,
    });

    expect(apiClient.getAnalyticsSummary).toHaveBeenCalledTimes(1);
    expect(apiClient.getContent).not.toHaveBeenCalled();
    expect(apiClient.getPlaylists).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Total Devices').parentElement?.parentElement).toHaveTextContent('2');
      expect(screen.getByText('Content Items').parentElement?.parentElement).toHaveTextContent('12');
      expect(screen.getByText('Playlists').parentElement?.parentElement).toHaveTextContent('4');
    });
  });

  it('refreshes overview totals from analytics summary and only samples recent activity', async () => {
    (apiClient.getAnalyticsSummary as jest.Mock).mockResolvedValueOnce({
      totalDevices: 10,
      onlineDevices: 8,
      totalContent: 250,
      processingContent: 7,
      totalPlaylists: 42,
      activePlaylists: 31,
      totalImpressions: 1200,
      totalContentSize: 1024000,
      uptimePercent: 80,
    });
    (apiClient.getContent as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'c1', title: 'Fresh Menu', type: 'image', status: 'ready', createdAt: '2026-05-31T12:00:00.000Z' }],
      meta: { page: 1, limit: 3, total: 250, totalPages: 84 },
    });
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({
      data: [{ id: 'p1', name: 'Lunch Loop', items: [{ id: 'i1' }] }],
      meta: { page: 1, limit: 3, total: 42, totalPages: 14 },
    });

    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(apiClient.getAnalyticsSummary).toHaveBeenCalledTimes(1);
      expect(apiClient.getContent).toHaveBeenCalledWith({ page: 1, limit: 3 });
      expect(apiClient.getPlaylists).toHaveBeenCalledWith({ page: 1, limit: 3 });
      expect(screen.getByText('Total Devices').parentElement?.parentElement).toHaveTextContent('10');
      expect(screen.getByText('Content Items').parentElement?.parentElement).toHaveTextContent('250');
      expect(screen.getByText('Playlists').parentElement?.parentElement).toHaveTextContent('42');
    });
    expect(apiClient.getContent).toHaveBeenCalledTimes(1);
    expect(apiClient.getPlaylists).toHaveBeenCalledTimes(1);
    expect(screen.getByText('7 processing')).toBeInTheDocument();
    expect(screen.getByText('31 ready')).toBeInTheDocument();
    expect(screen.getByText('Fresh Menu')).toBeInTheDocument();
    expect(screen.getByText('image - ready')).toBeInTheDocument();
    expect(screen.getByText('Lunch Loop')).toBeInTheDocument();
    expect(screen.queryByText(/â/)).not.toBeInTheDocument();
  });

  it('preserves initial overview counts when summary refresh fails', async () => {
    (apiClient.getAnalyticsSummary as jest.Mock).mockRejectedValueOnce(new Error('summary unavailable'));
    (apiClient.getContent as jest.Mock).mockResolvedValueOnce({ data: [] });
    (apiClient.getPlaylists as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'p1', isActive: true }],
      meta: { page: 1, limit: 3, total: 1, totalPages: 1 },
    });

    render(
      <DashboardClient
        initialContent={[{ id: 'c1' }, { id: 'c2' }]}
        initialPlaylists={[{ id: 'p1', isActive: true }]}
        initialStats={{
          devices: { total: 0, online: 0 },
          content: { total: 2, processing: 0 },
          playlists: { total: 1, active: 1 },
        }}
      />,
    );

    await waitFor(() => {
      expect(apiClient.getAnalyticsSummary).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Some dashboard data could not refresh')).toBeInTheDocument();
    });
    expect(screen.getByText('Content Items').parentElement?.parentElement).toHaveTextContent('2');
    expect(screen.getByText('Playlists').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('retries missing initial activity samples when summary totals indicate data exists', async () => {
    (apiClient.getAnalyticsSummary as jest.Mock).mockResolvedValueOnce({
      totalDevices: 0,
      onlineDevices: 0,
      totalContent: 5,
      processingContent: 1,
      totalPlaylists: 4,
      activePlaylists: 3,
      totalImpressions: 0,
      totalContentSize: 0,
      uptimePercent: 0,
    });
    (apiClient.getContent as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'c1', title: 'Recovered Menu', type: 'image', status: 'ready', createdAt: '2026-05-31T12:00:00.000Z' }],
      meta: { page: 1, limit: 3, total: 5, totalPages: 2 },
    });
    (apiClient.getPlaylists as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'Recovered Loop', items: [{ id: 'i1' }] }],
      meta: { page: 1, limit: 3, total: 4, totalPages: 2 },
    });

    render(
      <DashboardClient
        initialContent={[]}
        initialPlaylists={[]}
        initialStats={{
          devices: { total: 0, online: 0 },
          content: { total: 5, processing: 1 },
          playlists: { total: 4, active: 3 },
        }}
      />,
    );

    await waitFor(() => {
      expect(apiClient.getContent).toHaveBeenCalledWith({ page: 1, limit: 3 });
      expect(apiClient.getPlaylists).toHaveBeenCalledWith({ page: 1, limit: 3 });
      expect(screen.getByText('Recovered Menu')).toBeInTheDocument();
      expect(screen.getByText('Recovered Loop')).toBeInTheDocument();
    });
  });

  it('keeps live realtime device counts when a summary refresh arrives later', async () => {
    let resolveSummary: (value: unknown) => void = () => {};
    (apiClient.getAnalyticsSummary as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      resolveSummary = resolve;
    }));
    mockDeviceStatusContext = {
      deviceStatuses: {
        d1: { id: 'd1', status: 'online', metadata: { nickname: 'Lobby Screen' } },
        d2: { id: 'd2', status: 'offline', metadata: { nickname: 'Kitchen Screen' } },
      },
      isInitialized: true,
    };

    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Total Devices').parentElement?.parentElement).toHaveTextContent('2');
      expect(screen.getByText('1 online')).toBeInTheDocument();
    });

    await act(async () => {
      resolveSummary({
        totalDevices: 10,
        onlineDevices: 0,
        totalContent: 0,
        processingContent: 0,
        totalPlaylists: 0,
        activePlaylists: 0,
        totalImpressions: 0,
        totalContentSize: 0,
        uptimePercent: 0,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Total Devices').parentElement?.parentElement).toHaveTextContent('10');
      expect(screen.getByText('1 online')).toBeInTheDocument();
    });
  });

  it('refreshes recent activity after a partial content refresh succeeds', async () => {
    (apiClient.getAnalyticsSummary as jest.Mock).mockResolvedValueOnce({
      totalDevices: 0,
      onlineDevices: 0,
      totalContent: 1,
      processingContent: 0,
      totalPlaylists: 0,
      activePlaylists: 0,
      totalImpressions: 0,
      totalContentSize: 0,
      uptimePercent: 0,
    });
    (apiClient.getContent as jest.Mock).mockResolvedValueOnce({
      data: [{
        id: 'c-new',
        title: 'Updated Menu',
        type: 'image',
        status: 'ready',
        createdAt: '2026-05-31T12:00:00.000Z',
      }],
      meta: { page: 1, limit: 3, total: 1, totalPages: 1 },
    });
    (apiClient.getPlaylists as jest.Mock).mockRejectedValueOnce(new Error('playlists unavailable'));

    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Some dashboard data could not refresh')).toBeInTheDocument();
      expect(screen.getByText('Updated Menu')).toBeInTheDocument();
    });
    expect(screen.getByText('Content Items').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('adds device status entries to recent activity after device context initializes', async () => {
    mockDeviceStatusContext = {
      deviceStatuses: {},
      isInitialized: false,
    };

    const { rerender } = await renderDashboardClient();

    expect(screen.getByText('No recent activity yet')).toBeInTheDocument();

    mockDeviceStatusContext = {
      isInitialized: true,
      deviceStatuses: {
        'device-1': {
          id: 'device-1',
          status: 'online',
          metadata: {
            nickname: 'Lobby Display',
            location: 'Front Desk',
            lastSeen: '2026-05-31T12:00:00.000Z',
          },
        },
      },
    };

    rerender(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
      expect(screen.getByText('online - Front Desk')).toBeInTheDocument();
    });
  });
});
