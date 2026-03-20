import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FleetCommandDropdown from '../FleetCommandDropdown';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const mockSendFleetCommand = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    sendFleetCommand: (...args: any[]) => mockSendFleetCommand(...args),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    ToastContainer: () => null,
  }),
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
  });
});
