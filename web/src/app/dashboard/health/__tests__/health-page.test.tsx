import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/dashboard/health',
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDisplays: jest.fn(),
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

jest.mock('@/lib/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: () => ({
    isConnected: false,
    isOffline: true,
  }),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmptyState({ title, description }: { title: string; description: string }) {
    return <div data-testid="empty-state"><span>{title}</span><span>{description}</span></div>;
  };
});

jest.mock('@/components/SearchFilter', () => {
  return function MockSearchFilter({ placeholder }: { placeholder: string }) {
    return <input data-testid="search-filter" placeholder={placeholder} />;
  };
});

jest.mock('@/components/DeviceHealthMonitor', () => {
  const MockMonitor = () => <div data-testid="device-health-monitor">Health Monitor</div>;
  MockMonitor.DeviceHealth = {};
  return {
    __esModule: true,
    default: MockMonitor,
  };
});

import HealthMonitoringClient from '../page-client';
import { apiClient } from '@/lib/api';

const mockDevices = [
  {
    id: 'device-1',
    nickname: 'Lobby Screen',
    location: 'Building A',
    organizationId: 'org-1',
    pairingCode: 'ABC',
    status: 'online',
    isOnline: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'device-2',
    nickname: 'Meeting Room',
    location: 'Floor 2',
    organizationId: 'org-1',
    pairingCode: 'DEF',
    status: 'online',
    isOnline: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

describe('HealthMonitoringClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: mockDevices });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders heading', async () => {
    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByText('Device Health')).toBeInTheDocument();
    });
  });

  it('renders health description', async () => {
    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByText(/Monitor device performance and system health/)).toBeInTheDocument();
    });
  });

  it('renders refresh button', async () => {
    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('renders health statistics cards', async () => {
    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByText('Total Devices')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('Warnings')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  it('renders search filter', async () => {
    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByTestId('search-filter')).toBeInTheDocument();
    });
  });

  it('renders sort controls', async () => {
    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByText('Sort by Health')).toBeInTheDocument();
    });
  });

  it('shows empty state when no devices', async () => {
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: [] });

    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No devices found')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (apiClient.getDisplays as jest.Mock).mockRejectedValue(new Error('Connection failed'));

    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Connection failed');
    });
  });

  it('displays device names after loading', async () => {
    render(<HealthMonitoringClient />);

    await waitFor(() => {
      expect(screen.getByText('Lobby Screen')).toBeInTheDocument();
      expect(screen.getByText('Meeting Room')).toBeInTheDocument();
    });
  });
});
