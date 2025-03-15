import { Socket } from 'socket.io';

// Display Types
export interface Display {
  id: string;
  socket: Socket;
  pairingCode: string;
  createdAt: string;
  lastSeen: string;
  metadata?: DisplayMetadata;
}

export interface DisplayMetadata {
  name?: string;
  location?: string;
  type?: string;
  resolution?: string;
  orientation?: 'portrait' | 'landscape';
  [key: string]: unknown;
}

// Pairing Types
export interface PairingRequest {
  pairingCode: string;
  metadata?: ControllerMetadata;
}

export interface ControllerMetadata {
  name?: string;
  type?: string;
  permissions?: string[];
  [key: string]: unknown;
}

// Content Types
export interface ContentUpdate {
  displayId: string;
  content: ContentData;
  metadata?: ContentMetadata;
}

export interface ContentData {
  type: 'url' | 'html' | 'image' | 'video';
  data: string;
  layout?: LayoutOptions;
}

export interface LayoutOptions {
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  size?: 'full' | 'half' | 'quarter';
  rotation?: number;
  scale?: number;
  [key: string]: unknown;
}

export interface ContentMetadata {
  duration?: number;
  startTime?: string;
  endTime?: string;
  priority?: number;
  tags?: string[];
  [key: string]: unknown;
}

// Event Types
export interface DisplayRegisteredEvent {
  displayId: string;
  pairingCode: string;
}

export interface PairSuccessEvent {
  displayId: string;
  metadata?: DisplayMetadata;
}

export interface PairFailedEvent {
  code: string;
  message: string;
}

export interface ContentUpdateEvent {
  content: ContentData;
  timestamp: string;
  senderId: string;
  metadata?: ContentMetadata;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: unknown;
}

// WebSocket Events
export interface ServerToClientEvents {
  'display_registered': (event: DisplayRegisteredEvent) => void;
  'pair-success': (event: PairSuccessEvent) => void;
  'pair-failed': (event: PairFailedEvent) => void;
  'content-update': (event: ContentUpdateEvent) => void;
  'error': (event: ErrorEvent) => void;
  'session_created': (event: { reconnectionToken: string }) => void;
}

export interface ClientToServerEvents {
  'register_display': () => void;
  'pair-request': (data: PairingRequest) => void;
  'content-update': (data: ContentUpdate) => void;
}

export interface Controller {
  id: string;
  socket: Socket;
  connectedDisplays: Set<string>;
}

export interface Session {
  id: string;
  displayId: string;
  controllerId: string;
  createdAt: Date;
  lastActive: Date;
}

export type ContentType = 'text' | 'image' | 'video' | 'url';

export interface Content {
  type: ContentType;
  data: unknown;
}

export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'; 