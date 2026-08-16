import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import TrialBanner from '../TrialBanner';

const mockGetSubscriptionStatus = jest.fn();
jest.mock('@/lib/api', () => ({
  apiClient: { getSubscriptionStatus: (...a: any[]) => mockGetSubscriptionStatus(...a) },
}));

// next/link → plain anchor for assertions
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

const status = (over: Partial<Record<string, unknown>> = {}) => ({
  subscriptionTier: 'pro',
  subscriptionStatus: 'active',
  screenQuota: 25,
  screensUsed: 3,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  paymentProvider: 'stripe',
  ...over,
});

describe('TrialBanner', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('successful read (unchanged behaviour)', () => {
    it('renders nothing for a healthy paid account', async () => {
      mockGetSubscriptionStatus.mockResolvedValue(status());
      const { container } = render(<TrialBanner />);

      await waitFor(() => expect(mockGetSubscriptionStatus).toHaveBeenCalled());
      expect(container.querySelector('div')).toBeNull();
    });

    it('renders the ended-trial warning for a canceled free-tier org', async () => {
      mockGetSubscriptionStatus.mockResolvedValue(
        status({ subscriptionStatus: 'canceled', subscriptionTier: 'free' }),
      );
      render(<TrialBanner />);

      await screen.findByText(/Your free trial has ended/i);
      expect(screen.getByText('Upgrade Now').closest('a')).toHaveAttribute(
        'href',
        '/dashboard/settings/billing/plans',
      );
    });

    it('renders the ended-trial warning when a trial end date has passed', async () => {
      mockGetSubscriptionStatus.mockResolvedValue(
        status({ subscriptionStatus: 'trial', subscriptionTier: 'free', trialEndsAt: inDays(-1) }),
      );
      render(<TrialBanner />);

      await screen.findByText(/Your free trial has ended/i);
    });

    it('renders the urgent trial warning with days remaining', async () => {
      mockGetSubscriptionStatus.mockResolvedValue(
        status({ subscriptionStatus: 'trial', subscriptionTier: 'free', trialEndsAt: inDays(3) }),
      );
      render(<TrialBanner />);

      await screen.findByText(/Free Trial/i);
      expect(screen.getByText(/3 days remaining/i)).toBeInTheDocument();
    });

    // The server's own degraded sentinel is scoped to the PROVIDER read
    // (currentPeriodEnd / cancelAtPeriodEnd). subscriptionStatus, tier and
    // trialEndsAt still come from our database, so this banner's inputs are
    // untouched by it — degrading here would fabricate an alarm.
    it("renders the real trial state even when the server flags `degraded`", async () => {
      mockGetSubscriptionStatus.mockResolvedValue(
        status({
          degraded: true,
          subscriptionStatus: 'canceled',
          subscriptionTier: 'free',
        }),
      );
      render(<TrialBanner />);

      await screen.findByText(/Your free trial has ended/i);
      expect(screen.queryByText(/Couldn’t check your trial status/i)).toBeNull();
    });
  });

  // B5b — a failed read must degrade visibly. Silence here is indistinguishable
  // from a healthy account, and the orgs whose read fails are exactly the orgs
  // whose trial expiry this banner exists to warn about (#355 semantic model).
  describe('degraded read', () => {
    it('shows an explicit unknown-state notice instead of nothing when the read fails', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new Error('nope'));
      render(<TrialBanner />);

      await screen.findByText(/Couldn’t check your trial status/i);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('never fabricates a benign state or trial data from a failed read', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new Error('nope'));
      render(<TrialBanner />);
      await screen.findByText(/Couldn’t check your trial status/i);

      // No fabricated trial state, no fabricated day count, no upgrade CTA
      // (which would assert we know the account needs one).
      expect(screen.queryByText(/Your free trial has ended/i)).toBeNull();
      expect(screen.queryByText(/Free Trial/i)).toBeNull();
      expect(screen.queryByText(/days? remaining/i)).toBeNull();
      expect(screen.queryByText('Upgrade Now')).toBeNull();
      expect(screen.queryByText('Upgrade')).toBeNull();
      expect(screen.queryByText('View Plans')).toBeNull();
    });

    it('surfaces the captured error message (a boolean-only state loops retries blind)', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new Error('Network request failed'));
      render(<TrialBanner />);

      await screen.findByText(/Network request failed/i);
    });

    it('falls back to a generic message when the rejection carries none', async () => {
      mockGetSubscriptionStatus.mockRejectedValue('boom');
      render(<TrialBanner />);

      await screen.findByText(/The subscription status request failed/i);
    });

    it('retry re-fetches and replaces the degraded notice with the real state', async () => {
      mockGetSubscriptionStatus.mockRejectedValueOnce(new Error('nope'));
      render(<TrialBanner />);
      await screen.findByText(/Couldn’t check your trial status/i);

      mockGetSubscriptionStatus.mockResolvedValueOnce(
        status({ subscriptionStatus: 'canceled', subscriptionTier: 'free' }),
      );
      fireEvent.click(screen.getByText('Retry'));

      await screen.findByText(/Your free trial has ended/i);
      expect(screen.queryByText(/Couldn’t check your trial status/i)).toBeNull();
      expect(mockGetSubscriptionStatus).toHaveBeenCalledTimes(2);
    });

    it('holds the notice while a retry is IN FLIGHT (error clears on success, not on attempt)', async () => {
      mockGetSubscriptionStatus.mockRejectedValueOnce(new Error('still down'));
      render(<TrialBanner />);
      await screen.findByText(/Couldn’t check your trial status/i);

      // The retry is held open deliberately. `mockRejectedValue` alone cannot
      // pin this behaviour: a clear-on-ATTEMPT implementation would blank the
      // notice and re-set the error in the very next microtask, so the assertion
      // would pass either way. Holding the promise open is what separates them —
      // clear-on-attempt blanks the bar right here, while it is still in flight.
      let rejectRetry!: (err: Error) => void;
      mockGetSubscriptionStatus.mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectRetry = reject;
        }),
      );
      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => expect(mockGetSubscriptionStatus).toHaveBeenCalledTimes(2));
      expect(screen.getByText(/Couldn’t check your trial status/i)).toBeInTheDocument();

      // ...and it survives the retry's own failure rather than blanking the bar.
      await act(async () => {
        rejectRetry(new Error('still down'));
      });
      expect(screen.getByText(/Couldn’t check your trial status/i)).toBeInTheDocument();
    });

    // A dropped connection rejects fetch with a plain TypeError, which the API
    // client does NOT retry — so the non-dismissible notice needs a self-heal.
    it('re-reads on network restore so the notice does not outlive the outage', async () => {
      mockGetSubscriptionStatus.mockRejectedValueOnce(new Error('Failed to fetch'));
      render(<TrialBanner />);
      await screen.findByText(/Couldn’t check your trial status/i);

      mockGetSubscriptionStatus.mockResolvedValueOnce(status());
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() =>
        expect(screen.queryByText(/Couldn’t check your trial status/i)).toBeNull(),
      );
      expect(mockGetSubscriptionStatus).toHaveBeenCalledTimes(2);
    });

    it('removes the online listener on unmount', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new Error('nope'));
      const { unmount } = render(<TrialBanner />);
      await screen.findByText(/Couldn’t check your trial status/i);

      unmount();
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      expect(mockGetSubscriptionStatus).toHaveBeenCalledTimes(1);
    });

    it('is NOT dismissible — it may be masking an ended trial, and dismissal is silence again', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new Error('nope'));
      render(<TrialBanner />);
      await screen.findByText(/Couldn’t check your trial status/i);

      expect(screen.queryByLabelText('Dismiss')).toBeNull();
    });
  });
});
