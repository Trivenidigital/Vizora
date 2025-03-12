import { Device } from '../types/device';

// Define the Device interface if not already defined elsewhere
export interface NetworkScannerOptions {
  timeout?: number;
  ports?: number[];
  subnetMask?: string;
  manualSubnet?: string;
}

export class NetworkScanner {
  private options: NetworkScannerOptions;
  private isScanning: boolean = false;
  private abortController: AbortController | null = null;

  constructor(options: NetworkScannerOptions = {}) {
    this.options = {
      // Include ports for various devices:
      // - Samsung Smart TVs: 8001, 8002, 7676, 9197
      // - Amazon Fire Stick: 8008, 8009, 9080, 9998, 9955
      // - Standard HTTP/HTTPS: 80, 443
      // - DLNA/UPnP: 1900, 5000
      // - Other common media device ports: 8080, 8000, 7000
      ports: options.ports || [
        // Samsung TV ports
        8001, 8002, 7676, 9197,
        // Fire Stick ports
        8008, 8009, 9080, 9998, 9955,
        // Standard web ports
        80, 443, 8080, 8000,
        // DLNA/UPnP ports
        1900, 5000, 7000
      ],
      timeout: options.timeout || 1500, // Reduced timeout for faster scanning
      subnetMask: options.subnetMask || '255.255.255.0',
      manualSubnet: options.manualSubnet || null
    };
  }

  /**
   * Get the local IP address of the client
   * This is a best-effort approach as browsers have limited access to network information
   */
  async getLocalIpAddress(): Promise<string | null> {
    // If a manual subnet is provided, use it
    if (this.options.manualSubnet) {
      return this.options.manualSubnet;
    }
    
    try {
      // Use WebRTC to try to get local IP with multiple STUN servers for better results
      const pc = new RTCPeerConnection({
        iceServers: [
          {urls: 'stun:stun.l.google.com:19302'},
          {urls: 'stun:stun1.l.google.com:19302'},
          {urls: 'stun:stun2.l.google.com:19302'}
        ]
      });
      
      pc.createDataChannel('');
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      return new Promise<string | null>((resolve) => {
        const timeoutId = setTimeout(() => {
          pc.close();
          resolve(null); // Timeout if we can't get the IP
        }, 3000); // Increased timeout for better chance of success
        
        pc.onicecandidate = (ice) => {
          if (!ice.candidate) return;
          
          // Look for IPv4 address in the candidate string
          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
          const match = ipRegex.exec(ice.candidate.candidate);
          
          if (match && match[1] && !match[1].startsWith('127.')) {
            clearTimeout(timeoutId);
            pc.onicecandidate = null;
            pc.close();
            resolve(match[1]);
          }
        };
      });
    } catch (error) {
      console.error('Error getting local IP:', error);
      return null;
    }
  }

  /**
   * Generate a list of IP addresses to scan based on the local IP
   */
  private generateIpRange(baseIp: string): string[] {
    const ipParts = baseIp.split('.');
    const ipRange: string[] = [];
    
    // Generate IPs in the same subnet (assuming a /24 subnet)
    for (let i = 1; i < 255; i++) {
      ipRange.push(`${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${i}`);
    }
    
    return ipRange;
  }

  /**
   * Check if a specific IP and port combination is reachable
   * With special handling for device detection
   */
  private async checkHost(ip: string, port: number): Promise<{reachable: boolean, deviceType: string | null}> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
      
      // Determine URL based on port
      let url = `http://${ip}:${port}/`;
      
      // Samsung Smart TVs have a specific API endpoint
      if (port === 8001 || port === 8002) {
        url = `http://${ip}:${port}/api/v2/`;
      }
      
      // Fire Stick specific endpoints
      if (port === 8008 || port === 8009) {
        url = `http://${ip}:${port}/ssdp/device-desc.xml`;
      }
      
      // Try to fetch from the IP:port
      const response = await fetch(url, {
        mode: 'no-cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Determine device type based on port
      let deviceType = null;
      
      // Samsung TV ports
      if (port === 8001 || port === 8002 || port === 7676 || port === 9197) {
        deviceType = 'Samsung Smart TV';
      }
      // Fire Stick ports
      else if (port === 8008 || port === 8009 || port === 9080 || port === 9998 || port === 9955) {
        deviceType = 'Amazon Fire Stick';
      }
      // DLNA/UPnP ports
      else if (port === 1900 || port === 5000) {
        deviceType = 'DLNA Device';
      }
      
      return { reachable: true, deviceType };
    } catch (error) {
      // If aborted or network error, the host is likely not reachable
      return { reachable: false, deviceType: null };
    }
  }

