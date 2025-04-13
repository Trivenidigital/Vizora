import { vi } from 'vitest';

export interface AnalyticsData {
  views: number;
  uniqueViewers: number;
  averageViewDuration: number;
  peakViewership: number;
  interactionRate: number;
  conversionRate: number;
  byDevice: {
    deviceId: string;
    deviceName: string;
    views: number;
  }[];
  byContent: {
    contentId: string;
    contentName: string;
    views: number;
    averageViewDuration: number;
  }[];
  byHour: {
    hour: number;
    views: number;
  }[];
  byDay: {
    date: string;
    views: number;
  }[];
}

export interface AnalyticsTimeRange {
  start: string;
  end: string;
}

// Mock data
export const mockAnalyticsData: AnalyticsData = {
  views: 1500,
  uniqueViewers: 750,
  averageViewDuration: 45,
  peakViewership: 120,
  interactionRate: 0.32,
  conversionRate: 0.08,
  byDevice: [
    { deviceId: 'd1', deviceName: 'Lobby Display', views: 800 },
    { deviceId: 'd2', deviceName: 'Meeting Room Display', views: 700 }
  ],
  byContent: [
    { contentId: '1', contentName: 'Welcome Video', views: 900, averageViewDuration: 60 },
    { contentId: '2', contentName: 'Product Demo', views: 600, averageViewDuration: 30 }
  ],
  byHour: [
    { hour: 9, views: 200 },
    { hour: 10, views: 250 },
    { hour: 11, views: 300 },
    { hour: 12, views: 250 },
    { hour: 13, views: 200 },
    { hour: 14, views: 150 },
    { hour: 15, views: 150 }
  ],
  byDay: [
    { date: '2023-01-01', views: 300 },
    { date: '2023-01-02', views: 350 },
    { date: '2023-01-03', views: 400 },
    { date: '2023-01-04', views: 450 }
  ]
};

// Mock functions
export const analyticsService = {
  getAnalytics: vi.fn().mockResolvedValue(mockAnalyticsData),
  getDeviceAnalytics: vi.fn().mockImplementation((deviceId: string) => {
    const deviceData = mockAnalyticsData.byDevice.find(d => d.deviceId === deviceId);
    if (!deviceData) {
      return Promise.reject(new Error('Device analytics not found'));
    }
    return Promise.resolve({
      ...mockAnalyticsData,
      views: deviceData.views,
      uniqueViewers: Math.floor(deviceData.views / 2),
      byDevice: [deviceData]
    });
  }),
  getContentAnalytics: vi.fn().mockImplementation((contentId: string) => {
    const contentData = mockAnalyticsData.byContent.find(c => c.contentId === contentId);
    if (!contentData) {
      return Promise.reject(new Error('Content analytics not found'));
    }
    return Promise.resolve({
      ...mockAnalyticsData,
      views: contentData.views,
      averageViewDuration: contentData.averageViewDuration,
      byContent: [contentData]
    });
  }),
  getAnalyticsForDateRange: vi.fn().mockImplementation((range: AnalyticsTimeRange) => {
    return Promise.resolve(mockAnalyticsData);
  }),
  exportAnalytics: vi.fn().mockResolvedValue({
    url: 'https://example.com/analytics-export.csv',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }),
  getViewerDemographics: vi.fn().mockResolvedValue({
    ageGroups: [
      { group: '18-24', percentage: 20 },
      { group: '25-34', percentage: 35 },
      { group: '35-44', percentage: 25 },
      { group: '45-54', percentage: 15 },
      { group: '55+', percentage: 5 }
    ],
    gender: [
      { group: 'Male', percentage: 55 },
      { group: 'Female', percentage: 45 }
    ],
    locations: [
      { name: 'New York', percentage: 30 },
      { name: 'California', percentage: 25 },
      { name: 'Texas', percentage: 15 },
      { name: 'Florida', percentage: 10 },
      { name: 'Other', percentage: 20 }
    ]
  }),
  getInteractionHeatmap: vi.fn().mockResolvedValue({
    width: 1920,
    height: 1080,
    dataPoints: [
      { x: 960, y: 540, weight: 0.9 },
      { x: 480, y: 270, weight: 0.6 },
      { x: 1440, y: 810, weight: 0.5 },
      { x: 320, y: 180, weight: 0.4 },
      { x: 1600, y: 900, weight: 0.3 }
    ]
  })
}; 