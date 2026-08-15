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

    // The em-dash fallback must never leak into the genuinely-free state.
    // 'Free' appears twice here (tier headline + status badge), so pin the
    // headline itself rather than asserting a single match.
    const freeNodes = screen.getAllByText('Free');
    expect(freeNodes.some((node) => node.className.includes('text-3xl'))).toBe(true);
    expect(screen.queryByText('—')).not.toBeInTheDocument();
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

  it('shows trial end date for trial subscriptions', async () => {
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue({
      ...mockSubscription,
      subscriptionStatus: 'trial',
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

  describe('when the billing data load fails', () => {
    it('shows an error panel instead of fabricating a Free plan with a Cancel action', async () => {
      (apiClient.getSubscriptionStatus as jest.Mock).mockRejectedValue(
        new Error('Service Unavailable')
      );

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load your billing information/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument();
      expect(screen.queryByText('Free')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      // The captured reason must be visible — toasts auto-dismiss, so a
      // permanently failing load would otherwise leave nothing to act on.
      expect(screen.getByText('Service Unavailable')).toBeInTheDocument();
    });

    it('shows the same error panel when only getOrganization rejects', async () => {
      // Promise.all couples all three reads — one rejection blanks the page state.
      (apiClient.getOrganization as jest.Mock).mockRejectedValue(new Error('Boom'));

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load your billing information/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument();
      expect(screen.queryByText('Free')).not.toBeInTheDocument();
    });

    it('hides provider-derived panels when a RE-load fails after a good load', async () => {
      // `subscription` is deliberately not cleared in the catch (it keeps the
      // retry UX intact), so every panel reading from it must sit inside the
      // guard — otherwise stale provider data renders beside the error.
      (apiClient.getSubscriptionStatus as jest.Mock)
        .mockResolvedValueOnce({
          ...mockSubscription,
          paymentProvider: 'razorpay',
          cancelAtPeriodEnd: true,
        })
        .mockRejectedValue(new Error('Service Unavailable'));
      (apiClient.reactivateSubscription as jest.Mock).mockResolvedValue(undefined);

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText(/Payments processed by/i)).toBeInTheDocument();
      });
      expect(screen.getByText('Tax Information')).toBeInTheDocument();

      // Reactivate triggers a re-load; that second read fails.
      fireEvent.click(screen.getByRole('button', { name: /Reactivate Subscription/i }));

      await waitFor(() => {
        expect(screen.getByText(/Unable to load your billing information/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Payments processed by/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Tax Information')).not.toBeInTheDocument();
    });

    it('retry re-invokes the load and renders the plan once it succeeds', async () => {
      (apiClient.getSubscriptionStatus as jest.Mock)
        .mockRejectedValueOnce(new Error('Service Unavailable'))
        .mockResolvedValue(mockSubscription);

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => {
        expect(screen.getByText('Pro')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Unable to load your billing information/i)).not.toBeInTheDocument();
    });
  });

  it('disables plan actions when the provider period data is degraded', async () => {
    // cancelAtPeriodEnd is UNKNOWN on this path, not false — a customer who has
    // already cancelled must not be shown "Cancel Subscription" again.
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue({
      ...mockSubscription,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      degraded: true,
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    expect(screen.getByText(/Subscription details are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Reactivate Subscription/i })
    ).not.toBeInTheDocument();
  });

  it('does not offer Cancel Subscription when the tier field is missing', async () => {
    const { subscriptionTier, ...withoutTier } = mockSubscription;
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue(withoutTier);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Upgrade' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument();
  });

  it('treats a missing subscription as not-paid rather than offering Cancel Subscription', async () => {
    // Pins `isPaidPlan` on its own: absent subscription data must never gate the
    // destructive action footer, independently of the error panel above.
    (apiClient.getSubscriptionStatus as jest.Mock).mockResolvedValue(null);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Upgrade' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
  });
});
