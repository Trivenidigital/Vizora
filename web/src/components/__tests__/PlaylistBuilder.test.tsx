import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useParams } from 'next/navigation';
import PlaylistBuilderPage from '@/app/dashboard/playlists/[id]/page';
import ContentLibraryPanel from '@/components/playlist/ContentLibraryPanel';
import PlaylistEditorPanel from '@/components/playlist/PlaylistEditorPanel';
import PlaylistPreviewPanel from '@/components/playlist/PlaylistPreviewPanel';
import DraggableContentItem from '@/components/playlist/DraggableContentItem';
import { apiClient } from '@/lib/api';
import { Content, Playlist, PlaylistItem } from '@/lib/types';

// Mock dependencies
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    useRouter: jest.fn(() => ({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: mockBack,
      forward: jest.fn(),
    })),
    useParams: jest.fn(),
  };
});

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: jest.fn(),
    getPlaylist: jest.fn(),
    addPlaylistItem: jest.fn(),
    removePlaylistItem: jest.fn(),
    updatePlaylistItem: jest.fn(),
    reorderPlaylistItems: jest.fn(),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    ToastContainer: () => null,
  }),
}));

// Mock DnD kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  closestCenter: jest.fn(),
  PointerSensor: jest.fn(),
  KeyboardSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
  useDraggable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
  })),
  useDroppable: jest.fn(() => ({
    setNodeRef: jest.fn(),
    isOver: false,
  })),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  arrayMove: jest.fn((array, from, to) => {
    const newArray = [...array];
    const item = newArray.splice(from, 1)[0];
    newArray.splice(to, 0, item);
    return newArray;
  }),
  verticalListSortingStrategy: jest.fn(),
  sortableKeyboardCoordinates: jest.fn(),
}));

