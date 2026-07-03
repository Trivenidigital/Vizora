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

  it('renders nothing if the endpoint errors (no crash)', async () => {
    mockGetEntitlementBanner.mockRejectedValue(new Error('nope'));
    const { container } = render(<EntitlementBanner />);
    await waitFor(() => expect(mockGetEntitlementBanner).toHaveBeenCalled());
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
