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

// Import the Client Component directly (not the async Server Component page)
import AdminOrganizationsClient from '../organizations/page-client';
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

  it('renders organizations when provided as initial data', () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('TechStart Inc')).toBeInTheDocument();
    expect(screen.getByText('Suspended LLC')).toBeInTheDocument();
  });

  it('displays organization details correctly', () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText('techstart-inc')).toBeInTheDocument();
  });

  it('shows subscription status badges', () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    // Status text appears both in filter dropdown options and StatusBadge, so use getAllByText
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2); // option + badge
    expect(screen.getAllByText('Trialing').length).toBeGreaterThanOrEqual(2); // option + badge
    expect(screen.getAllByText('Suspended').length).toBeGreaterThanOrEqual(2); // option + badge
  });

  it('has search functionality', async () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    expect(screen.getByPlaceholderText('Search organizations...')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search organizations...');
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    // Search should trigger API call with search param (after debounce)
    await waitFor(() => {
      expect(apiClient.getAdminOrganizations).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('has status filter dropdown', () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    expect(screen.getByText('All Statuses')).toBeInTheDocument();
  });

  it('shows pagination info', () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    expect(screen.getByText(/Showing 3 of 3 organizations/)).toBeInTheDocument();
  });

  it('handles empty organizations list', () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={[]}
        initialTotal={0}
      />
    );

    expect(screen.getByText('No organizations found')).toBeInTheDocument();
  });

  it('shows action menu with suspend option for active org', async () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    // Click the action menu button for Acme Corp (first row)
    const tableRows = document.querySelectorAll('tbody tr');
    const firstRowButton = tableRows[0].querySelector('button');
    expect(firstRowButton).toBeTruthy();
    fireEvent.click(firstRowButton!);
    await waitFor(() => {
      expect(screen.getByText('Suspend')).toBeInTheDocument();
    });
  });

  it('shows extend trial option for trialing org', async () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    const tableRows = document.querySelectorAll('tbody tr');
    const trialingRowButton = tableRows[1].querySelector('button');
    expect(trialingRowButton).toBeTruthy();
    fireEvent.click(trialingRowButton!);
    await waitFor(() => {
      expect(screen.getByText('Extend Trial')).toBeInTheDocument();
    });
  });

  it('shows reactivate option for suspended org', async () => {
    render(
      <AdminOrganizationsClient
        initialOrganizations={mockOrganizations as any}
        initialTotal={mockOrganizations.length}
      />
    );

    const tableRows = document.querySelectorAll('tbody tr');
    const suspendedRowButton = tableRows[2].querySelector('button');
    expect(suspendedRowButton).toBeTruthy();
    fireEvent.click(suspendedRowButton!);
    await waitFor(() => {
      expect(screen.getByText('Reactivate')).toBeInTheDocument();
    });
  });
});
