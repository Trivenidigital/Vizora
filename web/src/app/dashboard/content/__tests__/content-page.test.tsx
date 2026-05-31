import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ContentClient from '../page-client';

const mockGetContent = jest.fn();
const mockGetFolderContent = jest.fn();
const mockGetFolders = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetPlaylists = jest.fn();
const mockDeleteContent = jest.fn();
const mockUploadContent = jest.fn();
const mockGenerateThumbnail = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: (...args: any[]) => mockGetContent(...args),
    getFolderContent: (...args: any[]) => mockGetFolderContent(...args),
    getFolders: (...args: any[]) => mockGetFolders(...args),
    getDisplays: (...args: any[]) => mockGetDisplays(...args),
    getPlaylists: (...args: any[]) => mockGetPlaylists(...args),
    deleteContent: (...args: any[]) => mockDeleteContent(...args),
    uploadContent: (...args: any[]) => mockUploadContent(...args),
    generateThumbnail: (...args: any[]) => mockGenerateThumbnail(...args),
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
  return function MockFolderTree({ onSelectFolder }: any) {
    return (
      <button data-testid="select-folder" onClick={() => onSelectFolder('folder-1')}>
        Select Folder
      </button>
    );
  };
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
    mockGenerateThumbnail.mockResolvedValue({});
  });

  const waitForInitialRequestsToSettle = async () => {
    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalled();
      expect(mockGetFolders).toHaveBeenCalled();
      expect(mockGetDisplays).toHaveBeenCalled();
      expect(mockGetPlaylists).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  const waitForAuxiliaryRequestsToSettle = async () => {
    await waitFor(() => {
      expect(mockGetFolders).toHaveBeenCalled();
      expect(mockGetDisplays).toHaveBeenCalled();
      expect(mockGetPlaylists).toHaveBeenCalled();
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('renders loading spinner initially', async () => {
    render(<ContentClient />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    await waitForInitialRequestsToSettle();
  });

  it('renders content management after load', async () => {
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();
  });

  it('fetches content data on mount', async () => {
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();
  });

  it('does not duplicate the initial content fetch on mount', async () => {
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();

    expect(mockGetContent).toHaveBeenCalledTimes(1);
  });

  it('ignores stale root content responses after switching folders', async () => {
    let resolveRoot: (value: any) => void = () => {};
    mockGetContent.mockImplementation(
      () => new Promise((resolve) => {
        resolveRoot = resolve;
      }),
    );
    mockGetFolderContent.mockResolvedValue({
      data: [{ ...sampleContent[1], id: 'folder-video', title: 'Folder Video' }],
    });

    render(<ContentClient />);
    fireEvent.click(screen.getByTestId('select-folder'));

    await waitFor(() => {
      expect(screen.getByText('Folder Video')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    await act(async () => {
      resolveRoot({ data: [{ ...sampleContent[0], title: 'Late Root Banner' }] });
    });

    expect(screen.getByText('Folder Video')).toBeInTheDocument();
    expect(screen.queryByText('Late Root Banner')).not.toBeInTheDocument();
  });

  it('renders empty state when no content', async () => {
    mockGetContent.mockResolvedValue({ data: [], meta: { total: 0 } });
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();
  });

  it('renders content items after successful fetch', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();
    expect(screen.getByText('Promo Video')).toBeInTheDocument();
    expect(screen.getByText('Menu PDF')).toBeInTheDocument();
  });

  it('shows error toast on fetch failure', async () => {
    mockGetContent.mockRejectedValue(new Error('Network error'));
    render(<ContentClient />);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    await waitForAuxiliaryRequestsToSettle();
  });

  it('renders content page header', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();
    expect(screen.getAllByText(/content/i).length).toBeGreaterThan(0);
  });

  it('fetches folders on mount', async () => {
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();
  });

  it('handles multiple content types', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();
    // All 3 items rendered
    expect(screen.getByText('Promo Video')).toBeInTheDocument();
    expect(screen.getByText('Menu PDF')).toBeInTheDocument();
  });

  it('does not fan out thumbnail generation on page load', async () => {
    mockGetContent.mockResolvedValue({
      data: [
        {
          ...sampleContent[0],
          thumbnailUrl: undefined,
        },
      ],
      meta: { total: 1 },
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    expect(mockGenerateThumbnail).not.toHaveBeenCalled();
  });

  it('also fetches displays and playlists for push/add features', async () => {
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();
  });
});
