import { io, Socket } from 'socket.io-client';

export interface Device {
  id: string;
  name: string;
  type: string;
  ip: string;
  port?: number;
  location?: string;
  manufacturer?: string;
  model?: string;
}

export interface ScanStatus {
  status: 'idle' | 'scanning' | 'completed' | 'error';
  message?: string;
}

export interface DeviceDiscoveryListener {
  onConnectionStatusChange: (isConnected: boolean) => void;
  onScanStatusChange: (status: ScanStatus) => void;
  onDeviceFound: (device: Device) => void;
  onScanComplete: () => void;
  onScanError: (error: string) => void;
}

class DeviceDiscoveryService {
  private socket: Socket | null = null;
  private listeners: DeviceDiscoveryListener[] = [];
  private isConnecting: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000;

  constructor() {
    this.connect();
  }

  private clearTimeouts() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private connect() {
    if (this.isConnecting || this.socket?.connected) {
      console.log('Already connecting or connected, skipping connection attempt');
      return;
    }

    this.isConnecting = true;
    console.log('Attempting to connect to network scanner server...');

    try {
      this.socket = io('http://localhost:3002', {
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 10000,
        path: '/socket.io'
      });

      this.socket.on('connect', () => {
        console.log('Connected to network scanner server');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.clearTimeouts();
        this.notifyListeners('onConnectionStatusChange', true);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from network scanner server:', reason);
        this.isConnecting = false;
        this.notifyListeners('onConnectionStatusChange', false);
        this.handleConnectionError();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.handleConnectionError();
      });

      this.socket.on('scanStatus', (status: ScanStatus) => {
        console.log('Received scan status:', status);
        this.notifyListeners('onScanStatusChange', status);
      });

      this.socket.on('deviceFound', (device: Device) => {
        console.log('Device found:', device);
        this.notifyListeners('onDeviceFound', device);
      });

      this.socket.on('scanComplete', () => {
        console.log('Scan completed');
        this.notifyListeners('onScanComplete');
      });

      this.socket.on('scanError', (error: { message: string }) => {
        console.error('Scan error:', error);
        this.notifyListeners('onScanError', error.message);
      });

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.socket?.connected) {
          console.error('Connection timeout');
          this.handleConnectionError();
        }
      }, 10000);

    } catch (error) {
      console.error('Error creating socket connection:', error);
      this.handleConnectionError();
    }
  }

  private handleConnectionError() {
    this.clearTimeouts();
    this.isConnecting = false;

    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, this.RECONNECT_DELAY);
    } else {
      console.error('Max reconnection attempts reached');
      this.notifyListeners('onConnectionStatusChange', false);
      this.notifyListeners('onScanError', 'Failed to connect to network scanner server');
    }
  }

  private notifyListeners<T extends keyof DeviceDiscoveryListener>(
    method: T,
    ...args: Parameters<DeviceDiscoveryListener[T]>
  ) {
    this.listeners.forEach(listener => {
      try {
        (listener[method] as Function)(...args);
      } catch (error) {
        console.error(`Error notifying listener ${method}:`, error);
      }
    });
  }

  public addListener(listener: DeviceDiscoveryListener) {
    this.listeners.push(listener);
    // Immediately notify of current connection status
    if (this.socket?.connected) {
      listener.onConnectionStatusChange(true);
    }
  }

  public removeListener(listener: DeviceDiscoveryListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public startScan() {
    if (!this.socket?.connected) {
      console.error('Cannot start scan: Not connected to server');
      this.notifyListeners('onScanError', 'Not connected to network scanner server');
      return;
    }

    console.log('Starting network scan...');
    this.socket.emit('startScan');
  }

  public stopScan() {
    if (!this.socket?.connected) {
      console.error('Cannot stop scan: Not connected to server');
      return;
    }

    console.log('Stopping network scan...');
    this.socket.emit('stopScan');
  }

  public disconnect() {
    console.log('Disconnecting from network scanner server...');
    this.clearTimeouts();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.notifyListeners('onConnectionStatusChange', false);
  }
}

export const deviceDiscoveryService = new DeviceDiscoveryService(); 