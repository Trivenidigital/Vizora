import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();

let mockUser: any = {
  id: 'u1',
  email: 'admin@test.com',
  firstName: 'Admin',
  lastName: 'User',
  organizationId: 'org-1',
  role: 'admin',
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard/playlists',
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getPlaylists: jest.fn(),
    getContent: jest.fn(),
    getDisplays: jest.fn(),
    createPlaylist: jest.fn(),
    deletePlaylist: jest.fn(),
    updatePlaylist: jest.fn(),
    duplicatePlaylist: jest.fn(),
    bulkAssignPlaylist: jest.fn(),
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

jest.mock('@/lib/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

/**
 * Capture the page's own `onConnectionChange` so a test can drive the THREE
 * states the hook actually emits (`true` / `false` / `null`). A hook mock that
 * only returns a static object can never exercise the `null` branch, which is
 * how the collapse it guards against went unnoticed.
 */
let connectionChange: ((connected: boolean | null) => void) | undefined;
jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: (opts: any) => {
    connectionChange = opts?.onConnectionChange;
    return {
      isConnected: false,
      isOffline: true,
      emitPlaylistUpdate: jest.fn(),
    };
  },
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmptyState({ title, description, action }: any) {
    return (
      <div data-testid="empty-state">
        <span>{title}</span>
        <span>{description}</span>
        {action && <button onClick={action.onClick}>{action.label}</button>}
      </div>
    );
  };
});

jest.mock('@/components/SearchFilter', () => {
  return function MockSearchFilter({ value, onChange, placeholder }: any) {
    return <input data-testid="search-filter" value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} />;
  };
});

jest.mock('@/components/Modal', () => ({
  __esModule: true,
  default: ({ isOpen, children, title, onClose }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <span>{title}</span>
        <button onClick={onClose} aria-label="Close modal">Close</button>
        {children}
      </div>
    ) : null,
}));

