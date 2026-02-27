import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SupportDashboardClient } from '../page-client';
import { apiClient } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getSupportRequests: jest.fn(),
    getSupportStats: jest.fn(),
    getSupportRequest: jest.fn(),
    updateSupportRequest: jest.fn(),
    addSupportMessage: jest.fn(),
    createSupportRequest: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/admin/support',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({
    isOpen,
    onClose,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) {
    if (!isOpen) return null;
    return (
      <div role="dialog" aria-modal="true" data-testid="modal">
        <div className="flex items-center justify-between">
          <h3>{title}</h3>
          <button onClick={onClose} aria-label="Close modal">
            X
          </button>
        </div>
        <div>{children}</div>
      </div>
    );
  };
});

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const mockStats = {
  open: 5,
  inProgress: 2,
  resolvedThisWeek: 10,
  total: 50,
  byCategory: {
    bug_report: 10,
    feature_request: 15,
    help_question: 8,
    template_request: 5,
    feedback: 7,
    urgent_issue: 2,
    account_issue: 3,
  },
  byPriority: { critical: 2, high: 5, medium: 20, low: 23 },
};

const mockRequests = [
  {
    id: '1',
    organizationId: 'org1',
    userId: 'user1',
    category: 'bug_report' as const,
    priority: 'high' as const,
    status: 'open' as const,
    title: 'App crashes on upload',
    description: 'The app crashes when I try to upload large files',
    aiSummary: 'User reports crash during file upload',
    aiSuggestedAction: 'Investigate file upload size limits',
    pageUrl: '/dashboard/content',
    browserInfo: 'Mozilla/5.0',
    consoleErrors: null,
    resolutionNotes: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  },
  {
    id: '2',
    organizationId: 'org1',
    userId: 'user2',
    category: 'feature_request' as const,
    priority: 'medium' as const,
    status: 'in_progress' as const,
    title: 'Add dark mode support',
    description: 'Would like dark mode in the dashboard',
    aiSummary: null,
    aiSuggestedAction: null,
    pageUrl: null,
    browserInfo: null,
    consoleErrors: null,
    resolutionNotes: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
  },
];

