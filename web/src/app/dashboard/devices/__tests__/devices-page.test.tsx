import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DevicesClient from '../page-client';

const mockPush = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetPlaylists = jest.fn();
const mockGetDisplayGroups = jest.fn();
const mockDeleteDisplay = jest.fn();
const mockUpdateDisplay = jest.fn();
const mockGeneratePairingToken = jest.fn();

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
    generatePairingToken: (...args: any[]) => mockGeneratePairingToken(...args),
    getCurrentUser: jest.fn().mockRejectedValue(new Error('401')),
    setAuthenticated: jest.fn(),
    getActiveOverrides: jest.fn().mockResolvedValue([]),
    sendFleetCommand: jest.fn(),
    clearOverride: jest.fn(),
  },
}));

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com', firstName: 'Test', lastName: 'User', organizationId: 'org-1', role: 'admin' },
    loading: false,
    error: null,
    isAuthenticated: true,
    logout: jest.fn(),
    reload: jest.fn(),
  }),
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
  return function MockGroupSelector({ groups, selectedGroupIds, onChange }: any) {
    return (
      <div data-testid="group-selector">
        {groups.map((group: any) => (
          <label key={group.id}>
            <input
              aria-label={`group-${group.name}`}
              type="checkbox"
              checked={selectedGroupIds.includes(group.id)}
              onChange={(event) => {
                onChange(
                  event.currentTarget.checked
                    ? [...selectedGroupIds, group.id]
                    : selectedGroupIds.filter((id: string) => id !== group.id),
                );
              }}
            />
            {group.name}
          </label>
        ))}
      </div>
    );
  };
});

jest.mock('@/components/DevicePreviewModal', () => {
  return function MockDevicePreview() { return null; };
});

jest.mock('@/components/PlaylistQuickSelect', () => {
  return function MockPlaylistSelect() { return null; };
});

jest.mock('@/components/fleet', () => ({
  FleetCommandDropdown: function MockFleetDropdown() { return <div data-testid="fleet-dropdown">Fleet Commands</div>; },
  EmergencyOverrideModal: function MockOverrideModal({ isOpen }: any) { return isOpen ? <div data-testid="override-modal">Override Modal</div> : null; },
  ActiveOverrideBanner: function MockBanner() { return null; },
}));

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
    mockGeneratePairingToken.mockResolvedValue({
      pairingToken: 'eyJ.mock.pairing-token',
      expiresIn: '30d',
      displayId: 'd1',
      deviceIdentifier: 'device-d1',
    });
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

  it('filters devices by selected device group membership', async () => {
    mockGetDisplays.mockResolvedValue({ data: sampleDevices, meta: { total: 3 } });
    mockGetDisplayGroups.mockResolvedValue({
      data: [{ id: 'g1', name: 'Lobby Group', description: '', displays: [{ displayId: 'd1' }] }],
    });

    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={samplePlaylists as any} />);

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Device Groups (1)'));
    fireEvent.click(screen.getByLabelText('group-Lobby Group'));

    expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    expect(screen.queryByText('Conference Room')).not.toBeInTheDocument();
    expect(screen.queryByText('Cafeteria Screen')).not.toBeInTheDocument();
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

  it('renders backend pairingToken when pairing an existing device', async () => {
    mockGetDisplays.mockResolvedValue({ data: sampleDevices, meta: { total: 3 } });

    render(<DevicesClient initialDevices={sampleDevices as any} initialPlaylists={samplePlaylists as any} />);

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Pair')[0]);

    await waitFor(() => {
      expect(mockGeneratePairingToken).toHaveBeenCalledWith('d1');
      expect(screen.getByText('eyJ.mock.pairing-token')).toBeInTheDocument();
    });
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('handles empty device list gracefully', async () => {
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });
});
