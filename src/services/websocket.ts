import { io, Socket } from 'socket.io-client';
import type { DisplayStatus, DisplayMetrics } from '../types/display';

export class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private statusListeners: Map<string, (status: DisplayStatus) => void> = new Map();
  private metricsListeners: Map<string, (metrics: DisplayMetrics) => void> = new Map();

  connect() {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io('/', {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });

    this.socket.on('display:status', (status: DisplayStatus) => {
      const listener = this.statusListeners.get(status.deviceId);
      if (listener) {
        listener(status);
      }
    });

    this.socket.on('display:metrics', (metrics: DisplayMetrics) => {
      const listener = this.metricsListeners.get(metrics.deviceId);
      if (listener) {
        listener(metrics);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.statusListeners.clear();
      this.metricsListeners.clear();
    }
  }

  subscribeToStatus(deviceId: string, callback: (status: DisplayStatus) => void) {
    this.statusListeners.set(deviceId, callback);
    this.requestDisplayStatus(deviceId);
  }

  subscribeToMetrics(deviceId: string, callback: (metrics: DisplayMetrics) => void) {
    this.metricsListeners.set(deviceId, callback);
    this.requestDisplayMetrics(deviceId);
  }

  requestDisplayStatus(deviceId: string) {
    if (this.socket?.connected) {
      this.socket.emit('display:requestStatus', { deviceId });
    }
  }

  requestDisplayMetrics(deviceId: string) {
    if (this.socket?.connected) {
      this.socket.emit('display:requestMetrics', { deviceId });
    }
  }
} 