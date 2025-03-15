import { v4 as uuidv4 } from 'uuid';
import { io, Socket } from 'socket.io-client';
import crypto from 'crypto';

// Create a browser-compatible EventEmitter
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: Function): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(...args));
  }

  once(event: string, callback: Function): void {
    const wrapper = (...args: any[]) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

// Add monitoring interfaces
interface ConnectionMetrics {
  attempts: number;
  successfulConnections: number;
  failedConnections: number;
  lastAttempt: Date | null;
  averageConnectTime: number;
  totalConnectTime: number;
  connectAttempts: number;
}

interface PairingMetrics {
  totalPairingAttempts: number;
  successfulPairings: number;
  failedPairings: number;
  averagePairingTime: number;
  totalPairingTime: number;
  pairingAttempts: number;
}

interface PerformanceMetrics {
  lastPingTime: number;
  averagePingTime: number;
  totalPings: number;
  pingTimes: number[];
  maxPingTime: number;
  minPingTime: number;
}

interface Metrics {
  connection: ConnectionMetrics;
  pairing: PairingMetrics;
  performance: PerformanceMetrics;
}

interface PerformanceStatus {
  status: 'good' | 'warning' | 'poor';
  latency: number;
  packetLoss: number;
}

const VIZORA_TV_URL = 'http://localhost:3003';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface PairingState {
  pairingCode: string;
  displayId?: string;
  connectionStatus: ConnectionStatus;
  errorMessage?: string;
}

export interface PairingResponse {
  success: boolean;
  error?: string;
  displayId?: string;
}

export interface PairingSession {
  status: 'paired' | 'expired';
  displayId?: string;
}

export interface PairingOptions {
  useQRCode?: boolean;
  manualIP?: string;
}

export class PairingError extends Error {
  constructor(
    message: string,
    public code: 'CONNECTION_ERROR' | 'PAIRING_ERROR' | 'TIMEOUT_ERROR' | 'VALIDATION_ERROR',
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'PairingError';
  }
}

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

interface Content {
  id: string;
  type: 'image' | 'video' | 'text' | 'html';
  content: string;
  metadata?: {
    duration?: number;
    transition?: 'fade' | 'slide' | 'none';
  };
}

export class PairingService {
  private socket: Socket | null = null;
  private isInitialized = false;
  private eventHandlers = {
    pairingCode: [] as ((code: string) => void)[],
    paired: [] as ((displayId: string) => void)[],
    pairingExpired: [] as (() => void)[],
    error: [] as ((error: Error) => void)[],
    contentUpdate: [] as ((content: Content) => void)[],
    connectionStatus: [] as ((status: boolean) => void)[]
  };

  private ensureConnection() {
    if (!this.socket) {
      this.socket = io('http://localhost:3003', {
        autoConnect: false,
        transports: ['websocket']
      });

      if (!this.isInitialized) {
        this.setupSocketListeners();
        this.isInitialized = true;
      }
    }

    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.eventHandlers.connectionStatus.forEach(handler => handler(true));
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.eventHandlers.connectionStatus.forEach(handler => handler(false));
    });

    this.socket.on('pairing_code', (code: string) => {
      this.eventHandlers.pairingCode.forEach(handler => handler(code));
    });

    this.socket.on('paired', (displayId: string) => {
      this.eventHandlers.paired.forEach(handler => handler(displayId));
    });

    this.socket.on('pairing_expired', () => {
      this.eventHandlers.pairingExpired.forEach(handler => handler());
    });

    this.socket.on('content_update', (content: Content) => {
      this.eventHandlers.contentUpdate.forEach(handler => handler(content));
    });

    this.socket.on('error', (error: Error) => {
      this.eventHandlers.error.forEach(handler => handler(error));
    });
  }

  registerDisplay() {
    this.ensureConnection();
    this.socket?.emit('register_display');
  }

  onPairingCode(handler: (code: string) => void) {
    this.eventHandlers.pairingCode.push(handler);
  }

  onPaired(handler: (displayId: string) => void) {
    this.eventHandlers.paired.push(handler);
  }

  onPairingExpired(handler: () => void) {
    this.eventHandlers.pairingExpired.push(handler);
  }

  onError(handler: (error: Error) => void) {
    this.eventHandlers.error.push(handler);
  }

  onContentUpdate(handler: (content: Content) => void) {
    this.ensureConnection();
    this.eventHandlers.contentUpdate.push(handler);
  }

  onConnectionStatus(handler: (status: boolean) => void) {
    this.ensureConnection();
    this.eventHandlers.connectionStatus.push(handler);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isInitialized = false;
      
      // Clear all event handlers
      Object.keys(this.eventHandlers).forEach(key => {
        this.eventHandlers[key as keyof typeof this.eventHandlers] = [];
      });
    }
  }
}

let pairingServiceInstance: PairingService | null = null;

export const getPairingService = () => {
  if (!pairingServiceInstance) {
    pairingServiceInstance = new PairingService();
  }
  return pairingServiceInstance;
}; 