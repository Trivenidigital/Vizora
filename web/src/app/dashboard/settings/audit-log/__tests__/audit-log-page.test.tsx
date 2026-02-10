import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/dashboard/settings/audit-log',
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getAuditLogs: jest.fn(),
    getUsers: jest.fn(),
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

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmptyState({ title, description }: any) {
    return <div data-testid="empty-state"><span>{title}</span><span>{description}</span></div>;
  };
});

import AuditLogClient from '../page-client';
import { apiClient } from '@/lib/api';

const mockLogs = [
  {
    id: 'log-1',
    action: 'content_created',
    entityType: 'content',
    entityId: 'content-123',
    changes: { title: 'New Banner' },
    ipAddress: '192.168.1.1',
    userAgent: 'Chrome',
    createdAt: '2024-06-15T10:30:00Z',
    userId: 'user-1',
    user: {
      id: 'user-1',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  },
  {
    id: 'log-2',
    action: 'user_invited',
    entityType: 'user',
    entityId: 'user-456',
    changes: null,
    ipAddress: null,
    userAgent: null,
    createdAt: '2024-06-14T09:00:00Z',
    userId: null,
    user: null,
  },
];

const mockUsers = [
  { id: 'user-1', email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
  { id: 'user-2', email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith' },
];

describe('AuditLogClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      data: mockLogs,
      meta: { totalPages: 1, total: 2 },
    });
    (apiClient.getUsers as jest.Mock).mockResolvedValue({ data: mockUsers });
  });

  it('renders audit log heading', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });
  });

  it('renders description with total entries', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText(/Track all actions performed in your organization/)).toBeInTheDocument();
    });
  });

  it('renders export CSV button', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });
  });

  it('renders filter controls', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      // Filter labels appear as label elements
      const labels = screen.getAllByText('Action');
      expect(labels.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
    });
  });

  it('renders table headers', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('Timestamp')).toBeInTheDocument();
      // "Action" appears both as filter label and table header
      const actionElements = screen.getAllByText('Action');
      expect(actionElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Entity ID')).toBeInTheDocument();
      expect(screen.getByText('IP Address')).toBeInTheDocument();
    });
  });

  it('renders user names in log entries', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      // "John Doe" appears in both the table row and potentially the user filter dropdown
      const johnDoeElements = screen.getAllByText('John Doe');
      expect(johnDoeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders "System" for logs without a user', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('renders formatted action labels', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('Content Created')).toBeInTheDocument();
      expect(screen.getByText('User Invited')).toBeInTheDocument();
    });
  });

  it('renders IP address when available', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });
  });

  it('shows View button for logs with changes', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('View')).toBeInTheDocument();
    });
  });

  it('expands changes when View is clicked', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('View')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View'));

    await waitFor(() => {
      expect(screen.getByText('Changes:')).toBeInTheDocument();
      expect(screen.getByText('Hide')).toBeInTheDocument();
    });
  });

  it('shows empty state when no logs', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockResolvedValue({
      data: [],
      meta: { totalPages: 0, total: 0 },
    });

    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No audit log entries')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    (apiClient.getAuditLogs as jest.Mock).mockRejectedValue(new Error('Server error'));

    render(<AuditLogClient />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('shows clear filters button when filters are active', async () => {
    render(<AuditLogClient />);

    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument();
    });

    // Select an action filter
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'content_created' } });

    await waitFor(() => {
      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });
  });
});
