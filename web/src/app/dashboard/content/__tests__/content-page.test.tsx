import { render, screen, waitFor } from '@testing-library/react';
import ContentClient from '../page-client';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getFolderContent: jest.fn().mockResolvedValue({ data: [] }),
    getFolders: jest.fn().mockResolvedValue([]),
    getDisplays: jest.fn().mockResolvedValue({ data: [] }),
    getPlaylists: jest.fn().mockResolvedValue({ data: [] }),
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

jest.mock('@/lib/hooks/useDebounce', () => ({
  useDebounce: (val: any) => val,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: jest.fn(),
  useOptimisticState: jest.fn((initialState: any) => [initialState, jest.fn(), jest.fn()]),
  useErrorRecovery: jest.fn(() => ({ retry: jest.fn(), isRecovering: false })),
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
  return function MockEmpty({ title }: any) { return <div>{title || 'No items'}</div>; };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children }: any) { return isOpen ? <div>{children}</div> : null; };
});

jest.mock('@/components/PreviewModal', () => {
  return function MockPreviewModal() { return null; };
});

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirm() { return null; };
});

jest.mock('@/components/SearchFilter', () => {
  return function MockSearch() { return <input placeholder="Search..." />; };
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

describe('ContentClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
