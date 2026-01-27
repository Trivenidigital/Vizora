import { io, Socket } from 'socket.io-client';
import * as os from 'os';

interface DeviceClientConfig {
  onPairingRequired: () => void;
  onPaired: (token: string) => void;
  onPlaylistUpdate: (playlist: any) => void;
  onCommand: (command: any) => void;
  onError: (error: any) => void;
}

export class DeviceClient {
  private socket: Socket | null = null;
  private deviceToken: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 15000; // 15 seconds

  constructor(
    private apiUrl: string,
    private realtimeUrl: string,
    private config: DeviceClientConfig,
  ) {}

  async requestPairingCode(): Promise<any> {
    try {
      const deviceIdentifier = this.getDeviceIdentifier();

      const response = await fetch(`${this.apiUrl}/api/devices/pairing/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceIdentifier,
          nickname: os.hostname(),
          metadata: this.getDeviceMetadata(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to request pairing code: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error requesting pairing code:', error);
      throw error;
    }
  }

  async checkPairingStatus(code: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.apiUrl}/api/devices/pairing/status/${code}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to check pairing status: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status === 'paired' && result.deviceToken) {
        this.deviceToken = result.deviceToken;
        this.config.onPaired(result.deviceToken);
        this.connect(result.deviceToken);
      }

      return result;
    } catch (error) {
      console.error('Error checking pairing status:', error);
      throw error;
    }
  }

  connect(token: string) {
    this.deviceToken = token;

    this.socket = io(this.realtimeUrl, {
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
      console.log('Connected to realtime gateway');
      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from realtime gateway');
      this.stopHeartbeat();
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
      console.error('Socket error:', error);
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
  }

  logImpression(data: any) {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    this.socket.emit('content:impression', {
      ...data,
      timestamp: Date.now(),
    });
  }

  logError(data: any) {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    this.socket.emit('content:error', {
      ...data,
      timestamp: Date.now(),
    });
  }

  private handleCommand(command: any) {
    switch (command.type) {
      case 'reload':
        // Reload the renderer
        break;
      case 'clear_cache':
        // Clear content cache
        break;
      case 'update':
        // Trigger app update
        break;
      default:
        console.warn('Unknown command type:', command.type);
    }
  }

  private getDeviceIdentifier(): string {
    // Generate a unique device identifier
    // In production, this could be MAC address or other hardware ID
    const networkInterfaces = os.networkInterfaces();
    const firstInterface = Object.values(networkInterfaces)[0]?.[0];

    return firstInterface?.mac || `device-${Date.now()}`;
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
}
