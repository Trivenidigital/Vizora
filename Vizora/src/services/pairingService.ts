import { io, Socket } from 'socket.io-client';
import { Content } from '../types';

const VIZORA_TV_URL = 'http://localhost:3003';

// Browser-compatible EventEmitter implementation
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(...args));
  }

  removeAllListeners() {
    this.events = {};
  }
}

export interface DisplayInfo {
  displayId: string;
  pairingCode: string;
  status: 'connected' | 'disconnected';
  lastSeen?: Date;
}

export class PairingService extends EventEmitter {
  private static instance: PairingService | null = null;
  private socket: Socket | null = null;
  private connectedDisplays: Map<string, DisplayInfo> = new Map();
  private connectionPromise: Promise<void> | null = null;
  private isInitialized = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000;
  private readonly serverUrl = 'http://localhost:3003'; // Middleware server URL
  private eventHandlers = {
    paired: [] as ((displayId: string) => void)[],
    pairingFailed: [] as ((error: string) => void)[],
    contentUpdateFailed: [] as ((error: string) => void)[],
    connectionStatus: [] as ((status: boolean) => void)[]
  };

  private constructor() {
    super();
  }

  public static getInstance(): PairingService {
    if (!PairingService.instance) {
      PairingService.instance = new PairingService();
    }
    return PairingService.instance;
  }

  private setupSocketListeners() {
    if (!this.socket || this.isInitialized) return;

    this.socket.on('connect', () => {
      console.log('Connected to middleware');
      this.eventHandlers.connectionStatus.forEach(handler => handler(true));
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from middleware');
      this.eventHandlers.connectionStatus.forEach(handler => handler(false));
    });

    this.socket.on('display-connected', (info: DisplayInfo) => {
      console.log('Display connected:', info);
      this.connectedDisplays.set(info.displayId, {
        ...info,
        lastSeen: new Date()
      });
      this.emit('displayConnected', info);
    });

    this.socket.on('display-disconnected', (displayId: string) => {
      console.log('Display disconnected:', displayId);
      this.connectedDisplays.delete(displayId);
      this.emit('displayDisconnected', displayId);
    });

    this.socket.on('pair-success', (displayId: string) => {
      console.log('Successfully paired with display:', displayId);
      this.eventHandlers.paired.forEach(handler => handler(displayId));
    });

    this.socket.on('pair-failed', (error: string) => {
      console.error('Pairing failed:', error);
      this.eventHandlers.pairingFailed.forEach(handler => handler(error));
    });

    this.socket.on('content-update-failed', (error: string) => {
      console.error('Content update failed:', error);
      this.eventHandlers.contentUpdateFailed.forEach(handler => handler(error));
    });

    this.isInitialized = true;
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(() => this.ensureConnection(), this.RECONNECT_DELAY);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      this.cleanup();
    }
  }

  private cleanup() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionPromise = null;
    this.connectedDisplays.clear();
    this.isInitialized = false;
    this.reconnectAttempts = 0;
  }

  private async ensureConnection(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          transports: ['websocket'],
          auth: {
            clientType: 'controller'
          }
        });

        this.setupSocketListeners();
        
        if (this.socket.connected) {
          console.log('Already connected to WebSocket server');
          this.reconnectAttempts = 0;
          resolve();
          return;
        }

        this.socket.once('connect', () => {
          console.log('Connected to WebSocket server');
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.socket.once('connect_error', (error) => {
          console.error('Connection failed:', error);
          this.emit('error', error);
          this.handleDisconnect();
          reject(error);
        });
      } catch (error) {
        console.error('Failed to connect to WebSocket server:', error);
        this.emit('error', error);
        this.handleDisconnect();
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  public async pairWithDisplay(pairingCode: string): Promise<string> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Pairing timeout - please check if the display is running and try again'));
      }, 60000); // Increased timeout to 60 seconds

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket?.off('pair-success');
        this.socket?.off('pair-failed');
      };

      this.socket.once('pair-success', (displayId: string) => {
        cleanup();
        resolve(displayId);
      });

      this.socket.once('pair-failed', (error: string) => {
        cleanup();
        reject(new Error(error));
      });

      console.log('Sending pair request with code:', pairingCode);
      this.socket.emit('pair-request', { pairingCode });
    });
  }

  public async sendContent(displayId: string, content: Content) {
    await this.ensureConnection();

    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }

    if (!this.connectedDisplays.has(displayId)) {
      throw new Error('Display not connected');
    }

    this.socket.emit('content-update', { displayId, content });
  }

  public disconnect() {
    this.cleanup();
  }

  onPaired(callback: (displayId: string) => void): void {
    this.eventHandlers.paired.push(callback);
  }

  onPairingFailed(callback: (error: string) => void): void {
    this.eventHandlers.pairingFailed.push(callback);
  }

  onContentUpdateFailed(callback: (error: string) => void): void {
    this.eventHandlers.contentUpdateFailed.push(callback);
  }

  onConnectionStatus(callback: (status: boolean) => void): void {
    this.eventHandlers.connectionStatus.push(callback);
    if (this.socket?.connected) {
      callback(true);
    }
  }
}

export const getPairingService = () => PairingService.getInstance(); 