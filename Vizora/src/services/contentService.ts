import { io, Socket } from 'socket.io-client';

const VIZORA_TV_URL = 'http://localhost:3003';

export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentValidationError';
  }
}

export interface Content {
  id: string;
  type: 'image' | 'video' | 'text' | 'html' | 'rss' | 'weather';
  content: {
    url?: string;
    title?: string;
    description?: string;
    html?: string;
    backgroundColor?: string;
    feeds?: string[];
  };
  metadata?: {
    checksum?: string;
    size?: number;
    mimeType?: string;
    lastModified?: Date;
    dimensions?: {
      width: number;
      height: number;
    };
  };
  security?: {
    signature?: string;
    timestamp?: number;
  };
}

interface ContentSecurityConfig {
  maxContentSize: number;
  maxUrlLength: number;
  maxRedirects: number;
  maxHtmlLength: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  maxFeeds: number;
  allowedMimeTypes: Set<string>;
  allowedDomains: Set<string>;
  urlWhitelist: Set<string>;
  bannedPatterns: RegExp[];
  sanitizeOptions: any;
  imageValidation: {
    maxWidth: number;
    maxHeight: number;
    maxAspectRatio: number;
    minAspectRatio: number;
  };
  videoValidation: {
    maxDuration: number;
    maxBitrate: number;
    allowedCodecs: Set<string>;
  };
}

class ContentService {
  private static instance: ContentService | null = null;
  private socket: Socket | null = null;
  private connectedDisplays: Map<string, Socket> = new Map();
  private contentCache: Map<string, { content: Content; timestamp: number }> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly securityConfig: ContentSecurityConfig = {
    maxContentSize: 10 * 1024 * 1024,
    maxUrlLength: 2048,
    maxRedirects: 5,
    maxHtmlLength: 50000,
    maxTitleLength: 200,
    maxDescriptionLength: 1000,
    maxFeeds: 10,
    allowedMimeTypes: new Set([
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm',
      'text/plain', 'text/html'
    ]),
    allowedDomains: new Set([
      'localhost',
      'trusted-domain.com'
    ]),
    urlWhitelist: new Set([
      'https://trusted-cdn.com',
      'https://api.weather.com',
      'https://rss.trusted-news.com'
    ]),
    bannedPatterns: [
      /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
      /javascript:/gi,
      /onerror=/gi,
      /onload=/gi,
      /eval\(/gi,
      /data:text\/html/gi
    ],
    sanitizeOptions: {},
    imageValidation: {
      maxWidth: 4096,
      maxHeight: 4096,
      maxAspectRatio: 16/9,
      minAspectRatio: 9/16
    },
    videoValidation: {
      maxDuration: 3600,
      maxBitrate: 5000000,
      allowedCodecs: new Set(['h264', 'vp8', 'vp9'])
    }
  };

  private constructor() {
    // Don't start cleanup in constructor
  }

  static getInstance(): ContentService {
    if (!ContentService.instance) {
      ContentService.instance = new ContentService();
    }
    return ContentService.instance;
  }

  private startContentCleanup(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, { timestamp }] of this.contentCache) {
        if (now - timestamp > 24 * 60 * 60 * 1000) {
          this.contentCache.delete(id);
        }
      }
    }, 60 * 60 * 1000);
  }

  private stopContentCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async ensureConnection(): Promise<void> {
    if (!this.socket?.connected) {
      // Start cleanup only when we need to connect
      this.startContentCleanup();
      
      return new Promise((resolve, reject) => {
        const socket = io(VIZORA_TV_URL, {
          transports: ['websocket'],
          autoConnect: false,
          reconnection: false,
          forceNew: true
        });

        socket.once('connect', () => {
          this.socket = socket;
          resolve();
        });

        socket.once('connect_error', (error) => {
          reject(new Error('Failed to connect: ' + error.message));
        });

        socket.connect();
      });
    }
  }

  async pushContent(displayId: string, content: Content): Promise<boolean> {
    try {
      await this.ensureConnection();

      const display = this.connectedDisplays.get(displayId);
      if (!display) {
        throw new ContentValidationError('Display not found');
      }

      if (!this.socket) {
        throw new ContentValidationError('Not connected to server');
      }

      this.socket.emit('push-content', {
        displayId,
        content,
        timestamp: Date.now()
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.socket?.off('content-received');
          resolve(false);
        }, 5000);

        this.socket?.once('content-received', ({ success, displayId: receivedDisplayId }) => {
          clearTimeout(timeout);
          resolve(success && receivedDisplayId === displayId);
        });
      });

    } catch (error) {
      console.error('Failed to push content:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        displayId,
        contentId: content.id,
        timestamp: new Date().toISOString()
      });
      return false;
    } finally {
      // Disconnect and cleanup after pushing content
      if (this.socket?.connected) {
        this.socket.disconnect();
        this.socket = null;
      }
      this.stopContentCleanup();
    }
  }

  setSocket(socket: Socket) {
    this.socket = socket;
  }

  registerDisplay(displayId: string, socket: Socket) {
    this.connectedDisplays.set(displayId, socket);
  }

  unregisterDisplay(displayId: string) {
    this.connectedDisplays.delete(displayId);
  }
}

// Export a function to get the instance instead of the instance itself
export const getContentService = () => ContentService.getInstance(); 