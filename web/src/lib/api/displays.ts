// Display management API methods

import type { Display, DisplayOrientation, PaginatedResponse, DisplayGroup, QrOverlayConfig } from '../types';
import { ApiClient } from './client';

/**
 * REPAIR — what `POST /devices/pairing/complete` answers on the rebind path.
 *
 * Deliberately narrow, and it matches the server exactly: the replacement
 * device credential is NOT in this response. The server parks it in the
 * pairing record for whoever polls `GET /devices/pairing/status/:code` — i.e.
 * the screen showing the code. Typing the response this way keeps it
 * structurally impossible for the dashboard to render a credential it was
 * never given.
 */
export interface RepairPairingResponse {
  success: boolean;
  display: {
    id: string;
    nickname: string | null;
    deviceIdentifier: string;
    status: string;
  };
}

/**
 * REPAIR — the conflict contract published by
 * `middleware/src/modules/displays/pairing-error-codes.ts`. Mirrored here
 * rather than imported: `web` does not depend on `middleware`.
 *
 * The UI selects its copy from `statusCode` + this code. It must never select
 * copy from, or render, the server's message text — a 4xx body is curated
 * today but nothing structurally guarantees that, and a 5xx body is not
 * curated at all.
 */
export const REPAIR_PAIRING_ERROR_CODES = [
  'ORG_PAIRING_IN_PROGRESS',
  'DISPLAY_REBIND_IN_PROGRESS',
  'DEVICE_IDENTIFIER_IN_USE',
  'DEVICE_IDENTIFIER_TAKEN_DURING_REBIND',
] as const;

export type RepairPairingErrorCode =
  (typeof REPAIR_PAIRING_ERROR_CODES)[number];

/** Narrow an error's `code` to the published contract, or undefined. */
export function readRepairPairingErrorCode(
  code: unknown,
): RepairPairingErrorCode | undefined {
  return REPAIR_PAIRING_ERROR_CODES.find((known) => known === code);
}

/**
 * Pull `conflictingDisplayId` out of a structured error body.
 *
 * Validated, not merely type-checked: the value becomes both link text and a
 * URL path segment, so anything that is not an id shape is dropped rather
 * than rendered. Absent or malformed → undefined, and the caller falls back
 * to the variant with no link.
 */
export function readConflictingDisplayId(
  details: Record<string, unknown> | undefined,
): string | undefined {
  const value = details?.conflictingDisplayId;
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
    ? value
    : undefined;
}

declare module './client' {
  interface ApiClient {
    getDisplays(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Display>>;
    getDisplay(id: string): Promise<Display>;
    createDisplay(data: { nickname: string; location?: string }): Promise<Display>;
    updateDisplay(id: string, data: Partial<{ nickname: string; location?: string; currentPlaylistId?: string | null; orientation?: DisplayOrientation }>): Promise<Display>;
    deleteDisplay(id: string): Promise<void>;
    completePairing(data: { code: string; nickname: string; location?: string }): Promise<Display>;
    repairDisplayPairing(displayId: string, code: string): Promise<RepairPairingResponse>;
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

ApiClient.prototype.completePairing = async function (data: { code: string; nickname: string; location?: string }): Promise<Display> {
  const { code, nickname, location } = data;
  return this.request<Display>('/devices/pairing/complete', {
    method: 'POST',
    body: JSON.stringify({ code, nickname, ...(location && { location }) }),
  });
};

/**
 * REPAIR — rebind a live pairing session onto an EXISTING display row instead
 * of creating a new one. Same endpoint as `completePairing`; `targetDisplayId`
 * is what selects the rebind path server-side.
 *
 * `nickname` and `location` are deliberately NOT sent. On the rebind path the
 * server preserves whatever the operator already named the screen unless a
 * replacement is supplied, and this flow has no reason to rename anything.
 * `provisioningTemplateId` is rejected outright alongside `targetDisplayId`,
 * so it is not offered either.
 */
ApiClient.prototype.repairDisplayPairing = async function (
  displayId: string,
  code: string,
): Promise<RepairPairingResponse> {
  return this.request<RepairPairingResponse>('/devices/pairing/complete', {
    method: 'POST',
    body: JSON.stringify({ code, targetDisplayId: displayId }),
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
