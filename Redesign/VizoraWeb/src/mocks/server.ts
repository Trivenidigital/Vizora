import { setupServer } from 'msw/node';
import { rest } from 'msw';
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
  rest.post(`${API_BASE_URL}/api/auth/login`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: mockUser,
        token: 'mock-token',
      })
    );
  }),

  rest.post(`${API_BASE_URL}/api/auth/register`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        user: mockUser,
        token: 'mock-token',
      })
    );
  }),

  rest.post(`${API_BASE_URL}/api/auth/logout`, (req, res, ctx) => {
    return res(ctx.status(200));
  }),

  rest.get(`${API_BASE_URL}/api/auth/me`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockUser)
    );
  }),

  // Display endpoints
  rest.get(`${API_BASE_URL}/api/displays`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockDisplays)
    );
  }),

  rest.get(`${API_BASE_URL}/api/displays/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const display = mockDisplays.find(d => d.id === id);
    if (!display) {
      return res(ctx.status(404));
    }
    return res(
      ctx.status(200),
      ctx.json(display)
    );
  }),

  rest.put(`${API_BASE_URL}/api/displays/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const display = mockDisplays.find(d => d.id === id);
    if (!display) {
      return res(ctx.status(404));
    }
    return res(
      ctx.status(200),
      ctx.json({ ...display, ...req.body })
    );
  }),

  // Content endpoints
  rest.get(`${API_BASE_URL}/api/content`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockContent)
    );
  }),

  rest.get(`${API_BASE_URL}/api/content/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const content = mockContent.find(c => c.id === id);
    if (!content) {
      return res(ctx.status(404));
    }
    return res(
      ctx.status(200),
      ctx.json(content)
    );
  }),

  rest.post(`${API_BASE_URL}/api/content`, (req, res, ctx) => {
    const newContent = {
      id: String(mockContent.length + 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body,
    };
    return res(
      ctx.status(201),
      ctx.json(newContent)
    );
  }),

  rest.put(`${API_BASE_URL}/api/content/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const content = mockContent.find(c => c.id === id);
    if (!content) {
      return res(ctx.status(404));
    }
    return res(
      ctx.status(200),
      ctx.json({ ...content, ...req.body, updatedAt: new Date().toISOString() })
    );
  }),

  rest.delete(`${API_BASE_URL}/api/content/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const contentIndex = mockContent.findIndex(c => c.id === id);
    if (contentIndex === -1) {
      return res(ctx.status(404));
    }
    return res(ctx.status(204));
  }),

  // System endpoints
  rest.get(`${API_BASE_URL}/api/system/settings`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
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
      })
    );
  }),

  rest.get(`${API_BASE_URL}/api/system/status`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
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
      })
    );
  }),

  rest.get(`${API_BASE_URL}/api/system/logs`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'System started successfully',
        },
      ])
    );
  }),
];

export const server = setupServer(...handlers); 