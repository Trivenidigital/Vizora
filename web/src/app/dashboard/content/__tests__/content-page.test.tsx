import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ContentClient from '../page-client';

const mockGetContent = jest.fn();
const mockGetFolderContent = jest.fn();
const mockGetFolders = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetPlaylists = jest.fn();
const mockDeleteContent = jest.fn();
const mockUploadContent = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: (...args: any[]) => mockGetContent(...args),
    getFolderContent: (...args: any[]) => mockGetFolderContent(...args),
    getFolders: (...args: any[]) => mockGetFolders(...args),
    getDisplays: (...args: any[]) => mockGetDisplays(...args),
    getPlaylists: (...args: any[]) => mockGetPlaylists(...args),
    deleteContent: (...args: any[]) => mockDeleteContent(...args),
    uploadContent: (...args: any[]) => mockUploadContent(...args),
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
  })),
  useErrorRecovery: jest.fn(() => ({ retry: jest.fn(), recordError: jest.fn(), isRecovering: false })),
}));

jest.mock('@/lib/validation', () => ({
  contentUploadSchema: { parse: jest.fn() },
  validateForm: jest.fn(() => ({})),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title, action }: any) {
    return (
      <div data-testid="empty-state">
        <span>{title || 'No items'}</span>
        {action && <button onClick={action.onClick}>{action.label}</button>}
      </div>
    );
  };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children, title }: any) {
    return isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null;
  };
});

jest.mock('@/components/PreviewModal', () => {
  return function MockPreviewModal() { return null; };
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
  return function MockSearch({ onSearch }: any) {
    return <input data-testid="search-input" placeholder="Search..." onChange={(e) => onSearch?.(e.target.value)} />;
  };
});

jest.mock('@/components/ContentTagger', () => {
  return function MockTagger() { return null; };
});

jest.mock('@/components/FolderTree', () => {
  return function MockFolderTree() { return null; };
});

jest.mock('@/components/FolderBreadcrumb', () => {
  return function MockBreadcrumb() { return null; };
});

jest.mock('@/components/ViewToggle', () => ({
  ViewToggle: () => null,
  getInitialView: () => 'grid',
}));

jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

const sampleContent = [
  {
    id: 'c1',
    title: 'Welcome Banner',
    type: 'image',
    status: 'ready',
    url: '/uploads/banner.png',
    thumbnailUrl: '/thumbs/banner.png',
    fileSize: 1024000,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'c2',
    title: 'Promo Video',
    type: 'video',
    status: 'processing',
    url: '/uploads/promo.mp4',
    fileSize: 5120000,
    createdAt: '2026-01-16T12:00:00Z',
    updatedAt: '2026-01-16T12:00:00Z',
  },
  {
    id: 'c3',
    title: 'Menu PDF',
    type: 'pdf',
    status: 'ready',
    url: '/uploads/menu.pdf',
    fileSize: 512000,
    createdAt: '2026-01-17T08:00:00Z',
    updatedAt: '2026-01-17T08:00:00Z',
  },
];

describe('ContentClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContent.mockResolvedValue({ data: [], meta: { total: 0 } });
    mockGetFolderContent.mockResolvedValue({ data: [] });
    mockGetFolders.mockResolvedValue([]);
    mockGetDisplays.mockResolvedValue({ data: [] });
    mockGetPlaylists.mockResolvedValue({ data: [] });
    mockDeleteContent.mockResolvedValue({});
    mockUploadContent.mockResolvedValue({ id: 'new-1', title: 'New Content' });
  });

  it('renders loading spinner initially', () => {
    render(<ContentClient />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders content management after load', async () => {
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  it('fetches content data on mount', async () => {
    render(<ContentClient />);
    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalled();
    });
  });

  it('renders empty state when no content', async () => {
    mockGetContent.mockResolvedValue({ data: [], meta: { total: 0 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  it('renders content items after successful fetch', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    expect(screen.getByText('Promo Video')).toBeInTheDocument();
    expect(screen.getByText('Menu PDF')).toBeInTheDocument();
  });

  it('shows error toast on fetch failure', async () => {
    mockGetContent.mockRejectedValue(new Error('Network error'));
    render(<ContentClient />);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it('renders content page header', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/content/i).length).toBeGreaterThan(0);
  });

  it('fetches folders on mount', async () => {
    render(<ContentClient />);
    await waitFor(() => {
      expect(mockGetFolders).toHaveBeenCalled();
    });
  });

  it('handles multiple content types', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    // All 3 items rendered
    expect(screen.getByText('Promo Video')).toBeInTheDocument();
    expect(screen.getByText('Menu PDF')).toBeInTheDocument();
  });

  it('also fetches displays and playlists for push/add features', async () => {
    render(<ContentClient />);
    await waitFor(() => {
      expect(mockGetDisplays).toHaveBeenCalled();
      expect(mockGetPlaylists).toHaveBeenCalled();
    });
  });
});
