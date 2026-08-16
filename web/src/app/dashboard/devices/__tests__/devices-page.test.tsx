import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
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

/**
 * Captured so a test can fire a realtime status update the way the gateway
 * does. Without this the only way to re-render the page is a user action, and
 * the focus-stability case that matters most — focus surviving a re-render the
 * user did NOT cause — would be untestable.
 */
let mockRealtimeOptions: any = null;

jest.mock('@/lib/hooks', () => ({
  // emitDeviceUpdate is part of the real hook's contract and the edit flow calls
  // it; omitting it made the success path throw into the retry error branch.
  useRealtimeEvents: jest.fn((options: any) => {
    mockRealtimeOptions = options;
    return {
      isConnected: false,
      isOffline: true,
      emitDeviceUpdate: jest.fn(),
    };
  }),
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
  // Faithful to the real SearchFilter's controlled contract (value + onChange):
  // the previous stub ignored its props, so no test could drive a search, and
  // anything gated on `debouncedSearch` was unreachable.
  return function MockSearch({ value, onChange }: any) {
    return (
      <input
        data-testid="search-input"
        placeholder="Search..."
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  };
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
    // Two selected, two deleted — the COMPLETE case, which stays a success
    // toast with no banner. (The partial case moved to its own describe below;
    // this fixture used to return `deleted: 1` for a 2-device request and
    // asserted that shortfall as a plain success.)
    mockBulkDeleteDisplays.mockResolvedValue({ deleted: 2 });

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
    expect(mockToast.success).toHaveBeenCalledWith('Deleted 2 device(s)');
    expect(screen.queryByText(/of 2 selected devices/)).not.toBeInTheDocument();
  });

  it('reports backend updated count after bulk playlist assignment', async () => {
    // d1 (online) + d2 (offline) selected, both updated — complete.
    mockBulkAssignPlaylist.mockResolvedValue({ updated: 2 });

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
    // d1 is online, d2 is offline — a mixed selection, so the operator is told
    // the offline one updates later rather than being left to infer it from a
    // TV that keeps showing its cached playlist.
    expect(mockToast.success).toHaveBeenCalledWith(
      'Playlist assigned to 2 device(s). Non-online devices will update when they come online.',
    );
  });

  it('omits the deferred-delivery note when every selected device is online', async () => {
    mockBulkAssignPlaylist.mockResolvedValue({ updated: 2 });

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

    // checkboxes[1] = d1 (online), checkboxes[3] = d3 (online) — d2 is offline.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[3]);
    fireEvent.click(screen.getByText('Assign Playlist'));
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(mockBulkAssignPlaylist).toHaveBeenCalledWith(['d1', 'd3'], 'p1');
    });
    expect(mockToast.success).toHaveBeenCalledWith('Playlist assigned to 2 device(s)');
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

  /**
   * A confirmed delete must leave the table, not just the database.
   *
   * `useOptimisticState` keeps its own copy of the array and the page never
   * renders it, so pairing the API call with commitOptimistic alone left the
   * deleted row on screen until the operator reloaded - the row looked alive
   * next to a "deleted successfully" toast. Asserted on the DOM with no
   * refetch: getDisplays is not re-stubbed here, so a row that survives cannot
   * be papered over by a reload.
   */
  it('removes the deleted device from the table without a reload', async () => {
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

    fireEvent.click(screen.getAllByText('Delete')[0]);
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockDeleteDisplay).toHaveBeenCalledWith('d1');
    });

    await waitFor(() => {
      expect(screen.queryByText('Lobby Display')).not.toBeInTheDocument();
    });
    expect(mockToast.success).toHaveBeenCalledWith('Device deleted successfully');
    // The other rows stay - the filter must be by id, not a blanket clear.
    expect(screen.getByText('Conference Room')).toBeInTheDocument();
    expect(screen.getByText('Cafeteria Screen')).toBeInTheDocument();
    expect(mockGetDisplays).not.toHaveBeenCalled();
  });

  // Same root cause as the delete above: the rendered list is `devices`, so a
  // rename that only committed the optimistic copy showed the old nickname.
  it('shows the renamed device in the table without a reload', async () => {
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

    fireEvent.click(screen.getAllByText('Edit')[0]);
    const [nicknameInput] = screen.getAllByPlaceholderText('e.g., Store Front Display');
    fireEvent.change(nicknameInput, { target: { value: 'Reception Screen' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateDisplay).toHaveBeenCalledWith('d1', {
        nickname: 'Reception Screen',
        location: 'Building A - Lobby',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Reception Screen')).toBeInTheDocument();
    });
    expect(screen.queryByText('Lobby Display')).not.toBeInTheDocument();
    expect(mockGetDisplays).not.toHaveBeenCalled();
  });

  it('handles empty device list gracefully', async () => {
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });
});

