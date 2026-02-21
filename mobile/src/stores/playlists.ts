import { create } from 'zustand';
import { api } from '../api/client';
import type { Playlist, PlaylistItem, PaginationParams } from '../types';

type PlaylistsState = {
  items: Playlist[];
  isLoading: boolean;
  error: string | null;

  fetchPlaylists: (params?: PaginationParams) => Promise<void>;
  getPlaylist: (id: string) => Promise<Playlist>;
  addPlaylistItem: (playlistId: string, contentId: string, duration?: number) => Promise<PlaylistItem>;
  removePlaylistItem: (playlistId: string, itemId: string) => Promise<void>;
  reorderPlaylist: (playlistId: string, itemIds: string[]) => Promise<void>;
};

export const usePlaylistsStore = create<PlaylistsState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchPlaylists: async (params?: PaginationParams) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getPlaylists(params);
      const items = Array.isArray(result) ? result : [];
      set({ items, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load playlists';
      set({ error: message, isLoading: false });
    }
  },

  getPlaylist: async (id: string) => {
    return api.getPlaylist(id);
  },

  addPlaylistItem: async (playlistId: string, contentId: string, duration?: number) => {
    return api.addPlaylistItem(playlistId, contentId, duration);
  },

  removePlaylistItem: async (playlistId: string, itemId: string) => {
    await api.removePlaylistItem(playlistId, itemId);
  },

  reorderPlaylist: async (playlistId: string, itemIds: string[]) => {
    await api.reorderPlaylist(playlistId, itemIds);
  },
}));
