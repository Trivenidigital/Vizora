import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeviceControls } from './DeviceControls';
import { apiClient } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiClient: {
    sendFleetCommand: jest.fn(),
  },
}));

const mockSuccess = jest.fn();
const mockError = jest.fn();
jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

jest.mock('@/theme/icons', () => ({
  Icon: () => <span data-testid="icon" />,
}));

const sendFleetCommand = apiClient.sendFleetCommand as jest.Mock;

const onlineResult = {
  commandId: 'cmd-1',
  command: 'reload',
  target: { type: 'device', id: 'dev-1' },
  devicesTargeted: 1,
  devicesOnline: 1,
  devicesQueued: 0,
};

describe('DeviceControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendFleetCommand.mockResolvedValue(onlineResult);
  });

  it('renders the three control buttons', () => {
    render(<DeviceControls deviceId="dev-1" />);
    expect(screen.getByRole('button', { name: 'Reload Screen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart App' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Cache' })).toBeInTheDocument();
  });

  it('sends reload immediately to the single-device target without a dialog', async () => {
    render(<DeviceControls deviceId="dev-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload Screen' }));

    await waitFor(() =>
      expect(sendFleetCommand).toHaveBeenCalledWith({
        command: 'reload',
        target: { type: 'device', id: 'dev-1' },
      }),
    );
    expect(mockSuccess).toHaveBeenCalledWith('Reload Screen sent');
  });

  it('requires confirmation before restarting', async () => {
    render(<DeviceControls deviceId="dev-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Restart App' }));

    // Dialog shown, command not yet sent
    expect(screen.getByText('Restart device app?')).toBeInTheDocument();
    expect(sendFleetCommand).not.toHaveBeenCalled();

    // Confirm via the dialog's action button
    fireEvent.click(screen.getByRole('button', { name: 'Send Command' }));

    await waitFor(() =>
      expect(sendFleetCommand).toHaveBeenCalledWith({
        command: 'restart',
        target: { type: 'device', id: 'dev-1' },
      }),
    );
  });

  it('reports a queued message when the device is offline', async () => {
    sendFleetCommand.mockResolvedValueOnce({
      ...onlineResult,
      devicesOnline: 0,
      devicesQueued: 1,
    });
    render(<DeviceControls deviceId="dev-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload Screen' }));

    await waitFor(() =>
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.stringContaining('queued'),
      ),
    );
  });

  it('shows an error toast when the command fails', async () => {
    sendFleetCommand.mockRejectedValueOnce(new Error('network down'));
    render(<DeviceControls deviceId="dev-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload Screen' }));

    await waitFor(() =>
      expect(mockError).toHaveBeenCalledWith('network down'),
    );
  });
});
