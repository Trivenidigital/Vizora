import { VizoraSocketClient } from '../services/socketClient';
import type { DisplayStatus, DisplaySettings } from '../types';
import { EventEmitter } from '../utils/EventEmitter';

export class DisplayService extends EventEmitter {
  private socket: VizoraSocketClient;
  private status: DisplayStatus | null = null;
  private settings: DisplaySettings | null = null;

  constructor(socket: VizoraSocketClient) {
    super();
    this.socket = socket;
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('display:status', (status: DisplayStatus) => {
      this.status = status;
      this.emit('display:status', status);
    });

    this.socket.on('display:settings', (settings: DisplaySettings) => {
      this.settings = settings;
      this.emit('display:settings', settings);
    });

    this.socket.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  public async register(settings: DisplaySettings): Promise<void> {
    try {
      this.settings = settings;
      await this.socket.emit('display:register', settings);
      this.emit('display:registered', settings);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public getStatus(): DisplayStatus | null {
    return this.status;
  }

  public getSettings(): DisplaySettings | null {
    return this.settings;
  }

  public handleError(error: Error): void {
    this.emit('error', error);
  }

  public stop(): void {
    this.socket.off('display:status');
    this.socket.off('display:settings');
    this.socket.off('error');
    this.removeAllListeners();
  }
} 