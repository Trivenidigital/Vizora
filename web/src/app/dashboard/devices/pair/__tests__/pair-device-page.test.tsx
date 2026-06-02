import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PairDevicePage from '../page';

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();
const mockCompletePairing = jest.fn();

let mockUser: any = {
  id: 'u1',
  email: 'manager@example.com',
  role: 'manager',
  organizationId: 'org-1',
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    completePairing: (...args: any[]) => mockCompletePairing(...args),
  },
}));

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    isAuthenticated: !!mockUser,
  }),
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
};

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: mockToast.success,
    error: mockToast.error,
    ToastContainer: () => null,
  }),
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <span>Loading</span>; };
});

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true" data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('qrcode.react', () => ({
  QRCodeSVG: () => <div data-testid="qr-code" />,
}));

describe('PairDevicePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockUser = {
      id: 'u1',
      email: 'manager@example.com',
      role: 'manager',
      organizationId: 'org-1',
    };
    mockCompletePairing.mockResolvedValue({ success: true });
  });

  it('blocks viewer users from the direct pairing form', () => {
    mockUser = { ...mockUser, role: 'viewer' };

    render(<PairDevicePage />);

    expect(screen.getByText('Device pairing requires manager or admin access')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Pairing Code/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pair Device' })).not.toBeInTheDocument();
  });

  it('does not show QR autofill success for denied viewer users', () => {
    mockUser = { ...mockUser, role: 'viewer' };
    mockSearchParams = new URLSearchParams('code=ABC123');

    render(<PairDevicePage />);

    expect(screen.getByText('Device pairing requires manager or admin access')).toBeInTheDocument();
    expect(mockToast.success).not.toHaveBeenCalledWith('Code autofilled from QR scan!');
  });

  it('autofills QR code once for managers when the toast hook identity changes', async () => {
    mockSearchParams = new URLSearchParams('code=abc123');

    render(<PairDevicePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Pairing Code/i)).toHaveValue('ABC123');
    });
    expect(mockToast.success).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledWith('Code autofilled from QR scan!');
  });

  it('allows managers to complete pairing', async () => {
    render(<PairDevicePage />);

    fireEvent.change(screen.getByLabelText(/Pairing Code/i), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText(/Device Name/i), { target: { value: 'Lobby Display' } });
    fireEvent.change(screen.getByLabelText(/Location/i), { target: { value: 'Lobby' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pair Device' }));

    await waitFor(() => {
      expect(mockCompletePairing).toHaveBeenCalledWith({
        code: 'ABC123',
        nickname: 'Lobby Display',
        location: 'Lobby',
      });
    });
  });
});
