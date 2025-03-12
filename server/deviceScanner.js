// Device scanner module for server-side network scanning
import os from 'os';
let find;

try {
  // Try to dynamically import the local-devices package
  // Note: This is a placeholder as dynamic imports might not work in this context
  find = async () => {
    return mockDevices();
  };
} catch (error) {
  // If the package is not available, create a mock implementation
  find = async () => {
    return mockDevices();
  };
}

// Scanning state
let scanning = false;

// Mock devices for testing
const mockDevices = () => {
  return [
    {
      name: 'Samsung Smart TV',
      ip: '192.168.1.101',
      mac: '00:1A:2B:3C:4D:5E'
    },
    {
      name: 'LG WebOS TV',
      ip: '192.168.1.102',
      mac: '11:2A:3B:4C:5D:6E'
    },
    {
      name: 'Amazon Fire Stick',
      ip: '192.168.1.103',
      mac: '22:3A:4B:5C:6D:7E'
    },
    {
      name: 'Roku Ultra',
      ip: '192.168.1.104',
      mac: '33:4A:5B:6C:7D:8E'
    },
    {
      name: 'Apple TV',
      ip: '192.168.1.105',
      mac: '44:5A:6B:7C:8D:9E'
    }
  ];
};

// Get device type based on MAC address or other characteristics
const getDeviceType = (device) => {
  // In a real implementation, we would use MAC address prefixes or other
  // characteristics to determine the device type
  
  // For demo purposes, we'll assign types based on the device name
  const name = device.name ? device.name.toLowerCase() : '';
  
  if (name.includes('samsung') || name.includes('lg') || name.includes('sony')) {
    return 'Smart TV';
  } else if (name.includes('fire') || name.includes('roku') || name.includes('apple tv')) {
    return 'Media Player';
  } else {
    return 'Unknown';
  }
};

// Scan the network for devices
const scanNetwork = async (progressCallback, deviceFoundCallback) => {
  if (scanning) {
    throw new Error('A scan is already in progress');
  }
  
  scanning = true;
  
  try {
    // Get network interfaces
    const interfaces = os.networkInterfaces();
    progressCallback(10, 'Identifying network interfaces...');
    
    // Find the active network interface
    let activeInterface = null;
    for (const [name, nets] of Object.entries(interfaces)) {
      for (const net of nets) {
        // Skip internal and non-IPv4 interfaces
        if (!net.internal && net.family === 'IPv4') {
          activeInterface = { name, address: net.address };
          break;
        }
      }
      if (activeInterface) break;
    }
    
    if (!activeInterface) {
      throw new Error('No active network interface found');
    }
    
    progressCallback(20, `Using network interface: ${activeInterface.name}`);
    
    // Determine subnet
    const subnet = activeInterface.address.split('.').slice(0, 3).join('.');
    progressCallback(30, `Scanning subnet: ${subnet}.0/24`);
    
    // Scan for devices
    progressCallback(40, 'Searching for devices...');
    
    // In a real implementation, we would scan the network
    // For demo purposes, we'll use mock devices or the local-devices package
    const devices = await find();
    
    progressCallback(70, `Found ${devices.length} devices on the network`);
    
    // Process each device
    let processedCount = 0;
    for (const device of devices) {
      processedCount++;
      progressCallback(
        70 + Math.floor((processedCount / devices.length) * 30),
        `Processing device ${processedCount} of ${devices.length}...`
      );
      
      // Determine device type
      const type = getDeviceType(device);
      
      // Create device object
      const enhancedDevice = {
        id: `device-${device.mac.replace(/:/g, '')}`,
        name: device.name || `Unknown Device (${device.ip})`,
        ip: device.ip,
        mac: device.mac,
        type,
        status: 'online',
        lastSeen: new Date().toISOString()
      };
      
      // Notify about found device
      deviceFoundCallback(enhancedDevice);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    progressCallback(100, 'Scan complete');
    scanning = false;
    return devices;
    
  } catch (error) {
    scanning = false;
    throw error;
  }
};

// Add a manually entered device
const addManualDevice = (deviceData) => {
  if (!deviceData.ip) {
    throw new Error('IP address is required');
  }
  
  // Create device object
  const device = {
    id: `manual-${Date.now()}`,
    name: deviceData.name || `Manual Device (${deviceData.ip})`,
    ip: deviceData.ip,
    mac: deviceData.mac || '00:00:00:00:00:00',
    type: deviceData.type || 'Manual Entry',
    status: 'pending',
    lastSeen: new Date().toISOString(),
    location: deviceData.location
  };
  
  return device;
};

// Check if a scan is in progress
const isScanning = () => {
  return scanning;
};

export {
  scanNetwork,
  addManualDevice,
  isScanning
};
