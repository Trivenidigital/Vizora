/**
 * NOTE: These tests fail because the page component is async (server-component style)
 * but renders as a Client Component in jsdom, producing an empty <div />.
 * This is a known issue tied to the RSC migration deferral.
 * Tests will be fixed when the page is refactored to proper RSC architecture.
 */
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

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getPlatformStats: jest.fn(),
  },
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

import AdminDashboardPage from '../page';
import { apiClient } from '@/lib/api';

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
    (apiClient.getPlatformStats as jest.Mock).mockResolvedValue(mockStats);
  });

  it('renders loading state initially', () => {
    render(<AdminDashboardPage />);
    // Should show loading spinner initially
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders dashboard with stats after loading', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });

    // Check that stats are displayed
    expect(screen.getByText('Total Organizations')).toBeInTheDocument();
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Total Screens')).toBeInTheDocument();
  });

  it('displays quick action links', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    expect(screen.getByText('Manage Plans')).toBeInTheDocument();
    expect(screen.getByText('Promotions')).toBeInTheDocument();
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Announcements')).toBeInTheDocument();
  });

  it('formats currency correctly', async () => {
    render(<AdminDashboardPage />);

    // Wait for loading to complete and dashboard to render
    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });

    // Wait for stats to load and render
    await waitFor(() => {
      const content = document.body.textContent;
      expect(content).toContain('$25,000');
    }, { timeout: 2000 });
  });

  it('calculates screen uptime rate correctly', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Screen Status')).toBeInTheDocument();
    });

    // 450/500 = 90%
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const mockError = new Error('Failed to load');
    (apiClient.getPlatformStats as jest.Mock).mockRejectedValue(mockError);

    render(<AdminDashboardPage />);

    await waitFor(() => {
      // Should still render the page structure
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
  });
});
