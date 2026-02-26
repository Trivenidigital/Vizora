import { usePlaylistsStore } from '../playlists';
import { api } from '../../api/client';
import type { Playlist, PlaylistItem } from '../../types';

jest.mock('../../api/client', () => ({
  api: {
    getPlaylists: jest.fn(),
    getPlaylist: jest.fn(),
    addPlaylistItem: jest.fn(),
    removePlaylistItem: jest.fn(),
    reorderPlaylist: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const makePlaylist = (overrides: Partial<Playlist> = {}): Playlist => ({
  id: 'pl-1',
  name: 'Default Playlist',
  description: 'Main lobby playlist',
  isDefault: true,
  organizationId: 'org-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makePlaylistItem = (overrides: Partial<PlaylistItem> = {}): PlaylistItem => ({
  id: 'item-1',
  playlistId: 'pl-1',
  contentId: 'content-1',
  duration: 10,
  order: 0,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

describe('usePlaylistsStore', () => {
  beforeEach(() => {
    usePlaylistsStore.setState(initialState);
    jest.clearAllMocks();
  });

  describe('fetchPlaylists', () => {
    it('should fetch playlists and set items on success', async () => {
      const playlists = [makePlaylist(), makePlaylist({ id: 'pl-2', name: 'Second Playlist' })];
      mockedApi.getPlaylists.mockResolvedValue(playlists);

      await usePlaylistsStore.getState().fetchPlaylists();

      expect(mockedApi.getPlaylists).toHaveBeenCalledWith(undefined);
      const state = usePlaylistsStore.getState();
      expect(state.items).toEqual(playlists);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should pass pagination params to API', async () => {
      mockedApi.getPlaylists.mockResolvedValue([]);

      await usePlaylistsStore.getState().fetchPlaylists({ page: 2, limit: 5, search: 'lobby' });

      expect(mockedApi.getPlaylists).toHaveBeenCalledWith({ page: 2, limit: 5, search: 'lobby' });
    });

    it('should set error on failure', async () => {
      mockedApi.getPlaylists.mockRejectedValue(new Error('Unauthorized'));

      await usePlaylistsStore.getState().fetchPlaylists();

      const state = usePlaylistsStore.getState();
      expect(state.error).toBe('Unauthorized');
      expect(state.isLoading).toBe(false);
      expect(state.items).toEqual([]);
    });

    it('should use fallback error message for non-Error throws', async () => {
      mockedApi.getPlaylists.mockRejectedValue(null);

      await usePlaylistsStore.getState().fetchPlaylists();

      expect(usePlaylistsStore.getState().error).toBe('Failed to load playlists');
    });

    it('should default to empty array if response is not an array', async () => {
      mockedApi.getPlaylists.mockResolvedValue({ data: [] } as unknown as Playlist[]);

      await usePlaylistsStore.getState().fetchPlaylists();

      expect(usePlaylistsStore.getState().items).toEqual([]);
    });

    it('should set isLoading=true while fetching', async () => {
      let capturedLoading = false;
      mockedApi.getPlaylists.mockImplementation(async () => {
        capturedLoading = usePlaylistsStore.getState().isLoading;
        return [];
      });

      await usePlaylistsStore.getState().fetchPlaylists();

      expect(capturedLoading).toBe(true);
      expect(usePlaylistsStore.getState().isLoading).toBe(false);
    });

    it('should clear previous error when starting a new fetch', async () => {
      usePlaylistsStore.setState({ error: 'stale error' });
      mockedApi.getPlaylists.mockResolvedValue([]);

      await usePlaylistsStore.getState().fetchPlaylists();

      expect(usePlaylistsStore.getState().error).toBeNull();
    });
  });

  describe('getPlaylist', () => {
    it('should call api.getPlaylist and return the result', async () => {
      const playlist = makePlaylist({
        id: 'pl-1',
        items: [makePlaylistItem()],
      });
      mockedApi.getPlaylist.mockResolvedValue(playlist);

      const result = await usePlaylistsStore.getState().getPlaylist('pl-1');

      expect(mockedApi.getPlaylist).toHaveBeenCalledWith('pl-1');
      expect(result).toEqual(playlist);
    });

    it('should propagate errors', async () => {
      mockedApi.getPlaylist.mockRejectedValue(new Error('Not found'));

      await expect(usePlaylistsStore.getState().getPlaylist('nonexistent')).rejects.toThrow('Not found');
    });
  });

  describe('addPlaylistItem', () => {
    it('should call api.addPlaylistItem and return the new item', async () => {
      const newItem = makePlaylistItem({ id: 'item-new', contentId: 'content-5' });
      mockedApi.addPlaylistItem.mockResolvedValue(newItem);

      const result = await usePlaylistsStore.getState().addPlaylistItem('pl-1', 'content-5');

      expect(mockedApi.addPlaylistItem).toHaveBeenCalledWith('pl-1', 'content-5', undefined);
      expect(result).toEqual(newItem);
    });

    it('should pass duration when provided', async () => {
      const newItem = makePlaylistItem({ duration: 30 });
      mockedApi.addPlaylistItem.mockResolvedValue(newItem);

      await usePlaylistsStore.getState().addPlaylistItem('pl-1', 'content-5', 30);

      expect(mockedApi.addPlaylistItem).toHaveBeenCalledWith('pl-1', 'content-5', 30);
    });

    it('should propagate errors', async () => {
      mockedApi.addPlaylistItem.mockRejectedValue(new Error('Conflict'));

      await expect(
        usePlaylistsStore.getState().addPlaylistItem('pl-1', 'content-5'),
      ).rejects.toThrow('Conflict');
    });
  });

  describe('removePlaylistItem', () => {
    it('should call api.removePlaylistItem with correct args', async () => {
      mockedApi.removePlaylistItem.mockResolvedValue(undefined);

      await usePlaylistsStore.getState().removePlaylistItem('pl-1', 'item-1');

      expect(mockedApi.removePlaylistItem).toHaveBeenCalledWith('pl-1', 'item-1');
    });

    it('should propagate errors', async () => {
      mockedApi.removePlaylistItem.mockRejectedValue(new Error('Forbidden'));

      await expect(
        usePlaylistsStore.getState().removePlaylistItem('pl-1', 'item-1'),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('reorderPlaylist', () => {
    it('should call api.reorderPlaylist with correct args', async () => {
      mockedApi.reorderPlaylist.mockResolvedValue(undefined);
      const newOrder = ['item-3', 'item-1', 'item-2'];

      await usePlaylistsStore.getState().reorderPlaylist('pl-1', newOrder);

      expect(mockedApi.reorderPlaylist).toHaveBeenCalledWith('pl-1', newOrder);
    });

    it('should propagate errors', async () => {
      mockedApi.reorderPlaylist.mockRejectedValue(new Error('Bad request'));

      await expect(
        usePlaylistsStore.getState().reorderPlaylist('pl-1', ['item-1']),
      ).rejects.toThrow('Bad request');
    });
  });
});
