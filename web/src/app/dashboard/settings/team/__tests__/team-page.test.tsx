import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TeamClient from '../page-client';

const mockGetUsers = jest.fn();
const mockInviteUser = jest.fn();
const mockUpdateUserRole = jest.fn();
const mockDeactivateUser = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getUsers: (...args: any[]) => mockGetUsers(...args),
    inviteUser: (...args: any[]) => mockInviteUser(...args),
    updateUserRole: (...args: any[]) => mockUpdateUserRole(...args),
    deactivateUser: (...args: any[]) => mockDeactivateUser(...args),
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

const sampleUsers = [
  {
    id: 'u1',
    email: 'admin@vizora.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
    lastLoginAt: '2026-02-09T08:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-09T08:00:00Z',
  },
  {
    id: 'u2',
    email: 'editor@vizora.com',
    firstName: 'Editor',
    lastName: 'Smith',
    role: 'editor',
    isActive: true,
    lastLoginAt: '2026-02-08T14:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-02-08T14:00:00Z',
  },
  {
    id: 'u3',
    email: 'viewer@vizora.com',
    firstName: 'View',
    lastName: 'Only',
    role: 'viewer',
    isActive: false,
    lastLoginAt: null,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

describe('TeamClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsers.mockResolvedValue({
      data: sampleUsers,
      meta: { total: 3, totalPages: 1 },
    });
    mockInviteUser.mockResolvedValue({ temporaryPassword: 'temp123' });
    mockUpdateUserRole.mockResolvedValue({});
    mockDeactivateUser.mockResolvedValue({});
  });

  it('renders loading spinner initially', () => {
    render(<TeamClient />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches team members on mount', async () => {
    render(<TeamClient />);
    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalled();
    });
  });

  it('renders team members after load', async () => {
    render(<TeamClient />);
    await waitFor(() => {
      expect(screen.getByText('admin@vizora.com')).toBeInTheDocument();
    });
    expect(screen.getByText('editor@vizora.com')).toBeInTheDocument();
    expect(screen.getByText('viewer@vizora.com')).toBeInTheDocument();
  });

  it('shows error toast on fetch failure', async () => {
    mockGetUsers.mockRejectedValue(new Error('Network error'));
    render(<TeamClient />);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it('renders invite button', async () => {
    render(<TeamClient />);
    await waitFor(() => {
      expect(screen.getByText('admin@vizora.com')).toBeInTheDocument();
    });
    expect(screen.getByText(/invite/i)).toBeInTheDocument();
  });

  it('renders user roles', async () => {
    render(<TeamClient />);
    await waitFor(() => {
      expect(screen.getByText('admin@vizora.com')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/admin/i).length).toBeGreaterThan(0);
  });

  it('displays inactive user status', async () => {
    render(<TeamClient />);
    await waitFor(() => {
      expect(screen.getByText('viewer@vizora.com')).toBeInTheDocument();
    });
  });

  it('renders page heading', async () => {
    render(<TeamClient />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/team/i).length).toBeGreaterThan(0);
  });

  it('renders user names', async () => {
    render(<TeamClient />);
    await waitFor(() => {
      expect(screen.getByText(/Admin/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Editor/)).toBeInTheDocument();
  });

  it('handles empty team list', async () => {
    mockGetUsers.mockResolvedValue({ data: [], meta: { total: 0, totalPages: 0 } });
    render(<TeamClient />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });
});