describe('SupportDashboardClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.getSupportStats.mockResolvedValue(mockStats as any);
    mockApiClient.getSupportRequests.mockResolvedValue({
      data: mockRequests,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    } as any);
  });

  it('renders the Support Dashboard heading', async () => {
    await act(async () => {
      render(<SupportDashboardClient />);
    });
    expect(screen.getByText('Support Dashboard')).toBeInTheDocument();
  });

  it('renders stats cards with correct counts', async () => {
    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // open
    });

    expect(screen.getByText('10')).toBeInTheDocument(); // resolved this week
    expect(screen.getByText('50')).toBeInTheDocument(); // total

    // Verify stat card labels exist (use getAllByText for labels that appear in multiple places)
    expect(screen.getByText('Resolved This Week')).toBeInTheDocument();
    // "Open", "In Progress", "Total" may appear in both stats cards and filter/request card badges.
    // Use getAllByText to verify they exist at least once.
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders request list', async () => {
    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('App crashes on upload')).toBeInTheDocument();
    });

    expect(screen.getByText('Add dark mode support')).toBeInTheDocument();
  });

  it('shows user names on request cards', async () => {
    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows "No support requests found" when empty', async () => {
    mockApiClient.getSupportRequests.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    } as any);

    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('No support requests found')).toBeInTheDocument();
    });
  });

  it('clicking a request opens the detail modal', async () => {
    const fullRequest = {
      ...mockRequests[0],
      messages: [
        {
          id: 'msg-1',
          requestId: '1',
          organizationId: 'org1',
          userId: 'user1',
          role: 'user' as const,
          content: 'The app crashes when uploading',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    mockApiClient.getSupportRequest.mockResolvedValue(fullRequest as any);

    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('App crashes on upload')).toBeInTheDocument();
    });

    // Click on the request card
    await act(async () => {
      fireEvent.click(screen.getByText('App crashes on upload'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('detail modal shows request title and AI summary', async () => {
    const fullRequest = {
      ...mockRequests[0],
      messages: [],
    };
    mockApiClient.getSupportRequest.mockResolvedValue(fullRequest as any);

    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('App crashes on upload')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('App crashes on upload'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // The modal should show the AI summary
    expect(screen.getByText('User reports crash during file upload')).toBeInTheDocument();
    expect(screen.getByText('Investigate file upload size limits')).toBeInTheDocument();
  });

  it('detail modal shows conversation thread', async () => {
    const fullRequest = {
      ...mockRequests[0],
      messages: [
        {
          id: 'msg-1',
          requestId: '1',
          organizationId: 'org1',
          userId: 'user1',
          role: 'user' as const,
          content: 'The app crashes when uploading large files',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          requestId: '1',
          organizationId: 'org1',
          userId: '',
          role: 'assistant' as const,
          content: 'I understand the issue with file uploads',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    mockApiClient.getSupportRequest.mockResolvedValue(fullRequest as any);

    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('App crashes on upload')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('App crashes on upload'));
    });

    await waitFor(() => {
      expect(screen.getByText('Conversation')).toBeInTheDocument();
    });

    expect(screen.getByText('The app crashes when uploading large files')).toBeInTheDocument();
    expect(screen.getByText('I understand the issue with file uploads')).toBeInTheDocument();
  });

  it('changing status calls updateSupportRequest API', async () => {
    const fullRequest = {
      ...mockRequests[0],
      messages: [],
    };
    mockApiClient.getSupportRequest.mockResolvedValue(fullRequest as any);
    mockApiClient.updateSupportRequest.mockResolvedValue({
      ...fullRequest,
      status: 'in_progress',
    } as any);

    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('App crashes on upload')).toBeInTheDocument();
    });

    // Open the detail modal
    await act(async () => {
      fireEvent.click(screen.getByText('App crashes on upload'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Find the status select and change it
    const statusSelect = screen.getByDisplayValue('Open');
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: 'in_progress' } });
    });

    // A "Save Changes" button should appear since the status changed
    const saveButton = screen.getByText('Save Changes');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockApiClient.updateSupportRequest).toHaveBeenCalledWith('1', {
        status: 'in_progress',
      });
    });
  });

  it('filters update the request list', async () => {
    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('App crashes on upload')).toBeInTheDocument();
    });

    // Change the status filter
    const statusFilter = screen.getByDisplayValue('All Statuses');
    mockApiClient.getSupportRequests.mockResolvedValue({
      data: [mockRequests[0]],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    } as any);

    await act(async () => {
      fireEvent.change(statusFilter, { target: { value: 'open' } });
    });

    await waitFor(() => {
      // The API should have been called again with the new filter
      expect(mockApiClient.getSupportRequests).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' })
      );
    });
  });

  it('pagination controls work', async () => {
    mockApiClient.getSupportRequests.mockResolvedValue({
      data: mockRequests,
      meta: { total: 40, page: 1, limit: 20, totalPages: 2 },
    } as any);

    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    // Previous should be disabled on page 1
    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();

    // Click Next
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();

    mockApiClient.getSupportRequests.mockResolvedValue({
      data: [],
      meta: { total: 40, page: 2, limit: 20, totalPages: 2 },
    } as any);

    await act(async () => {
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(mockApiClient.getSupportRequests).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it('renders category badges on request cards', async () => {
    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      // "Bug Report" and "Feature Request" appear in both filter dropdown options
      // and request card badges. Use getAllByText to verify they exist.
      expect(screen.getAllByText('Bug Report').length).toBeGreaterThanOrEqual(2); // filter + card
      expect(screen.getAllByText('Feature Request').length).toBeGreaterThanOrEqual(2); // filter + card
    });
  });

  it('renders the search input in filters', async () => {
    await act(async () => {
      render(<SupportDashboardClient />);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search requests...')).toBeInTheDocument();
    });
  });
});
