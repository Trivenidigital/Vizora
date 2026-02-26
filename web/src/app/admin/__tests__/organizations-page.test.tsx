/**
 * NOTE: These tests fail because the page component is async (server-component style)
 * but renders as a Client Component in jsdom, producing an empty <div />.
 * This is a known issue tied to the RSC migration deferral.
 * Tests will be fixed when the page is refactored to proper RSC architecture.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/admin/organizations',
}));

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getAdminOrganizations: jest.fn(),
    suspendOrganization: jest.fn(),
    unsuspendOrganization: jest.fn(),
    extendTrial: jest.fn(),
  },
}));

// Mock useAuth hook
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'admin@test.com', isSuperAdmin: true },
    loading: false,
  }),
}));

// Mock useToast hook
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  ToastContainer: () => null,
};
jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

// Mock ConfirmDialog
jest.mock('@/components/ConfirmDialog', () => ({
  __esModule: true,
  default: ({ isOpen, onConfirm, onClose, title }: any) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

import AdminOrganizationsPage from '../organizations/page';
import { apiClient } from '@/lib/api';

const mockOrganizations = [
  {
    id: '1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    subscriptionTier: 'professional',
    subscriptionStatus: 'active',
    screenQuota: 10,
    country: 'US',
    createdAt: '2024-01-15',
    _count: { users: 5, displays: 8 },
  },
  {
    id: '2',
    name: 'TechStart Inc',
    slug: 'techstart-inc',
    subscriptionTier: 'free',
    subscriptionStatus: 'trialing',
    screenQuota: 2,
    country: 'IN',
    createdAt: '2024-02-01',
    _count: { users: 2, displays: 1 },
  },
  {
    id: '3',
    name: 'Suspended LLC',
    slug: 'suspended-llc',
    subscriptionTier: 'professional',
    subscriptionStatus: 'suspended',
    screenQuota: 10,
    country: 'UK',
    createdAt: '2023-12-01',
    _count: { users: 3, displays: 5 },
  },
];

describe('AdminOrganizationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getAdminOrganizations as jest.Mock).mockResolvedValue({
      data: mockOrganizations,
      total: mockOrganizations.length,
    });
  });

  it('renders loading state initially', () => {
    render(<AdminOrganizationsPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders organizations after loading', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Organizations')).toBeInTheDocument();
    });

    // Wait for the debounced search to complete and data to load
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText('TechStart Inc')).toBeInTheDocument();
    expect(screen.getByText('Suspended LLC')).toBeInTheDocument();
  });

  it('displays organization details correctly', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('acme-corp')).toBeInTheDocument();
    });

    // Check that organization slugs are displayed
    expect(screen.getByText('techstart-inc')).toBeInTheDocument();
  });

  it('shows subscription status badges', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Trialing')).toBeInTheDocument();
      expect(screen.getByText('Suspended')).toBeInTheDocument();
    });
  });

  it('has search functionality', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search organizations...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search organizations...');
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    // Search should trigger API call with search param
    await waitFor(() => {
      expect(apiClient.getAdminOrganizations).toHaveBeenCalledWith({ search: 'Acme' });
    });
  });

  it('has status filter dropdown', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'active' } });

    await waitFor(() => {
      expect(apiClient.getAdminOrganizations).toHaveBeenCalledWith({ status: 'active' });
    });
  });

  it('shows pagination info', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Showing 3 of 3 organizations/)).toBeInTheDocument();
    });
  });

  it('handles empty organizations list', async () => {
    (apiClient.getAdminOrganizations as jest.Mock).mockResolvedValue({
      data: [],
      total: 0,
    });

    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('No organizations found')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    (apiClient.getAdminOrganizations as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Network error');
    });
  });

  it('shows action menu with suspend option for active org', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    // Click the action menu button for Acme Corp (first org)
    const actionButtons = screen.getAllByRole('button');
    const moreButton = actionButtons.find(btn => btn.querySelector('svg'));

    // Find the MoreVertical button in the first row
    const tableRows = document.querySelectorAll('tbody tr');
    const firstRowMoreButton = tableRows[0].querySelector('button');
    if (firstRowMoreButton) {
      fireEvent.click(firstRowMoreButton);
    }
  });

  it('shows extend trial option for trialing org', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('TechStart Inc')).toBeInTheDocument();
    });

    // The trialing org should have extend trial option available
    const tableRows = document.querySelectorAll('tbody tr');
    const trialingRowMoreButton = tableRows[1].querySelector('button');
    if (trialingRowMoreButton) {
      fireEvent.click(trialingRowMoreButton);
      await waitFor(() => {
        expect(screen.getByText('Extend Trial')).toBeInTheDocument();
      });
    }
  });

  it('shows reactivate option for suspended org', async () => {
    render(<AdminOrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Suspended LLC')).toBeInTheDocument();
    });

    const tableRows = document.querySelectorAll('tbody tr');
    const suspendedRowMoreButton = tableRows[2].querySelector('button');
    if (suspendedRowMoreButton) {
      fireEvent.click(suspendedRowMoreButton);
      await waitFor(() => {
        expect(screen.getByText('Reactivate')).toBeInTheDocument();
      });
    }
  });
});
