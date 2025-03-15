export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface DisplayStatus {
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  error?: string;
}

export type ContentType = 'text' | 'image' | 'video' | 'url';

export interface Content {
  type: ContentType;
  data: unknown;
}

export interface DisplayInfo {
  displayId: string;
  pairingCode: string;
  status: DisplayStatus['status'];
}

export interface PairingData {
  displayId: string;
  controllerId: string;
}

export interface WebSocketMessage {
  type: 'pairing' | 'content' | 'status' | 'error';
  payload: any;
} 