/**
 * A bulk action that only PARTLY landed must not read as success.
 *
 * Every bulk endpoint answers with a count from the row-matching write it
 * performed — `deleteMany().count`, `updateMany().count`, `createMany().count`
 * — so a shortfall is server-reported evidence, not an inference. The page used
 * to render that count into a success toast: ask to delete ten, get one gone
 * and a green "Deleted 1 device(s)", with the other nine still listed and no
 * statement that anything was skipped. Toasts also expire, so the one message
 * that needed re-reading was the one that disappeared.
 *
 * The two families are deliberately NOT reported the same way:
 *   delete / assign-playlist  -> a shortfall means rows did not match. Warning.
 *   add-to-group              -> createMany skips duplicates, so a shortfall
 *                                means ALREADY A MEMBER. Not a failure, and
 *                                calling it one sends the operator chasing a
 *                                problem that does not exist.
 */
describe('DevicesClient reports partial bulk outcomes honestly', () => {
  const renderThree = () =>
    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

  const selectTwo = () => {
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
  };

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
    mockGetDisplays.mockResolvedValue({ data: sampleDevices, meta: { total: 3 } });
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
  });

  it('warns, and keeps a banner on screen, when fewer devices were deleted than selected', async () => {
    mockBulkDeleteDisplays.mockResolvedValue({ deleted: 1 });

    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    selectTwo();
    fireEvent.click(screen.getByText('Delete Selected'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockBulkDeleteDisplays).toHaveBeenCalledWith(['d1', 'd2']);
    });

    // Not a success toast — the operator asked for two and got one.
    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith('Deleted 1 device(s) of 2 selected');
    });
    expect(mockToast.success).not.toHaveBeenCalled();

    // And it survives past the toast: the count is still readable afterwards.
    expect(screen.getByText('Deleted 1 of 2 selected devices')).toBeInTheDocument();
    expect(screen.getByText(/1 were not changed/)).toBeInTheDocument();
  });

  it('lets the operator dismiss the partial-result banner', async () => {
    mockBulkDeleteDisplays.mockResolvedValue({ deleted: 1 });

    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    selectTwo();
    fireEvent.click(screen.getByText('Delete Selected'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(screen.getByText('Deleted 1 of 2 selected devices')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Dismiss bulk action result'));
    expect(screen.queryByText('Deleted 1 of 2 selected devices')).not.toBeInTheDocument();
  });

  it('warns when fewer devices got the playlist than were selected', async () => {
    mockBulkAssignPlaylist.mockResolvedValue({ updated: 1 });

    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    selectTwo();
    fireEvent.click(screen.getByText('Assign Playlist'));
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(mockBulkAssignPlaylist).toHaveBeenCalledWith(['d1', 'd2'], 'p1');
    });

    await waitFor(() => {
      // The scope clause qualifies the COUNT, so it sits against the count and
      // BEFORE the trailing sentence. Appending it last produced "...come
      // online. of 2 selected" — a fragment after a full stop. The deferred-
      // delivery note still rides along: d2 is offline, and a deferred
      // assignment is applied on reconnect, not lost.
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Playlist assigned to 1 device(s) of 2 selected. Non-online devices will update when they come online.',
      );
    });
    expect(mockToast.warning.mock.calls.every(([m]: [string]) => !/\.\s+of \d+ selected/.test(m))).toBe(true);
    expect(
      screen.getByText('Assigned the playlist to 1 of 2 selected devices'),
    ).toBeInTheDocument();
  });

  it('does not call an already-a-member group shortfall a failure', async () => {
    mockGetDisplayGroups.mockResolvedValue({
      data: [{ id: 'g1', name: 'Lobby Group', description: '', displays: [] }],
      meta: { total: 1 },
    });
    mockBulkAssignGroup.mockResolvedValue({ added: 1 });

    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    selectTwo();
    fireEvent.click(screen.getByText('Add to Group'));
    await waitFor(() => expect(screen.getByText('Lobby Group')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'g1' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to Group' }).at(-1)!);

    await waitFor(() => {
      expect(mockBulkAssignGroup).toHaveBeenCalledWith(['d1', 'd2'], 'g1');
    });

    expect(mockToast.success).toHaveBeenCalledWith('Added 1 device(s) to group');
    expect(mockToast.warning).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/were already in this group/)).toBeInTheDocument();
    });

    // ...and the banner must be painted to MATCH that reading. A success toast
    // over a warning-inked banner is the same contradiction, one layer down.
    const banner = screen.getByText(/were already in this group/).closest('.eh-partial-banner');
    expect(banner).toHaveClass('eh-partial-banner-info');
  });

  it('paints a genuine partial delete as a warning, not as information', async () => {
    mockBulkDeleteDisplays.mockResolvedValue({ deleted: 1 });

    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    selectTwo();
    fireEvent.click(screen.getByText('Delete Selected'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(screen.getByText('Deleted 1 of 2 selected devices')).toBeInTheDocument();
    });
    const banner = screen.getByText('Deleted 1 of 2 selected devices').closest('.eh-partial-banner');
    expect(banner).not.toHaveClass('eh-partial-banner-info');
  });
});

