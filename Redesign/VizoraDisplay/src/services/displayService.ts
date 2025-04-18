import { VizoraSocketClient, DisplayStatus /*, DisplaySettings */ } from '@vizora/common';
import { EventEmitter } from '../utils/EventEmitter';

export class DisplayService extends EventEmitter {
  private socket: VizoraSocketClient;
  private status: DisplayStatus | null = null;
  private settings: any | null = null; // Use any for settings for now

  constructor(socket: VizoraSocketClient) {
    super();
    this.socket = socket;
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('display:status');
    this.socket.on('display:settings');
    this.socket.on('error');
  }

  public async register(settings: any): Promise<void> {
    await this.socket.emit('display:register');
  }

  public getStatus(): DisplayStatus | null {
    return this.status;
  }

  public getSettings(): any | null {
    return this.settings;
  }

  public handleError(error: Error): void {
    this.emit('error', error);
  }

  public stop(): void {
    this.socket.off('display:status');
    this.socket.off('display:settings');
    this.socket.off('error');
  }

  async registerDisplay(displayId: string): Promise<DisplayStatus> {
    this.socket.emit('display:register');
    return new Promise((resolve) => {
      this.socket.on('display:status');
      resolve({} as DisplayStatus);
    });
  }
} 