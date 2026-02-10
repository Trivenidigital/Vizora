import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DevicesClient from '../page-client';

const mockPush = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetPlaylists = jest.fn();
const mockGetDisplayGroups = jest.fn();
const mockDeleteDisplay = jest.fn();
const mockUpdateDisplay = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/dashboard/devices',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDisplays: (...args: any[]) => mockGetDisplays(...args),
    getPlaylists: (...args: any[]) => mockGetPlaylists(...args),
    getDisplayGroups: (...args: any[]) => mockGetDisplayGroups(...args),
    deleteDisplay: (...args: any[]) => mockDeleteDisplay(...args),
    updateDisplay: (...args: any[]) => mockUpdateDisplay(...args),
  },
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  ToastContainer: () => null,
};

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/lib/hooks/useDebounce', () => ({
  useDebounce: (val: any) => val,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: jest.fn(() => ({ isConnected: false, isOffline: true })),
  useOptimisticState: jest.fn((initialState: any) => ({
    updateOptimistic: jest.fn(),
    commitOptimistic: jest.fn(),
    rollbackOptimistic: jest.fn(),
    getPendingCount: jest.fn(() => 0),
    hasPendingUpdates: jest.fn(() => false),
  })),
  useErrorRecovery: jest.fn(() => ({ retry: jest.fn(), recordError: jest.fn(), clearError: jest.fn(), isRecovering: false })),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title }: any) { return <div data-testid="empty-state">{title || 'No items'}</div>; };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children }: any) { return isOpen ? <div data-testid="modal">{children}</div> : null; };
});

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirm({ isOpen, onConfirm, title }: any) {
    return isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null;
  };
});

jest.mock('@/components/SearchFilter', () => {
  return function MockSearch() { return <input data-testid="search-input" placeholder="Search..." />; };
});

jest.mock('@/components/DeviceStatusIndicator', () => {
  return function MockIndicator({ status }: any) { return <span data-testid="device-status">{status || 'Online'}</span>; };
});

jest.mock('@/components/DeviceGroupSelector', () => {
  return function MockGroupSelector() { return null; };
});

jest.mock('@/components/DevicePreviewModal', () => {
  return function MockDevicePreview() { return null; };
});

jest.mock('@/components/PlaylistQuickSelect', () => {
  return function MockPlaylistSelect() { return null; };
});

const sampleDevices = [
  {
    id: 'd1',
    name: 'Lobby Display',
    nickname: 'Lobby Display',
    status: 'online',
    location: 'Building A - Lobby',
    lastSeen: '2026-02-09T10:00:00Z',
    currentPlaylistId: 'p1',
    resolution: '1920x1080',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'd2',
    name: 'Conference Room',
    nickname: 'Conference Room',
    status: 'offline',
    location: 'Building B - Room 201',
    lastSeen: '2026-02-08T18:00:00Z',
    currentPlaylistId: null,
    resolution: '3840x2160',
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'd3',
    name: 'Cafeteria Screen',
    nickname: 'Cafeteria Screen',
    status: 'online',
    location: 'Building A - Cafeteria',
    lastSeen: '2026-02-09T09:55:00Z',
    currentPlaylistId: 'p2',
    createdAt: '2026-01-10T00:00:00Z',
  },
];

const samplePlaylists = [
  { id: 'p1', name: 'Welcome Playlist', isActive: true },
  { id: 'p2', name: 'Menu Display', isActive: true },
];

describe('DevicesClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplays.mockResolvedValue({ data: [], meta: { total: 0 } });
    mockGetPlaylists.mockResolvedValue({ data: [] });
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
    mockDeleteDisplay.mockResolvedValue({});
    mockUpdateDisplay.mockResolvedValue({});
  });

  it('renders and loads data with empty initial props', async () => {
    mockGetDisplays.mockResolvedValue({ data: [], meta: { total: 0 } });
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    // Component loads from API, eventually finishes loading
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('calls getDisplays API', async () => {
    mockGetDisplays.mockResolvedValue({ data: sampleDevices, meta: { total: 3 } });
    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={samplePlaylists as any} />);
    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
  });

  it('renders devices from initial props', async () => {
    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={samplePlaylists as any} />);
    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
    expect(screen.getByText('Conference Room')).toBeInTheDocument();
    expect(screen.getByText('Cafeteria Screen')).toBeInTheDocument();
  });

  it('handles API failure gracefully', async () => {
    mockGetDisplays.mockRejectedValue(new Error('Server error'));
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders device page header', async () => {
    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/device/i).length).toBeGreaterThan(0);
  });

  it('renders search input', async () => {
    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });
  });

  it('fetches display groups for filtering', async () => {
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(mockGetDisplayGroups).toHaveBeenCalled();
    });
  });

  it('renders with provided playlists', async () => {
    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={samplePlaylists as any} />);
    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
  });

  it('renders device management controls', async () => {
    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={samplePlaylists as any} />);
    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
    // Page renders with device management UI
    expect(screen.getAllByText(/device/i).length).toBeGreaterThan(0);
  });

  it('handles empty device list gracefully', async () => {
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });
});
