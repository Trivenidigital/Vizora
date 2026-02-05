/**
 * Shared type definitions for the realtime service
 */

/**
 * Content item in a playlist
 */
export interface PlaylistContentItem {
  id: string;
  contentId: string;
  order: number;
  duration: number;
  content: {
    id: string;
    name: string;
    type: string;
    url: string;
    thumbnailUrl?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Playlist data structure
 */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  isActive: boolean;
  items: PlaylistContentItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Command types that can be sent to devices
 */
export enum DeviceCommandType {
  RELOAD = 'reload',
  RESTART = 'restart',
  UPDATE_CONFIG = 'update_config',
  CLEAR_CACHE = 'clear_cache',
  SCREENSHOT = 'screenshot',
  REBOOT = 'reboot',
  SKIP_CONTENT = 'skip_content',
  PAUSE = 'pause',
  RESUME = 'resume',
  PUSH_CONTENT = 'push_content',
}

/**
 * Command sent to a device
 */
export interface DeviceCommand {
  type: DeviceCommandType;
  payload?: Record<string, unknown>;
  timestamp?: string;
  priority?: number;
}

/**
 * Device metrics data
 */
export interface DeviceMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkLatency?: number;
  temperature?: number;
}

/**
 * Current content playback state
 */
export interface CurrentContentState {
  contentId?: string;
  playlistId?: string;
  playbackPosition?: number;
  status?: 'playing' | 'paused' | 'buffering' | 'error' | 'idle';
}

/**
 * Device status stored in Redis
 */
export interface DeviceStatus {
  status: 'online' | 'offline' | 'pairing' | 'error';
  lastHeartbeat: number;
  socketId: string | null;
  organizationId: string;
  metrics?: DeviceMetrics;
  currentContent?: CurrentContentState;
}

/**
 * Heartbeat data from device
 */
export interface HeartbeatData {
  metrics?: DeviceMetrics;
  currentContent?: CurrentContentState;
  uptime?: number;
  appVersion?: string;
}

/**
 * Content impression data
 */
export interface ImpressionData {
  contentId: string;
  playlistId?: string;
  duration?: number;
  completionPercentage?: number;
  timestamp?: string;
}

/**
 * Content error data
 */
export interface ContentErrorData {
  contentId: string;
  playlistId?: string;
  errorType: string;
  errorMessage?: string;
  errorCode?: string;
  context?: Record<string, unknown>;
}

/**
 * Broadcast event data
 */
export interface BroadcastData {
  [key: string]: unknown;
}

/**
 * Push API request data
 */
export interface PushPlaylistRequest {
  deviceId: string;
  playlist: Playlist;
}

export interface PushCommandRequest {
  deviceId: string;
  command: DeviceCommand;
}

/**
 * Content data for push content command
 */
export interface PushContentData {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  mimeType?: string;
  duration?: number;
}

/**
 * Push content request data
 */
export interface PushContentRequest {
  deviceId: string;
  content: PushContentData;
  duration?: number;
}
