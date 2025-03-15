export type ContentType = 'text' | 'image' | 'video' | 'url';

export interface Content {
  type: ContentType;
  data: unknown;
}

export interface DisplayInfo {
  displayId: string;
  pairingCode: string;
  status: 'connected' | 'disconnected';
  lastSeen?: Date;
}

export interface PairingResponse {
  displayId: string;
  success: boolean;
  error?: string;
}

export interface ContentUpdateResponse {
  success: boolean;
  error?: string;
} 