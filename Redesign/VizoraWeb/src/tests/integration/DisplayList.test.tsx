import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DisplayList } from '../../pages/displays/DisplayList';
import { displayService } from '../../services/displayService';
import toast from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../services/displayService');
vi.mock('react-hot-toast');

const mockDisplays = [
  {
    id: '1',
    name: 'Main Lobby Display',
    status: 'online',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.100'
  },
  {
    id: '2',
    name: 'Conference Room A',
    status: 'offline',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.101'
  },
  {
    id: '3',
    name: 'Cafeteria Display',
    status: 'online',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.102'
  }
];

describe('DisplayList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (displayService.getDisplays as jest.Mock).mockResolvedValue(mockDisplays);
  });

  it('renders displays when loaded', async () => {
    render(
      <BrowserRouter>
        <DisplayList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
      expect(screen.getByText('Cafeteria Display')).toBeInTheDocument();
    });
  });

  it('renders empty state when no displays', async () => {
    (displayService.getDisplays as jest.Mock).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <DisplayList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no displays found/i)).toBeInTheDocument();
    });
  });

  it('handles display unpairing', async () => {
    (displayService.unpairDisplay as jest.Mock).mockResolvedValue(undefined);

    render(
      <BrowserRouter>
        <DisplayList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    const unpairButton = screen.getAllByRole('button', { name: /unpair/i })[0];
    fireEvent.click(unpairButton);

    await waitFor(() => {
      expect(displayService.unpairDisplay).toHaveBeenCalledWith('1');
      expect(toast.success).toHaveBeenCalledWith('Display unpaired successfully');
    });
  });

  it('handles error when loading displays fails', async () => {
    const error = new Error('Failed to load displays');
    (displayService.getDisplays as jest.Mock).mockRejectedValue(error);

    render(
      <BrowserRouter>
        <DisplayList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load displays');
    });
  });

  it('handles error when unpairing display fails', async () => {
    const error = new Error('Failed to unpair display');
    (displayService.unpairDisplay as jest.Mock).mockRejectedValue(error);

    render(
      <BrowserRouter>
        <DisplayList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    const unpairButton = screen.getAllByRole('button', { name: /unpair/i })[0];
    fireEvent.click(unpairButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to unpair display');
    });
  });
}); 