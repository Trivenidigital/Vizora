import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { apiClient } from '@/lib/api';
import { Display, DisplayOrientation, Playlist } from '@/lib/types';
import PlaylistQuickSelect from '../PlaylistQuickSelect';

// Mock dependencies
jest.mock('@/lib/api');

describe('DeviceQuickChange - Orientation Type', () => {
  it('includes all 4 orientation values in DisplayOrientation type', () => {
    // Type checking test - if this compiles, the types are correct
    const orientations: DisplayOrientation[] = [
      'landscape',
      'portrait',
      'landscape_flipped',
      'portrait_flipped',
    ];

    expect(orientations).toHaveLength(4);
    expect(orientations).toContain('landscape');
    expect(orientations).toContain('portrait');
    expect(orientations).toContain('landscape_flipped');
    expect(orientations).toContain('portrait_flipped');
  });

  it('Display interface includes orientation field', () => {
    const device: Display = {
      id: 'test-1',
      nickname: 'Test Device',
      deviceId: 'device-abc',
      status: 'online',
      orientation: 'landscape',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(device.orientation).toBe('landscape');
  });

  it('Display interface accepts all orientation values', () => {
    const orientations: DisplayOrientation[] = [
      'landscape',
      'portrait',
      'landscape_flipped',
      'portrait_flipped',
    ];

    orientations.forEach((orientation) => {
      const device: Display = {
        id: 'test-1',
        nickname: 'Test Device',
        deviceId: 'device-abc',
        status: 'online',
        orientation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(device.orientation).toBe(orientation);
    });
  });
});

describe('DeviceQuickChange - API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updateDisplay accepts orientation parameter', async () => {
    (apiClient.updateDisplay as jest.Mock).mockResolvedValue({
      id: 'device-1',
      nickname: 'Test Device',
      orientation: 'portrait_flipped',
    });

    await apiClient.updateDisplay('device-1', { orientation: 'portrait_flipped' });

    expect(apiClient.updateDisplay).toHaveBeenCalledWith('device-1', {
      orientation: 'portrait_flipped',
    });
  });

  it('updateDisplay accepts currentPlaylistId parameter with null value', async () => {
    (apiClient.updateDisplay as jest.Mock).mockResolvedValue({
      id: 'device-1',
      nickname: 'Test Device',
      currentPlaylistId: null,
    });

    await apiClient.updateDisplay('device-1', { currentPlaylistId: null });

    expect(apiClient.updateDisplay).toHaveBeenCalledWith('device-1', {
      currentPlaylistId: null,
    });
  });
});

