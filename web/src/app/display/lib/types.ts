// Display client state machine
export type DisplayState = 'LOADING' | 'PAIRING' | 'CONNECTING' | 'PLAYING' | 'ERROR';

export interface PlaylistItem {
  id: string;
  contentId: string;
  duration: number;
  order: number;
  content: {
    id: string;
    name: string;
    type: ContentType;
    url: string;
    thumbnail?: string;
    mimeType?: string;
    duration?: number;
    metadata?: LayoutMetadata;
  } | null;
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  loopPlaylist?: boolean;
  totalDuration?: number;
}

export type ContentType = 'image' | 'video' | 'url' | 'webpage' | 'html' | 'template' | 'layout';

export interface PushContent {
  id: string;
  name: string;
  type: ContentType;
  url: string;
  thumbnailUrl?: string;
  mimeType?: string;
  duration?: number;
}

export interface DeviceCredentials {
  deviceToken: string;
  deviceId: string;
  organizationId?: string;
}

export interface PairingResponse {
  code: string;
  qrCode?: string;
  deviceId: string;
  expiresAt?: string;
}

export interface PairingStatusResponse {
  status: 'pending' | 'paired' | 'expired';
  deviceToken?: string;
  displayId?: string;
  organizationId?: string;
}

export interface HeartbeatData {
  timestamp: string;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    uptime?: number;
  };
  currentContent: string | null;
  status: 'online';
}

export interface DeviceCommand {
  type: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DeviceConfig {
  heartbeatInterval?: number;
  cacheSize?: number;
  autoUpdate?: boolean;
  qrOverlay?: QrOverlayConfig;
}

export interface QrOverlayConfig {
  enabled: boolean;
  url: string;
  size?: number;
  margin?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  backgroundColor?: string;
  opacity?: number;
  label?: string;
}

export interface LayoutMetadata {
  gridTemplate?: {
    columns?: string;
    rows?: string;
  };
  gap?: number;
  backgroundColor?: string;
  zones: LayoutZone[];
}

export interface LayoutZone {
  id: string;
  gridArea: string;
  resolvedPlaylist?: {
    items: PlaylistItem[];
  };
  resolvedContent?: {
    type: ContentType;
    url: string;
    name?: string;
  };
}
