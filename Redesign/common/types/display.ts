export interface DisplayMetadata {
  id: string;
  name: string;
  location?: string;
  resolution?: {
    width: number;
    height: number;
  };
  model?: string;
  os?: string;
  lastSeen?: Date;
  status: 'online' | 'offline' | 'error';
}

export interface DisplayRegistration {
  pairingCode: string;
  metadata: Omit<DisplayMetadata, 'id' | 'status'>;
}

export interface DisplayToken {
  token: string;
  expiresAt: Date;
  displayId: string;
}

export interface DisplayStatus {
  displayId: string;
  status: DisplayMetadata['status'];
  lastSeen: Date;
  errors?: string[];
  contentStatus?: {
    currentContentId?: string;
    nextContentId?: string;
    isPlaying: boolean;
    lastSync: Date;
  };
}

/**
 * Pairing confirmation event payload
 * Sent when an admin pairs a device via VizoraWeb
 */
export interface PairingEvent {
  displayId: string;
  userId: string;
  displayName?: string;
  pairedAt: string;
  metadata?: {
    name?: string;
    location?: string;
    [key: string]: any;
  };
} 