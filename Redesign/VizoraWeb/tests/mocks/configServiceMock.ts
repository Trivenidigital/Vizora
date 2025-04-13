import { vi } from 'vitest';

// Sample configuration
export const mockConfig = {
  id: '1',
  displayName: 'Test Display',
  resolution: '1920x1080',
  orientation: 'landscape',
  brightness: 75,
  volume: 50,
  autostart: true,
  offlineMode: 'basic',
  cacheLimit: 1000,
  logLevel: 'info',
  refreshRate: 30,
  timezone: 'UTC',
  sleepSchedule: {
    enabled: true,
    startTime: '22:00',
    endTime: '06:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
  networkSettings: {
    proxy: {
      enabled: false,
      host: '',
      port: 0,
      requiresAuth: false,
      username: '',
      password: '',
    },
    retryStrategy: 'exponential',
    maxRetries: 5,
  },
  updateSettings: {
    autoUpdate: true,
    updateTime: '03:00',
    channel: 'stable',
  },
  contentSettings: {
    transitionEffect: 'fade',
    transitionDuration: 500,
    defaultDuration: 10000,
    allowSkip: true,
    showProgress: true,
  },
};

// Create a mock configuration service
export const configServiceMock = {
  getConfiguration: vi.fn().mockResolvedValue(mockConfig),
  updateConfiguration: vi.fn().mockImplementation((configData: any) => {
    const updatedConfig = {
      ...mockConfig,
      ...configData,
      updatedAt: new Date().toISOString(),
    };
    return Promise.resolve(updatedConfig);
  }),
  resetConfiguration: vi.fn().mockResolvedValue({
    ...mockConfig,
    brightness: 70,
    volume: 50,
    autostart: false,
    logLevel: 'info',
    cacheLimit: 500,
    updatedAt: new Date().toISOString(),
  }),
  exportConfiguration: vi.fn().mockImplementation(() => {
    const configJSON = JSON.stringify(mockConfig, null, 2);
    const blob = new Blob([configJSON], { type: 'application/json' });
    return Promise.resolve({
      blob,
      filename: `display-config-${mockConfig.id}.json`,
    });
  }),
  importConfiguration: vi.fn().mockImplementation((configFile: File) => {
    // Mock successful import
    return Promise.resolve({
      success: true,
      message: 'Configuration imported successfully',
      config: mockConfig,
    });
  }),
  validateConfiguration: vi.fn().mockImplementation((configData: any) => {
    // Always return valid for tests
    return {
      valid: true,
      errors: [],
    };
  }),
  getConfigurationHistory: vi.fn().mockResolvedValue([
    {
      id: 'history-1',
      timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      user: 'admin@example.com',
      changes: [
        { field: 'brightness', oldValue: 70, newValue: 75 },
        { field: 'volume', oldValue: 60, newValue: 50 },
      ],
    },
    {
      id: 'history-2',
      timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      user: 'admin@example.com',
      changes: [
        { field: 'resolution', oldValue: '1280x720', newValue: '1920x1080' },
      ],
    },
  ]),
  applyConfigurationToDisplay: vi.fn().mockResolvedValue({
    success: true,
    message: 'Configuration applied to display successfully',
  }),
};

// Function to reset all mocks in the service
export function resetConfigServiceMocks() {
  Object.values(configServiceMock).forEach(mock => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  // Reset default implementations
  configServiceMock.getConfiguration.mockResolvedValue(mockConfig);
  configServiceMock.updateConfiguration.mockImplementation((configData: any) => {
    const updatedConfig = {
      ...mockConfig,
      ...configData,
      updatedAt: new Date().toISOString(),
    };
    return Promise.resolve(updatedConfig);
  });
  // Reset other implementations as needed
} 