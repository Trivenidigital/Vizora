import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceDetailPage from '../page';

const mockGetDisplay = jest.fn();
const mockRepairDisplayPairing = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'disp-1' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDisplay: (...args: any[]) => mockGetDisplay(...args),
    repairDisplayPairing: (...args: any[]) => mockRepairDisplayPairing(...args),
  },
}));

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'admin' },
    loading: false,
    isAuthenticated: true,
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() {
    return <span>Loading</span>;
  };
});

jest.mock('@/components/DeviceStatusIndicator', () => {
  return function MockStatus() {
    return <span>status</span>;
  };
});

jest.mock('@/components/devices/DeviceControls', () => ({
  DeviceControls: () => <div data-testid="device-controls" />,
}));

const display = {
  id: 'disp-1',
  nickname: 'Lobby Screen',
  status: 'offline',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
};

describe('DeviceDetailPage — re-pair affordance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplay.mockResolvedValue(display);
    mockRepairDisplayPairing.mockResolvedValue({
      success: true,
      display: { ...display, deviceIdentifier: 'device-2' },
    });
  });

  it('mounts the re-pair panel on the display detail page', async () => {
    render(<DeviceDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Re-pair Display' }),
    ).toBeInTheDocument();
  });

  it('re-reads the display after a successful re-pair, without tearing the page down', async () => {
    render(<DeviceDetailPage />);
    await screen.findByRole('heading', { name: 'Re-pair Display' });
    expect(mockGetDisplay).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Re-pair display' }));
    fireEvent.change(screen.getByLabelText('Pairing code'), {
      target: { value: 'AB12CD' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-pair display' }));

    await waitFor(() =>
      expect(mockRepairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD'),
    );
    // The row is re-read, and the success state survives the refresh — the
    // silent re-read must not swap the page for the full-page spinner.
    await waitFor(() => expect(mockGetDisplay).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Display re-paired',
    );
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('a failed silent re-read does not replace the page with the error view', async () => {
    render(<DeviceDetailPage />);
    await screen.findByRole('heading', { name: 'Re-pair Display' });
    mockGetDisplay.mockRejectedValueOnce(new Error('network down'));

    fireEvent.click(screen.getByRole('button', { name: 'Re-pair display' }));
    fireEvent.change(screen.getByLabelText('Pairing code'), {
      target: { value: 'AB12CD' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-pair display' }));

    const status = await screen.findByRole('status');
    await waitFor(() =>
      expect(status).toHaveTextContent('This page could not be refreshed'),
    );
    expect(screen.queryByText('Device Not Found')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Device Information' }),
    ).toBeInTheDocument();
  });
});
