import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DevicesClient from '../page-client';

const mockPush = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetPlaylists = jest.fn();
const mockGetDisplayGroups = jest.fn();
const mockDeleteDisplay = jest.fn();
const mockUpdateDisplay = jest.fn();
const mockGeneratePairingToken = jest.fn();
const mockBulkDeleteDisplays = jest.fn();
const mockBulkAssignPlaylist = jest.fn();
const mockBulkAssignGroup = jest.fn();

let mockUser: any = {
  id: 'u1',
  email: 'test@test.com',
  firstName: 'Test',
  lastName: 'User',
  organizationId: 'org-1',
  role: 'admin',
};

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
    bulkDeleteDisplays: (...args: any[]) => mockBulkDeleteDisplays(...args),
    bulkAssignPlaylist: (...args: any[]) => mockBulkAssignPlaylist(...args),
    bulkAssignGroup: (...args: any[]) => mockBulkAssignGroup(...args),
    getCurrentUser: jest.fn().mockRejectedValue(new Error('401')),
    setAuthenticated: jest.fn(),
    getActiveOverrides: jest.fn().mockResolvedValue([]),
    sendFleetCommand: jest.fn(),
    clearOverride: jest.fn(),
  },
}));

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    error: null,
    isAuthenticated: !!mockUser,
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
  useErrorRecovery: jest.fn(() => ({
    retry: jest.fn(async (_id, fn, onSuccess, onError) => {
      try {
        const result = await fn();
        onSuccess?.(result);
        return result;
      } catch (error) {
        onError?.(error);
        throw error;
      }
    }),
    recordError: jest.fn(),
    clearError: jest.fn(),
    isRecovering: false,
  })),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title, description, action }: any) {
    return (
      <div data-testid="empty-state">
        {title || 'No items'}
        {description && <p>{description}</p>}
        {action && <button onClick={action.onClick}>{action.label}</button>}
      </div>
    );
  };
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
  return function MockDevicePreview({ isOpen, canRequestScreenshot }: any) {
    return isOpen ? (
      <div data-testid="device-preview-modal">
        {canRequestScreenshot && <button>Refresh Screenshot</button>}
      </div>
    ) : null;
  };
});

