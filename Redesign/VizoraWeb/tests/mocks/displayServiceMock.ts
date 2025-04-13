import { vi } from 'vitest';

// Sample mock displays
export const mockDisplays = [
  {
    id: '1',
    name: 'Main Lobby Display',
    location: 'Lobby',
    status: 'online',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.100',
    resolution: '1920x1080',
    orientation: 'landscape',
    brightness: 80,
    schedule: {
      enabled: true,
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    },
    content: {
      current: {
        id: '1',
        title: 'Welcome Message',
        type: 'text',
        content: 'Welcome to our office!',
      },
      queue: [],
    },
    settings: {
      autoPlay: true,
      volume: 50,
      brightness: 80,
    },
    metrics: {
      uptime: 99.9,
      lastUpdate: new Date().toISOString(),
    },
    alerts: [],
    logs: [],
  },
  {
    id: '2',
    name: 'Conference Room Display',
    location: 'Conference Room',
    status: 'offline',
    lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    ipAddress: '192.168.1.101',
    resolution: '3840x2160',
    orientation: 'landscape',
    brightness: 70,
    schedule: {
      enabled: false,
      startTime: '',
      endTime: '',
      timezone: 'UTC',
    },
    content: {
      current: null,
      queue: [],
    },
    settings: {
      autoPlay: false,
      volume: 30,
      brightness: 70,
    },
    metrics: {
      uptime: 95.2,
      lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    alerts: [
      {
        id: '1',
        type: 'offline',
        message: 'Display has been offline for more than 24 hours',
        timestamp: new Date().toISOString(),
        severity: 'high',
      },
    ],
    logs: [],
  }
];

// Create a mock display service
export const displayServiceMock = {
  getDisplays: vi.fn().mockResolvedValue(mockDisplays),
  getDisplayById: vi.fn().mockImplementation((id: string) => {
    const display = mockDisplays.find(item => item.id === id);
    if (display) {
      return Promise.resolve(display);
    }
    return Promise.reject(new Error('Display not found'));
  }),
  createDisplay: vi.fn().mockImplementation((displayData: any) => {
    const newDisplay = {
      ...displayData,
      id: String(mockDisplays.length + 1),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      metrics: {
        uptime: 100,
        lastUpdate: new Date().toISOString()
      },
      alerts: [],
      logs: []
    };
    return Promise.resolve(newDisplay);
  }),
  updateDisplay: vi.fn().mockImplementation((id: string, data: any) => {
    const index = mockDisplays.findIndex(item => item.id === id);
    if (index !== -1) {
      const updatedDisplay = {
        ...mockDisplays[index],
        ...data,
        lastUpdate: new Date().toISOString(),
      };
      return Promise.resolve(updatedDisplay);
    }
    return Promise.reject(new Error('Display not found'));
  }),
  deleteDisplay: vi.fn().mockImplementation((id: string) => {
    const index = mockDisplays.findIndex(item => item.id === id);
    if (index !== -1) {
      return Promise.resolve(true);
    }
    return Promise.reject(new Error('Display not found'));
  }),
  pairDisplay: vi.fn().mockResolvedValue({ success: true, message: 'Display paired successfully' }),
  unpairDisplay: vi.fn().mockResolvedValue({ success: true, message: 'Display unpaired successfully' }),
  getDisplayAnalytics: vi.fn().mockResolvedValue({
    viewCount: 1250,
    averageViewDuration: 45,
    peakTimes: [
      { hour: 9, count: 120 },
      { hour: 12, count: 180 },
      { hour: 15, count: 150 }
    ],
    contentPerformance: [
      { contentId: '1', views: 500, avgDuration: 40 },
      { contentId: '2', views: 750, avgDuration: 50 }
    ]
  }),
  getDisplayStatus: vi.fn().mockImplementation((id: string) => {
    const display = mockDisplays.find(item => item.id === id);
    if (display) {
      return Promise.resolve({
        status: display.status,
        lastSeen: display.lastSeen,
        alerts: display.alerts
      });
    }
    return Promise.reject(new Error('Display not found'));
  }),
  restartDisplay: vi.fn().mockResolvedValue({ success: true, message: 'Display restart initiated' }),
  updateDisplaySettings: vi.fn().mockResolvedValue({ success: true, message: 'Display settings updated' }),
};

// Function to reset all mocks in the service
export function resetDisplayServiceMocks() {
  Object.values(displayServiceMock).forEach(mock => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  // Reset default implementations
  displayServiceMock.getDisplays.mockResolvedValue(mockDisplays);
  displayServiceMock.getDisplayById.mockImplementation((id: string) => {
    const display = mockDisplays.find(item => item.id === id);
    if (display) {
      return Promise.resolve(display);
    }
    return Promise.reject(new Error('Display not found'));
  });
  // Reset other implementations as needed
} 