import { io, Socket } from 'socket.io-client';

const VIZORA_TV_URL = 'http://localhost:3003';

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

class PairingService {
  private socket: Socket | null = null;
  private static instance: PairingService | null = null;
  private isInitialized = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): PairingService {
    if (!PairingService.instance) {
      PairingService.instance = new PairingService();
    }
    return PairingService.instance;
  }

  private async ensureConnection(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      throw new Error('Max connection attempts reached');
    }

    if (!this.socket && !this.isInitialized) {
      this.socket = io(VIZORA_TV_URL, {
        autoConnect: false,
        transports: ['websocket'],
        reconnection: false, // Disable auto reconnection
        timeout: 5000 // 5 second timeout
      });

      this.setupSocketListeners();
      this.isInitialized = true;
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Failed to initialize socket'));
        return;
      }

      const timeoutId = setTimeout(() => {
        this.socket?.off('connect');
        this.socket?.off('connect_error');
        reject(new Error('Connection timeout'));
      }, 5000);

      this.socket.once('connect', () => {
        clearTimeout(timeoutId);
        this.connectionAttempts = 0;
        resolve();
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeoutId);
        this.connectionAttempts++;
        reject(error);
      });

      this.socket.connect();
    });
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  async startPairing(options: PairingOptions = {}): Promise<{ qrCode?: string; pairingCode: string }> {
    await this.ensureConnection();
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to VizoraTV server'));
        return;
      }

      this.socket.emit('pairing:start', options, (response: any) => {
        if (response.success) {
          resolve({
            qrCode: response.qrCode,
            pairingCode: response.pairingCode
          });
        } else {
          reject(new Error(response.error || 'Failed to start pairing'));
        }
      });
    });
  }

  async pairWithDisplay(pairingCode: string): Promise<PairingResponse> {
    try {
      await this.ensureConnection();

      return new Promise((resolve) => {
        if (!this.socket?.connected) {
          resolve({
            success: false,
            error: 'Not connected to server'
          });
          return;
        }

        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: 'Pairing request timed out'
          });
        }, 10000);

        this.socket.emit('pairing:request', { pairingCode }, (response: any) => {
          clearTimeout(timeout);
          
          if (response.success) {
            resolve({
              success: true,
              displayId: response.displayId
            });
          } else {
            resolve({
              success: false,
              error: response.error || 'Pairing failed'
            });
          }
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to server'
      };
    }
  }

  async checkPairingStatus(): Promise<PairingSession> {
    await this.ensureConnection();
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to VizoraTV server'));
        return;
      }

      this.socket.emit('pairing:status', (response: any) => {
        if (response.success) {
          resolve({
            status: response.status,
            displayId: response.displayId
          });
        } else {
          reject(new Error(response.error || 'Failed to check pairing status'));
        }
      });
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isInitialized = false;
      this.connectionAttempts = 0;
    }
  }
}

export const getPairingService = () => PairingService.getInstance();




