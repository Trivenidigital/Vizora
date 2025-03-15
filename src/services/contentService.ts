import { io, Socket } from 'socket.io-client';

const VIZORA_TV_URL = 'http://localhost:3003';

export interface ContentUpdate {
  type: 'image' | 'video' | 'html' | 'text';
  content: any;
  metadata?: Record<string, any>;
}

class ContentService {
  private socket: Socket | null = null;
  private static instance: ContentService | null = null;
  private isInitialized = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ContentService {
    if (!ContentService.instance) {
      ContentService.instance = new ContentService();
    }
    return ContentService.instance;
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
      console.log('Disconnected from content server');
    });

    this.socket.on('error', (error) => {
      console.error('Content service error:', error);
    });
  }

  async pushContent(displayId: string, content: ContentUpdate): Promise<boolean> {
    try {
      await this.ensureConnection();

      return new Promise((resolve) => {
        if (!this.socket?.connected) {
          resolve(false);
          return;
        }

        const timeout = setTimeout(() => {
          resolve(false);
        }, 10000);

        this.socket.emit('content:push', { displayId, content }, (response: any) => {
          clearTimeout(timeout);
          resolve(response?.success ?? false);
        });
      });
    } catch (error) {
      console.error('Content service error:', error);
      return false;
    }
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

export const getContentService = () => ContentService.getInstance(); 