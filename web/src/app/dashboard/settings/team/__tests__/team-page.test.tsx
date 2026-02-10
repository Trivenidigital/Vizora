import { render, screen, waitFor } from '@testing-library/react';
import TeamClient from '../page-client';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getUsers: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'u1',
          email: 'admin@test.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true,
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: { total: 1, totalPages: 1 },
    }),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    ToastContainer: () => null,
  }),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title }: any) { return <div>{title || 'No items'}</div>; };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children }: any) { return isOpen ? <div>{children}</div> : null; };
});

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirm() { return null; };
});

describe('TeamClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    render(<TeamClient />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches team members on mount', async () => {
    render(<TeamClient />);
    const { apiClient } = require('@/lib/api');
    await waitFor(() => {
      expect(apiClient.getUsers).toHaveBeenCalled();
    });
  });
});
