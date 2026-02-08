import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBadge } from '../components/status-badge';
import { QuotaBar } from '../components/quota-bar';
import { PlanCard } from '../components/plan-card';
import type { Plan } from '@/lib/types';

describe('StatusBadge', () => {
  it('renders active status correctly', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Active')).toHaveClass('bg-green-500/10');
  });

  it('renders trialing status correctly', () => {
    render(<StatusBadge status="trialing" />);
    expect(screen.getByText('Trial')).toBeInTheDocument();
    expect(screen.getByText('Trial')).toHaveClass('bg-[#00B4D8]/10');
  });

  it('renders past_due status correctly', () => {
    render(<StatusBadge status="past_due" />);
    expect(screen.getByText('Past Due')).toBeInTheDocument();
    expect(screen.getByText('Past Due')).toHaveClass('bg-yellow-500/10');
  });

  it('renders canceled status correctly', () => {
    render(<StatusBadge status="canceled" />);
    expect(screen.getByText('Canceled')).toBeInTheDocument();
    expect(screen.getByText('Canceled')).toHaveClass('bg-[var(--surface-hover)]');
  });

  it('renders paid invoice status correctly', () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toHaveClass('bg-green-500/10');
  });

  it('renders open invoice status correctly', () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Open')).toHaveClass('bg-yellow-500/10');
  });

  it('handles unknown status gracefully', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('Unknown status')).toBeInTheDocument();
  });

  it('capitalizes and formats snake_case statuses', () => {
    render(<StatusBadge status="incomplete_expired" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});

describe('QuotaBar', () => {
  it('renders with label', () => {
    render(<QuotaBar used={10} total={25} label="Screen Usage" />);
    expect(screen.getByText('Screen Usage')).toBeInTheDocument();
  });

  it('shows correct usage numbers', () => {
    render(<QuotaBar used={10} total={25} label="Test" />);
    expect(screen.getByText('10 / 25 screens')).toBeInTheDocument();
  });

  it('calculates percentage correctly', () => {
    render(<QuotaBar used={10} total={25} label="Test" />);
    expect(screen.getByText('40% used')).toBeInTheDocument();
  });

  it('shows remaining count', () => {
    render(<QuotaBar used={10} total={25} label="Test" />);
    expect(screen.getByText('15 remaining')).toBeInTheDocument();
  });

  it('shows green color for normal usage', () => {
    const { container } = render(<QuotaBar used={10} total={25} />);
    const progressBar = container.querySelector('.bg-\\[\\#00E5A0\\]');
    expect(progressBar).toBeInTheDocument();
  });

  it('shows yellow color for 75%+ usage', () => {
    const { container } = render(<QuotaBar used={80} total={100} />);
    const progressBar = container.querySelector('.bg-yellow-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('shows red color for 90%+ usage', () => {
    const { container } = render(<QuotaBar used={95} total={100} />);
    const progressBar = container.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('handles zero total gracefully', () => {
    render(<QuotaBar used={0} total={0} label="Test" />);
    expect(screen.getByText('0% used')).toBeInTheDocument();
  });

  it('caps percentage at 100%', () => {
    render(<QuotaBar used={150} total={100} label="Test" />);
    expect(screen.getByText('100% used')).toBeInTheDocument();
  });
});

describe('PlanCard', () => {
  const mockPlan: Plan = {
    id: 'pro',
    name: 'Pro',
    screenQuota: 25,
    price: 99,
    currency: 'USD',
    interval: 'monthly',
    features: ['25 screens', 'Priority support', 'API access'],
    isCurrent: false,
  };

  const mockOnSelect = jest.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('renders plan name', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('formats USD price correctly', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText('$99.00')).toBeInTheDocument();
  });

  it('formats INR price correctly', () => {
    const inrPlan = { ...mockPlan, price: 7999, currency: 'INR' };
    render(<PlanCard plan={inrPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText(/7,999/)).toBeInTheDocument();
  });

  it('shows screen quota', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText(/Up to 25 screens/)).toBeInTheDocument();
  });

  it('shows features', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText('25 screens')).toBeInTheDocument();
    expect(screen.getByText('Priority support')).toBeInTheDocument();
    expect(screen.getByText('API access')).toBeInTheDocument();
  });

  it('shows "Current Plan" badge when isCurrentPlan is true', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={true} />);
    // "Current Plan" appears twice - as badge and as disabled button
    const currentPlanElements = screen.getAllByText('Current Plan');
    expect(currentPlanElements.length).toBe(2);
  });

  it('disables button for current plan', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={true} />);
    const button = screen.getByRole('button', { name: 'Current Plan' });
    expect(button).toBeDisabled();
  });

  it('calls onSelect when Select Plan button is clicked', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Plan' }));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner when isLoading is true', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} isLoading={true} />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('disables button when loading', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} isLoading={true} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows "Free" for zero price plans', () => {
    const freePlan = { ...mockPlan, price: 0 };
    render(<PlanCard plan={freePlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows "Downgrade" button for free plans', () => {
    const freePlan = { ...mockPlan, price: 0 };
    render(<PlanCard plan={freePlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByRole('button', { name: 'Downgrade' })).toBeInTheDocument();
  });

  it('shows "Contact Sales" for enterprise plan', () => {
    const enterprisePlan = { ...mockPlan, name: 'Enterprise' };
    render(<PlanCard plan={enterprisePlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    // Contact Sales is a link for enterprise plan
    expect(screen.getByRole('link', { name: 'Contact Sales' })).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('shows "Unlimited screens" for enterprise plan', () => {
    const enterprisePlan = { ...mockPlan, name: 'Enterprise' };
    render(<PlanCard plan={enterprisePlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText('Unlimited screens')).toBeInTheDocument();
  });

  it('shows billing interval', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText('/month')).toBeInTheDocument();
  });

  it('shows yearly interval', () => {
    const yearlyPlan = { ...mockPlan, interval: 'yearly' };
    render(<PlanCard plan={yearlyPlan} onSelect={mockOnSelect} isCurrentPlan={false} />);
    expect(screen.getByText('/year')).toBeInTheDocument();
  });
});
