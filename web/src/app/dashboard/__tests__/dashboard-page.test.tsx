import { render, screen } from '@testing-library/react';
import DashboardClient from '../page-client';

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
  },
}));

jest.mock('@/lib/context/DeviceStatusContext', () => ({
  useDeviceStatus: () => ({
    deviceStatuses: {},
    isInitialized: true,
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
});
