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
  usePathname: () => '/admin/plans',
}));

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getAdminPlans: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    deletePlan: jest.fn(),
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

import AdminPlansPage from '../plans/page';
import { apiClient } from '@/lib/api';

const mockPlans = [
  {
    id: '1',
    slug: 'free',
    name: 'Free',
    description: 'For small teams',
    screenQuota: 2,
    storageQuotaMb: 512,
    apiRateLimit: 100,
    priceUsdMonthly: 0,
    priceUsdYearly: 0,
    priceInrMonthly: 0,
    priceInrYearly: 0,
    features: ['2 screens', 'Basic support'],
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    highlightText: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    slug: 'professional',
    name: 'Professional',
    description: 'For growing businesses',
    screenQuota: 10,
    storageQuotaMb: 5120,
    apiRateLimit: 1000,
    priceUsdMonthly: 29,
    priceUsdYearly: 290,
    priceInrMonthly: 2400,
    priceInrYearly: 24000,
    features: ['10 screens', 'Priority support', 'Analytics'],
    isActive: true,
    isPublic: true,
    sortOrder: 1,
    highlightText: 'Most Popular',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

describe('AdminPlansPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getAdminPlans as jest.Mock).mockResolvedValue(mockPlans);
  });

  it('renders loading state initially', () => {
    render(<AdminPlansPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders plans after loading', async () => {
    render(<AdminPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Plans')).toBeInTheDocument();
    });

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('displays plan pricing correctly', async () => {
    render(<AdminPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('$29')).toBeInTheDocument();
    });

    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('shows create plan button', async () => {
    render(<AdminPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Create Plan')).toBeInTheDocument();
    });
  });

  it('opens create plan form when button clicked', async () => {
    render(<AdminPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Create Plan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Plan'));

    await waitFor(() => {
      // The form modal should appear
      expect(screen.getByText('Save Plan')).toBeInTheDocument();
    });
  });

  it('displays plan features', async () => {
    render(<AdminPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('2 screens')).toBeInTheDocument();
    });

    expect(screen.getByText('10 screens')).toBeInTheDocument();
  });

  it('shows edit button for each plan', async () => {
    render(<AdminPlansPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons).toHaveLength(2);
    });
  });

  it('shows active/inactive status badges', async () => {
    render(<AdminPlansPage />);

    await waitFor(() => {
      const activeBadges = screen.getAllByText('Active');
      expect(activeBadges.length).toBeGreaterThan(0);
    });
  });

  it('handles empty plans list', async () => {
    (apiClient.getAdminPlans as jest.Mock).mockResolvedValue([]);

    render(<AdminPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('No plans yet')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    (apiClient.getAdminPlans as jest.Mock).mockRejectedValue(new Error('Failed to load'));

    render(<AdminPlansPage />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load');
    });
  });
});
