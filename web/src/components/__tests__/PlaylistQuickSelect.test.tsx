import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlaylistQuickSelect from '../PlaylistQuickSelect';

jest.mock('@/lib/api', () => ({
  apiClient: {
    updateDisplay: jest.fn(),
  },
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

import { apiClient } from '@/lib/api';

describe('PlaylistQuickSelect', () => {
  const mockDevice = {
    id: 'device-1',
    nickname: 'Lobby Display',
    currentPlaylistId: 'playlist-1',
    organizationId: 'org-1',
    pairingCode: 'ABC123',
    status: 'online' as const,
    isOnline: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  const mockPlaylists = [
    { id: 'playlist-1', name: 'Morning Promo', items: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'playlist-2', name: 'Afternoon Special', items: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'playlist-3', name: 'Evening Loop', items: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const mockOnUpdate = jest.fn();
  const mockOnError = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.updateDisplay as jest.Mock).mockResolvedValue({});
  });

  it('renders a select element', () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('has proper aria-label', () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
      />
    );
    expect(screen.getByLabelText('Select playlist for Lobby Display')).toBeInTheDocument();
  });

  it('renders "No playlist" option', () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
      />
    );
    expect(screen.getByText('No playlist')).toBeInTheDocument();
  });

  it('renders all playlist options', () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
      />
    );
    expect(screen.getByText('Morning Promo')).toBeInTheDocument();
    expect(screen.getByText('Afternoon Special')).toBeInTheDocument();
    expect(screen.getByText('Evening Loop')).toBeInTheDocument();
  });

  it('selects current playlist by default', () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('playlist-1');
  });

  it('has test id attribute on select', () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
      />
    );
    expect(screen.getByTestId('playlist-select-device-1')).toBeInTheDocument();
  });

  it('calls apiClient.updateDisplay when playlist is changed', async () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
        onUpdate={mockOnUpdate}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'playlist-2' },
    });

    await waitFor(() => {
      expect(apiClient.updateDisplay).toHaveBeenCalledWith('device-1', {
        currentPlaylistId: 'playlist-2',
      });
    });
  });

  it('calls onSuccess and onUpdate callbacks on successful change', async () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
        onUpdate={mockOnUpdate}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'playlist-2' },
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onError callback on API failure', async () => {
    (apiClient.updateDisplay as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
        onError={mockOnError}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'playlist-2' },
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Network error' })
      );
    });
  });

  it('sends null for currentPlaylistId when "No playlist" is selected', async () => {
    render(
      <PlaylistQuickSelect
        device={mockDevice as any}
        playlists={mockPlaylists as any}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '' },
    });

    await waitFor(() => {
      expect(apiClient.updateDisplay).toHaveBeenCalledWith('device-1', {
        currentPlaylistId: null,
      });
    });
  });

  it('selects empty value when device has no current playlist', () => {
    const deviceWithoutPlaylist = { ...mockDevice, currentPlaylistId: null };
    render(
      <PlaylistQuickSelect
        device={deviceWithoutPlaylist as any}
        playlists={mockPlaylists as any}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});
