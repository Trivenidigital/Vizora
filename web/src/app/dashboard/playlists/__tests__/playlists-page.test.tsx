import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();

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

jest.mock('@/lib/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: () => ({
    isConnected: false,
    isOffline: true,
    emitPlaylistUpdate: jest.fn(),
  }),
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

// Mock @dnd-kit modules
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: () => [],
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn((arr, from, to) => arr),
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: jest.fn(),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

import PlaylistsClient from '../page-client';
import { apiClient } from '@/lib/api';

const mockPlaylists = [
  {
    id: 'playlist-1',
    name: 'Morning Promo',
    description: 'Morning promotions',
    items: [
      { id: 'item-1', contentId: 'c-1', duration: 30, content: { title: 'Banner 1', thumbnailUrl: '' } },
      { id: 'item-2', contentId: 'c-2', duration: 15, content: { title: 'Banner 2', thumbnailUrl: '' } },
    ],
    isActive: true,
    totalSize: 1024000,
    updatedAt: '2024-06-01',
    createdAt: '2024-01-01',
  },
  {
    id: 'playlist-2',
    name: 'Evening Loop',
    description: null,
    items: [],
    isActive: false,
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

  it('renders active badge for active playlists', async () => {
    render(<PlaylistsClient />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
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
