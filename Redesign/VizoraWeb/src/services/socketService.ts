import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { authService } from './authService';

interface SocketEvent {
  type: string;
  payload: unknown;
}

interface SocketMessage {
  type: string;
  data: unknown;
}

interface SocketError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface DisplayEvent {
  displayId: string;
  event: string;
  data: any;
}

export interface ContentEvent {
  contentId: string;
  event: string;
  data: any;
}

export interface SystemEvent {
  event: string;
  data: any;
}

class SocketService {
  private socket: Socket | null = null;
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private messageHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private errorHandlers: Set<(error: SocketError) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = authService.getToken();
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    this.socket = io(API_BASE_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectTimeout,
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleReconnect();
    });

    this.socket.on('error', (error: SocketError) => {
      console.error('Socket error:', error);
      this.errorHandlers.forEach(handler => handler(error));
    });

    this.socket.on('display:update', (data: DisplayEvent) => {
      this.emitEvent('display:update', data);
    });

    this.socket.on('display:status', (data: DisplayEvent) => {
      this.emitEvent('display:status', data);
    });

    this.socket.on('display:alert', (data: DisplayEvent) => {
      this.emitEvent('display:alert', data);
    });

    this.socket.on('content:update', (data: ContentEvent) => {
      this.emitEvent('content:update', data);
    });

    this.socket.on('content:status', (data: ContentEvent) => {
      this.emitEvent('content:status', data);
    });

    this.socket.on('system:notification', (data: SystemEvent) => {
      this.emitEvent('system:notification', data);
    });

    this.socket.on('system:maintenance', (data: SystemEvent) => {
      this.emitEvent('system:maintenance', data);
    });

    this.socket.on('event', (event: SocketEvent) => {
      const handlers = this.eventHandlers.get(event.type);
      if (handlers) {
        handlers.forEach(handler => handler(event.payload));
      }
    });

    this.socket.on('message', (message: SocketMessage) => {
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message.data));
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, this.reconnectTimeout * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.disconnect();
    }
  }

  onEvent(type: string, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)?.add(handler);
  }

  onMessage(type: string, handler: (data: unknown) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)?.add(handler);
  }

  onError(handler: (error: SocketError) => void): void {
    this.errorHandlers.add(handler);
  }

  emitEvent(type: string, payload: unknown): void {
    if (this.socket) {
      this.socket.emit('event', { type, payload });
    }
  }

  emitMessage(type: string, data: unknown): void {
    if (this.socket) {
      this.socket.emit('message', { type, data });
    }
  }

  removeEventHandlers(type: string): void {
    this.eventHandlers.delete(type);
  }

  removeMessageHandlers(type: string): void {
    this.messageHandlers.delete(type);
  }

  removeErrorHandler(handler: (error: SocketError) => void): void {
    this.errorHandlers.delete(handler);
  }

  subscribeToDisplay(displayId: string): void {
    this.socket?.emit('display:subscribe', { displayId });
  }

  unsubscribeFromDisplay(displayId: string): void {
    this.socket?.emit('display:unsubscribe', { displayId });
  }

  subscribeToContent(contentId: string): void {
    this.socket?.emit('content:subscribe', { contentId });
  }

  unsubscribeFromContent(contentId: string): void {
    this.socket?.emit('content:unsubscribe', { contentId });
  }

  subscribeToSystem(): void {
    this.socket?.emit('system:subscribe');
  }

  unsubscribeFromSystem(): void {
    this.socket?.emit('system:unsubscribe');
  }

  sendDisplayCommand(displayId: string, command: string, data: any): void {
    this.socket?.emit('display:command', { displayId, command, data });
  }

  sendContentCommand(contentId: string, command: string, data: any): void {
    this.socket?.emit('content:command', { contentId, command, data });
  }

  sendSystemCommand(command: string, data: any): void {
    this.socket?.emit('system:command', { command, data });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService(); 