jest.mock('@/components/PlaylistQuickSelect', () => {
  return function MockPlaylistSelect({ device, disabled }: any) {
    return (
      <select data-testid={`playlist-select-${device.id}`} disabled={disabled}>
        <option>No playlist</option>
      </select>
    );
  };
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
    mockUser = {
      id: 'u1',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      organizationId: 'org-1',
      role: 'admin',
    };
    mockGetDisplays.mockResolvedValue({ data: [], meta: { total: 0 } });
    mockGetPlaylists.mockResolvedValue({ data: [] });
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
    mockDeleteDisplay.mockResolvedValue({});
    mockUpdateDisplay.mockResolvedValue({});
    mockBulkDeleteDisplays.mockResolvedValue({ deleted: 0 });
    mockBulkAssignPlaylist.mockResolvedValue({ updated: 0 });
    mockBulkAssignGroup.mockResolvedValue({ added: 0 });
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

  it('does not refetch devices or playlists when server props are already present', async () => {
    mockGetDisplays.mockResolvedValue({ data: sampleDevices, meta: { total: 3 } });
    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
    expect(mockGetDisplays).not.toHaveBeenCalled();
    expect(mockGetPlaylists).not.toHaveBeenCalled();
  });

  it('fetches devices and playlists on mount when server props are empty', async () => {
    mockGetDisplays.mockResolvedValue({ data: sampleDevices, meta: { total: 3 } });
    mockGetPlaylists.mockResolvedValue({ data: samplePlaylists, meta: { total: 2 } });

    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);

    await waitFor(() => {
      expect(mockGetDisplays).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(mockGetPlaylists).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
  });

  it('fetches all devices and playlists when server props are only the first page', async () => {
    mockGetDisplays
      .mockResolvedValueOnce({
        data: [{ ...sampleDevices[0], id: 'd100', nickname: 'Fetched First Page Device' }],
        meta: { page: 1, limit: 100, total: 101, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ ...sampleDevices[2], id: 'd101', nickname: 'Overflow Device' }],
        meta: { page: 2, limit: 100, total: 101, totalPages: 2 },
      });
    mockGetPlaylists
      .mockResolvedValueOnce({
        data: [{ id: 'p100', name: 'Fetched First Page Playlist', isActive: true }],
        meta: { page: 1, limit: 100, total: 101, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'p101', name: 'Overflow Playlist', isActive: true }],
        meta: { page: 2, limit: 100, total: 101, totalPages: 2 },
      });

    render(
      <DevicesClient
        initialDevices={[sampleDevices[0]] as any}
        initialPlaylists={[samplePlaylists[0]] as any}
        initialDevicesComplete={false}
        initialPlaylistsComplete={false}
      />,
    );

    await waitFor(() => {
      expect(mockGetDisplays).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(mockGetPlaylists).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(screen.getByText('Overflow Device')).toBeInTheDocument();
    });
    expect(mockGetDisplays).toHaveBeenCalledWith({ page: 2, limit: 100 });
    expect(mockGetPlaylists).toHaveBeenCalledWith({ page: 2, limit: 100 });
    expect(screen.getByText('Fetched First Page Device')).toBeInTheDocument();
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
    expect(screen.getByRole('alert')).toHaveTextContent('Devices Error');
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.queryByText('No devices yet')).not.toBeInTheDocument();
  });

  it('keeps viewers on read-only device actions', async () => {
    mockUser = { ...mockUser, role: 'viewer' };

    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('fleet-dropdown')).not.toBeInTheDocument();
    expect(screen.queryByText('Emergency Override')).not.toBeInTheDocument();
    expect(screen.queryByText('Pair New Device')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Pair')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.getAllByText('Preview').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/playlist-select-/).every((select) => select.hasAttribute('disabled'))).toBe(true);

    fireEvent.click(screen.getAllByText('Preview')[0]);

    expect(screen.getByTestId('device-preview-modal')).toBeInTheDocument();
    expect(screen.queryByText('Refresh Screenshot')).not.toBeInTheDocument();
  });

  it('does not show an empty-state pairing action to viewers', async () => {
    mockUser = { ...mockUser, role: 'viewer' };
    mockGetDisplays.mockResolvedValue({ data: [], meta: { total: 0 } });

    render(
      <DevicesClient
        initialDevices={[]}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toHaveTextContent('No devices yet');
    });

    expect(screen.getByTestId('empty-state')).toHaveTextContent('A manager or admin can add the first screen');
    expect(screen.queryByText('Get started by pairing your first display device')).not.toBeInTheDocument();
    expect(screen.queryByText('Pair Device')).not.toBeInTheDocument();
  });

  it('allows managers to pair and assign devices without exposing admin-only deletes or emergency override', async () => {
    mockUser = { ...mockUser, role: 'manager' };

    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });

    expect(screen.getByTestId('fleet-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Pair New Device')).toBeInTheDocument();
    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pair').length).toBeGreaterThan(0);
    expect(screen.queryByText('Emergency Override')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
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

  it('requires confirmation before bulk deleting selected devices and reports the backend count', async () => {
    mockBulkDeleteDisplays.mockResolvedValue({ deleted: 1 });

    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    fireEvent.click(screen.getByText('Delete Selected'));

    expect(mockBulkDeleteDisplays).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('Delete Selected Devices');

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockBulkDeleteDisplays).toHaveBeenCalledWith(['d1', 'd2']);
    });
    expect(mockToast.success).toHaveBeenCalledWith('Deleted 1 device(s)');
  });

  it('reports backend updated count after bulk playlist assignment', async () => {
    mockBulkAssignPlaylist.mockResolvedValue({ updated: 1 });

    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(screen.getByText('Assign Playlist'));
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(mockBulkAssignPlaylist).toHaveBeenCalledWith(['d1', 'd2'], 'p1');
    });
    expect(mockToast.success).toHaveBeenCalledWith('Playlist assigned to 1 device(s)');
  });

  it('reports backend added count after bulk group assignment', async () => {
    mockGetDisplayGroups.mockResolvedValue({
      data: [{ id: 'g1', name: 'Lobby Group', description: '', displays: [] }],
      meta: { total: 1 },
    });
    mockBulkAssignGroup.mockResolvedValue({ added: 1 });

    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(screen.getByText('Add to Group'));

    await waitFor(() => {
      expect(screen.getByText('Lobby Group')).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'g1' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to Group' }).at(-1)!);

    await waitFor(() => {
      expect(mockBulkAssignGroup).toHaveBeenCalledWith(['d1', 'd2'], 'g1');
    });
    expect(mockToast.success).toHaveBeenCalledWith('Added 1 device(s) to group');
  });

  it('handles empty device list gracefully', async () => {
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });
});
