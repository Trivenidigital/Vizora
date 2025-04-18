import { vi } from 'vitest';
export class MockVizoraSocketClient {
    constructor() {
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "connected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "connect", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation(() => {
                this.connected = true;
                this.emit('connect');
                return Promise.resolve();
            })
        });
        Object.defineProperty(this, "disconnect", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation(() => {
                this.connected = false;
                this.emit('disconnect');
                return Promise.resolve();
            })
        });
        Object.defineProperty(this, "on", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation((event, callback) => {
                if (!this.listeners.has(event)) {
                    this.listeners.set(event, new Set());
                }
                this.listeners.get(event)?.add(callback);
            })
        });
        Object.defineProperty(this, "off", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation((event, callback) => {
                this.listeners.get(event)?.delete(callback);
            })
        });
        Object.defineProperty(this, "emit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation((event, data) => {
                return new Promise((resolve) => {
                    const callbacks = this.listeners.get(event);
                    if (callbacks) {
                        callbacks.forEach(callback => callback(data));
                    }
                    resolve();
                });
            })
        });
    }
    // Mock methods for testing
    mockEmit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
    mockError(error) {
        const callbacks = this.listeners.get('error');
        if (callbacks) {
            callbacks.forEach(callback => callback(error));
        }
    }
    mockStatusUpdate(status) {
        const callbacks = this.listeners.get('status:update');
        if (callbacks) {
            callbacks.forEach(callback => callback(status));
        }
    }
    mockSettingsUpdate(settings) {
        const callbacks = this.listeners.get('settings:update');
        if (callbacks) {
            callbacks.forEach(callback => callback(settings));
        }
    }
    mockScheduleUpdate(schedule) {
        const callbacks = this.listeners.get('schedule:update');
        if (callbacks) {
            callbacks.forEach(callback => callback(schedule));
        }
    }
    mockContentUpdate(content) {
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
