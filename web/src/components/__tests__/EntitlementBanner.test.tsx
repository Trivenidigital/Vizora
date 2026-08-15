import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

  // NB: 'unknown' is deliberately NOT in this list — it is the server's degraded
  // sentinel, not a healthy state. See the degraded-read block below.
  it('renders nothing for active/trial/canceled', async () => {
    for (const status of ['active', 'trial', 'canceled']) {
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

    it('holds the notice while a retry is IN FLIGHT (error clears on success, not on attempt)', async () => {
      mockGetEntitlementBanner.mockRejectedValueOnce(new Error('still down'));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      // The retry is held open deliberately. `mockRejectedValue` alone cannot
      // pin this behaviour: a clear-on-ATTEMPT implementation would blank the
      // notice and re-set the error in the very next microtask, so the assertion
      // would pass either way. Holding the promise open is what separates them —
      // clear-on-attempt blanks the bar right here, while it is still in flight.
      let rejectRetry!: (err: Error) => void;
      mockGetEntitlementBanner.mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectRetry = reject;
        }),
      );
      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => expect(mockGetEntitlementBanner).toHaveBeenCalledTimes(2));
      expect(screen.getByText(/Couldn’t check your subscription status/i)).toBeInTheDocument();

      // ...and it survives the retry's own failure rather than blanking the bar.
      await act(async () => {
        rejectRetry(new Error('still down'));
      });
      expect(screen.getByText(/Couldn’t check your subscription status/i)).toBeInTheDocument();
    });

    // The server has its OWN degraded sentinel: getBannerState returns status
    // 'unknown' when it cannot read the org row. Rendering nothing for it is the
    // same silent failure one layer back.
    it("treats the server's status:'unknown' sentinel as degraded, not as healthy", async () => {
      mockGetEntitlementBanner.mockResolvedValue(banner({ status: 'unknown' }));
      render(<EntitlementBanner />);

      await screen.findByText(/Couldn’t check your subscription status/i);
      expect(screen.getByText(/couldn’t determine your account’s billing state/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it("retry recovers from status:'unknown' once the server can determine the state", async () => {
      mockGetEntitlementBanner.mockResolvedValueOnce(banner({ status: 'unknown' }));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      mockGetEntitlementBanner.mockResolvedValueOnce(
        banner({ status: 'publish_locked', publishLocked: true, daysUntilNextRung: 7, nextRung: 'suspended' }),
      );
      fireEvent.click(screen.getByText('Retry'));

      await screen.findByText(/Publishing paused/i);
      expect(screen.queryByText(/Couldn’t check your subscription status/i)).toBeNull();
    });

    // A dropped connection rejects fetch with a plain TypeError, which the API
    // client does NOT retry — so the non-dismissible notice needs a self-heal.
    it('re-reads on network restore so the notice does not outlive the outage', async () => {
      mockGetEntitlementBanner.mockRejectedValueOnce(new Error('Failed to fetch'));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      mockGetEntitlementBanner.mockResolvedValueOnce(banner({ status: 'active' }));
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() =>
        expect(screen.queryByText(/Couldn’t check your subscription status/i)).toBeNull(),
      );
      expect(mockGetEntitlementBanner).toHaveBeenCalledTimes(2);
    });

    it('removes the online listener on unmount', async () => {
      mockGetEntitlementBanner.mockRejectedValue(new Error('nope'));
      const { unmount } = render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      unmount();
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      expect(mockGetEntitlementBanner).toHaveBeenCalledTimes(1);
    });

    it('is NOT dismissible — it may be masking a rung, and dismissal is silence again', async () => {
      mockGetEntitlementBanner.mockRejectedValue(new Error('nope'));
      render(<EntitlementBanner />);
      await screen.findByText(/Couldn’t check your subscription status/i);

      expect(screen.queryByLabelText('Dismiss')).toBeNull();
    });
  });
});
