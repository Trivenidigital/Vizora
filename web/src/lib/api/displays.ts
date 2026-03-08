// Display management API methods

import type { Display, DisplayOrientation, PaginatedResponse, DisplayGroup, QrOverlayConfig } from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    getDisplays(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Display>>;
    getDisplay(id: string): Promise<Display>;
    createDisplay(data: { nickname: string; location?: string }): Promise<Display>;
    updateDisplay(id: string, data: Partial<{ nickname: string; location?: string; currentPlaylistId?: string | null; orientation?: DisplayOrientation }>): Promise<Display>;
    deleteDisplay(id: string): Promise<void>;
    generatePairingToken(id: string): Promise<{ pairingCode: string }>;
    completePairing(data: { code: string; nickname: string; location?: string }): Promise<Display>;
    pushContentToDisplay(displayId: string, contentId: string, duration?: number): Promise<{ success: boolean; message: string }>;
    requestDeviceScreenshot(displayId: string): Promise<{ requestId: string; status: string }>;
    getDeviceScreenshot(displayId: string): Promise<{ url: string; capturedAt: string; width?: number; height?: number } | null>;
    bulkDeleteDisplays(displayIds: string[]): Promise<{ deleted: number }>;
    bulkAssignPlaylist(displayIds: string[], playlistId: string): Promise<{ updated: number }>;
    bulkAssignGroup(displayIds: string[], displayGroupId: string): Promise<{ added: number }>;
    // Display Groups
    getDisplayGroups(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<DisplayGroup>>;
    getDisplayGroup(id: string): Promise<DisplayGroup>;
    createDisplayGroup(data: { name: string; description?: string }): Promise<DisplayGroup>;
    updateDisplayGroup(id: string, data: { name?: string; description?: string }): Promise<DisplayGroup>;
    deleteDisplayGroup(id: string): Promise<void>;
    addDisplaysToGroup(groupId: string, displayIds: string[]): Promise<{ added: number }>;
    removeDisplaysFromGroup(groupId: string, displayIds: string[]): Promise<{ removed: number }>;
    // QR Overlay
    updateQrOverlay(displayId: string, config: QrOverlayConfig): Promise<QrOverlayConfig>;
    removeQrOverlay(displayId: string): Promise<void>;
  }
}

