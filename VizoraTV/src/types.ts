export interface WebSocketMessage {
  type: string;
  payload: any;
}

export interface DisplayStatus {
  status: 'online' | 'offline' | 'pairing' | 'paired';
  lastSeen?: Date;
}

export interface DisplayContent {
  type: 'text' | 'image' | 'video' | 'url';
  content: string;
  options?: {
    duration?: number;
    transition?: string;
    [key: string]: any;
  };
}

export interface PairingData {
  pairingCode: string;
  displayId?: string;
} 