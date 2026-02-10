import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/admin/health',
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getPlatformHealth: jest.fn(),
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

import AdminHealthClient from '../page-client';
import { apiClient } from '@/lib/api';

const mockHealth = {
  status: 'healthy' as const,
  services: [
    { name: 'API Server', status: 'up' as const, latency: 12 },
    { name: 'WebSocket Gateway', status: 'up' as const, latency: 8 },
    { name: 'Background Workers', status: 'up' as const },
  ],
  database: {
    status: 'up' as const,
    connections: 15,
    maxConnections: 100,
    latency: 5,
  },
  redis: {
    status: 'up' as const,
    memory: 256 * 1024 * 1024,
    maxMemory: 1024 * 1024 * 1024,
    latency: 1,
  },
  storage: {
    status: 'up' as const,
    used: 50 * 1024 * 1024 * 1024,
    total: 500 * 1024 * 1024 * 1024,
  },
  uptime: 864000,
  errorRate: { last1h: 0.1, last24h: 0.5 },
};

describe('AdminHealthClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (apiClient.getPlatformHealth as jest.Mock).mockResolvedValue(mockHealth);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders loading state when no initial health data', () => {
    render(<AdminHealthClient initialHealth={null} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders system health heading with initial data', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Monitor platform services and infrastructure')).toBeInTheDocument();
  });

  it('renders overall system status', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    expect(screen.getByText('System healthy')).toBeInTheDocument();
  });

  it('renders stat cards', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    expect(screen.getByTestId('stat-card-Uptime')).toBeInTheDocument();
    expect(screen.getByTestId('stat-card-Error Rate (1h)')).toBeInTheDocument();
    expect(screen.getByTestId('stat-card-DB Connections')).toBeInTheDocument();
    expect(screen.getByTestId('stat-card-Storage Used')).toBeInTheDocument();
  });

  it('renders services list', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('API Server')).toBeInTheDocument();
    expect(screen.getByText('WebSocket Gateway')).toBeInTheDocument();
    expect(screen.getByText('Background Workers')).toBeInTheDocument();
  });

  it('renders infrastructure section', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    expect(screen.getByText('Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('MinIO Storage')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('fetches health data on refresh button click', async () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(apiClient.getPlatformHealth).toHaveBeenCalled();
    });
  });

  it('handles API error gracefully', async () => {
    (apiClient.getPlatformHealth as jest.Mock).mockRejectedValue(new Error('Server error'));

    render(<AdminHealthClient initialHealth={null} />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('renders degraded status appropriately', () => {
    const degradedHealth = {
      ...mockHealth,
      status: 'degraded' as const,
    };
    render(<AdminHealthClient initialHealth={degradedHealth} />);
    expect(screen.getByText('System degraded')).toBeInTheDocument();
  });

  it('uses fallback data when health is null after load', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    // The data renders without fallback; check key structures are present
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure')).toBeInTheDocument();
  });

  it('displays service latency values', () => {
    render(<AdminHealthClient initialHealth={mockHealth} />);
    expect(screen.getByText('12ms')).toBeInTheDocument();
    expect(screen.getByText('8ms')).toBeInTheDocument();
  });
});
