import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ContentClient from '../page-client';

const mockGetContent = jest.fn();
const mockGetContentItem = jest.fn();
const mockGetFolderContent = jest.fn();
const mockGetFolders = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetPlaylists = jest.fn();
const mockDeleteContent = jest.fn();
const mockUpdateContent = jest.fn();
const mockUploadContent = jest.fn();
const mockCreateContent = jest.fn();
const mockUploadContentWithProgress = jest.fn();
const mockGenerateThumbnail = jest.fn();
const mockAddPlaylistItem = jest.fn();
const mockValidateForm = jest.fn<Record<string, string>, [unknown, unknown]>(() => ({}));
let lastDropzoneOptions: any;

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: (...args: any[]) => mockGetContent(...args),
    getContentItem: (...args: any[]) => mockGetContentItem(...args),
    getFolderContent: (...args: any[]) => mockGetFolderContent(...args),
    getFolders: (...args: any[]) => mockGetFolders(...args),
    getDisplays: (...args: any[]) => mockGetDisplays(...args),
    getPlaylists: (...args: any[]) => mockGetPlaylists(...args),
    deleteContent: (...args: any[]) => mockDeleteContent(...args),
    updateContent: (...args: any[]) => mockUpdateContent(...args),
    uploadContent: (...args: any[]) => mockUploadContent(...args),
    createContent: (...args: any[]) => mockCreateContent(...args),
    uploadContentWithProgress: (...args: any[]) => mockUploadContentWithProgress(...args),
    generateThumbnail: (...args: any[]) => mockGenerateThumbnail(...args),
    addPlaylistItem: (...args: any[]) => mockAddPlaylistItem(...args),
  },
}));

const mockToast = {
  showToast: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  ToastContainer: () => null,
};

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({ ...mockToast }),
}));

jest.mock('@/lib/hooks/useDebounce', () => ({
  useDebounce: (val: any) => val,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: jest.fn(() => ({ isConnected: false, isOffline: true })),
  useOptimisticState: jest.fn((_initialState: any) => ({
    updateOptimistic: jest.fn(),
    commitOptimistic: jest.fn(),
    rollbackOptimistic: jest.fn(),
    getPendingCount: jest.fn(() => 0),
  })),
  useErrorRecovery: jest.fn(() => ({
    retry: jest.fn(async (
      _id: string,
      operation: () => Promise<unknown>,
      onSuccess?: () => void,
      onError?: (error: unknown) => void,
    ) => {
      try {
        await operation();
        onSuccess?.();
      } catch (error) {
        onError?.(error);
      }
    }),
    recordError: jest.fn(),
    isRecovering: false,
  })),
}));

