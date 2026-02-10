import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/admin/users',
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getAdminUsers: jest.fn(),
    disableUser: jest.fn(),
    enableUser: jest.fn(),
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

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

jest.mock('../../components/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid={`status-badge-${status}`}>{status}</span>
  ),
}));

jest.mock('@/components/ConfirmDialog', () => ({
  __esModule: true,
  default: ({ isOpen, onConfirm, onClose, title, message }: any) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

import AdminUsersClient from '../page-client';
import { apiClient } from '@/lib/api';

const mockUsers = [
  {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'admin',
    isActive: true,
    isSuperAdmin: false,
    lastLoginAt: '2024-06-15T10:30:00Z',
    organization: { name: 'Acme Corp' },
  },
  {
    id: 'user-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    role: 'owner',
    isActive: true,
    isSuperAdmin: true,
    lastLoginAt: null,
    organization: { name: 'TechStart Inc' },
  },
  {
    id: 'user-3',
    firstName: 'Bob',
    lastName: 'Wilson',
    email: 'bob@example.com',
    role: 'member',
    isActive: false,
    isSuperAdmin: false,
    lastLoginAt: '2024-01-10T08:00:00Z',
    organization: { name: 'Widget Co' },
  },
];

describe('AdminUsersClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders users heading', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Manage all users across organizations')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument();
  });

  it('renders user names', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
  });

  it('renders user emails', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('renders organization names', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('TechStart Inc')).toBeInTheDocument();
    expect(screen.getByText('Widget Co')).toBeInTheDocument();
  });

  it('renders role badges', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('renders active/inactive status badges', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    const activeBadges = screen.getAllByTestId('status-badge-active');
    const inactiveBadges = screen.getAllByTestId('status-badge-inactive');
    expect(activeBadges.length).toBe(2);
    expect(inactiveBadges.length).toBe(1);
  });

  it('renders table headers', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Last Login')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders pagination info', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('Showing 3 of 3 users')).toBeInTheDocument();
  });

  it('shows Disable button for active non-super-admin users', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    const disableButtons = screen.getAllByText('Disable');
    expect(disableButtons.length).toBeGreaterThan(0);
  });

  it('shows Enable button for inactive users', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('Enable')).toBeInTheDocument();
  });

  it('renders "Never" for null lastLoginAt', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('renders empty state when no users', () => {
    render(<AdminUsersClient initialUsers={[]} initialTotal={0} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('triggers search on input change', async () => {
    (apiClient.getAdminUsers as jest.Mock).mockResolvedValue({
      data: [],
      total: 0,
    });

    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);

    fireEvent.change(screen.getByPlaceholderText('Search by name or email...'), {
      target: { value: 'john' },
    });

    await waitFor(() => {
      expect(apiClient.getAdminUsers).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('opens confirm dialog when Disable is clicked', () => {
    render(<AdminUsersClient initialUsers={mockUsers as any} initialTotal={3} />);

    // Click the first Disable button (John Doe, who is active and not super admin)
    const disableButtons = screen.getAllByText('Disable');
    fireEvent.click(disableButtons[0]);

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Disable User')).toBeInTheDocument();
  });
});
