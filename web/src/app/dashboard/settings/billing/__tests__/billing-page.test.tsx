import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BillingPage from '../page';
import { apiClient } from '@/lib/api';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getSubscriptionStatus: jest.fn(),
    getQuotaUsage: jest.fn(),
    getOrganization: jest.fn(),
    updateOrganization: jest.fn(),
    cancelSubscription: jest.fn(),
    reactivateSubscription: jest.fn(),
    getBillingPortalUrl: jest.fn(),
  },
}));

// Mock useToast
jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    ToastContainer: () => null,
  }),
}));

describe('BillingPage', () => {
  const mockSubscription = {
    subscriptionTier: 'Pro',
    subscriptionStatus: 'active',
    screenQuota: 25,
    screensUsed: 10,
    trialEndsAt: null,
    currentPeriodEnd: '2026-03-05T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    paymentProvider: 'stripe',
  };

  const mockQuota = {
    screenQuota: 25,
    screensUsed: 10,
    remaining: 15,
    percentUsed: 40,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue(mockSubscription);
    (apiClient.getQuotaUsage as jest.Mock).mockResolvedValue(mockQuota);
    (apiClient.getOrganization as jest.Mock).mockResolvedValue({ id: 'org-1', country: 'US', gstin: null });
  });

  it('renders subscription status', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows current plan', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Current Plan')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });
  });

  it('shows quota usage bar', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Screen Usage')).toBeInTheDocument();
      expect(screen.getByText('10 / 25 screens')).toBeInTheDocument();
      expect(screen.getByText('40% used')).toBeInTheDocument();
      expect(screen.getByText('15 remaining')).toBeInTheDocument();
    });
  });

  it('shows upgrade button for paid plans', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Change Plan' })).toBeInTheDocument();
    });
  });

  it('shows upgrade text for free plan', async () => {
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue({
      ...mockSubscription,
      subscriptionTier: 'Free',
      subscriptionStatus: 'free',
      paymentProvider: null,
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Upgrade' })).toBeInTheDocument();
    });
  });

  it('upgrade button navigates to plans page', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      const upgradeLink = screen.getByRole('link', { name: 'Change Plan' });
      expect(upgradeLink).toHaveAttribute('href', '/dashboard/settings/billing/plans');
    });
  });

  it('shows manage billing button for Stripe users', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Manage Billing/i })).toBeInTheDocument();
    });
  });

  it('shows cancel subscription button for active subscriptions', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel Subscription' })).toBeInTheDocument();
    });
  });

  it('shows reactivate button for canceled subscriptions', async () => {
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue({
      ...mockSubscription,
      cancelAtPeriodEnd: true,
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reactivate Subscription/i })).toBeInTheDocument();
    });
  });

  it('shows trial end date for trialing subscriptions', async () => {
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue({
      ...mockSubscription,
      subscriptionStatus: 'trialing',
      trialEndsAt: '2026-02-20T00:00:00.000Z',
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Trial')).toBeInTheDocument();
      expect(screen.getByText(/Trial ends/)).toBeInTheDocument();
    });
  });

  it('displays loading spinner while fetching data', () => {
    // Delay resolution to see loading state
    (apiClient.getSubscriptionStatus as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSubscription), 100))
    );

    render(<BillingPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows invoice history link', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('View Invoice History')).toBeInTheDocument();
    });
  });

  it('shows compare plans quick link', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Compare Plans')).toBeInTheDocument();
    });
  });
});
