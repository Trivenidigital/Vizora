import { useDevicesStore } from '../devices';
import { api } from '../../api/client';
import type { Display, DeviceStatusEvent } from '../../types';

jest.mock('../../api/client', () => ({
  api: {
    getDisplays: jest.fn(),
    updateDisplay: jest.fn(),
    deleteDisplay: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const makeDisplay = (overrides: Partial<Display> = {}): Display => ({
  id: 'disp-1',
  nickname: 'Lobby Screen',
  deviceIdentifier: 'device-abc',
  status: 'online',
  location: 'Lobby',
  orientation: 'landscape',
  resolution: '1920x1080',
  lastSeen: '2026-01-01T00:00:00Z',
  lastHeartbeat: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  organizationId: 'org-1',
  currentPlaylistId: null,
  ...overrides,
});

const initialState = {
  displays: [],
  isLoading: false,
  error: null,
};

describe('useDevicesStore', () => {
  beforeEach(() => {
    useDevicesStore.setState(initialState);
    jest.clearAllMocks();
  });

  describe('fetchDisplays', () => {
    it('should set displays on success (array response)', async () => {
      const displays = [makeDisplay(), makeDisplay({ id: 'disp-2', nickname: 'Break Room' })];
      mockedApi.getDisplays.mockResolvedValue(displays);

      await useDevicesStore.getState().fetchDisplays();

      const state = useDevicesStore.getState();
      expect(state.displays).toEqual(displays);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle envelope-wrapped response with data field', async () => {
      const displays = [makeDisplay()];
      mockedApi.getDisplays.mockResolvedValue({ data: displays } as unknown as Display[]);

      await useDevicesStore.getState().fetchDisplays();

      expect(useDevicesStore.getState().displays).toEqual(displays);
    });

    it('should handle envelope-wrapped response with displays field', async () => {
      const displays = [makeDisplay()];
      mockedApi.getDisplays.mockResolvedValue({ displays } as unknown as Display[]);

      await useDevicesStore.getState().fetchDisplays();

      expect(useDevicesStore.getState().displays).toEqual(displays);
    });

    it('should handle envelope-wrapped response with items field', async () => {
      const displays = [makeDisplay()];
      mockedApi.getDisplays.mockResolvedValue({ items: displays } as unknown as Display[]);

      await useDevicesStore.getState().fetchDisplays();

      expect(useDevicesStore.getState().displays).toEqual(displays);
    });

    it('should fall back to empty array for unknown shape', async () => {
      mockedApi.getDisplays.mockResolvedValue({ something: 'else' } as unknown as Display[]);

      await useDevicesStore.getState().fetchDisplays();

      expect(useDevicesStore.getState().displays).toEqual([]);
    });

    it('should set error message on failure', async () => {
      mockedApi.getDisplays.mockRejectedValue(new Error('Network error'));

      await useDevicesStore.getState().fetchDisplays();

      const state = useDevicesStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
      expect(state.displays).toEqual([]);
    });

    it('should use fallback error message for non-Error throws', async () => {
      mockedApi.getDisplays.mockRejectedValue('something went wrong');

      await useDevicesStore.getState().fetchDisplays();

      expect(useDevicesStore.getState().error).toBe('Failed to load displays');
    });

    it('should set isLoading=true while fetching', async () => {
      let capturedLoading = false;
      mockedApi.getDisplays.mockImplementation(async () => {
        capturedLoading = useDevicesStore.getState().isLoading;
        return [];
      });

      await useDevicesStore.getState().fetchDisplays();

      expect(capturedLoading).toBe(true);
      expect(useDevicesStore.getState().isLoading).toBe(false);
    });
  });

  describe('updateDisplayStatus', () => {
    it('should update matching display status and lastSeen', () => {
      const display1 = makeDisplay({ id: 'disp-1', status: 'online' });
      const display2 = makeDisplay({ id: 'disp-2', status: 'online' });
      useDevicesStore.setState({ displays: [display1, display2] });

      const event: DeviceStatusEvent = {
        deviceId: 'disp-1',
        status: 'offline',
        timestamp: '2026-02-26T12:00:00Z',
      };

      useDevicesStore.getState().updateDisplayStatus(event);

      const state = useDevicesStore.getState();
      expect(state.displays[0].status).toBe('offline');
      expect(state.displays[0].lastSeen).toBe('2026-02-26T12:00:00Z');
      // Second display should be unchanged
      expect(state.displays[1].status).toBe('online');
    });

    it('should not modify displays when deviceId does not match', () => {
      const display = makeDisplay({ id: 'disp-1', status: 'online' });
      useDevicesStore.setState({ displays: [display] });

      const event: DeviceStatusEvent = {
        deviceId: 'nonexistent',
        status: 'offline',
        timestamp: '2026-02-26T12:00:00Z',
      };

      useDevicesStore.getState().updateDisplayStatus(event);

      expect(useDevicesStore.getState().displays[0].status).toBe('online');
    });
  });

  describe('updateDisplay', () => {
    it('should call API and update the matching display in state', async () => {
      const original = makeDisplay({ id: 'disp-1', nickname: 'Old Name' });
      useDevicesStore.setState({ displays: [original] });

      const updatedDisplay = { ...original, nickname: 'New Name' };
      mockedApi.updateDisplay.mockResolvedValue(updatedDisplay);

      const result = await useDevicesStore.getState().updateDisplay('disp-1', { nickname: 'New Name' });

      expect(mockedApi.updateDisplay).toHaveBeenCalledWith('disp-1', { nickname: 'New Name' });
      expect(result).toEqual(updatedDisplay);
      expect(useDevicesStore.getState().displays[0].nickname).toBe('New Name');
    });
  });

  describe('removeDisplay', () => {
    it('should call API and remove display from state', async () => {
      const display1 = makeDisplay({ id: 'disp-1' });
      const display2 = makeDisplay({ id: 'disp-2' });
      useDevicesStore.setState({ displays: [display1, display2] });

      mockedApi.deleteDisplay.mockResolvedValue(undefined);

      await useDevicesStore.getState().removeDisplay('disp-1');

      expect(mockedApi.deleteDisplay).toHaveBeenCalledWith('disp-1');
      const state = useDevicesStore.getState();
      expect(state.displays).toHaveLength(1);
      expect(state.displays[0].id).toBe('disp-2');
    });
  });

  describe('setDisplays', () => {
    it('should directly set the displays array', () => {
      const displays = [makeDisplay(), makeDisplay({ id: 'disp-2' })];

      useDevicesStore.getState().setDisplays(displays);

      expect(useDevicesStore.getState().displays).toEqual(displays);
    });
  });
});
