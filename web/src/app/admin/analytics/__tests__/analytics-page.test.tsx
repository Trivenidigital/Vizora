import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/admin/analytics',
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getPlatformStats: jest.fn(),
  },
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  ToastContainer: () => null,
};
jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

jest.mock('../../components/StatCard', () => ({
  StatCard: ({ title, value }: { title: string; value: any }) => (
    <div data-testid={`stat-card-${title}`}>
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ),
}));

import AdminAnalyticsClient from '../page-client';
import { apiClient } from '@/lib/api';

const mockStats = {
  totalOrganizations: 150,
  totalUsers: 1200,
  totalScreens: 500,
  onlineScreens: 450,
  mrr: 25000,
  arr: 300000,
};

describe('AdminAnalyticsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getPlatformStats as jest.Mock).mockResolvedValue(mockStats);
  });

  it('renders loading state when no initial stats', () => {
    render(<AdminAnalyticsClient initialStats={null} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders analytics heading with initial stats', () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Platform metrics and growth insights')).toBeInTheDocument();
  });

  it('renders stat cards with correct data', () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);
    expect(screen.getByTestId('stat-card-Organizations')).toBeInTheDocument();
    expect(screen.getByTestId('stat-card-Total Users')).toBeInTheDocument();
    expect(screen.getByTestId('stat-card-Active Screens')).toBeInTheDocument();
    expect(screen.getByTestId('stat-card-Monthly Revenue')).toBeInTheDocument();
  });

  it('renders revenue metrics section', () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);
    expect(screen.getByText('Revenue Metrics')).toBeInTheDocument();
    expect(screen.getByText('Monthly Recurring Revenue')).toBeInTheDocument();
    expect(screen.getByText('Annual Recurring Revenue')).toBeInTheDocument();
  });

  it('renders platform usage section', () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);
    expect(screen.getByText('Platform Usage')).toBeInTheDocument();
    expect(screen.getByText('Screen Utilization')).toBeInTheDocument();
    expect(screen.getByText('Content Engagement')).toBeInTheDocument();
  });

  it('renders growth trends section', () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);
    expect(screen.getByText('Growth Trends')).toBeInTheDocument();
  });

  it('renders time range selector', () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
  });

  it('fetches stats when time range changes', async () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '7d' } });

    await waitFor(() => {
      expect(apiClient.getPlatformStats).toHaveBeenCalled();
    });
  });

  it('handles API error gracefully', async () => {
    (apiClient.getPlatformStats as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<AdminAnalyticsClient initialStats={null} />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Network error');
    });
  });

  it('formats currency values', () => {
    render(<AdminAnalyticsClient initialStats={mockStats} />);
    const content = document.body.textContent;
    expect(content).toContain('$25,000');
    expect(content).toContain('$300,000');
  });
});
