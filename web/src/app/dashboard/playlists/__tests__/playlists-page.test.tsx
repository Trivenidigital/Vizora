import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  default: ({ isOpen, children, title }: any) =>
    isOpen ? <div data-testid="modal"><span>{title}</span>{children}</div> : null,
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

describe('PlaylistsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getPlaylists as jest.Mock).mockResolvedValue({ data: mockPlaylists });
    (apiClient.getContent as jest.Mock).mockResolvedValue({ data: [] });
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: [] });
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
