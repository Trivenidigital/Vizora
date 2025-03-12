import { Device } from '../types/device';

export class NetworkScanner {
  private isScanning: boolean = false;
  private subnet: string | null = null;

  constructor() {
    // Initialize scanner
  }

  /**
   * Attempts to determine the local subnet based on the user's IP address
   */
  private async determineSubnet(): Promise<string> {
    try {
      // This is a simplified approach that may not work in all environments
      // In a real implementation, we would use more robust methods
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      
      // For demo purposes, we'll just return a common subnet
      return '192.168.1.0';
    } catch (error) {
      console.error('Error determining subnet:', error);
      throw new Error('Could not determine local IP address');
    }
  }

  /**
   * Scans the network for compatible display devices
   * @param progressCallback Function to call with progress updates (0-100)
   * @param deviceFoundCallback Function to call when a device is found
   * @param manualSubnet Optional subnet to scan (e.g., "192.168.1.0")
   * @returns Promise that resolves with an array of found devices
   */
  async scanNetwork(
    progressCallback: (progress: number) => void,
    deviceFoundCallback: (device: Device) => void,
    manualSubnet?: string
  ): Promise<Device[]> {
    if (this.isScanning) {
      throw new Error('A scan is already in progress');
    }

    this.isScanning = true;
    const foundDevices: Device[] = [];
    
    try {
      // Determine subnet if not provided manually
      this.subnet = manualSubnet || await this.determineSubnet();
      
      // For demo purposes, we'll simulate finding devices
      // In a real implementation, we would use network scanning techniques
      const totalIps = 20; // Simulate scanning 20 IPs
      
      for (let i = 1; i <= totalIps; i++) {
        if (!this.isScanning) break; // Check if scan was stopped
        
        // Update progress
        const progress = Math.floor((i / totalIps) * 100);
        progressCallback(progress);
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Randomly "find" some devices (for demo purposes)
        if (i % 5 === 0 || i % 7 === 0) {
          const device: Device = this.createMockDevice(i);
          foundDevices.push(device);
          deviceFoundCallback(device);
        }
      }
      
      progressCallback(100);
      this.isScanning = false;
      return foundDevices;
      
    } catch (error) {
      this.isScanning = false;
      throw error;
    }
  }

  /**
   * Stops an ongoing network scan
   */
  stopScan(): void {
    this.isScanning = false;
  }

  /**
   * Creates a mock device for demonstration purposes
   */
  private createMockDevice(index: number): Device {
    const types = ['Smart TV', 'Media Player', 'Android TV', 'Fire TV Stick'];
    const names = ['Samsung TV', 'LG Display', 'Sony Bravia', 'Amazon Fire Stick', 'Roku Player'];
    
    const ip = `192.168.1.${100 + index}`;
    const type = types[Math.floor(Math.random() * types.length)];
    const name = `${names[Math.floor(Math.random() * names.length)]} ${index}`;
    
    return {
      id: `device-${index}`,
      name,
      ip,
      mac: this.generateRandomMac(),
      type,
      status: 'online',
      lastSeen: new Date().toISOString()
    };
  }

  /**
   * Generates a random MAC address for demo purposes
   */
  private generateRandomMac(): string {
    return Array.from({ length: 6 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':');
  }
}
