import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FleetCommandDropdown from '../FleetCommandDropdown';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const mockSendFleetCommand = jest.fn();
const mockToast = {
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  ToastContainer: () => null,
};

jest.mock('@/lib/api', () => ({
  apiClient: {
    sendFleetCommand: (...args: any[]) => mockSendFleetCommand(...args),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

describe('FleetCommandDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dropdown trigger button', () => {
    render(<FleetCommandDropdown organizationId="org-1" />);
    expect(screen.getByText('Fleet Commands')).toBeInTheDocument();
  });

  it('shows dropdown items when clicked', () => {
    render(<FleetCommandDropdown organizationId="org-1" />);
    fireEvent.click(screen.getByText('Fleet Commands'));
    expect(screen.getByText('Reload All Devices')).toBeInTheDocument();
    expect(screen.getByText('Restart All Devices')).toBeInTheDocument();
    expect(screen.getByText('Clear All Caches')).toBeInTheDocument();
  });

  it('opens confirm dialog when item is clicked', () => {
    render(<FleetCommandDropdown organizationId="org-1" />);
    fireEvent.click(screen.getByText('Fleet Commands'));
    fireEvent.click(screen.getByText('Reload All Devices'));
    expect(screen.getByText('This will reload all devices in your organization. Currently playing content may briefly interrupt.')).toBeInTheDocument();
  });

  it('sends correct command on confirm', async () => {
    mockSendFleetCommand.mockResolvedValue({
      commandId: 'cmd-1',
      command: 'reload',
      target: { type: 'organization', id: 'org-1' },
      devicesTargeted: 5,
      devicesOnline: 3,
      devicesQueued: 2,
      devicesDelivered: 3,
      devicesFailed: 0,
    });

    render(<FleetCommandDropdown organizationId="org-1" />);
    fireEvent.click(screen.getByText('Fleet Commands'));
    fireEvent.click(screen.getByText('Reload All Devices'));
    fireEvent.click(screen.getByText('Send Command'));

    await waitFor(() => {
      expect(mockSendFleetCommand).toHaveBeenCalledWith({
        command: 'reload',
        target: { type: 'organization', id: 'org-1' },
      });
    });
    expect(mockToast.success).toHaveBeenCalledWith(
      'Reload All Devices delivered to 3 devices; 2 queued for offline devices',
    );
  });

  it('warns when a fleet command partially fails', async () => {
    mockSendFleetCommand.mockResolvedValue({
      commandId: 'cmd-1',
      command: 'reload',
      target: { type: 'organization', id: 'org-1' },
      devicesTargeted: 5,
      devicesOnline: 4,
      devicesQueued: 0,
      devicesDelivered: 3,
      devicesFailed: 2,
    });

    render(<FleetCommandDropdown organizationId="org-1" />);
    fireEvent.click(screen.getByText('Fleet Commands'));
    fireEvent.click(screen.getByText('Reload All Devices'));
    fireEvent.click(screen.getByText('Send Command'));

    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Reload All Devices reached 3 of 5 devices; 2 failed',
      );
    });
  });

  it('errors when a fleet command fails for every targeted device', async () => {
    mockSendFleetCommand.mockResolvedValue({
      commandId: 'cmd-1',
      command: 'reload',
      target: { type: 'organization', id: 'org-1' },
      devicesTargeted: 2,
      devicesOnline: 0,
      devicesQueued: 0,
      devicesDelivered: 0,
      devicesFailed: 2,
    });

    render(<FleetCommandDropdown organizationId="org-1" />);
    fireEvent.click(screen.getByText('Fleet Commands'));
    fireEvent.click(screen.getByText('Reload All Devices'));
    fireEvent.click(screen.getByText('Send Command'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Reload All Devices failed for all 2 targeted devices',
      );
    });
  });
});
