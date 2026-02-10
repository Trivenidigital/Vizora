import { render, screen, waitFor } from '@testing-library/react';
import LayoutsPage from '../page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/dashboard/layouts',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getLayoutPresets: jest.fn().mockResolvedValue([]),
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

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirm() { return null; };
});

describe('LayoutsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    render(<LayoutsPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders page heading after load', async () => {
    render(<LayoutsPage />);
    await waitFor(() => {
      expect(screen.getByText('Layouts')).toBeInTheDocument();
    });
  });
});
