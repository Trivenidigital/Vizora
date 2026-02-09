import { io, Socket } from 'socket.io-client';
import * as os from 'os';
import * as http from 'http';

interface DeviceClientConfig {
  onPairingRequired: () => void;
  onPaired: (token: string) => void;
  onPlaylistUpdate: (playlist: any) => void;
  onCommand: (command: any) => void;
  onError: (error: any) => void;
}

export class DeviceClient {
  private socket: Socket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 15000; // 15 seconds
  private cachedDeviceIdentifier: string | null = null;

  constructor(
    private apiUrl: string,
    private realtimeUrl: string,
    private config: DeviceClientConfig,
    private store?: any, // electron-store instance
  ) {}

  async requestPairingCode(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const deviceIdentifier = this.getDeviceIdentifier();
        const payload = JSON.stringify({
          deviceIdentifier,
          nickname: os.hostname(),
          metadata: this.getDeviceMetadata(),
        });

        console.log('[DeviceClient] Requesting pairing code from:', `${this.apiUrl}/api/devices/pairing/request`);
        console.log('[DeviceClient] Device Identifier:', deviceIdentifier);
        console.log('[DeviceClient] Nickname:', os.hostname());

        // Fix localhost resolution to IPv4 instead of IPv6
        const urlStr = `${this.apiUrl}/api/devices/pairing/request`.replace(/localhost/g, '127.0.0.1');
        const url = new URL(urlStr);
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        };

