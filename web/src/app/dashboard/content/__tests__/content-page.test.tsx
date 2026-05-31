import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ContentClient from '../page-client';

const mockGetContent = jest.fn();
const mockGetFolderContent = jest.fn();
const mockGetFolders = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetPlaylists = jest.fn();
const mockDeleteContent = jest.fn();
const mockUploadContent = jest.fn();
const mockCreateContent = jest.fn();
const mockUploadContentWithProgress = jest.fn();
const mockGenerateThumbnail = jest.fn();
let lastDropzoneOptions: any;

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: (...args: any[]) => mockGetContent(...args),
    getFolderContent: (...args: any[]) => mockGetFolderContent(...args),
    getFolders: (...args: any[]) => mockGetFolders(...args),
    getDisplays: (...args: any[]) => mockGetDisplays(...args),
    getPlaylists: (...args: any[]) => mockGetPlaylists(...args),
    deleteContent: (...args: any[]) => mockDeleteContent(...args),
    uploadContent: (...args: any[]) => mockUploadContent(...args),
    createContent: (...args: any[]) => mockCreateContent(...args),
    uploadContentWithProgress: (...args: any[]) => mockUploadContentWithProgress(...args),
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
  return function MockModal({ isOpen, children, title, onClose }: any) {
    return isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <button type="button" aria-label="Close modal" onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null;
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
  return function MockTagger({ selectedTags, onChange }: any) {
    return (
      <div data-testid="content-tagger">
        <button type="button" onClick={() => onChange(['1'])}>
          Select Marketing Tag
        </button>
        <span data-testid="selected-tags">{selectedTags.join(',')}</span>
      </div>
    );
  };
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
  useDropzone: (options: any) => {
    lastDropzoneOptions = options;
    return ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
    });
  },
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
    metadata: { tags: ['Marketing'] },
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
    mockCreateContent.mockResolvedValue({ id: 'new-1', title: 'New Content' });
    mockUploadContentWithProgress.mockResolvedValue({ id: 'new-1', title: 'New Content' });
    mockGenerateThumbnail.mockResolvedValue({});
    lastDropzoneOptions = undefined;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:mock-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
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

  it('renders content from every paginated page', async () => {
    mockGetContent
      .mockResolvedValueOnce({
        data: [sampleContent[0]],
        meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [sampleContent[1]],
        meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
      });

    render(<ContentClient />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
      expect(screen.getByText('Promo Video')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();
    expect(mockGetContent).toHaveBeenNthCalledWith(1, { page: 1, limit: 100 });
    expect(mockGetContent).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
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

  it('clears selected tag filters when Clear all is clicked', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
      expect(screen.getByText('Promo Video')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getByText(/Tags/));
    fireEvent.click(screen.getByText('Select Marketing Tag'));

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
      expect(screen.queryByText('Promo Video')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Clear all'));

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
      expect(screen.getByText('Promo Video')).toBeInTheDocument();
    });
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('');
  });

  it('also fetches displays and playlists for push/add features', async () => {
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();
  });

  it('bulk upload preserves each queued file type after the selector changes', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    const imageFile = new File(['image-bytes'], 'lobby.png', { type: 'image/png' });

    await act(async () => {
      lastDropzoneOptions.onDrop([imageFile]);
    });

    fireEvent.change(screen.getByDisplayValue('Image'), { target: { value: 'video' } });
    fireEvent.click(screen.getByText('Upload 1 File'));

    await waitFor(() => {
      expect(mockUploadContentWithProgress).toHaveBeenCalled();
    });
    expect(mockUploadContentWithProgress.mock.calls[0][0].title).toBe('lobby');
    expect(mockUploadContentWithProgress.mock.calls[0][0].type).toBe('image');
    expect(mockUploadContentWithProgress.mock.calls[0][0].file).toBe(imageFile);
    expect(mockCreateContent).not.toHaveBeenCalledWith(expect.objectContaining({ file: imageFile }));
  });

  it('keeps queued files visible by blocking URL mode until the queue is cleared', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    const imageFile = new File(['image-bytes'], 'queued.png', { type: 'image/png' });

    await act(async () => {
      lastDropzoneOptions.onDrop([imageFile]);
    });

    expect(screen.getByText('queued.png')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'URL/Web Page' })).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue('Image'), { target: { value: 'url' } });

    expect(screen.getByDisplayValue('Image')).toBeInTheDocument();
    expect(screen.getByText('queued.png')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('https://example.com/page')).not.toBeInTheDocument();
  });

  it('locks queued bulk upload controls while files are uploading', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    let resolveUpload: (content: any) => void = () => {};
    mockUploadContentWithProgress.mockImplementation((_data, onProgress) => {
      onProgress?.(42);
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    const imageFile = new File(['image-bytes'], 'locked.png', { type: 'image/png' });

    await act(async () => {
      lastDropzoneOptions.onDrop([imageFile]);
    });

    fireEvent.click(screen.getByText('Upload 1 File'));

    await waitFor(() => {
      expect(mockUploadContentWithProgress).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /clear all/i })).toBeDisabled();
      expect(screen.getByLabelText(/remove locked.png from upload queue/i)).toBeDisabled();
    });

    await act(async () => {
      resolveUpload({ id: 'new-1', title: 'Locked' });
    });
  });

  it('does not close or clear queued upload progress while files are uploading', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    let resolveUpload: (content: any) => void = () => {};
    mockUploadContentWithProgress.mockImplementation((_data, onProgress) => {
      onProgress?.(42);
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    const imageFile = new File(['image-bytes'], 'in-flight.png', { type: 'image/png' });

    await act(async () => {
      lastDropzoneOptions.onDrop([imageFile]);
    });

    fireEvent.click(screen.getByText('Upload 1 File'));

    await waitFor(() => {
      expect(screen.getByText('in-flight.png')).toBeInTheDocument();
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(screen.getByText('in-flight.png')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();

    await act(async () => {
      resolveUpload({ id: 'new-1', title: 'In Flight' });
    });
  });

  it('limits queued bulk uploads to three concurrent files', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    const deferredUploads: Array<{ resolve: (content: any) => void; promise: Promise<any> }> = [];
    mockUploadContentWithProgress.mockImplementation((_data, onProgress) => {
      onProgress?.(10);
      let resolveUpload: (content: any) => void = () => {};
      const promise = new Promise((resolve) => {
        resolveUpload = resolve;
      });
      deferredUploads.push({ resolve: resolveUpload, promise });
      return promise;
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    const files = [
      new File(['1'], 'file-1.png', { type: 'image/png' }),
      new File(['2'], 'file-2.png', { type: 'image/png' }),
      new File(['3'], 'file-3.png', { type: 'image/png' }),
      new File(['4'], 'file-4.png', { type: 'image/png' }),
    ];

    await act(async () => {
      lastDropzoneOptions.onDrop(files);
    });

    fireEvent.click(screen.getByText('Upload 4 Files'));

    await waitFor(() => {
      expect(mockUploadContentWithProgress).toHaveBeenCalledTimes(3);
    });
    expect(mockUploadContentWithProgress.mock.calls[0][0].title).toBe('file-1');
    expect(mockUploadContentWithProgress.mock.calls[1][0].title).toBe('file-2');
    expect(mockUploadContentWithProgress.mock.calls[2][0].title).toBe('file-3');
    expect(screen.getAllByText('10%')).toHaveLength(3);

    await act(async () => {
      deferredUploads[0].resolve({ id: 'new-1', title: 'File 1' });
      await deferredUploads[0].promise;
    });

    await waitFor(() => {
      expect(mockUploadContentWithProgress).toHaveBeenCalledTimes(4);
    });
    expect(mockUploadContentWithProgress.mock.calls[3][0].title).toBe('file-4');

    await act(async () => {
      for (const deferred of deferredUploads.slice(1)) {
        deferred.resolve({ id: 'new-rest', title: 'Rest' });
      }
      await Promise.all(deferredUploads.slice(1).map((deferred) => deferred.promise));
    });
  });
});