jest.mock('@/lib/validation', () => ({
  contentUploadSchema: { parse: jest.fn() },
  validateForm: (schema: unknown, values: unknown) => mockValidateForm(schema, values),
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
  return function MockPreviewModal({ isOpen, content }: any) {
    return isOpen ? (
      <div data-testid="preview-modal">
        <span>{content?.title}</span>
        <span data-testid="preview-url">{content?.url || ''}</span>
      </div>
    ) : null;
  };
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
  return function MockSearch({ value, onChange }: any) {
    return <input data-testid="search-input" value={value} placeholder="Search..." onChange={(e) => onChange?.(e.target.value)} />;
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

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

describe('ContentClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    mockGetContentItem.mockResolvedValue(sampleContent[0]);
    mockGetFolderContent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    mockGetFolders.mockResolvedValue([]);
    mockGetDisplays.mockResolvedValue({ data: [] });
    mockGetPlaylists.mockResolvedValue({ data: [] });
    mockDeleteContent.mockResolvedValue({});
    mockUpdateContent.mockResolvedValue(sampleContent[0]);
    mockUploadContent.mockResolvedValue({ id: 'new-1', title: 'New Content' });
    mockCreateContent.mockResolvedValue({ id: 'new-1', title: 'New Content' });
    mockUploadContentWithProgress.mockResolvedValue({ id: 'new-1', title: 'New Content' });
    mockGenerateThumbnail.mockResolvedValue({});
    mockAddPlaylistItem.mockResolvedValue({});
    mockValidateForm.mockReturnValue({});
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

  it('renders content list cards from summary payloads without url or metadata', async () => {
    const summaryContent = { ...sampleContent[0] };
    delete (summaryContent as any).url;
    delete (summaryContent as any).metadata;
    mockGetContent.mockResolvedValue({
      data: [summaryContent],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    render(<ContentClient />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();
    expect(mockGetContentItem).not.toHaveBeenCalled();
  });

  it('hydrates full content before opening preview from a summary payload', async () => {
    const summaryContent = { ...sampleContent[0] };
    delete (summaryContent as any).url;
    delete (summaryContent as any).metadata;
    mockGetContent.mockResolvedValue({
      data: [summaryContent],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    mockGetContentItem.mockResolvedValue({
      ...sampleContent[0],
      url: '/uploads/banner.png',
      metadata: { tags: ['Marketing'] },
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getByTitle('Click to preview'));

    await waitFor(() => {
      expect(mockGetContentItem).toHaveBeenCalledWith('c1');
    });
    await waitFor(() => {
      expect(screen.getByTestId('preview-url')).toHaveTextContent('/uploads/banner.png');
    });
  });

  it('does not open stale preview detail after the list context changes', async () => {
    const summaryContent = { ...sampleContent[0] };
    delete (summaryContent as any).url;
    delete (summaryContent as any).metadata;
    const deferredDetail = createDeferred<any>();
    mockGetContent
      .mockResolvedValueOnce({
        data: [summaryContent],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      })
      .mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });
    mockGetContentItem.mockReturnValueOnce(deferredDetail.promise);

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getByTitle('Click to preview'));
    await waitFor(() => {
      expect(mockGetContentItem).toHaveBeenCalledWith('c1');
    });

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'menu' } });
    await waitFor(() => {
      expect(mockGetContent).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'menu' }));
    });

    await act(async () => {
      deferredDetail.resolve({
        ...sampleContent[0],
        url: '/uploads/banner.png',
      });
      await deferredDetail.promise;
    });

    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();
  });

  it('dedupes repeated preview detail loads for the same item', async () => {
    const summaryContent = { ...sampleContent[0] };
    delete (summaryContent as any).url;
    delete (summaryContent as any).metadata;
    const deferredDetail = createDeferred<any>();
    mockGetContent.mockResolvedValue({
      data: [summaryContent],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    mockGetContentItem.mockReturnValueOnce(deferredDetail.promise);

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    const previewTarget = screen.getByTitle('Click to preview');
    fireEvent.click(previewTarget);
    fireEvent.click(previewTarget);

    expect(mockGetContentItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferredDetail.resolve({
        ...sampleContent[0],
        url: '/uploads/banner.png',
      });
      await deferredDetail.promise;
    });

    expect(screen.getByTestId('preview-url')).toHaveTextContent('/uploads/banner.png');
  });

  it('does not open a second modal from mixed actions while detail is loading', async () => {
    const flaggedSummary = {
      ...sampleContent[0],
      status: 'flagged',
    };
    delete (flaggedSummary as any).url;
    delete (flaggedSummary as any).metadata;
    const deferredDetail = createDeferred<any>();
    mockGetContent.mockResolvedValue({
      data: [flaggedSummary],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    mockGetContentItem.mockReturnValueOnce(deferredDetail.promise);

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getByTitle('Click to preview'));
    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    expect(mockGetContentItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferredDetail.resolve({
        ...flaggedSummary,
        url: '/uploads/banner.png',
        metadata: {
          moderation: {
            flagReason: 'Wrong location',
          },
        },
      });
      await deferredDetail.promise;
    });

    expect(screen.getByTestId('preview-url')).toHaveTextContent('/uploads/banner.png');
    expect(screen.queryByText('Review Flagged Content')).not.toBeInTheDocument();
  });

  it('hydrates detail before edit validation when the list row is only a summary', async () => {
    const summaryContent = { ...sampleContent[0] };
    delete (summaryContent as any).url;
    delete (summaryContent as any).metadata;
    mockGetContent.mockResolvedValue({
      data: [summaryContent],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    mockGetContentItem.mockResolvedValue({
      ...sampleContent[0],
      url: '/uploads/banner.png',
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => {
      expect(mockGetContentItem).toHaveBeenCalledWith('c1');
    });
    await waitFor(() => {
      expect(screen.getByText('Edit Content')).toBeInTheDocument();
    });

    mockValidateForm.mockClear();
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockValidateForm).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ url: '/uploads/banner.png' }),
      );
    });
  });

  it('hydrates flagged content detail before showing moderation metadata', async () => {
    const flaggedSummary = {
      ...sampleContent[0],
      status: 'flagged',
    };
    delete (flaggedSummary as any).url;
    delete (flaggedSummary as any).metadata;
    mockGetContent.mockResolvedValue({
      data: [flaggedSummary],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    mockGetContentItem.mockResolvedValue({
      ...flaggedSummary,
      url: '/uploads/banner.png',
      metadata: {
        moderation: {
          flagReason: 'Wrong location',
        },
      },
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    await waitFor(() => {
      expect(mockGetContentItem).toHaveBeenCalledWith('c1');
    });
    await waitFor(() => {
      expect(screen.getByText(/Reason: Wrong location/)).toBeInTheDocument();
    });
  });

  it('renders one content page at a time and fetches the next page on demand', async () => {
    mockGetContent
      .mockResolvedValueOnce({
        data: [sampleContent[0]],
        meta: { page: 1, limit: 50, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [sampleContent[1]],
        meta: { page: 2, limit: 50, total: 2, totalPages: 2 },
      });

    render(<ContentClient />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();
    expect(screen.queryByText('Promo Video')).not.toBeInTheDocument();
    expect(screen.getByText('1-1 of 2 items')).toBeInTheDocument();
    expect(mockGetContent).toHaveBeenNthCalledWith(1, { page: 1, limit: 50 });

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(screen.getByText('Promo Video')).toBeInTheDocument();
    });
    expect(mockGetContent).toHaveBeenNthCalledWith(2, { page: 2, limit: 50 });
  });

  it('sends search and type filters to the server and resets to the first page', async () => {
    mockGetContent.mockResolvedValue({
      data: [sampleContent[0]],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();
    mockGetContent.mockClear();

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'menu' } });

    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 50,
        search: 'menu',
      }));
    });

    mockGetContent.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Video' }));

    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 50,
        search: 'menu',
        type: 'video',
      }));
    });
  });

  it('sends selected tag filters to folder content queries', async () => {
    mockGetContent.mockResolvedValue({
      data: sampleContent,
      meta: { page: 1, limit: 50, total: 3, totalPages: 1 },
    });
    mockGetFolderContent.mockResolvedValue({
      data: [sampleContent[0]],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getByTestId('select-folder'));
    await waitFor(() => {
      expect(mockGetFolderContent).toHaveBeenCalledWith('folder-1', expect.objectContaining({
        page: 1,
        limit: 50,
      }));
    });
    mockGetFolderContent.mockClear();

    fireEvent.click(screen.getByText(/Tags/));
    fireEvent.click(screen.getByText('Select Marketing Tag'));

    await waitFor(() => {
      expect(mockGetFolderContent).toHaveBeenCalledWith('folder-1', expect.objectContaining({
        page: 1,
        limit: 50,
        tagNames: ['Marketing'],
      }));
    });
  });

  it('moves back to a valid page after deleting the only item on a later page', async () => {
    mockGetContent
      .mockResolvedValueOnce({
        data: [sampleContent[0]],
        meta: { page: 1, limit: 50, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [sampleContent[1]],
        meta: { page: 2, limit: 50, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [sampleContent[0]],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(screen.getByText('Promo Video')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockDeleteContent).toHaveBeenCalledWith('c2');
    });
    await waitFor(() => {
      expect(mockGetContent).toHaveBeenLastCalledWith({ page: 1, limit: 50 });
    });
    expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    expect(screen.queryByText('Promo Video')).not.toBeInTheDocument();
  });

  it('shows error toast on fetch failure', async () => {
    mockGetContent.mockRejectedValue(new Error('Network error'));
    render(<ContentClient />);
    await waitFor(() => {
      expect(mockToast.showToast).toHaveBeenCalledWith('Network error', 'error');
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
    mockGetContent.mockClear();
    fireEvent.click(screen.getByText('Select Marketing Tag'));

    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 50,
        tagNames: ['Marketing'],
      }));
    });
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('1');

    mockGetContent.mockClear();
    fireEvent.click(screen.getByText('Clear all'));

    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalledWith(expect.not.objectContaining({
        tagNames: expect.anything(),
      }));
    });
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('');
  });

  it('does not fetch modal-only displays and playlists on mount', async () => {
    render(<ContentClient />);
    await waitForInitialRequestsToSettle();
    expect(mockGetDisplays).not.toHaveBeenCalled();
    expect(mockGetPlaylists).not.toHaveBeenCalled();
  });

  it('lazy-loads displays when opening the push modal', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockGetDisplays.mockResolvedValue({
      data: [{ id: 'd1', nickname: 'Lobby Display', status: 'online', location: 'Lobby' }],
      meta: { total: 1, totalPages: 1 },
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    expect(mockGetDisplays).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByText('Push')[0]);

    await waitFor(() => {
      expect(mockGetDisplays).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
    });
    expect(mockGetPlaylists).not.toHaveBeenCalled();
  });

  it('shows a retryable device-load error in the push modal', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockGetDisplays
      .mockRejectedValueOnce(new Error('Devices unavailable'))
      .mockResolvedValueOnce({
        data: [{ id: 'd2', nickname: 'Recovered Display', status: 'online', location: 'Lobby' }],
        meta: { total: 1, totalPages: 1 },
      });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Push')[0]);

    await waitFor(() => {
      expect(screen.getByText('Devices unavailable')).toBeInTheDocument();
      expect(screen.getByText('Retry loading devices')).toBeInTheDocument();
    });
    expect(screen.queryByText('No devices available')).not.toBeInTheDocument();
    expect(screen.getByText('Select Devices')).toBeInTheDocument();
    expect(screen.queryByText('Select Devices (0 online)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Retry loading devices'));

    await waitFor(() => {
      expect(mockGetDisplays).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Recovered Display')).toBeInTheDocument();
      expect(screen.getByText('Select Devices (1 online)')).toBeInTheDocument();
    });
  });

  it('lazy-loads playlists when opening the add-to-playlist modal', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockGetPlaylists.mockResolvedValue({
      data: [{ id: 'p1', name: 'Lunch Menu', items: [] }],
      meta: { total: 1, totalPages: 1 },
    });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    expect(mockGetPlaylists).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByText('Playlist')[0]);

    await waitFor(() => {
      expect(mockGetPlaylists).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(screen.getByText('Lunch Menu (0 items)')).toBeInTheDocument();
    });
    expect(mockGetDisplays).not.toHaveBeenCalled();
  });

  it('shows a retryable playlist-load error in the add-to-playlist modal', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockGetPlaylists
      .mockRejectedValueOnce(new Error('Playlists unavailable'))
      .mockResolvedValueOnce({
        data: [{ id: 'p2', name: 'Recovered Playlist', items: [] }],
        meta: { total: 1, totalPages: 1 },
      });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Playlist')[0]);

    await waitFor(() => {
      expect(screen.getByText('Playlists unavailable')).toBeInTheDocument();
      expect(screen.getByText('Retry loading playlists')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Unable to load playlists')).toBeDisabled();

    fireEvent.click(screen.getByText('Retry loading playlists'));

    await waitFor(() => {
      expect(mockGetPlaylists).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Recovered Playlist (0 items)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Select a playlist')).not.toBeDisabled();
    });
  });

  it('refreshes devices each time the push modal is opened', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockGetDisplays
      .mockResolvedValueOnce({
        data: [{ id: 'd1', nickname: 'Lobby Display', status: 'online', location: 'Lobby' }],
        meta: { total: 1, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'd2', nickname: 'Kitchen Display', status: 'offline', location: 'Kitchen' }],
        meta: { total: 1, totalPages: 1 },
      });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Push')[0]);
    await waitFor(() => {
      expect(screen.getByText('Lobby Display')).toBeInTheDocument();
      expect(screen.getByText('Select Devices (1 online)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Close modal'));
    fireEvent.click(screen.getAllByText('Push')[0]);

    await waitFor(() => {
      expect(mockGetDisplays).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
      expect(screen.getByText('Select Devices (0 online)')).toBeInTheDocument();
    });
  });

  it('refreshes playlists each time the add-to-playlist modal is opened', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockGetPlaylists
      .mockResolvedValueOnce({
        data: [{ id: 'p1', name: 'Lunch Menu', items: [] }],
        meta: { total: 1, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'p2', name: 'Dinner Menu', items: [{ id: 'item-1' }] }],
        meta: { total: 1, totalPages: 1 },
      });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Playlist')[0]);
    await waitFor(() => {
      expect(screen.getByText('Lunch Menu (0 items)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Close modal'));
    fireEvent.click(screen.getAllByText('Playlist')[0]);

    await waitFor(() => {
      expect(mockGetPlaylists).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Dinner Menu (1 items)')).toBeInTheDocument();
    });
  });

  it('refetches playlist options after adding content to a playlist', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockGetPlaylists
      .mockResolvedValueOnce({
        data: [{ id: 'p1', name: 'Lunch Menu', items: [] }],
        meta: { total: 1, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'p1', name: 'Lunch Menu', items: [{ id: 'item-1' }] }],
        meta: { total: 1, totalPages: 1 },
      });

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Playlist')[0]);
    await waitFor(() => {
      expect(screen.getByText('Lunch Menu (0 items)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByDisplayValue('Select a playlist'), { target: { value: 'p1' } });
    fireEvent.click(screen.getAllByText('Add to Playlist').at(-1)!);

    await waitFor(() => {
      expect(mockAddPlaylistItem).toHaveBeenCalledWith('p1', 'c1');
    });

    fireEvent.click(screen.getAllByText('Playlist')[0]);
    await waitFor(() => {
      expect(mockGetPlaylists).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Lunch Menu (1 items)')).toBeInTheDocument();
    });
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

  it('does not upload a removed queued file when switching to URL content', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    const removedFile = new File(['image-bytes'], 'removed.png', { type: 'image/png' });

    await act(async () => {
      lastDropzoneOptions.onDrop([removedFile]);
    });

    fireEvent.click(screen.getByLabelText(/remove removed.png from upload queue/i));
    fireEvent.change(screen.getByDisplayValue('Image'), { target: { value: 'url' } });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/page'), {
      target: { value: 'https://example.com/menu' },
    });

    const submitButtons = screen.getAllByRole('button', { name: 'Upload Content' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(mockCreateContent).toHaveBeenCalledWith({
        title: 'removed',
        type: 'url',
        url: 'https://example.com/menu',
      });
    });
    expect(mockUploadContentWithProgress).not.toHaveBeenCalled();
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

  it('limits queued video uploads to one concurrent file', async () => {
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
    fireEvent.change(screen.getByDisplayValue('Image'), { target: { value: 'video' } });
    await waitFor(() => {
      expect(screen.getByDisplayValue('Video')).toBeInTheDocument();
    });

    const files = [
      new File(['1'], 'video-1.mp4', { type: 'video/mp4' }),
      new File(['2'], 'video-2.mp4', { type: 'video/mp4' }),
    ];

    await act(async () => {
      lastDropzoneOptions.onDrop(files);
    });

    fireEvent.click(screen.getByText('Upload 2 Files'));

    await waitFor(() => {
      expect(mockUploadContentWithProgress).toHaveBeenCalledTimes(1);
    });
    expect(mockUploadContentWithProgress.mock.calls[0][0].title).toBe('video-1');

    await act(async () => {
      deferredUploads[0].resolve({ id: 'video-1', title: 'Video 1' });
      await deferredUploads[0].promise;
    });

    await waitFor(() => {
      expect(mockUploadContentWithProgress).toHaveBeenCalledTimes(2);
    });
    expect(mockUploadContentWithProgress.mock.calls[1][0].title).toBe('video-2');
  });

  it('enforces the upload queue cap across repeated drops', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    expect(lastDropzoneOptions.maxFiles).toBeUndefined();

    await act(async () => {
      lastDropzoneOptions.onDrop(
        Array.from({ length: 8 }, (_, index) =>
          new File([String(index)], `queue-${index + 1}.png`, { type: 'image/png' }),
        ),
      );
    });
    await act(async () => {
      lastDropzoneOptions.onDrop(
        Array.from({ length: 5 }, (_, index) =>
          new File([String(index)], `queue-${index + 9}.png`, { type: 'image/png' }),
        ),
      );
    });

    expect(screen.getByText('Upload Queue (10 files)')).toBeInTheDocument();
    expect(screen.getByText('queue-10.png')).toBeInTheDocument();
    expect(screen.queryByText('queue-11.png')).not.toBeInTheDocument();
    expect(screen.queryByText('queue-13.png')).not.toBeInTheDocument();
    expect(mockToast.warning).toHaveBeenCalledWith(expect.stringContaining('upload queue'));
  });

  it('shows rejected upload files inline with the rejection reason', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    expect(lastDropzoneOptions.onDropRejected).toEqual(expect.any(Function));

    await act(async () => {
      lastDropzoneOptions.onDropRejected([
        {
          file: new File(['too-large'], 'huge.mp4', { type: 'video/mp4' }),
          errors: [{ code: 'file-too-large', message: 'File is larger than 100MB' }],
        },
      ]);
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('huge.mp4');
    expect(alert).toHaveTextContent('File is larger than 100MB');
  });

  it('labels partial-failure retries with the remaining retryable count and visible row error', async () => {
    mockGetContent.mockResolvedValue({ data: sampleContent, meta: { total: 3 } });
    mockUploadContentWithProgress
      .mockResolvedValueOnce({ id: 'ok', title: 'OK' })
      .mockRejectedValueOnce(new Error('Network timeout'));

    render(<ContentClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Banner')).toBeInTheDocument();
    });
    await waitForAuxiliaryRequestsToSettle();

    fireEvent.click(screen.getAllByText('Upload Content')[0]);
    const files = [
      new File(['1'], 'ok.png', { type: 'image/png' }),
      new File(['2'], 'failed.png', { type: 'image/png' }),
    ];

    await act(async () => {
      lastDropzoneOptions.onDrop(files);
    });

    fireEvent.click(screen.getByText('Upload 2 Files'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('1 file(s) uploaded, 1 failed');
    });
    expect(screen.getByText('Retry 1 Failed')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });
});