        const req = http.request(url, options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            console.log('[DeviceClient] Response received, status:', res.statusCode);
            console.log('[DeviceClient] Response data length:', data.length);
            if (res.statusCode === 200 || res.statusCode === 201) {
              try {
                const result = JSON.parse(data);
                console.log('[DeviceClient] ✅ Pairing code received successfully:', result.code);
                console.log('[DeviceClient] QR Code present:', !!result.qrCode);
                if (result.qrCode) {
                  console.log('[DeviceClient] QR Code length:', result.qrCode.length);
                }
                resolve(result);
              } catch (e: any) {
                console.error('[DeviceClient] ❌ Failed to parse response as JSON:', e.message);
                console.error('[DeviceClient] Response preview:', data.substring(0, 300));
                reject(new Error('Failed to parse response: ' + data));
              }
            } else if (res.statusCode === 400) {
              // Device already paired - ignore and just display error as pairing failure
              try {
                const errorData = JSON.parse(data);
                if (errorData.message && errorData.message.includes('already paired')) {
                  console.error('[DeviceClient] Device already paired error');
                  console.error('[DeviceClient] Pairing will retry with new request...');
                }
              } catch (e) {
                // Continue with normal error handling
              }
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (error: any) => {
          console.error('[DeviceClient] *** REQUEST ERROR:', error.message || error);
          console.error('[DeviceClient] Full error:', error);
          console.error('[DeviceClient] Is middleware running at', this.apiUrl, '?');
          reject(error);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(payload);
        req.end();
      } catch (error) {
        console.error('[DeviceClient] Error preparing request:', error);
        reject(error);
      }
    });
  }

  async checkPairingStatus(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Fix localhost resolution to IPv4 instead of IPv6
        const urlStr = `${this.apiUrl}/api/devices/pairing/status/${code}`.replace(/localhost/g, '127.0.0.1');
        const url = new URL(urlStr);
        const options = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const req = http.request(url, options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const result = JSON.parse(data) as { status?: string; deviceToken?: string };

                if (result.status === 'paired' && result.deviceToken) {
                  console.log('[DeviceClient] ✅ ✅ ✅ DEVICE PAIRED! Token received');
                  console.log('[DeviceClient] Token length:', result.deviceToken.length);
                  console.log('[DeviceClient] Token preview:', result.deviceToken.substring(0, 50) + '...');
                  console.log('[DeviceClient] About to call config.onPaired callback...');
                  try {
                    this.config.onPaired(result.deviceToken);
                    console.log('[DeviceClient] ✅ config.onPaired callback executed successfully');
                  } catch (callbackError) {
                    console.error('[DeviceClient] ❌ ERROR in onPaired callback:', callbackError);
                  }
                  console.log('[DeviceClient] Connecting to realtime gateway with token...');
                  try {
                    this.connect(result.deviceToken);
                    console.log('[DeviceClient] ✅ Connection initiated successfully');
                  } catch (connectError) {
                    console.error('[DeviceClient] ❌ ERROR connecting to realtime gateway:', connectError);
                  }
                }

                resolve(result);
              } else if (res.statusCode === 404) {
                // Pairing not yet complete
                resolve({ status: 'pending' });
              } else {
                reject(new Error(`HTTP ${res.statusCode}`));
              }
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          });
        });

        req.on('error', (error) => {
          console.error('[DeviceClient] Check status error:', error);
          reject(error);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  connect(token: string) {
    // Fix localhost resolution to IPv4 for WebSocket
    const realtimeUrl = this.realtimeUrl.replace(/localhost/g, '127.0.0.1');
    console.log('[DeviceClient] Connecting to realtime gateway:', realtimeUrl);

    this.socket = io(realtimeUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[DeviceClient] Connected to realtime gateway');
      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      console.log('[DeviceClient] Disconnected from realtime gateway');
      this.stopHeartbeat();
    });

    this.socket.on('connect_error', (error) => {
      console.error('[DeviceClient] Connection error:', error.message);
      if (error.message.includes('unauthorized') || error.message.includes('invalid token')) {
        console.log('[DeviceClient] Token rejected, clearing and re-entering pairing');
        this.store?.delete('deviceToken');
        this.socket?.disconnect();
        this.config.onPairingRequired();
      }
    });

    this.socket.on('config', (config) => {
      console.log('Received configuration:', config);
    });

    this.socket.on('playlist:update', (data) => {
      console.log('Received playlist update:', data);
      this.config.onPlaylistUpdate(data.playlist);
    });

    this.socket.on('command', (data) => {
      console.log('Received command:', data);
      this.config.onCommand(data);
      this.handleCommand(data);
    });

    this.socket.on('error', (error) => {
      console.error('[DeviceClient] Socket error:', error);
      this.config.onError(error);
    });
  }

  disconnect() {
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat({});
    }, this.heartbeatIntervalMs);

    // Send first heartbeat immediately
    this.sendHeartbeat({});
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  sendHeartbeat(data: any) {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    try {
      const heartbeatData = {
        timestamp: Date.now(),
        metrics: {
          cpuUsage: this.getCpuUsage(),
          memoryUsage: this.getMemoryUsage(),
          storageUsed: 0, // TODO: Implement storage tracking
        },
        currentContent: data.currentContent || null,
        status: 'online',
      };

      this.socket.emit('heartbeat', heartbeatData, (response: any) => {
        if (response && response.commands) {
          response.commands.forEach((cmd: any) => this.handleCommand(cmd));
        }
      });
    } catch (error) {
      console.error('[DeviceClient] Error sending heartbeat:', error);
      // Socket will auto-reconnect due to reconnection: true setting
    }
  }

  logImpression(data: any) {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    try {
      this.socket.emit('content:impression', {
        ...data,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[DeviceClient] Error logging impression:', error);
    }
  }

  logError(data: any) {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    try {
      this.socket.emit('content:error', {
        ...data,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[DeviceClient] Error logging error:', error);
    }
  }

  private handleCommand(command: any) {
    switch (command.type) {
      case 'reload':
        console.log('[DeviceClient] Executing reload command');
        try {
          const { BrowserWindow } = require('electron');
          const mainWindow = BrowserWindow.getAllWindows()[0];
          if (mainWindow) {
            mainWindow.reload();
            console.log('[DeviceClient] Reload complete');
          } else {
            console.warn('[DeviceClient] No window found for reload');
          }
        } catch (err) {
          console.error('[DeviceClient] Reload failed:', err);
        }
        break;
      case 'clear_cache':
        console.log('[DeviceClient] Executing clear_cache command');
        try {
          const { session } = require('electron');
          session.defaultSession.clearCache().then(() => {
            console.log('[DeviceClient] Cache cleared successfully');
          }).catch((err: any) => {
            console.error('[DeviceClient] Cache clear failed:', err);
          });
        } catch (err) {
          console.error('[DeviceClient] clear_cache failed:', err);
        }
        break;
      case 'update':
        console.log('[DeviceClient] Update command received');
        // Stub for autoUpdater integration
        // In production, this would trigger electron-updater:
        // const { autoUpdater } = require('electron-updater');
        // autoUpdater.checkForUpdatesAndNotify();
        console.log('[DeviceClient] Auto-update not yet configured. Update payload:', command.payload);
        break;
      default:
        console.warn('Unknown command type:', command.type);
    }
  }

  private getDeviceIdentifier(): string {
    // Return cached identifier if available (persistence across calls)
    if (this.cachedDeviceIdentifier) {
      return this.cachedDeviceIdentifier;
    }

    // Try to load from electron-store if available
    if (this.store) {
      const storedId = this.store.get('deviceIdentifier') as string | undefined;
      if (storedId) {
        console.log('[DeviceClient] Loaded persisted device identifier from store');
        this.cachedDeviceIdentifier = storedId;
        return storedId;
      }
    }

    // Generate a unique device identifier once
    // In production, this could be MAC address or other hardware ID
    const networkInterfaces = os.networkInterfaces();
    const firstInterface = Object.values(networkInterfaces)[0]?.[0];
    const mac = firstInterface?.mac || `device-${Date.now()}`;

    // Generate random suffix once and reuse it
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const deviceIdentifier = `${mac}-${randomSuffix}`;

    // Persist the identifier for future use
    if (this.store) {
      this.store.set('deviceIdentifier', deviceIdentifier);
      console.log('[DeviceClient] Persisted new device identifier to store:', deviceIdentifier);
    }

    this.cachedDeviceIdentifier = deviceIdentifier;
    return deviceIdentifier;
  }

  private getDeviceMetadata() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      type: os.type(),
      release: os.release(),
    };
  }

  private getCpuUsage(): number {
    // Simple CPU usage calculation
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (idle / total) * 100;

    return Math.round(usage * 100) / 100;
  }

  private getMemoryUsage(): number {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = (usedMem / totalMem) * 100;

    return Math.round(usage * 100) / 100;
  }

  private async unpairDevice(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const deviceIdentifier = this.getDeviceIdentifier();
        const urlStr = `${this.apiUrl}/api/devices/pairing/unpair`.replace(/localhost/g, '127.0.0.1');
        const url = new URL(urlStr);
        const payload = JSON.stringify({ deviceIdentifier });

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        };

        const req = http.request(url, options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 204) {
              console.log('[DeviceClient] Device unpaired successfully');
              resolve();
            } else {
              console.warn('[DeviceClient] Failed to unpair device:', res.statusCode);
              // Don't fail - continue with pairing anyway
              resolve();
            }
          });
        });

        req.on('error', () => {
          // Network error - continue anyway
          resolve();
        });

        req.setTimeout(5000, () => {
          req.destroy();
          resolve();
        });

        req.write(payload);
        req.end();
      } catch (error) {
        console.error('[DeviceClient] Error unpairing device:', error);
        resolve(); // Continue anyway
      }
    });
  }
}