ApiClient.prototype.getDisplays = async function (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Display>> {
  const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  return this.request<PaginatedResponse<Display>>(`/displays${query ? `?${query}` : ''}`);
};

ApiClient.prototype.getDisplay = async function (id: string): Promise<Display> {
  return this.request<Display>(`/displays/${id}`);
};

ApiClient.prototype.createDisplay = async function (data: { nickname: string; location?: string }): Promise<Display> {
  // Backend expects 'name' and 'deviceId', frontend uses 'nickname'
  const payload = {
    name: data.nickname,
    location: data.location,
    deviceId: `device-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
  return this.request<Display>('/displays', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

ApiClient.prototype.updateDisplay = async function (
  id: string,
  data: Partial<{ nickname: string; location?: string; currentPlaylistId?: string | null; orientation?: DisplayOrientation }>
): Promise<Display> {
  const payload: Record<string, string | undefined | null> = {};
  if (data.nickname !== undefined) payload.name = data.nickname;
  if (data.location !== undefined) payload.location = data.location;
  if (data.currentPlaylistId !== undefined) payload.currentPlaylistId = data.currentPlaylistId;
  if (data.orientation !== undefined) payload.orientation = data.orientation;

  return this.request<Display>(`/displays/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

ApiClient.prototype.deleteDisplay = async function (id: string): Promise<void> {
  return this.request<void>(`/displays/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.generatePairingToken = async function (id: string): Promise<{ pairingCode: string }> {
  return this.request<{ pairingCode: string }>(`/displays/${id}/pair`, {
    method: 'POST',
  });
};

ApiClient.prototype.completePairing = async function (data: { code: string; nickname: string; location?: string }): Promise<Display> {
  const { code, nickname, location } = data;
  return this.request<Display>('/devices/pairing/complete', {
    method: 'POST',
    body: JSON.stringify({ code, nickname, ...(location && { location }) }),
  });
};

ApiClient.prototype.pushContentToDisplay = async function (
  displayId: string,
  contentId: string,
  duration: number = 5,
): Promise<{ success: boolean; message: string }> {
  return this.request<{ success: boolean; message: string }>(
    `/displays/${displayId}/push-content`,
    {
      method: 'POST',
      body: JSON.stringify({ contentId, duration }),
    },
  );
};

ApiClient.prototype.requestDeviceScreenshot = async function (displayId: string): Promise<{ requestId: string; status: string }> {
  return this.request<{ requestId: string; status: string }>(
    `/displays/${displayId}/screenshot`,
    {
      method: 'POST',
    },
  );
};

ApiClient.prototype.getDeviceScreenshot = async function (displayId: string): Promise<{ url: string; capturedAt: string; width?: number; height?: number } | null> {
  return this.request<{ url: string; capturedAt: string; width?: number; height?: number } | null>(
    `/displays/${displayId}/screenshot`,
  );
};

// Bulk Display Operations
ApiClient.prototype.bulkDeleteDisplays = async function (displayIds: string[]): Promise<{ deleted: number }> {
  return this.request<{ deleted: number }>('/displays/bulk/delete', {
    method: 'POST',
    body: JSON.stringify({ displayIds }),
  });
};

ApiClient.prototype.bulkAssignPlaylist = async function (displayIds: string[], playlistId: string): Promise<{ updated: number }> {
  return this.request<{ updated: number }>('/displays/bulk/assign-playlist', {
    method: 'POST',
    body: JSON.stringify({ displayIds, playlistId }),
  });
};

ApiClient.prototype.bulkAssignGroup = async function (displayIds: string[], displayGroupId: string): Promise<{ added: number }> {
  return this.request<{ added: number }>('/displays/bulk/assign-group', {
    method: 'POST',
    body: JSON.stringify({ displayIds, displayGroupId }),
  });
};

// Display Groups
ApiClient.prototype.getDisplayGroups = async function (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<DisplayGroup>> {
  const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  return this.request<PaginatedResponse<DisplayGroup>>(`/display-groups${query ? `?${query}` : ''}`);
};

ApiClient.prototype.getDisplayGroup = async function (id: string): Promise<DisplayGroup> {
  return this.request<DisplayGroup>(`/display-groups/${id}`);
};

ApiClient.prototype.createDisplayGroup = async function (data: { name: string; description?: string }): Promise<DisplayGroup> {
  return this.request<DisplayGroup>('/display-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateDisplayGroup = async function (id: string, data: { name?: string; description?: string }): Promise<DisplayGroup> {
  return this.request<DisplayGroup>(`/display-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deleteDisplayGroup = async function (id: string): Promise<void> {
  return this.request<void>(`/display-groups/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.addDisplaysToGroup = async function (groupId: string, displayIds: string[]): Promise<{ added: number }> {
  return this.request<{ added: number }>(`/display-groups/${groupId}/displays`, {
    method: 'POST',
    body: JSON.stringify({ displayIds }),
  });
};

ApiClient.prototype.removeDisplaysFromGroup = async function (groupId: string, displayIds: string[]): Promise<{ removed: number }> {
  return this.request<{ removed: number }>(`/display-groups/${groupId}/displays`, {
    method: 'DELETE',
    body: JSON.stringify({ displayIds }),
  });
};

// QR Overlay
ApiClient.prototype.updateQrOverlay = async function (displayId: string, config: QrOverlayConfig): Promise<QrOverlayConfig> {
  return this.request<QrOverlayConfig>(`/displays/${displayId}/qr-overlay`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
};

ApiClient.prototype.removeQrOverlay = async function (displayId: string): Promise<void> {
  return this.request<void>(`/displays/${displayId}/qr-overlay`, {
    method: 'DELETE',
  });
};
