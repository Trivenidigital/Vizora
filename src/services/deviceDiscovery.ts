import { Device } from '../types/device';

// Define event types
type EventCallback = (...args: any[]) => void;
type EventType = 'connected' | 'disconnected' | 'scanStatus' | 'scanProgress' | 'deviceFound' | 'scanComplete' | 'scanError';

class DeviceDiscoveryService {
  private eventListeners: Map<EventType, EventCallback[]> = new Map();
  private isConnected: boolean = false;
  private mockDevices: Device[] = [];
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize and connect
    this.connect();
    
    // Create some mock devices
    this.mockDevices = [
      {
        id: 'device-1',
        name: 'Samsung Smart TV',
        ip: '192.168.1.101',
        mac: '00:1A:2B:3C:4D:5E',
        type: 'Smart TV',
        status: 'online',
        lastSeen: new Date().toISOString(),
        location: 'Living Room'
      },
      {
        id: 'device-2',
        name: 'LG WebOS TV',
        ip: '192.168.1.102',
        mac: '11:2A:3B:4C:5D:6E',
        type: 'Smart TV',
        status: 'online',
        lastSeen: new Date().toISOString(),
        location: 'Conference Room'
      },
      {
        id: 'device-3',
        name: 'Amazon Fire Stick',
        ip: '192.168.1.103',
        mac: '22:3A:4B:5C:6D:7E',
        type: 'Media Player',
        status: 'online',
        lastSeen: new Date().toISOString(),
        location: 'Lobby'
      }
    ];
  }

  // Connect to the device discovery service
  private connect(): void {
    // Simulate connection delay
    setTimeout(() => {
      this.isConnected = true;
      this.emit('connected');
    }, 1000);
  }

  // Start a network scan
  public startScan(): void {
    if (!this.isConnected) {
      this.emit('scanError', { message: 'Not connected to discovery service' });
      return;
    }

    // Emit scan started event
    this.emit('scanStatus', { status: 'started' });

    let progress = 0;
    let foundCount = 0;

    // Clear any existing scan interval
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    // Simulate scan progress
    this.scanInterval = setInterval(() => {
      progress += 10;
      
      // Emit progress update
      this.emit('scanProgress', { 
        progress, 
        message: `Scanning network (${progress}%)...` 
      });

      // Randomly "find" devices
      if (progress % 20 === 0 && foundCount < this.mockDevices.length) {
        const device = this.mockDevices[foundCount];
        this.emit('deviceFound', device);
        foundCount++;
      }

      // Complete the scan
      if (progress >= 100) {
        clearInterval(this.scanInterval!);
        this.scanInterval = null;
        this.emit('scanComplete');
      }
    }, 500);
  }

  // Add a manually entered device
  public addManualDevice(deviceData: Partial<Device>): void {
    if (!deviceData.ip) {
      this.emit('scanError', { message: 'IP address is required' });
      return;
    }

    const newDevice: Device = {
      id: `manual-${Date.now()}`,
      name: deviceData.name || `Manual Device (${deviceData.ip})`,
      ip: deviceData.ip,
      mac: deviceData.mac || '00:00:00:00:00:00',
      type: deviceData.type || 'Manual Entry',
      status: 'pending',
      lastSeen: new Date().toISOString(),
      location: deviceData.location
    };

    // Add to mock devices
    this.mockDevices.push(newDevice);
    
    // Emit device found event
    this.emit('deviceFound', newDevice);
  }

  // Event listener registration
  public on(event: EventType, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  // Remove event listener
  public off(event: EventType, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event)!;
    const index = listeners.indexOf(callback);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  // Emit an event
  private emit(event: EventType, ...args: any[]): void {
    if (!this.eventListeners.has(event)) return;
    
    for (const callback of this.eventListeners.get(event)!) {
      callback(...args);
    }
  }
}

// Create and export a singleton instance
const deviceDiscoveryService = new DeviceDiscoveryService();
export default deviceDiscoveryService;
