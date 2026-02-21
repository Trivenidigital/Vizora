// Shared TypeScript types for the Vizora mobile app

export type Display = {
  id: string;
  nickname: string | null;
  deviceIdentifier: string;
  status: 'online' | 'offline' | 'pairing';
  location: string | null;
  orientation: string | null;
  resolution: string | null;
  lastSeen: string | null;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  currentPlaylistId: string | null;
  currentPlaylist?: Playlist | null;
};

export type Content = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'url' | 'html';
  url: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
  status: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type Playlist = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  organizationId: string;
  items?: PlaylistItem[];
  _count?: { items: number };
  createdAt: string;
  updatedAt: string;
};

export type PlaylistItem = {
  id: string;
  playlistId: string;
  contentId: string;
  content?: Content;
  duration: number;
  order: number;
  createdAt: string;
};

export type DeviceStatusEvent = {
  deviceId: string;
  status: 'online' | 'offline';
  timestamp: string;
};

export type ScreenshotReadyEvent = {
  deviceId: string;
  url: string;
  timestamp: string;
};

export type UpdateDisplayData = {
  nickname?: string;
  location?: string;
  currentPlaylistId?: string | null;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type ContentFilterParams = PaginationParams & {
  type?: 'image' | 'video' | 'url' | 'html';
};
