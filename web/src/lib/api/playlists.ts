// Playlist API methods

import type { Playlist, PlaylistItem, PaginatedResponse } from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    getPlaylists(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Playlist>>;
    getPlaylist(id: string): Promise<Playlist>;
    createPlaylist(data: { name: string; description?: string; loop?: boolean; items?: Array<{ contentId: string; duration?: number }> }): Promise<Playlist>;
    updatePlaylist(id: string, data: Partial<{ name: string; description?: string; loop?: boolean }>): Promise<Playlist>;
    deletePlaylist(id: string): Promise<void>;
    duplicatePlaylist(id: string): Promise<Playlist>;
    addPlaylistItem(playlistId: string, contentId: string, duration?: number): Promise<PlaylistItem>;
    removePlaylistItem(playlistId: string, itemId: string): Promise<void>;
    updatePlaylistItem(playlistId: string, itemId: string, data: { duration?: number }): Promise<PlaylistItem>;
    reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<{ reordered: boolean }>;
  }
}

ApiClient.prototype.getPlaylists = async function (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Playlist>> {
  const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  return this.request<PaginatedResponse<Playlist>>(`/playlists${query ? `?${query}` : ''}`);
};

ApiClient.prototype.getPlaylist = async function (id: string): Promise<Playlist> {
  return this.request<Playlist>(`/playlists/${id}`);
};

ApiClient.prototype.createPlaylist = async function (data: {
  name: string;
  description?: string;
  loop?: boolean;
  items?: Array<{ contentId: string; duration?: number }>;
}): Promise<Playlist> {
  return this.request<Playlist>('/playlists', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updatePlaylist = async function (
  id: string,
  data: Partial<{ name: string; description?: string; loop?: boolean }>
): Promise<Playlist> {
  return this.request<Playlist>(`/playlists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deletePlaylist = async function (id: string): Promise<void> {
  return this.request<void>(`/playlists/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.duplicatePlaylist = async function (id: string): Promise<Playlist> {
  return this.request<Playlist>(`/playlists/${id}/duplicate`, {
    method: 'POST',
  });
};

ApiClient.prototype.addPlaylistItem = async function (
  playlistId: string,
  contentId: string,
  duration?: number
): Promise<PlaylistItem> {
  return this.request<PlaylistItem>(`/playlists/${playlistId}/items`, {
    method: 'POST',
    body: JSON.stringify({ contentId, duration }),
  });
};

ApiClient.prototype.removePlaylistItem = async function (playlistId: string, itemId: string): Promise<void> {
  return this.request<void>(`/playlists/${playlistId}/items/${itemId}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.updatePlaylistItem = async function (
  playlistId: string,
  itemId: string,
  data: { duration?: number }
): Promise<PlaylistItem> {
  return this.request<PlaylistItem>(`/playlists/${playlistId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.reorderPlaylistItems = async function (playlistId: string, itemIds: string[]): Promise<{ reordered: boolean }> {
  return this.request<{ reordered: boolean }>(`/playlists/${playlistId}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ itemIds }),
  });
};