describe('PlaylistQuickSelect - Dropdown Component', () => {
  const mockDevice: Display = {
    id: 'device-1',
    nickname: 'Lobby Display',
    deviceId: 'dev-abc',
    location: 'Main Lobby',
    status: 'online',
    currentPlaylistId: 'playlist-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDeviceNoPlaylist: Display = {
    id: 'device-2',
    nickname: 'Conference Room',
    deviceId: 'dev-xyz',
    location: 'Floor 2',
    status: 'offline',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockPlaylists: Playlist[] = [
    {
      id: 'playlist-1',
      name: 'Welcome Loop',
      items: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'playlist-2',
      name: 'Promo Content',
      items: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'playlist-3',
      name: 'Holiday Special',
      items: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.updateDisplay as jest.Mock).mockResolvedValue({
      ...mockDevice,
      currentPlaylistId: 'playlist-2',
    });
  });

  it('renders dropdown with current playlist selected', () => {
    render(<PlaylistQuickSelect device={mockDevice} playlists={mockPlaylists} />);

    const dropdown = screen.getByTestId('playlist-select-device-1') as HTMLSelectElement;
    expect(dropdown).toBeInTheDocument();
    expect(dropdown.value).toBe('playlist-1');
  });

  it('renders dropdown showing all playlists', () => {
    render(<PlaylistQuickSelect device={mockDevice} playlists={mockPlaylists} />);

    const dropdown = screen.getByTestId('playlist-select-device-1') as HTMLSelectElement;

    // Check all playlist options are present
    const options = dropdown.querySelectorAll('option');
    expect(options).toHaveLength(4); // 3 playlists + "No playlist"

    const optionTexts = Array.from(options).map((opt) => opt.textContent);
    expect(optionTexts).toContain('No playlist');
    expect(optionTexts).toContain('Welcome Loop');
    expect(optionTexts).toContain('Promo Content');
    expect(optionTexts).toContain('Holiday Special');
  });

  it('changing dropdown calls updateDisplay', async () => {
    render(<PlaylistQuickSelect device={mockDevice} playlists={mockPlaylists} />);

    const dropdown = screen.getByTestId('playlist-select-device-1') as HTMLSelectElement;

    fireEvent.change(dropdown, { target: { value: 'playlist-2' } });

    await waitFor(() => {
      expect(apiClient.updateDisplay).toHaveBeenCalledWith('device-1', {
        currentPlaylistId: 'playlist-2',
      });
    });
  });

  it('shows loading state during update', async () => {
    let resolveUpdate: () => void;
    (apiClient.updateDisplay as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () =>
            resolve({
              ...mockDevice,
              currentPlaylistId: 'playlist-2',
            });
        })
    );

    render(<PlaylistQuickSelect device={mockDevice} playlists={mockPlaylists} />);

    const dropdown = screen.getByTestId('playlist-select-device-1') as HTMLSelectElement;

    fireEvent.change(dropdown, { target: { value: 'playlist-2' } });

    // Dropdown should be disabled during update
    await waitFor(() => {
      expect(dropdown).toBeDisabled();
    });

    // Resolve the update
    resolveUpdate!();

    await waitFor(() => {
      expect(dropdown).not.toBeDisabled();
    });
  });

  it('"No playlist" option works correctly', async () => {
    render(<PlaylistQuickSelect device={mockDevice} playlists={mockPlaylists} />);

    const dropdown = screen.getByTestId('playlist-select-device-1') as HTMLSelectElement;

    // Select "No playlist" (empty value)
    fireEvent.change(dropdown, { target: { value: '' } });

    await waitFor(() => {
      expect(apiClient.updateDisplay).toHaveBeenCalledWith('device-1', {
        currentPlaylistId: null,
      });
    });
  });

  it('handles error on update failure', async () => {
    const onError = jest.fn();

    (apiClient.updateDisplay as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <PlaylistQuickSelect
        device={mockDevice}
        playlists={mockPlaylists}
        onError={onError}
      />
    );

    const dropdown = screen.getByTestId('playlist-select-device-1') as HTMLSelectElement;

    fireEvent.change(dropdown, { target: { value: 'playlist-2' } });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    // Dropdown should be re-enabled after error
    expect(dropdown).not.toBeDisabled();
  });

  it('device without playlist shows empty dropdown value', () => {
    render(<PlaylistQuickSelect device={mockDeviceNoPlaylist} playlists={mockPlaylists} />);

    const dropdown = screen.getByTestId('playlist-select-device-2') as HTMLSelectElement;
    expect(dropdown.value).toBe('');
  });

  it('calls onSuccess callback after successful update', async () => {
    const onSuccess = jest.fn();

    render(
      <PlaylistQuickSelect
        device={mockDevice}
        playlists={mockPlaylists}
        onSuccess={onSuccess}
      />
    );

    const dropdown = screen.getByTestId('playlist-select-device-1') as HTMLSelectElement;

    fireEvent.change(dropdown, { target: { value: 'playlist-2' } });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('has proper accessibility label', () => {
    render(<PlaylistQuickSelect device={mockDevice} playlists={mockPlaylists} />);

    const dropdown = screen.getByLabelText('Select playlist for Lobby Display');
    expect(dropdown).toBeInTheDocument();
  });
});
