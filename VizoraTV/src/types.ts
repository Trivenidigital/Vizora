// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'error';

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: any;
  payload?: any;
  id?: string;
  displayId?: string;
  timestamp?: number;
  error?: string | Error;
  [key: string]: any; // Allow for other properties
}

// Registration response
export interface RegistrationResponse {
  displayId: string;
  pairingCode: string | null;
  originalResponse?: any;
  timestamp?: number;
  error?: string;
}

// Socket error
export interface SocketError {
  type: string;
  message: string;
  details?: any;
}

// Device info
export interface DeviceInfo {
  deviceId: string;
  userAgent: string;
  platform: string;
  resolution?: {
    width: number;
    height: number;
  };
  timestamp: number;
}

// Event emitter listener
export type EventListener = (...args: any[]) => void; 