  /**
   * Scan the network for devices
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
    this.abortController = new AbortController();
    const devices: Device[] = [];
    
    try {
      // If manual subnet is provided for this scan, use it
      if (manualSubnet) {
        this.options.manualSubnet = manualSubnet;
      }
      
      // Get local IP address
      let localIp = await this.getLocalIpAddress();
      
      // If we couldn't get the IP and no manual subnet was provided, try common subnets
      if (!localIp && !manualSubnet) {
        const commonSubnets = ['192.168.1.0', '192.168.0.0', '10.0.0.0', '172.16.0.0'];
        
        // Try to scan common subnets
        for (const subnet of commonSubnets) {
          if (!this.isScanning) break;
          
          progressCallback(5); // Show some initial progress
          console.log(`Trying common subnet: ${subnet}`);
          
          const subnetDevices = await this.scanSubnet(subnet, progressCallback, deviceFoundCallback);
          
          if (subnetDevices.length > 0) {
            // We found devices in this subnet, add them to our list
            devices.push(...subnetDevices);
            break;
          }
        }
        
        // If we still didn't find any devices, use mock devices
        if (devices.length === 0) {
          const mockDevices = this.generateMockDevices();
          mockDevices.forEach(device => {
            devices.push(device);
            deviceFoundCallback(device);
          });
        }
        
        progressCallback(100);
        return devices;
      }
      
      // If we have a local IP or manual subnet, scan that subnet
      if (localIp || manualSubnet) {
        const subnet = localIp || manualSubnet!;
        const subnetDevices = await this.scanSubnet(subnet, progressCallback, deviceFoundCallback);
        devices.push(...subnetDevices);
      }
      
      return devices;
    } catch (error) {
      console.error('Error scanning network:', error);
      throw error;
    } finally {
      this.isScanning = false;
      this.abortController = null;
    }
  }

  /**
   * Scan a specific subnet for devices
   */
  private async scanSubnet(
    subnet: string,
    progressCallback: (progress: number) => void,
    deviceFoundCallback: (device: Device) => void
  ): Promise<Device[]> {
    const devices: Device[] = [];
    
    // Generate IP range to scan
    const ipRange = this.generateIpRange(subnet);
    const totalHosts = ipRange.length * this.options.ports!.length;
    let scannedHosts = 0;
    
    // Use a more efficient scanning approach - scan multiple IPs in parallel
    const batchSize = 10; // Number of IPs to scan in parallel
    
    for (let i = 0; i < ipRange.length; i += batchSize) {
      if (!this.isScanning) break;
      
      const ipBatch = ipRange.slice(i, i + batchSize);
      
      // For each IP in the batch, scan all ports
      await Promise.all(ipBatch.map(async (ip) => {
        if (!this.isScanning) return;
        
        // Try each port for this IP
        for (const port of this.options.ports!) {
          if (!this.isScanning) break;
          
          const result = await this.checkHost(ip, port);
          scannedHosts++;
          
          // Update progress
          progressCallback(Math.floor((scannedHosts / totalHosts) * 100));
          
          if (result.reachable) {
            // Try to get device info
            const deviceInfo = await this.getDeviceInfo(ip, port, result.deviceType);
            
            // Check if we already found this device (by IP)
            const existingDevice = devices.find(d => d.ip === ip);
            if (!existingDevice) {
              devices.push(deviceInfo);
              deviceFoundCallback(deviceInfo);
            }
          }
        }
      }));
    }
    
    return devices;
  }

  /**
   * Try to get more information about a device
   */
  private async getDeviceInfo(ip: string, port: number, deviceType: string | null): Promise<Device> {
    let name = `Device at ${ip}:${port}`;
    let type = deviceType || this.guessDeviceType(port);
    let resolution = '1920x1080';
    
    // Set device-specific information
    if (type === 'Samsung Smart TV') {
      name = `Samsung Smart TV (${ip})`;
      resolution = '3840x2160'; // Assume 4K for Samsung TVs
    } else if (type === 'Amazon Fire Stick') {
      name = `Amazon Fire Stick (${ip})`;
      resolution = '1920x1080'; // Fire Sticks typically support 1080p
    }
    
    const id = `dev-${ip.replace(/\./g, '-')}`;
    
    return {
      id,
      name,
      ip,
      type,
      status: 'online',
      lastSeen: new Date().toISOString(),
      resolution
    };
  }

  /**
   * Generate mock devices for testing when real scanning isn't possible
   */
  private generateMockDevices(): Device[] {
    const mockDevices: Device[] = [
      {
        id: 'dev-192-168-1-100',
        name: 'Samsung Smart TV (Simulated)',
        ip: '192.168.1.100',
        type: 'Samsung Smart TV',
        status: 'online',
        lastSeen: new Date().toISOString(),
        resolution: '3840x2160'
      },
      {
        id: 'dev-192-168-1-101',
        name: 'Amazon Fire Stick (Simulated)',
        ip: '192.168.1.101',
        type: 'Amazon Fire Stick',
        status: 'online',
        lastSeen: new Date().toISOString(),
        resolution: '1920x1080'
      },
      {
        id: 'dev-192-168-1-102',
        name: 'Digital Signage (Simulated)',
        ip: '192.168.1.102',
        type: 'Digital Signage',
        status: 'online',
        lastSeen: new Date().toISOString(),
        resolution: '1920x1080'
      }
    ];
    
    return mockDevices;
  }

  /**
   * Make an educated guess about device type based on open port
   */
  private guessDeviceType(port: number): string {
    switch (port) {
      case 8001:
      case 8002:
      case 7676:
      case 9197:
        return 'Samsung Smart TV';
      case 8008:
      case 8009:
      case 9080:
      case 9998:
      case 9955:
        return 'Amazon Fire Stick';
      case 80:
      case 443:
        return 'Web-enabled Device';
      case 8080:
        return 'Possible Media Player';
      case 8000:
        return 'Possible Smart Display';
      case 1900:
      case 5000:
        return 'DLNA/UPnP Device';
      default:
        return 'Unknown Device';
    }
  }

  /**
   * Stop an ongoing scan
   */
  stopScan(): void {
    if (this.isScanning && this.abortController) {
      this.abortController.abort();
      this.isScanning = false;
    }
  }
}

export default NetworkScanner;
