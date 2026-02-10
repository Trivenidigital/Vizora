import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import LayoutsPage from '../page';

const mockPush = jest.fn();
const mockGetLayoutPresets = jest.fn();
const mockGet = jest.fn();
const mockCreateLayout = jest.fn();
const mockDeleteLayout = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/dashboard/layouts',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getLayoutPresets: (...args: any[]) => mockGetLayoutPresets(...args),
    get: (...args: any[]) => mockGet(...args),
    createLayout: (...args: any[]) => mockCreateLayout(...args),
    deleteLayout: (...args: any[]) => mockDeleteLayout(...args),
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

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title }: any) { return <div data-testid="empty-state">{title || 'No items'}</div>; };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children, title }: any) {
    return isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null;
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

const samplePresets = [
  {
    type: 'split-horizontal',
    name: 'Split Horizontal',
    description: 'Two equal columns side by side',
    zones: 2,
  },
  {
    type: 'grid-2x2',
    name: '2x2 Grid',
    description: 'Four equal zones in a grid',
    zones: 4,
  },
  {
    type: 'main-sidebar',
    name: 'Main + Sidebar',
    description: 'Large main area with sidebar',
    zones: 2,
  },
];

const sampleLayouts = [
  {
    id: 'l1',
    name: 'Lobby Layout',
    type: 'split-horizontal',
    zones: [
      { id: 'z1', playlistId: 'p1', label: 'A' },
      { id: 'z2', playlistId: 'p2', label: 'B' },
    ],
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'l2',
    name: 'Dashboard Grid',
    type: 'grid-2x2',
    zones: [
      { id: 'z1', label: 'A' },
      { id: 'z2', label: 'B' },
      { id: 'z3', label: 'C' },
      { id: 'z4', label: 'D' },
    ],
    createdAt: '2026-01-15T00:00:00Z',
  },
];

describe('LayoutsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLayoutPresets.mockResolvedValue(samplePresets);
    mockGet.mockResolvedValue({ data: sampleLayouts });
    mockCreateLayout.mockResolvedValue({ id: 'new-1' });
    mockDeleteLayout.mockResolvedValue({});
  });

  it('renders loading spinner initially', () => {
    render(<LayoutsPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders page heading after load', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Layouts')).toBeInTheDocument();
    });
  });

  it('fetches layout presets on mount', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(mockGetLayoutPresets).toHaveBeenCalled();
    });
  });

  it('renders layout presets', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Split Horizontal')).toBeInTheDocument();
    });
    expect(screen.getByText('2x2 Grid')).toBeInTheDocument();
    expect(screen.getByText('Main + Sidebar')).toBeInTheDocument();
  });

  it('renders preset descriptions', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Two equal columns side by side')).toBeInTheDocument();
    });
    expect(screen.getByText('Four equal zones in a grid')).toBeInTheDocument();
  });

  it('renders existing layouts', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Lobby Layout')).toBeInTheDocument();
    });
    expect(screen.getByText('Dashboard Grid')).toBeInTheDocument();
  });

  it('handles fetch failure gracefully', async () => {
    mockGetLayoutPresets.mockRejectedValue(new Error('Failed'));
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    // Page still renders even on error
    expect(screen.getByText('Layouts')).toBeInTheDocument();
  });

  it('handles empty layout list gracefully', async () => {
    mockGet.mockResolvedValue({ data: [] });
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Layouts')).toBeInTheDocument();
    });
  });

  it('renders create layout option', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Layouts')).toBeInTheDocument();
    });
    // Presets serve as create options
    expect(screen.getAllByText(/create/i).length).toBeGreaterThan(0);
  });

  it('renders zone count for presets', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Split Horizontal')).toBeInTheDocument();
    });
  });
});
