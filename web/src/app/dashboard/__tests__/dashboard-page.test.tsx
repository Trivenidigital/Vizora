import { render, screen, waitFor } from '@testing-library/react';
import DashboardClient from '../page-client';
import { apiClient } from '@/lib/api';

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
    getQuotaUsage: jest.fn().mockResolvedValue({ storageUsedBytes: 0, storageQuotaBytes: 1073741824, screenCount: 0, screenQuota: 5 }),
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

describe('DashboardClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeviceStatusContext = {
      deviceStatuses: {},
      isInitialized: true,
    };
  });

  it('renders dashboard overview heading', () => {
    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);
    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
  });

  it('renders stats cards', () => {
    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);
    expect(screen.getByText('Total Devices')).toBeInTheDocument();
    expect(screen.getByText('Content Items')).toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('renders quick actions section', () => {
    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('renders recent activity section', () => {
    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders storage usage section', () => {
    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);
    expect(screen.getByText('Storage Usage')).toBeInTheDocument();
  });

  it('shows getting started guide when no devices', () => {
    render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
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

    const { rerender } = render(<DashboardClient initialContent={[]} initialPlaylists={[]} />);

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