/**
 * "No devices at all" and "no devices match your filters" are different
 * situations with different fixes, so they are different screens.
 *
 * Showing "No devices yet — pair your first display" while a search box holds
 * "zzz" tells an operator with 500 screens that the fleet is gone.
 */
describe('DevicesClient distinguishes empty from filtered-empty', () => {
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
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
  });

  it('names the filters, not the fleet, when a search matches nothing', async () => {
    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'zzz-no-such-screen' } });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toHaveTextContent(
        'No devices match these filters',
      );
    });
    expect(screen.queryByText('No devices yet')).not.toBeInTheDocument();
    // The fleet size is stated so nobody reads this as data loss.
    expect(screen.getByTestId('empty-state')).toHaveTextContent('3 devices are paired');

    fireEvent.click(screen.getByText('Clear filters'));
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());
  });
});

/**
 * Fleet scannability: at 500 devices nobody reads rows, they read totals and
 * then narrow. The summary strip is the aggregate AND the filter, counted over
 * the whole fleet rather than the visible page so the numbers do not move under
 * pagination.
 */
describe('DevicesClient fleet status summary', () => {
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
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
  });

  it('counts each status over the whole fleet and filters to it on click', async () => {
    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    // sampleDevices: d1 + d3 online, d2 offline.
    const offlineChip = screen.getByRole('button', { name: '1 Offline' });
    expect(screen.getByRole('button', { name: '2 Online' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 All devices' })).toBeInTheDocument();

    fireEvent.click(offlineChip);

    await waitFor(() => {
      expect(screen.queryByText('Lobby Display')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Conference Room')).toBeInTheDocument();
    expect(offlineChip).toHaveAttribute('aria-pressed', 'true');

    // Clicking the active chip clears it rather than trapping the operator.
    fireEvent.click(offlineChip);
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());
  });
});

/**
 * Row actions and column sorting must be reachable without a mouse.
 *
 * Sorting was a bare `onClick` on the `<th>`: not focusable, not activatable by
 * keyboard, and announcing no sort state at all. Row actions were four buttons
 * all named "Delete"/"Edit"/"Pair" — identical accessible names repeated once
 * per device, so a screen-reader user tabbing a 500-row list heard "Delete
 * button" 500 times with nothing to tell them apart.
 */
describe('DevicesClient keyboard and assistive-tech operability', () => {
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
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
  });

  const renderThree = () =>
    render(
      <DevicesClient
        initialDevices={sampleDevices as any}
        initialPlaylists={samplePlaylists as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

  /**
   * Activating a sort must not throw focus away.
   *
   * `SortableHeader` lives at module scope. Declared inside the page component
   * its identity changes every render, so React sees a different element TYPE
   * and unmounts/remounts each `<th>` subtree instead of updating it — which
   * destroys the very button the user just pressed. `document.activeElement`
   * falls back to `<body>`, the next Tab restarts at the top of the page, and
   * the screen reader never hears the `aria-sort` it was waiting for.
   *
   * Asserting on the SAME node reference is what makes this mutation-sensitive:
   * a re-query would find the replacement button and pass either way, which is
   * exactly why the original keyboard test could not see the defect.
   */
  it('keeps focus on the sort button it just activated', async () => {
    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    const button = within(screen.getByRole('columnheader', { name: /^Device/ })).getByRole('button');
    button.focus();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);

    // Same DOM node, still focused, and now carrying the new sort state.
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('columnheader', { name: /^Device/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  /**
   * The same remount also fires on re-renders the user did not cause. A single
   * realtime `device:status` event is enough to yank focus out of whatever the
   * operator was on — including mid-Tab through the row actions.
   */
  it('keeps focus through a realtime status update the user did not trigger', async () => {
    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    const button = within(screen.getByRole('columnheader', { name: /^Status/ })).getByRole('button');
    button.focus();
    expect(document.activeElement).toBe(button);

    act(() => {
      mockRealtimeOptions.onDeviceStatusChange({
        deviceId: 'd1',
        status: 'offline',
        lastSeen: '2026-08-16T00:00:00.000Z',
      });
    });

    expect(document.activeElement).toBe(button);
  });

  it('shows the select-all box as indeterminate when only some rows are selected', async () => {
    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    const selectAll = screen.getByLabelText('Select all devices on this page') as HTMLInputElement;
    expect(selectAll.indeterminate).toBe(false);

    // One of three — the header box must not read as plain "nothing selected"
    // while a row is armed for Delete Selected.
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    await waitFor(() => expect(selectAll.indeterminate).toBe(true));
    expect(selectAll.checked).toBe(false);

    fireEvent.click(selectAll);
    await waitFor(() => expect(selectAll.checked).toBe(true));
    expect(selectAll.indeterminate).toBe(false);
  });

  it('sorts from a real button and publishes the sort state on the column header', async () => {
    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    const header = screen.getByRole('columnheader', { name: /^Device/ });
    expect(header).toHaveAttribute('aria-sort', 'none');

    const sortButton = screen.getByRole('button', {
      name: /Device.*activate to sort ascending/,
    });
    fireEvent.click(sortButton);

    expect(screen.getByRole('columnheader', { name: /^Device/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    fireEvent.click(screen.getByRole('button', { name: /Device.*activate to sort descending/ }));
    expect(screen.getByRole('columnheader', { name: /^Device/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('gives every row control an accessible name that identifies its device', async () => {
    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Delete Lobby Display' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Conference Room' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview Cafeteria Screen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Select Lobby Display')).toBeInTheDocument();

    // Still operable — the accessible name changed, the behaviour did not.
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lobby Display' }));
    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('Delete Device');
  });

  it('exposes the group filter disclosure state', async () => {
    mockGetDisplayGroups.mockResolvedValue({
      data: [{ id: 'g1', name: 'Lobby Group', description: '', displays: [] }],
    });
    renderThree();
    await waitFor(() => expect(screen.getByText('Lobby Display')).toBeInTheDocument());

    const toggle = await screen.findByRole('button', { name: /Device Groups/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

/**
 * Destructive bulk actions must operate on exactly the rows the operator can
 * identify as selected.
 *
 * Selection previously survived pagination while the header checkbox and the
 * bulk bar described only the visible page, so selecting a page of devices and
 * paging on left the bulk Delete armed against rows the operator could no
 * longer see or review. Deletion is irreversible.
 *
 * Page-scoped is the model this app already teaches: the content page prunes
 * selection to the visible ids on every load (content/page-client.tsx). Cases
 * are phrased as what must NOT happen.
 */
describe('DevicesClient bulk selection is confined to visible rows', () => {
  const manyDevices = Array.from({ length: 25 }, (_, i) => ({
    id: `dev-${i + 1}`,
    nickname: `Device ${i + 1}`,
    name: `Device ${i + 1}`,
    status: 'online',
    location: 'Seattle',
    lastSeen: '2026-08-13T10:00:00.000Z',
  }));

  const renderMany = () =>
    render(
      <DevicesClient
        initialDevices={manyDevices as any}
        initialPlaylists={[] as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

  const selectAllCheckbox = () => screen.getByLabelText('Select all devices on this page');

  it('reports the filtered total as the result count, not the page slice', async () => {
    renderMany();
    await waitFor(() => expect(screen.getByText('Device 1')).toBeInTheDocument());

    // The banner only renders during an active search, which is exactly when
    // the mismatch showed: it counted the page slice ("10 results found") while
    // the pagination line below counted the filtered set ("of 24 devices").
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Device' } });

    await waitFor(() => {
      const banner = screen.getByText(/results found/i).textContent ?? '';
      expect(banner.replace(/\s+/g, ' ').trim()).toBe('25 results found');
    });
  });

  it('drops selection that is no longer visible when the page changes', async () => {
    renderMany();
    await waitFor(() => expect(screen.getByText('Device 1')).toBeInTheDocument());

    fireEvent.click(selectAllCheckbox());
    expect(selectAllCheckbox()).toBeChecked();

    fireEvent.click(screen.getByText('Next →'));

    // Page 2 holds different rows, so nothing from page 1 may remain armed.
    // Search, filter, sort and page-size changes prune through the same
    // visible-ids path, so this covers them too; the shared SearchFilter mock
    // has no onChange wiring, so a filter-driven case would assert the mock.
    await waitFor(() => {
      expect(selectAllCheckbox()).not.toBeChecked();
    });
  });
});

/**
 * The current page may never point past the end of the list.
 *
 * Once a delete actually removes the row, emptying the last page strands the
 * operator on a blank table under a footer reading "Showing 21 to 20 of 20
 * devices". The clamp lives in an effect keyed off `totalPages`, not inside
 * confirmDelete, because every shrink path reaches the same symptom: the single
 * delete below, a bulk delete of the whole last page, and a search or group
 * filter that narrows the results.
 *
 * 21 devices at the default 10-per-page puts exactly one row on page 3, which
 * is the boundary. The same boundary exists at every page size the selector
 * offers - 26 devices at 25/page, 51 at 50/page, 101 at 100/page each put one
 * row alone on a last page - so this fixture is the cheapest instance of the
 * condition, not a special case.
 */
describe('DevicesClient keeps the current page inside the list', () => {
  const twentyOneDevices = Array.from({ length: 21 }, (_, i) => ({
    id: `dev-${i + 1}`,
    nickname: `Device ${i + 1}`,
    name: `Device ${i + 1}`,
    status: 'online',
    location: 'Seattle',
    lastSeen: '2026-08-13T10:00:00.000Z',
  }));

  const renderTwentyOne = () =>
    render(
      <DevicesClient
        initialDevices={twentyOneDevices as any}
        initialPlaylists={[] as any}
        initialDevicesComplete
        initialPlaylistsComplete
      />,
    );

  // The footer splits its numbers across <span>s, so read the whole line.
  const footerText = () =>
    (screen.getByText(/Showing/).textContent ?? '').replace(/\s+/g, ' ').trim();

  const goToLastPage = async () => {
    await waitFor(() => expect(screen.getByText('Device 1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Next →'));
    fireEvent.click(screen.getByText('Next →'));
    await waitFor(() => expect(screen.getByText('Device 21')).toBeInTheDocument());
    expect(footerText()).toBe('Showing 21 to 21 of 21 devices');
  };

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
    mockDeleteDisplay.mockResolvedValue({});
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
  });

  it('falls back a page when a single delete empties the last page', async () => {
    renderTwentyOne();
    await goToLastPage();

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockDeleteDisplay).toHaveBeenCalledWith('dev-21');
    });

    // Without the clamp the slice is empty and this reads "Showing 21 to 20 of
    // 20 devices" over a blank table. The clamp lands one render after the
    // removal, so wait for it rather than reading between the two commits.
    await waitFor(() => {
      expect(footerText()).toBe('Showing 11 to 20 of 20 devices');
    });
    expect(screen.queryByText('Device 21')).not.toBeInTheDocument();
    expect(screen.getByText('Device 20')).toBeInTheDocument();
  });

  it('falls back a page when a bulk delete empties the last page', async () => {
    mockBulkDeleteDisplays.mockResolvedValue({ deleted: 1 });
    // Bulk delete refetches, so the clamp has to survive a reload too.
    mockGetDisplays.mockResolvedValue({
      data: twentyOneDevices.slice(0, 20),
      meta: { page: 1, limit: 100, total: 20, totalPages: 1 },
    });

    renderTwentyOne();
    await goToLastPage();

    fireEvent.click(screen.getByLabelText('Select all devices on this page'));
    fireEvent.click(screen.getByText('Delete Selected'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockBulkDeleteDisplays).toHaveBeenCalledWith(['dev-21']);
    });

    await waitFor(() => {
      expect(footerText()).toBe('Showing 11 to 20 of 20 devices');
    });
    expect(screen.queryByText('Device 21')).not.toBeInTheDocument();
    expect(screen.getByText('Device 20')).toBeInTheDocument();
  });
});
