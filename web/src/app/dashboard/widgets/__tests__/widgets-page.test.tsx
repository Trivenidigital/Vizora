import { render, screen, waitFor } from '@testing-library/react';
import WidgetsPage from '../page';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getWidgetTypes: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({ data: [] }),
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

describe('WidgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    render(<WidgetsPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches widget data on mount', async () => {
    render(<WidgetsPage />);
    const { apiClient } = require('@/lib/api');
    await waitFor(() => {
      expect(apiClient.getWidgetTypes).toHaveBeenCalled();
    });
  });
});
