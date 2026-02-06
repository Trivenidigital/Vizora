import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlansPage from '../plans/page';
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
    getPlans: jest.fn(),
    createCheckout: jest.fn(),
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

describe('PlansPage', () => {
  const mockPlans = [
    {
      id: 'free',
      name: 'Free',
      screenQuota: 2,
      price: 0,
      currency: 'USD',
      interval: 'monthly',
      features: ['2 screens', 'Basic support'],
      isCurrent: false,
    },
    {
      id: 'basic',
      name: 'Basic',
      screenQuota: 5,
      price: 29,
      currency: 'USD',
      interval: 'monthly',
      features: ['5 screens', 'Email support', 'Basic analytics'],
      isCurrent: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      screenQuota: 25,
      price: 99,
      currency: 'USD',
      interval: 'monthly',
      features: ['25 screens', 'Priority support', 'Advanced analytics', 'API access'],
      isCurrent: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      screenQuota: 1000,
      price: 0,
      currency: 'USD',
      interval: 'monthly',
      features: ['Unlimited screens', 'Dedicated support', 'Custom integrations', 'SLA'],
      isCurrent: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getPlans as jest.Mock).mockResolvedValue(mockPlans);
  });

  it('renders all plan cards', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      // Check for plan names in the heading elements
      expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Basic' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument();
    });
  });

  it('current plan is highlighted', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      // The Pro plan should show "Current Plan" badge and button
      const currentPlanElements = screen.getAllByText('Current Plan');
      expect(currentPlanElements.length).toBeGreaterThan(0);
    });
  });

  it('shows plan features', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText('5 screens')).toBeInTheDocument();
      expect(screen.getByText('Priority support')).toBeInTheDocument();
      expect(screen.getByText('API access')).toBeInTheDocument();
    });
  });

  it('shows screen quotas', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText(/Up to 2 screen/)).toBeInTheDocument();
      expect(screen.getByText(/Up to 5 screens/)).toBeInTheDocument();
      expect(screen.getByText(/Up to 25 screens/)).toBeInTheDocument();
    });
  });

  it('enterprise shows contact sales', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      // Contact Sales appears twice - in the enterprise card and the bottom CTA
      const contactLinks = screen.getAllByRole('link', { name: 'Contact Sales' });
      expect(contactLinks.length).toBeGreaterThan(0);
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  it('enterprise shows unlimited screens', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      // Enterprise shows "Unlimited screens" in the quota section and may have it in features too
      const unlimitedTexts = screen.getAllByText('Unlimited screens');
      expect(unlimitedTexts.length).toBeGreaterThan(0);
    });
  });

  it('current plan button is disabled', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      // Find the button inside the Pro plan card
      const currentPlanButton = screen.getByRole('button', { name: 'Current Plan' });
      expect(currentPlanButton).toBeDisabled();
    });
  });

  it('select button triggers checkout', async () => {
    (apiClient.createCheckout as jest.Mock).mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
      sessionId: 'sess_123',
    });

    // Mock window.location.href setter
    const hrefSetter = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
    });

    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Basic')).toBeInTheDocument();
    });

    // Find and click the Select Plan button for Basic plan
    const selectButtons = screen.getAllByRole('button', { name: 'Select Plan' });
    fireEvent.click(selectButtons[0]);

    await waitFor(() => {
      expect(apiClient.createCheckout).toHaveBeenCalledWith('basic', 'monthly');
    });
  });

  it('shows billing interval toggle', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Monthly' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Yearly/ })).toBeInTheDocument();
    });
  });

  it('shows save 20% badge on yearly toggle', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Save 20%')).toBeInTheDocument();
    });
  });

  it('updates prices when switching to yearly billing', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText('$29.00')).toBeInTheDocument();
    });

    // Click yearly toggle
    fireEvent.click(screen.getByRole('button', { name: /Yearly/ }));

    await waitFor(() => {
      // 29 * 12 * 0.8 = 278.4 rounded to 278
      expect(screen.getByText('$278.00')).toBeInTheDocument();
    });
  });

  it('shows free plan as downgrade option', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Downgrade')).toBeInTheDocument();
    });
  });

  it('displays loading spinner while fetching plans', () => {
    // Delay resolution to see loading state
    (apiClient.getPlans as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockPlans), 100))
    );

    render(<PlansPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows FAQ section', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
      expect(screen.getByText('Can I change plans later?')).toBeInTheDocument();
      expect(screen.getByText('What happens if I exceed my screen quota?')).toBeInTheDocument();
    });
  });

  it('shows enterprise CTA section', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Need more than 100 screens?')).toBeInTheDocument();
    });
  });

  it('shows back button to billing page', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: '' }); // The chevron link
      expect(backLink).toHaveAttribute('href', '/dashboard/settings/billing');
    });
  });
});
