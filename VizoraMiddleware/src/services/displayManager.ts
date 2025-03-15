import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Display } from '../types';
import { RedisStateManager } from './redisStateManager';

export class DisplayManager {
  private stateManager: RedisStateManager;

  constructor() {
    this.stateManager = new RedisStateManager();
  }

  generatePairingCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async registerDisplay(socket: Socket): Promise<Display> {
    const displayId = uuidv4();
    const pairingCode = this.generatePairingCode();

    const display: Display = {
      id: displayId,
      socket,
      pairingCode,
      status: 'online',
      lastSeen: new Date()
    };

    await this.stateManager.saveDisplay(display);
    return display;
  }

  async getDisplayByPairingCode(pairingCode: string): Promise<Display | null> {
    const displayId = await this.stateManager.getDisplayByPairingCode(pairingCode);
    if (!displayId) return null;
    
    const displayData = await this.stateManager.getDisplay(displayId);
    if (!displayData) return null;

    return displayData as Display;
  }

  async getDisplay(displayId: string): Promise<Display | null> {
    const displayData = await this.stateManager.getDisplay(displayId);
    return displayData as Display | null;
  }

  async updateDisplayStatus(displayId: string, status: Display['status']): Promise<boolean> {
    const display = await this.getDisplay(displayId);
    if (!display) return false;

    display.status = status;
    display.lastSeen = new Date();
    await this.stateManager.saveDisplay(display);
    return true;
  }

  async removeDisplay(displayId: string): Promise<void> {
    const display = await this.getDisplay(displayId);
    if (display) {
      await this.stateManager.removeDisplay(displayId, display.pairingCode);
    }
  }

  async cleanupDisconnectedDisplays(): Promise<void> {
    await this.stateManager.cleanupStaleDisplays();
  }
} 