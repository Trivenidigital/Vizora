import { io, Socket } from 'socket.io-client';
import { ConnectionStatus } from '../types';

type RegistrationCallback = (data: { displayId: string; pairingCode: string }) => void;
type ConnectionCallback = (status: ConnectionStatus) => void;
type ContentCallback = (content: any) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private readonly serverUrl: string;
  private isConnecting = false;
  private connectionCallback: ConnectionCallback | null = null;
  private registrationCallback: RegistrationCallback | null = null;
  private contentCallback: ContentCallback | null = null;

  constructor() {
    this.serverUrl = 'http://localhost:3003'; // Middleware server URL
    this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isConnecting || this.socket?.connected) {
      return;
    }

    this.isConnecting = true;
    this.connectionCallback?.('connecting');

    try {
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 45000,
        transports: ['websocket'],
        auth: {
          clientType: 'display'
        }
      });

      this.setupSocketListeners();
    } catch (error) {
      console.error('Failed to connect to middleware:', error);
      this.connectionCallback?.('error');
      this.isConnecting = false;
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to middleware');
      this.isConnecting = false;
      this.connectionCallback?.('connected');
      // Register as a display after connection
      this.socket?.emit('register_display');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from middleware');
      this.connectionCallback?.('disconnected');
    });

    this.socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.connectionCallback?.('error');
    });

    this.socket.on('display_registered', (data: { displayId: string; pairingCode: string }) => {
      console.log('Display registered:', data);
      this.registrationCallback?.(data);
    });

    this.socket.on('paired', (data: { controllerId: string }) => {
      console.log('Successfully paired with controller:', data.controllerId);
    });

    this.socket.on('content-update', (content: any) => {
      console.log('Received content update:', content);
      this.contentCallback?.(content);
    });
  }

  onConnectionChange(callback: ConnectionCallback): void {
    this.connectionCallback = callback;
    if (this.socket?.connected) {
      callback('connected');
    }
  }

  onRegistration(callback: RegistrationCallback): void {
    this.registrationCallback = callback;
  }

  onContentUpdate(callback: ContentCallback): void {
    this.contentCallback = callback;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

// Create a singleton instance
const websocketService = new WebSocketService();
export { websocketService }; 