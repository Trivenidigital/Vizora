import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '../config';

// Mock data
const mockUser = {
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  companyName: 'Test Company',
  role: 'admin',
};

const mockDisplays = [
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
];

const mockContent = [
  {
    id: '1',
    title: 'Welcome Message',
    description: 'A welcome message for the lobby display',
    type: 'text',
    content: 'Welcome to our office!',
    displayIds: ['1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'published',
  },
];

// API handlers
export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE_URL}/auth/login`, () => {
    return HttpResponse.json({
      success: true,
      user: mockUser,
      token: 'mock-token',
    }, { status: 200 });
  }),

  http.post(`${API_BASE_URL}/auth/register`, () => {
    return HttpResponse.json({
      success: true,
      user: mockUser,
      token: 'mock-token',
    }, { status: 201 });
  }),

  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return HttpResponse.json({
      success: true,
      message: 'Logged out successfully'
    }, { status: 200 });
  }),

  http.get(`${API_BASE_URL}/auth/me`, () => {
    return HttpResponse.json({
      success: true,
      data: mockUser
    }, { status: 200 });
  }),

  // Display endpoints
  http.get(`${API_BASE_URL}/displays`, () => {
    return HttpResponse.json({
      success: true,
      data: mockDisplays
    }, { status: 200 });
  }),

  http.get(`${API_BASE_URL}/displays/:id`, ({ params }) => {
    const { id } = params;
    const display = mockDisplays.find(d => d.id === id);
    if (!display) {
      return HttpResponse.json({
        success: false,
        message: 'Display not found'
      }, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: display
    }, { status: 200 });
  }),

  http.put(`${API_BASE_URL}/displays/:id`, ({ params }) => {
    const { id } = params;
    const display = mockDisplays.find(d => d.id === id);
    if (!display) {
      return HttpResponse.json({
        success: false,
        message: 'Display not found'
      }, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: { ...display, ...params.body }
    }, { status: 200 });
  }),

  // Content endpoints
  http.get(`${API_BASE_URL}/content`, () => {
    return HttpResponse.json({
      success: true,
      data: mockContent
    }, { status: 200 });
  }),

  http.get(`${API_BASE_URL}/content/:id`, ({ params }) => {
    const { id } = params;
    const content = mockContent.find(c => c.id === id);
    if (!content) {
      return HttpResponse.json({
        success: false,
        message: 'Content not found'
      }, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: content
    }, { status: 200 });
  }),

  http.post(`${API_BASE_URL}/content`, ({ request }) => {
    const newContent = {
      id: String(mockContent.length + 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...request.body,
    };
    return HttpResponse.json({
      success: true,
      data: newContent
    }, { status: 201 });
  }),

  http.put(`${API_BASE_URL}/content/:id`, ({ params }) => {
    const { id } = params;
    const content = mockContent.find(c => c.id === id);
    if (!content) {
      return HttpResponse.json({
        success: false,
        message: 'Content not found'
      }, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: { ...content, ...params.body, updatedAt: new Date().toISOString() }
    }, { status: 200 });
  }),

  http.delete(`${API_BASE_URL}/content/:id`, ({ params }) => {
    const { id } = params;
    const contentIndex = mockContent.findIndex(c => c.id === id);
    if (contentIndex === -1) {
      return HttpResponse.json({
        success: false,
        message: 'Content not found'
      }, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      message: 'Content deleted successfully'
    }, { status: 204 });
  }),

  // System endpoints
  http.get(`${API_BASE_URL}/system/settings`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        systemName: 'Vizora Display System',
        timezone: 'UTC',
        dateFormat: 'yyyy-MM-dd HH:mm:ss',
        emailSettings: {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUser: 'notifications@example.com',
        },
        backupSettings: {
          autoBackup: true,
          frequency: 'daily',
          retention: 7,
        },
        notificationSettings: {
          email: true,
          sms: false,
          notificationEmail: 'admin@example.com',
        },
        securitySettings: {
          sessionTimeout: 3600,
          twoFactorAuth: false,
        },
      }
    }, { status: 200 });
  }),

  http.get(`${API_BASE_URL}/system/status`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        version: '1.0.0',
        uptime: 86400,
        memory: {
          total: 8589934592,
          used: 4294967296,
          free: 4294967296,
        },
        cpu: {
          cores: 4,
          usage: 25,
        },
        disk: {
          total: 107374182400,
          used: 53687091200,
          free: 53687091200,
        },
        network: {
          interfaces: ['eth0'],
          bytesIn: 1024,
          bytesOut: 1024,
        },
      }
    }, { status: 200 });
  }),

  http.get(`${API_BASE_URL}/system/logs`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'System started successfully',
        },
      ]
    }, { status: 200 });
  }),

  // Health endpoint
  http.get(`${API_BASE_URL}/health`, () => {
    return HttpResponse.json({
      status: 'ok'
    }, { status: 200 });
  }),
];

export const server = setupServer(...handlers); 