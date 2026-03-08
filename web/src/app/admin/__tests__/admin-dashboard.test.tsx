import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/admin',
}));

// Mock useAuth hook
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'admin@test.com', isSuperAdmin: true },
    loading: false,
  }),
}));

// Mock useToast hook
jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    ToastContainer: () => null,
  }),
}));

// Import the Client Component directly (not the async Server Component page)
import AdminDashboardClient from '../page-client';

const mockStats = {
  totalOrganizations: 150,
  totalUsers: 1200,
  totalScreens: 500,
  onlineScreens: 450,
  mrr: 25000,
  arr: 300000,
};

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with stats', () => {
    render(<AdminDashboardClient initialStats={mockStats} />);

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Organizations')).toBeInTheDocument();
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Total Screens')).toBeInTheDocument();
  });

  it('displays quick action links', () => {
    render(<AdminDashboardClient initialStats={mockStats} />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Manage Plans')).toBeInTheDocument();
    expect(screen.getByText('Promotions')).toBeInTheDocument();
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Announcements')).toBeInTheDocument();
  });

  it('formats currency correctly', () => {
    render(<AdminDashboardClient initialStats={mockStats} />);

    const content = document.body.textContent;
    expect(content).toContain('$25,000');
  });

  it('calculates screen uptime rate correctly', () => {
    render(<AdminDashboardClient initialStats={mockStats} />);

    expect(screen.getByText('Screen Status')).toBeInTheDocument();
    // 450/500 = 90%
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('handles null stats gracefully', () => {
    render(<AdminDashboardClient initialStats={null} />);

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    // Should show 0 values when stats are null
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
