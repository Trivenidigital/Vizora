import { vi } from 'vitest';

export interface Display {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  lastPing?: string;
  location?: string;
  model?: string;
  serialNumber?: string;
  ipAddress?: string;
  macAddress?: string;
  osVersion?: string;
  appVersion?: string;
  resolution?: string;
  orientation?: 'landscape' | 'portrait';
  createdAt: string;
  updatedAt: string;
  groupId?: string;
  tags?: string[];
}

export const mockDisplays: Display[] = [
  {
    id: 'd1',
    name: 'Lobby Display',
    status: 'online',
    lastPing: new Date().toISOString(),
    location: 'Main Lobby',
    model: 'Samsung QM85R',
    serialNumber: 'SN12345678',
    ipAddress: '192.168.1.101',
    macAddress: '00:1A:2B:3C:4D:5E',
    osVersion: 'Android 10',
    appVersion: '2.5.1',
    resolution: '3840x2160',
    orientation: 'landscape',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['lobby', 'entrance']
  },
  {
    id: 'd2',
    name: 'Cafeteria Display',
    status: 'online',
    lastPing: new Date().toISOString(),
    location: 'Cafeteria',
    model: 'LG 75UL3G',
    serialNumber: 'LG87654321',
    ipAddress: '192.168.1.102',
    macAddress: '00:2C:3D:4E:5F:6G',
    osVersion: 'Android 11',
    appVersion: '2.5.1',
    resolution: '3840x2160',
    orientation: 'landscape',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    groupId: 'g1',
    tags: ['cafeteria', 'dining']
  },
  {
    id: 'd3',
    name: 'Conference Room A',
    status: 'offline',
    lastPing: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'Conference Area',
    model: 'Sony BRAVIA FW-100BZ40J',
    serialNumber: 'SONY2022XYZ',
    ipAddress: '192.168.1.103',
    macAddress: '00:3D:4E:5F:6G:7H',
    osVersion: 'Android 9',
    appVersion: '2.4.8',
    resolution: '3840x2160',
    orientation: 'landscape',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    groupId: 'g2',
    tags: ['conference', 'meeting']
  },
  {
    id: 'd4',
    name: 'Reception Kiosk',
    status: 'warning',
    lastPing: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    location: 'Reception Area',
    model: 'iPad Pro 12.9"',
    serialNumber: 'IPAD2023ABC',
    ipAddress: '192.168.1.104',
    macAddress: '00:4E:5F:6G:7H:8I',
    osVersion: 'iOS 15.4',
    appVersion: '2.5.1',
    resolution: '2732x2048',
    orientation: 'portrait',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['reception', 'kiosk', 'touchscreen']
  }
];

export const displayService = {
  getDisplays: vi.fn().mockResolvedValue(mockDisplays),
  
  getDisplayById: vi.fn().mockImplementation((id: string) => {
    const display = mockDisplays.find(d => d.id === id);
    return display 
      ? Promise.resolve(display) 
      : Promise.reject(new Error('Display not found'));
  }),
  
  createDisplay: vi.fn().mockImplementation((displayData: Partial<Display>) => {
    const newDisplay: Display = {
      id: `d${Date.now()}`,
      name: displayData.name || 'New Display',
      status: 'offline',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...displayData
    };
    return Promise.resolve(newDisplay);
  }),
  
  updateDisplay: vi.fn().mockImplementation((id: string, displayData: Partial<Display>) => {
    const displayIndex = mockDisplays.findIndex(d => d.id === id);
    if (displayIndex === -1) {
      return Promise.reject(new Error('Display not found'));
    }
    
    const updatedDisplay = {
      ...mockDisplays[displayIndex],
      ...displayData,
      updatedAt: new Date().toISOString()
    };
    
    return Promise.resolve(updatedDisplay);
  }),
  
  deleteDisplay: vi.fn().mockResolvedValue(true),
  
  pairDisplay: vi.fn().mockImplementation((pairingCode: string, displayName: string) => {
    return Promise.resolve({
      id: `d${Date.now()}`,
      name: displayName,
      status: 'online',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pairingCode
    });
  }),
  
  unpairDisplay: vi.fn().mockImplementation((id: string) => {
    const displayIndex = mockDisplays.findIndex(d => d.id === id);
    if (displayIndex === -1) {
      return Promise.reject(new Error('Display not found'));
    }
    return Promise.resolve(true);
  }),
  
  getDisplayGroups: vi.fn().mockResolvedValue([
    { id: 'g1', name: 'Main Floor Displays', displayCount: 2 },
    { id: 'g2', name: 'Conference Displays', displayCount: 1 }
  ]),
  
  getDisplaysByGroup: vi.fn().mockImplementation((groupId: string) => {
    const displays = mockDisplays.filter(d => d.groupId === groupId);
    return Promise.resolve(displays);
  }),
  
  getDisplayStatus: vi.fn().mockImplementation((id: string) => {
    const display = mockDisplays.find(d => d.id === id);
    if (!display) {
      return Promise.reject(new Error('Display not found'));
    }
    return Promise.resolve({
      id: display.id,
      status: display.status,
      lastPing: display.lastPing,
      uptimePercent: Math.floor(Math.random() * 20) + 80,
      storage: {
        total: 64,
        used: Math.floor(Math.random() * 40) + 10,
        free: Math.floor(Math.random() * 20) + 10
      },
      memory: {
        total: 8,
        used: Math.floor(Math.random() * 4) + 2,
        free: Math.floor(Math.random() * 2) + 1
      },
      network: {
        type: 'WiFi',
        signalStrength: Math.floor(Math.random() * 40) + 60,
        ipAddress: display.ipAddress
      }
    });
  }),
  
  restartDisplay: vi.fn().mockResolvedValue(true),
  
  updateDisplaySoftware: vi.fn().mockResolvedValue({
    status: 'updating',
    estimatedTimeRemaining: '2 minutes'
  })
}; 