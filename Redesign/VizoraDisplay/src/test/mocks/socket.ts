import { vi } from 'vitest';
import type { Content, ScheduleItem, DisplayStatus, DisplaySettings } from '../../types';

export class MockVizoraSocketClient {
  private listeners: Map<string, Set<Function>> = new Map();
  private connected = false;

  connect = vi.fn().mockImplementation(() => {
    this.connected = true;
    this.emit('connect');
    return Promise.resolve();
  });

  disconnect = vi.fn().mockImplementation(() => {
    this.connected = false;
    this.emit('disconnect');
    return Promise.resolve();
  });

  on = vi.fn().mockImplementation((event: string, callback: Function) => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  });

  off = vi.fn().mockImplementation((event: string, callback: Function) => {
    this.listeners.get(event)?.delete(callback);
  });

  emit = vi.fn().mockImplementation((event: string, data: any) => {
    return new Promise<void>((resolve) => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(callback => callback(data));
      }
      resolve();
    });
  });

  // Mock methods for testing
  mockEmit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  mockError(error: Error) {
    const callbacks = this.listeners.get('error');
    if (callbacks) {
      callbacks.forEach(callback => callback(error));
    }
  }

  mockStatusUpdate(status: DisplayStatus) {
    const callbacks = this.listeners.get('status:update');
    if (callbacks) {
      callbacks.forEach(callback => callback(status));
    }
  }

  mockSettingsUpdate(settings: DisplaySettings) {
    const callbacks = this.listeners.get('settings:update');
    if (callbacks) {
      callbacks.forEach(callback => callback(settings));
    }
  }

  mockScheduleUpdate(schedule: ScheduleItem[]) {
    const callbacks = this.listeners.get('schedule:update');
    if (callbacks) {
      callbacks.forEach(callback => callback(schedule));
    }
  }

  mockContentUpdate(content: Content) {
    const callbacks = this.listeners.get('content:update');
    if (callbacks) {
      callbacks.forEach(callback => callback(content));
    }
  }

  isConnected() {
    return this.connected;
  }
}

export const createMockSocketClient = () => {
  return new MockVizoraSocketClient();
}; 