import { render, screen, waitFor } from '@testing-library/react';
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
      initialContentComplete={props.initialContentComplete}
      initialPlaylistsComplete={props.initialPlaylistsComplete}
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
  });

  it('does not refetch content and playlists on mount when server pagination is complete', async () => {
    await renderDashboardClient({
      initialContent: [{ id: 'c1' }],
      initialPlaylists: [{ id: 'p1', items: [{ id: 'item-1' }] }],
      initialContentComplete: true,
      initialPlaylistsComplete: true,
    });

    expect(apiClient.getContent).not.toHaveBeenCalled();
    expect(apiClient.getPlaylists).not.toHaveBeenCalled();
    expect(screen.getByText('Content Items').parentElement?.parentElement).toHaveTextContent('1');
    expect(screen.getByText('Playlists').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('refreshes overview counts from all paginated pages on mount', async () => {
    (apiClient.getContent as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 'c1' }],
        meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'c2', status: 'processing' }],
        meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
      });
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({
      data: [{ id: 'p1', isActive: true }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(apiClient.getContent).toHaveBeenNthCalledWith(1, { page: 1, limit: 100 });
      expect(apiClient.getContent).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
      expect(apiClient.getPlaylists).toHaveBeenCalledWith({ page: 1, limit: 100 });
    });
    expect(screen.getByText('Content Items').parentElement?.parentElement).toHaveTextContent('2');
    expect(screen.getByText('Playlists').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('preserves initial overview counts when all-page refresh partially fails', async () => {
    (apiClient.getContent as jest.Mock).mockRejectedValueOnce(new Error('content unavailable'));
    (apiClient.getPlaylists as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'p1', isActive: true }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    render(
      <DashboardClient
        initialContent={[{ id: 'c1' }, { id: 'c2' }]}
        initialPlaylists={[{ id: 'p1', isActive: true }]}
      />,
    );

    await waitFor(() => {
      expect(apiClient.getContent).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(screen.getByText('Some dashboard data could not refresh')).toBeInTheDocument();
    });
    expect(screen.getByText('Content Items').parentElement?.parentElement).toHaveTextContent('2');
    expect(screen.getByText('Playlists').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('refreshes recent activity after a partial content refresh succeeds', async () => {
    (apiClient.getContent as jest.Mock).mockResolvedValueOnce({
      data: [{
        id: 'c-new',
        title: 'Updated Menu',
        type: 'image',
        status: 'ready',
        createdAt: '2026-05-31T12:00:00.000Z',
      }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
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
      expect(screen.getByText(/online.*Front Desk/)).toBeInTheDocument();
    });
  });
});
