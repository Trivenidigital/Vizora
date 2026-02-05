import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DevicePreviewModal from '../DevicePreviewModal';
import { apiClient } from '@/lib/api';
import { useSocket } from '@/lib/hooks/useSocket';
import { useToast } from '@/lib/hooks/useToast';

// Mock dependencies
jest.mock('@/lib/api');
jest.mock('@/lib/hooks/useSocket');
jest.mock('@/lib/hooks/useToast');

describe('DevicePreviewModal', () => {
  const mockDevice = {
    id: 'device-123',
    nickname: 'Test Display',
    deviceId: 'device-abc',
    location: 'Conference Room',
    status: 'online' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockScreenshot = {
    url: 'https://example.com/screenshot.png',
    capturedAt: '2026-02-05T10:00:00Z',
    width: 1920,
    height: 1080,
  };

  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  };

  const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.on.mockReturnValue(mockSocket);
    mockSocket.off.mockReturnValue(mockSocket);
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });
    (useToast as jest.Mock).mockReturnValue(mockToast);
    (apiClient.getDeviceScreenshot as jest.Mock).mockResolvedValue(mockScreenshot);
    (apiClient.requestDeviceScreenshot as jest.Mock).mockResolvedValue({
      requestId: 'request-123',
      status: 'pending',
    });
  });

  it('renders device info', async () => {
    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Test Display')).toBeInTheDocument();
    // Location text is joined with bullet point, so check partial match
    expect(screen.getByText(/Conference Room/)).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows last screenshot if available', async () => {
    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(apiClient.getDeviceScreenshot).toHaveBeenCalledWith('device-123');
    });

    await waitFor(() => {
      const img = screen.getByAltText('Screenshot of Test Display');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', mockScreenshot.url);
    });
  });

  it('shows loading state', () => {
    (apiClient.getDeviceScreenshot as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument(); // LoadingSpinner has role="status"
  });

  it('refresh button triggers new request', async () => {
    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh screenshot/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(apiClient.requestDeviceScreenshot).toHaveBeenCalledWith('device-123');
    });

    expect(mockToast.info).toHaveBeenCalledWith('Screenshot request sent to device...');
  });

  it('handles offline device', () => {
    const offlineDevice = { ...mockDevice, status: 'offline' as const };

    render(
      <DevicePreviewModal
        device={offlineDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText(/device is currently offline/i)).toBeInTheDocument();
  });

  it('shows timestamp of screenshot', async () => {
    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/captured:/i)).toBeInTheDocument();
    });
  });

  it('closes on button click', async () => {
    const onClose = jest.fn();

    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const closeButton = screen.getByText('Close').closest('button');
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sets up socket listener for screenshot:ready events', async () => {
    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('screenshot:ready', expect.any(Function));
    });
  });

  it('shows error state when screenshot load fails', async () => {
    (apiClient.getDeviceScreenshot as jest.Mock).mockRejectedValue(
      new Error('Failed to load screenshot')
    );

    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load screenshot')).toBeInTheDocument();
    });
  });

  it('shows error when refresh fails', async () => {
    (apiClient.requestDeviceScreenshot as jest.Mock).mockRejectedValue(
      new Error('Request failed')
    );

    render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(apiClient.getDeviceScreenshot).toHaveBeenCalled();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh screenshot/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to request screenshot');
    });
  });

  it('disables refresh button for offline device', () => {
    const offlineDevice = { ...mockDevice, status: 'offline' as const };

    render(
      <DevicePreviewModal
        device={offlineDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const refreshButton = screen.getByRole('button', { name: /refresh screenshot/i });
    expect(refreshButton).toBeDisabled();
  });

  it('prevents refresh request on offline device', async () => {
    const offlineDevice = { ...mockDevice, status: 'offline' as const };

    render(
      <DevicePreviewModal
        device={offlineDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const refreshButton = screen.getByRole('button', { name: /refresh screenshot/i });

    // Try to click (won't work because disabled)
    fireEvent.click(refreshButton);

    // Should not have made API call
    expect(apiClient.requestDeviceScreenshot).not.toHaveBeenCalled();
  });

  it('cleans up socket listeners on unmount', async () => {
    const { unmount } = render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('screenshot:ready', expect.any(Function));
  });

  it('reloads screenshot when modal reopens', async () => {
    const { rerender } = render(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(apiClient.getDeviceScreenshot).toHaveBeenCalledTimes(1);
    });

    // Close modal
    rerender(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={false}
        onClose={jest.fn()}
      />
    );

    // Reopen modal
    rerender(
      <DevicePreviewModal
        device={mockDevice}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    // Should reload screenshot
    await waitFor(() => {
      expect(apiClient.getDeviceScreenshot).toHaveBeenCalledTimes(2);
    });
  });
});
