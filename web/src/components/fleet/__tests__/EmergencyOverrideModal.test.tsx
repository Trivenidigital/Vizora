import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmergencyOverrideModal from '../EmergencyOverrideModal';
import { apiClient } from '@/lib/api';

const mockSendFleetCommand = jest.fn();
const mockToast = {
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  ToastContainer: () => null,
};

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: jest.fn().mockResolvedValue({
      data: [{ id: 'content-1', name: 'Emergency Notice', type: 'image' }],
    }),
    getDisplays: jest.fn().mockResolvedValue({ data: [] }),
    getDisplayGroups: jest.fn().mockResolvedValue({ data: [] }),
    sendFleetCommand: (...args: any[]) => mockSendFleetCommand(...args),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

describe('EmergencyOverrideModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    organizationId: 'org-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getContent as jest.Mock).mockResolvedValue({
      data: [{ id: 'content-1', name: 'Emergency Notice', type: 'image' }],
    });
    (apiClient.getDisplays as jest.Mock).mockResolvedValue({ data: [] });
    (apiClient.getDisplayGroups as jest.Mock).mockResolvedValue({ data: [] });
    mockSendFleetCommand.mockResolvedValue({
      commandId: 'cmd-1',
      devicesTargeted: 3,
      devicesOnline: 2,
      devicesQueued: 1,
      devicesDelivered: 2,
      devicesFailed: 0,
    });
  });

  it('renders when isOpen=true', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    expect(screen.getByText('Emergency Content Override')).toBeInTheDocument();
  });

  it('does not render when isOpen=false', () => {
    render(<EmergencyOverrideModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Emergency Content Override')).not.toBeInTheDocument();
  });

  it('defaults duration to 1h (60 minutes)', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    // The 1h pill should have the selected styling (bg-[var(--primary)])
    const oneHourPill = screen.getByText('1h');
    expect(oneHourPill).toBeInTheDocument();
    expect(oneHourPill.className).toContain('bg-[var(--primary)]');
  });

  it('submit button is disabled when no content selected', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    const submitButton = screen.getByText('Push Emergency Content');
    expect(submitButton).toBeDisabled();
  });

  it('shows warning text', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    expect(screen.getByText('This will immediately interrupt current content on targeted devices')).toBeInTheDocument();
  });

  it('shows all duration options', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    expect(screen.getByText('15m')).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
  });

  it('uses delivered and queued counts in emergency override success messaging', async () => {
    render(<EmergencyOverrideModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Emergency Notice (image)' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Content to Push'), {
      target: { value: 'content-1' },
    });
    fireEvent.click(screen.getByText('Push Emergency Content'));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        'Emergency content delivered to 2 devices; 1 queued for offline devices',
      );
    });
  });

  it('loads all paginated content options for emergency override', async () => {
    (apiClient.getContent as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 'content-1', name: 'Emergency Notice', type: 'image' }],
        meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'content-2', name: 'Safety Instructions', type: 'html' }],
        meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
      });

    render(<EmergencyOverrideModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Emergency Notice (image)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Safety Instructions (html)' })).toBeInTheDocument();
    });
    expect(apiClient.getContent).toHaveBeenNthCalledWith(1, { page: 1, limit: 100 });
    expect(apiClient.getContent).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
  });

  it('does not close the modal when no devices match the emergency target', async () => {
    const onClose = jest.fn();
    mockSendFleetCommand.mockResolvedValue({
      commandId: 'cmd-1',
      devicesTargeted: 0,
      devicesOnline: 0,
      devicesQueued: 0,
      devicesDelivered: 0,
      devicesFailed: 0,
    });

    render(<EmergencyOverrideModal {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Emergency Notice (image)' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Content to Push'), {
      target: { value: 'content-1' },
    });
    fireEvent.click(screen.getByText('Push Emergency Content'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Emergency content did not match any devices');
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('warns when emergency override delivery partially fails', async () => {
    mockSendFleetCommand.mockResolvedValue({
      commandId: 'cmd-1',
      devicesTargeted: 3,
      devicesOnline: 2,
      devicesQueued: 0,
      devicesDelivered: 1,
      devicesFailed: 2,
    });

    render(<EmergencyOverrideModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Emergency Notice (image)' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Content to Push'), {
      target: { value: 'content-1' },
    });
    fireEvent.click(screen.getByText('Push Emergency Content'));

    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Emergency content reached 1 of 3 devices; 2 failed',
      );
    });
  });
});
