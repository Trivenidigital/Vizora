import { screen, fireEvent, waitFor } from '@testing-library/react';
import DisplayList from '../../components/DisplayList';
import { displayService } from '../../services/displayService';
import { renderWithProviders } from '../../test/test-utils';

// Mock the display service
vi.mock('../../services/displayService', () => ({
  displayService: {
    getDisplays: vi.fn(),
    updateDisplay: vi.fn(),
    deleteDisplay: vi.fn(),
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => vi.fn(),
}));

const mockDisplays = [
  {
    id: '1',
    name: 'Main Lobby Display',
    location: 'Lobby',
    status: 'online',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.100',
    resolution: '1920x1080',
    orientation: 'landscape',
    brightness: 80,
    schedule: {
      enabled: true,
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    },
    content: {
      current: {
        id: '1',
        title: 'Welcome Message',
        type: 'text',
        content: 'Welcome to our office!',
      },
      queue: [],
    },
    settings: {
      autoPlay: true,
      volume: 50,
      brightness: 80,
    },
    metrics: {
      uptime: 99.9,
      lastUpdate: new Date().toISOString(),
    },
    alerts: [],
    logs: [],
  },
];

describe('DisplayList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(displayService.getDisplays).mockResolvedValueOnce(mockDisplays);
  });

  it('renders display list', async () => {
    renderWithProviders(<DisplayList />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
      expect(screen.getByText('Lobby')).toBeInTheDocument();
      expect(screen.getByText('online')).toBeInTheDocument();
    });
  });

  it('handles display status update', async () => {
    vi.mocked(displayService.updateDisplay).mockResolvedValueOnce({
      ...mockDisplays[0],
      status: 'offline',
    });

    renderWithProviders(<DisplayList />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    const statusButton = screen.getByRole('button', { name: /update status/i });
    fireEvent.click(statusButton);

    await waitFor(() => {
      expect(displayService.updateDisplay).toHaveBeenCalledWith('1', { status: 'offline' });
      expect(screen.getByText('offline')).toBeInTheDocument();
    });
  });

  it('handles display deletion', async () => {
    vi.mocked(displayService.deleteDisplay).mockResolvedValueOnce(true);

    renderWithProviders(<DisplayList />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete display/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(displayService.deleteDisplay).toHaveBeenCalledWith('1');
      expect(screen.queryByText('Main Lobby Display')).not.toBeInTheDocument();
    });
  });

  it('shows error message on service failure', async () => {
    vi.mocked(displayService.getDisplays).mockRejectedValueOnce(new Error('Failed to fetch displays'));

    renderWithProviders(<DisplayList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch displays/i)).toBeInTheDocument();
    });
  });
}); 