const mockContent: Content[] = [
  {
    id: 'content-1',
    title: 'Test Image',
    type: 'image',
    status: 'ready',
    thumbnailUrl: 'https://example.com/thumb1.jpg',
    duration: 30,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'content-2',
    title: 'Test Video',
    type: 'video',
    status: 'ready',
    thumbnailUrl: 'https://example.com/thumb2.jpg',
    duration: 60,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

const mockPlaylistItem: PlaylistItem = {
  id: 'item-1',
  contentId: 'content-1',
  duration: 30,
  order: 0,
  content: mockContent[0],
};

const mockPlaylist: Playlist = {
  id: 'playlist-1',
  name: 'Test Playlist',
  description: 'Test Description',
  items: [mockPlaylistItem],
  isActive: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

describe('PlaylistBuilder Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DraggableContentItem', () => {
    it('renders content item with thumbnail', () => {
      render(<DraggableContentItem content={mockContent[0]} />);

      expect(screen.getByText('Test Image')).toBeInTheDocument();
      expect(screen.getByText('image')).toBeInTheDocument();
      expect(screen.getByText('30s')).toBeInTheDocument();
    });

    it('renders content item without thumbnail', () => {
      const contentWithoutThumb = { ...mockContent[0], thumbnailUrl: undefined };
      render(<DraggableContentItem content={contentWithoutThumb} />);

      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });

    it('applies dragging opacity', () => {
      const { container } = render(
        <DraggableContentItem content={mockContent[0]} isDragging />
      );

      const item = container.querySelector('.opacity-50');
      expect(item).toBeInTheDocument();
    });
  });

  describe('ContentLibraryPanel', () => {
    beforeEach(() => {
      (apiClient.getContent as jest.Mock).mockResolvedValue({
        data: mockContent,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('renders content library with items', async () => {
      render(<ContentLibraryPanel organizationId="org-1" />);

      expect(screen.getByText('Content Library')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Test Image')).toBeInTheDocument();
        expect(screen.getByText('Test Video')).toBeInTheDocument();
      });
    });

    it('filters content by search query', async () => {
      render(<ContentLibraryPanel organizationId="org-1" />);

      await waitFor(() => {
        expect(screen.getByText('Test Image')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search content...');
      fireEvent.change(searchInput, { target: { value: 'Video' } });

      expect(screen.queryByText('Test Image')).not.toBeInTheDocument();
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    it('filters content by type', async () => {
      render(<ContentLibraryPanel organizationId="org-1" />);

      await waitFor(() => {
        expect(screen.getByText('Test Image')).toBeInTheDocument();
      });

      const imageButton = screen.getByText('Image');
      fireEvent.click(imageButton);

      await waitFor(() => {
        expect(apiClient.getContent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'image' })
        );
      });
    });

    it('displays loading spinner while fetching', () => {
      render(<ContentLibraryPanel organizationId="org-1" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays empty state when no content', async () => {
      (apiClient.getContent as jest.Mock).mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
      });

      render(<ContentLibraryPanel organizationId="org-1" />);

      await waitFor(() => {
        expect(screen.getByText('No content available')).toBeInTheDocument();
      });
    });
  });

  describe('PlaylistEditorPanel', () => {
    const mockHandlers = {
      onRemoveItem: jest.fn(),
      onUpdateDuration: jest.fn(),
      onReorder: jest.fn(),
    };

    it('renders playlist items', () => {
      render(<PlaylistEditorPanel items={[mockPlaylistItem]} {...mockHandlers} />);

      expect(screen.getByText('Playlist Items')).toBeInTheDocument();
      expect(screen.getByText('Test Image')).toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();
      expect(screen.getByText('30s')).toBeInTheDocument();
    });

    it('displays empty state when no items', () => {
      render(<PlaylistEditorPanel items={[]} {...mockHandlers} />);

      expect(screen.getByText('Empty Playlist')).toBeInTheDocument();
      expect(screen.getByText(/to build your playlist/)).toBeInTheDocument();
    });

    it('calls onRemoveItem when remove button clicked', () => {
      render(<PlaylistEditorPanel items={[mockPlaylistItem]} {...mockHandlers} />);

      const removeButton = screen.getAllByRole('button').find(
        (btn) => btn.querySelector('[class*="text-red-600"]')
      );

      if (removeButton) {
        fireEvent.click(removeButton);
        expect(mockHandlers.onRemoveItem).toHaveBeenCalledWith('item-1');
      }
    });

    it('calls onUpdateDuration when duration input changes', () => {
      render(<PlaylistEditorPanel items={[mockPlaylistItem]} {...mockHandlers} />);

      const durationInput = screen.getByDisplayValue('30');
      fireEvent.change(durationInput, { target: { value: '45' } });

      expect(mockHandlers.onUpdateDuration).toHaveBeenCalledWith('item-1', 45);
    });

    it('calculates total duration correctly', () => {
      const items = [
        { ...mockPlaylistItem, id: 'item-1', duration: 30 },
        { ...mockPlaylistItem, id: 'item-2', duration: 45 },
      ];

      render(<PlaylistEditorPanel items={items} {...mockHandlers} />);

      expect(screen.getByText('1m 15s')).toBeInTheDocument();
    });
  });

  describe('PlaylistPreviewPanel', () => {
    it('renders preview with item', () => {
      render(<PlaylistPreviewPanel items={[mockPlaylistItem]} />);

      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });

    it('displays empty state when no items', () => {
      render(<PlaylistPreviewPanel items={[]} />);

      expect(screen.getByText('Add items to preview')).toBeInTheDocument();
    });

    it('has play/pause controls', () => {
      render(<PlaylistPreviewPanel items={[mockPlaylistItem]} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('has next/previous controls', () => {
      const items = [
        { ...mockPlaylistItem, id: 'item-1' },
        { ...mockPlaylistItem, id: 'item-2' },
      ];

      render(<PlaylistPreviewPanel items={items} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(3); // prev, play/pause, next
    });

    it('displays progress bar', () => {
      render(<PlaylistPreviewPanel items={[mockPlaylistItem]} />);

      expect(screen.getByText('Playlist Progress')).toBeInTheDocument();
    });
  });

  describe('PlaylistBuilderPage', () => {
    beforeEach(() => {
      mockPush.mockClear();
      mockBack.mockClear();
      (useParams as jest.Mock).mockReturnValue({ id: 'playlist-1' });
      (apiClient.getPlaylist as jest.Mock).mockResolvedValue(mockPlaylist);
      (apiClient.getContent as jest.Mock).mockResolvedValue({
        data: mockContent,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('renders 3-panel layout', async () => {
      render(<PlaylistBuilderPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Playlist')).toBeInTheDocument();
      });

      expect(screen.getByText('Content Library')).toBeInTheDocument();
      expect(screen.getByText('Playlist Items')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('loads playlist on mount', async () => {
      render(<PlaylistBuilderPage />);

      await waitFor(() => {
        expect(apiClient.getPlaylist).toHaveBeenCalledWith('playlist-1');
      });
    });

    it('navigates back to playlists on back button click', async () => {
      render(<PlaylistBuilderPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Playlist')).toBeInTheDocument();
      });

      const backButton = screen.getByTitle('Back to playlists');
      fireEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith('/dashboard/playlists');
    });

    it('displays save button', async () => {
      render(<PlaylistBuilderPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });

    it('shows loading spinner initially', () => {
      render(<PlaylistBuilderPage />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('redirects to playlists if playlist load fails', async () => {
      (apiClient.getPlaylist as jest.Mock).mockRejectedValue(new Error('Not found'));

      render(<PlaylistBuilderPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/playlists');
      });
    });
  });
});