jest.mock('@/components/ConfirmDialog', () => ({
  __esModule: true,
  default: ({ isOpen, onConfirm, onClose, title }: any) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

jest.mock('@/components/PlaylistPreview', () => {
  return function MockPlaylistPreview() {
    return <div data-testid="playlist-preview">Preview</div>;
  };
});

// The real indicator calls `useDeviceStatus()` unconditionally, which throws
// outside DeviceStatusProvider. The dashboard layout supplies it in the app.
jest.mock('@/components/DeviceStatusIndicator', () => {
  return function MockIndicator({ status }: any) {
    return <span data-testid="device-status">{status || 'Unknown'}</span>;
  };
});

import PlaylistsClient from '../page-client';
import { apiClient } from '@/lib/api';

/**
 * `isActive` is deliberately absent from these fixtures.
 *
 * `Playlist` has no such column (packages/database/prisma/schema.prisma), no DTO
 * accepts one and no serializer emits one, so the API can never send it. The
 * fixtures used to set it and the page rendered an "Active" badge off it, which
 * meant the badge was green in the test suite and permanently invisible in
 * production. The test that asserted it therefore pinned a defect.
 */
const mockPlaylists = [
  {
    id: 'playlist-1',
    name: 'Morning Promo',
    description: 'Morning promotions',
    items: [
      { id: 'item-1', contentId: 'c-1', duration: 30, content: { title: 'Banner 1', thumbnailUrl: '', status: 'active' } },
      { id: 'item-2', contentId: 'c-2', duration: 15, content: { title: 'Banner 2', thumbnailUrl: '', status: 'active' } },
    ],
    totalSize: 1024000,
    updatedAt: '2024-06-01',
    createdAt: '2024-01-01',
  },
  {
    id: 'playlist-2',
    name: 'Evening Loop',
    description: null,
    items: [],
    totalSize: 0,
    updatedAt: '2024-05-01',
    createdAt: '2024-01-01',
  },
];

const mockDevices = [
  {
    id: 'display-1',
    nickname: 'Lobby Screen',
    status: 'online',
    location: 'Lobby',
    currentPlaylistId: null,
  },
  {
    id: 'display-2',
    nickname: 'Cafe Screen',
    status: 'offline',
    location: 'Cafe',
    currentPlaylistId: 'playlist-2',
  },
];

describe('PlaylistsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'u1',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      organizationId: 'org-1',
      role: 'admin',
    };
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({ data: mockPlaylists });
    (apiClient.getContent as jest.Mock).mockResolvedValue({ data: [] });
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: [] });
    (apiClient.updatePlaylist as jest.Mock).mockResolvedValue({});
    (apiClient.bulkAssignPlaylist as jest.Mock).mockResolvedValue({ updated: 0 });
  });

  it('renders playlists heading', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Playlists')).toBeInTheDocument();
    });
  });

  it('renders create playlist button', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Create Playlist')).toBeInTheDocument();
    });
  });

  it('renders search filter', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByTestId('search-filter')).toBeInTheDocument();
    });
  });

  it('renders playlist names after loading', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
      expect(screen.getByText('Evening Loop')).toBeInTheDocument();
    });
  });

  it('renders playlist item count', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('2 items')).toBeInTheDocument();
      expect(screen.getByText('0 items')).toBeInTheDocument();
    });
  });

  it('does not claim a playlist is "Active" — no column backs that word', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('separates "no screens assigned" from "screen assignments unknown"', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: mockDevices });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    // display-2 is assigned playlist-2, nothing is assigned playlist-1.
    await waitFor(() => {
      expect(screen.getByText('Assigned to 1 screen')).toBeInTheDocument();
    });
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
    expect(screen.queryByText('Screens unknown')).not.toBeInTheDocument();
  });

  it('says screens are unknown rather than unassigned when the device fetch fails', async () => {
    (apiClient.getDisplays as jest.Mock).mockRejectedValue(new Error('failed'));

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getAllByText('Screens unknown')).toHaveLength(2);
    });
    expect(screen.queryByText('Not assigned')).not.toBeInTheDocument();
  });

  /**
   * `useRealtimeEvents` emits `null` on disconnect while the browser is still
   * online — "reconnecting", not "offline". Collapsing it into the offline claim
   * tells the operator to reload a page whose socket is already coming back.
   */
  it('does not claim live updates are off while the socket is reconnecting', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    act(() => connectionChange?.(true));
    await waitFor(() => {
      expect(screen.getByText('Live updates on')).toBeInTheDocument();
    });

    // null = WS dropped, browser still online. The claim must not flip.
    act(() => connectionChange?.(null));
    expect(screen.getByText('Live updates on')).toBeInTheDocument();
    expect(screen.queryByText('Live updates off')).not.toBeInTheDocument();

    // false = genuinely offline. Now it may flip.
    act(() => connectionChange?.(false));
    await waitFor(() => {
      expect(screen.getByText('Live updates off')).toBeInTheDocument();
    });
  });

  it('qualifies "Not assigned" with the schedules that also use the playlist', async () => {
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({
      data: [{ ...mockPlaylists[0], _count: { schedules: 2 } }],
    });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Also used by 2 schedules')).toBeInTheDocument();
    });
    // Still "Not assigned" — no screen names it — but no longer dead inventory.
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
  });

  it('degrades instead of crashing on an unparseable updatedAt', async () => {
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({
      data: [{ ...mockPlaylists[0], updatedAt: 'not-a-date' }],
    });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Last update time unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Morning Promo')).toBeInTheDocument();
  });

  it('warns that non-active content will be skipped on screens', async () => {
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({
      data: [
        {
          ...mockPlaylists[0],
          items: [
            mockPlaylists[0].items[0],
            { ...mockPlaylists[0].items[1], content: { title: 'Banner 2', thumbnailUrl: '', status: 'archived' } },
          ],
        },
      ],
    });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('At least 1 item will be skipped')).toBeInTheDocument();
    });
    // A label, not the raw API token.
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.queryByText('archived')).not.toBeInTheDocument();
    // The card still reports the stored item count; the warning is what closes
    // the gap between "listed" and "delivered".
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('offers a way back from a filtered-empty list instead of an empty grid', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('search-filter'), { target: { value: 'zzz' } });

    await waitFor(() => {
      expect(screen.getByText('No playlists match these filters')).toBeInTheDocument();
    });
    expect(screen.queryByText('No playlists yet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear filters'));

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });
  });

  it('filters the library from the summary chips', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: mockDevices });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.click(await screen.findByRole('button', { name: /Assigned/ }));

    await waitFor(() => {
      expect(screen.queryByText('Morning Promo')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Evening Loop')).toBeInTheDocument();
  });

  /**
   * Focus survival across a re-render.
   *
   * The assertion holds the ORIGINAL node. Re-querying the button after the
   * re-render would pass whether or not React remounted the card, because the
   * query simply finds the replacement — which is exactly how a remount-on-render
   * bug survives a green suite. `PlaylistCard` is declared at module scope to make
   * this true; moving it into the render body turns this red.
   */
  it('keeps focus on the same button across a re-render', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: 'Edit Morning Promo' });
    editButton.focus();
    expect(document.activeElement).toBe(editButton);

    fireEvent.change(screen.getByTestId('search-filter'), { target: { value: 'Morning' } });

    await waitFor(() => {
      expect(screen.getByText('1 result found')).toBeInTheDocument();
    });
    expect(document.activeElement).toBe(editButton);
  });

  it('opens a device assignment modal instead of fake-updating the playlist name', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: mockDevices });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Assign')[0]);

    expect(apiClient.updatePlaylist).not.toHaveBeenCalled();
    expect(screen.getByTestId('modal')).toHaveTextContent('Assign Morning Promo to Devices');
    expect(screen.getByLabelText('Lobby Screen')).toBeInTheDocument();
    expect(screen.getByLabelText('Cafe Screen')).toBeInTheDocument();
    expect(screen.getByText('Updates when online')).toBeInTheDocument();
  });

  it('assigns a playlist to selected devices and reports the backend count', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: mockDevices });
    (apiClient.bulkAssignPlaylist as jest.Mock).mockResolvedValue({ updated: 1 });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Assign')[0]);
    fireEvent.click(screen.getByLabelText('Lobby Screen'));
    fireEvent.click(screen.getByRole('button', { name: 'Assign to 1 device' }));

    await waitFor(() => {
      expect(apiClient.bulkAssignPlaylist).toHaveBeenCalledWith(['display-1'], 'playlist-1');
    });
    expect(mockToast.success).toHaveBeenCalledWith('Playlist assigned to 1 device');
    expect(apiClient.updatePlaylist).not.toHaveBeenCalled();
  });

  it('states non-online assignment correctly instead of promising live delivery', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({
      data: [{ ...mockDevices[1], status: 'pairing' }],
    });
    (apiClient.bulkAssignPlaylist as jest.Mock).mockResolvedValue({ updated: 1 });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Assign')[0]);
    expect(screen.getByText('Updates when online')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Cafe Screen'));
    fireEvent.click(screen.getByRole('button', { name: 'Assign to 1 device' }));

    await waitFor(() => {
      expect(apiClient.bulkAssignPlaylist).toHaveBeenCalledWith(['display-2'], 'playlist-1');
    });
    expect(mockToast.success).toHaveBeenCalledWith(
      'Playlist assigned to 1 device. Non-online devices will update when they come online.',
    );
  });

  it('shows already assigned devices as read-only instead of unpublish targets', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({
      data: [{ ...mockDevices[0], currentPlaylistId: 'playlist-1' }],
    });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Assign')[0]);

    expect(screen.getByText('Already assigned')).toBeInTheDocument();
    expect(screen.queryByLabelText('Lobby Screen')).not.toBeInTheDocument();
    expect(screen.getByText('Lobby Screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign to 0 devices' })).toBeDisabled();
    expect(apiClient.bulkAssignPlaylist).not.toHaveBeenCalled();
  });

  it('blocks assigning an empty playlist before opening the device modal', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: mockDevices });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Evening Loop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Assign')[1]);

    expect(mockToast.warning).toHaveBeenCalledWith('Add content to this playlist before assigning it');
    expect(apiClient.bulkAssignPlaylist).not.toHaveBeenCalled();
    expect(apiClient.updatePlaylist).not.toHaveBeenCalled();
  });

  it('blocks assignment when there are no paired devices', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(apiClient.getDisplays).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByText('Assign')[0]);

    expect(mockToast.warning).toHaveBeenCalledWith('Pair a device before assigning playlists to screens');
    expect(apiClient.bulkAssignPlaylist).not.toHaveBeenCalled();
    expect(apiClient.updatePlaylist).not.toHaveBeenCalled();
  });

  it('defers assignment while the device list is still loading', async () => {
    (apiClient.getDisplays as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Assign')[0]);

    expect(mockToast.info).toHaveBeenCalledWith('Devices are still loading. Try again in a moment.');
    expect(apiClient.bulkAssignPlaylist).not.toHaveBeenCalled();
  });

  it('blocks assignment after device list load failure', async () => {
    (apiClient.getDisplays as jest.Mock).mockRejectedValue(new Error('failed'));

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load devices');
    });

    mockToast.error.mockClear();
    fireEvent.click(screen.getAllByText('Assign')[0]);

    expect(mockToast.error).toHaveBeenCalledWith(
      'Device list failed to load. Refresh the page before assigning playlists.',
    );
    expect(apiClient.bulkAssignPlaylist).not.toHaveBeenCalled();
  });

  it('keeps the assignment modal open if close is requested during an in-flight assignment', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: mockDevices });
    let resolveAssignment: (value: { updated: number }) => void = () => {};
    (apiClient.bulkAssignPlaylist as jest.Mock).mockImplementation(
      () => new Promise((resolve) => {
        resolveAssignment = resolve;
      }),
    );

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Assign')[0]);
    fireEvent.click(screen.getByLabelText('Lobby Screen'));
    fireEvent.click(screen.getByRole('button', { name: 'Assign to 1 device' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Cafe Screen')).toBeDisabled();
    });
    fireEvent.click(screen.getByLabelText('Cafe Screen'));
    expect(screen.getByRole('button', { name: /Assign to 1 device/ })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(screen.getByTestId('modal')).toBeInTheDocument();

    await act(async () => {
      resolveAssignment({ updated: 1 });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  it('renders action buttons for each playlist', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getAllByText('Preview').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Delete').length).toBeGreaterThan(0);
    });
  });

  it('keeps viewers on read-only playlist actions', async () => {
    mockUser = { ...mockUser, role: 'viewer' };

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    expect(screen.queryByText('Create Playlist')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
    expect(screen.queryAllByText('Delete')).toHaveLength(0);
    expect(screen.getAllByText('Preview').length).toBeGreaterThan(0);
  });

  it('allows managers to manage playlists without exposing admin-only deletes', async () => {
    mockUser = { ...mockUser, role: 'manager' };

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    expect(screen.getByText('Create Playlist')).toBeInTheDocument();
    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Assign').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Duplicate').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Delete')).toHaveLength(0);
  });

  it('opens create modal when Create Playlist is clicked', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Create Playlist')).toBeInTheDocument();
    });

    // Click the Create Playlist button (the one with + in front)
    const createBtn = screen.getAllByText('Create Playlist')[0];
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Create New Playlist')).toBeInTheDocument();
    });
  });

  it('shows empty state when no playlists', async () => {
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({ data: [] });

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No playlists yet')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (apiClient.getPlaylists as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Network error');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Playlists Error');
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.queryByText('No playlists yet')).not.toBeInTheDocument();
  });

  it('opens delete confirmation when Delete is clicked', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Playlist')).toBeInTheDocument();
  });

  it('renders playlist description', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Morning promotions')).toBeInTheDocument();
    });
  });

  it('renders content preview for playlists with items', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Content Preview')).toBeInTheDocument();
      expect(screen.getByText('Banner 1')).toBeInTheDocument();
      expect(screen.getByText('Banner 2')).toBeInTheDocument();
    });
  });
});
