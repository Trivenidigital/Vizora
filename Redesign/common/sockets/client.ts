import { io, Socket } from 'socket.io-client';
import { DisplayStatus, PairingEvent } from '../types/display';
import { ContentPlaybackStatus, ContentUpdateEvent, DisplayContent } from '../types/content';

export type SocketEvent = 
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'display:status'
  | 'content:update'
  | 'content:updated'
  | 'schedule:update'
  | 'pairing:confirmed'
  | 'sync:request'
  | 'sync:complete';

export const SOCKET_EVENTS = {
  CONNECT: 'connect' as SocketEvent,
  DISCONNECT: 'disconnect' as SocketEvent,
  ERROR: 'error' as SocketEvent,
  DISPLAY_STATUS: 'display:status' as SocketEvent,
  CONTENT_UPDATE: 'content:update' as SocketEvent,
  CONTENT_UPDATED: 'content:updated' as SocketEvent,
  SCHEDULE_UPDATE: 'schedule:update' as SocketEvent,
  PAIRING_CONFIRMED: 'pairing:confirmed' as SocketEvent,
  SYNC_REQUEST: 'sync:request' as SocketEvent,
  SYNC_COMPLETE: 'sync:complete' as SocketEvent
};

export interface SocketOptions {
  url: string;
  token: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class VizoraSocketClient {
  private socket: Socket | null = null;
  private options: SocketOptions;
  private reconnectCount = 0;
  private eventHandlers: Map<SocketEvent, Set<Function>> = new Map();

  constructor(options: SocketOptions) {
    this.options = {
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      ...options
    };
  }

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(this.options.url, {
      auth: { token: this.options.token },
      reconnection: true,
      reconnectionAttempts: this.options.reconnectAttempts,
      reconnectionDelay: this.options.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.reconnectCount = 0;
  }

  on(event: SocketEvent, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  off(event: SocketEvent, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  emit(event: SocketEvent, data?: any): void {
    this.socket?.emit(event, data);
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.reconnectCount = 0;
      this.emitEvent('connect');
    });

    this.socket.on('disconnect', () => {
      this.emitEvent('disconnect');
    });

    this.socket.on('error', (error) => {
      this.emitEvent('error', error);
    });

    this.socket.on('display:status', (status: DisplayStatus) => {
      this.emitEvent('display:status', status);
    });

    this.socket.on('content:update', (data: DisplayContent[]) => {
      this.emitEvent('content:update', data);
    });

    this.socket.on('content:updated', (data: ContentUpdateEvent) => {
      this.emitEvent('content:updated', data);
    });

    this.socket.on('schedule:update', (data: any) => {
      this.emitEvent('schedule:update', data);
    });

    this.socket.on('pairing:confirmed', (data: PairingEvent) => {
      this.emitEvent('pairing:confirmed', data);
    });

    this.socket.on('sync:request', (data: any) => {
      this.emitEvent('sync:request', data);
    });

    this.socket.on('sync:complete', (data: any) => {
      this.emitEvent('sync:complete', data);
    });
  }

  private emitEvent(event: SocketEvent, data?: any): void {
    this.eventHandlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} event handler:`, error);
      }
    });
  }
} 