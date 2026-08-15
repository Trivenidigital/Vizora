import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EntitlementBanner from '../EntitlementBanner';

const mockGetEntitlementBanner = jest.fn();
jest.mock('@/lib/api', () => ({
  apiClient: { getEntitlementBanner: (...a: any[]) => mockGetEntitlementBanner(...a) },
}));

// next/link → plain anchor for assertions
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

const banner = (over: Partial<{ status: string; publishLocked: boolean; daysUntilNextRung: number | null; nextRung: string | null }>) => ({
  status: 'active', publishLocked: false, daysUntilNextRung: null, nextRung: null, ...over,
});

describe('EntitlementBanner (B3 ladder)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing for active/trial/canceled', async () => {
    for (const status of ['active', 'trial', 'canceled', 'unknown']) {
      mockGetEntitlementBanner.mockResolvedValue(banner({ status }));
      const { container } = render(<EntitlementBanner />);
      await waitFor(() => expect(mockGetEntitlementBanner).toHaveBeenCalled());
      expect(container.querySelector('[role="alert"]')).toBeNull();
    }
  });

  it('past_due: shows days-until-publish-lock, screens-still-playing, and is dismissible', async () => {
    mockGetEntitlementBanner.mockResolvedValue(banner({ status: 'past_due', daysUntilNextRung: 5, nextRung: 'publish_locked' }));
    render(<EntitlementBanner />);
    await screen.findByText(/Payment past due/i);
    expect(screen.getByText(/publishing pauses in 5 days/i)).toBeInTheDocument();
    // dismissible
    fireEvent.click(screen.getByLabelText('Dismiss'));
    await waitFor(() => expect(screen.queryByText(/Payment past due/i)).toBeNull());
  });

  it('publish_locked: says screens keep playing but publishing is blocked; NOT dismissible', async () => {
    mockGetEntitlementBanner.mockResolvedValue(banner({ status: 'publish_locked', publishLocked: true, daysUntilNextRung: 7, nextRung: 'suspended' }));
    render(<EntitlementBanner />);
    await screen.findByText(/Publishing paused/i);
    expect(screen.getByText(/screens keep playing/i)).toBeInTheDocument();
    expect(screen.getByText(/Screens pause in 7 days/i)).toBeInTheDocument();
    // NEGATIVE: no dismiss on a load-bearing rung
    expect(screen.queryByLabelText('Dismiss')).toBeNull();
  });

  it('suspended: most urgent, Update Billing CTA, not dismissible', async () => {
    mockGetEntitlementBanner.mockResolvedValue(banner({ status: 'suspended', publishLocked: true }));
    render(<EntitlementBanner />);
    await screen.findByText(/Your screens are paused/i);
    const cta = screen.getByText('Update Billing');
    expect(cta.closest('a')).toHaveAttribute('href', '/dashboard/settings/billing/plans');
    expect(screen.queryByLabelText('Dismiss')).toBeNull();
  });

  // B5 — a failed read must degrade visibly. Silence here is indistinguishable
  // from a healthy account, and the orgs whose read fails are exactly the orgs
  // the ladder exists to warn (#350 semantic model).
  describe('degraded read', () => {
    it('shows an explicit unknown-state notice instead of nothing when the read fails', async () => {
      mockGetEntitlementBanner.mockRejectedValue(new Error('nope'));
      render(<EntitlementBanner />);

      await screen.findByText(/Couldn’t check your subscription status/i);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('never fabricates a benign or ladder state from a failed read', async () => {
      mockGetEntitlementBanner.mockRejectedValue(new Error('nope'));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      // No fabricated tier/OK state, and none of the three ladder rungs.
      expect(screen.queryByText(/Payment past due/i)).toBeNull();
      expect(screen.queryByText(/Publishing paused/i)).toBeNull();
      expect(screen.queryByText(/Your screens are paused/i)).toBeNull();
      expect(screen.queryByText(/\bfree\b/i)).toBeNull();
      expect(screen.queryByText(/up to date|all good|active/i)).toBeNull();
      // The ladder CTA asserts a payment is due — it must not appear here.
      expect(screen.queryByText('Update Payment')).toBeNull();
      expect(screen.queryByText('Update Billing')).toBeNull();
    });

    it('surfaces the captured error message (a boolean-only state loops retries blind)', async () => {
      mockGetEntitlementBanner.mockRejectedValue(new Error('Network request failed'));
      render(<EntitlementBanner />);

      await screen.findByText(/Network request failed/i);
    });

    it('falls back to a generic message when the rejection carries none', async () => {
      mockGetEntitlementBanner.mockRejectedValue('boom');
      render(<EntitlementBanner />);

      await screen.findByText(/The subscription status request failed/i);
    });

    it('retry re-fetches and replaces the degraded notice with the real state', async () => {
      mockGetEntitlementBanner.mockRejectedValueOnce(new Error('nope'));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      mockGetEntitlementBanner.mockResolvedValueOnce(
        banner({ status: 'suspended', publishLocked: true }),
      );
      fireEvent.click(screen.getByText('Retry'));

      await screen.findByText(/Your screens are paused/i);
      expect(screen.queryByText(/Couldn’t check your subscription status/i)).toBeNull();
      expect(mockGetEntitlementBanner).toHaveBeenCalledTimes(2);
    });

    it('a failed retry keeps the degraded notice up rather than blanking the bar', async () => {
      mockGetEntitlementBanner.mockRejectedValue(new Error('still down'));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => expect(mockGetEntitlementBanner).toHaveBeenCalledTimes(2));
      expect(screen.getByText(/Couldn’t check your subscription status/i)).toBeInTheDocument();
    });

    it('is NOT dismissible — it may be masking a rung, and dismissal is silence again', async () => {
      mockGetEntitlementBanner.mockRejectedValue(new Error('nope'));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      expect(screen.queryByLabelText('Dismiss')).toBeNull();
    });
  });
});
