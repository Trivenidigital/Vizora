import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

interface RequestParams {
  id?: string;
  displayId?: string;
}

interface RequestBody {
  [key: string]: any;
}

// Helper function to add CORS headers to responses
const addCorsHeaders = (status: number) => ({
  status,
  headers: {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  }
});

const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    return HttpResponse.json({
      token: 'test-token',
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'admin',
        name: 'Test User',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: '2024-01-01T00:00:00Z',
        settings: {
          theme: 'light',
          notifications: true,
          language: 'en',
        },
      },
    }, addCorsHeaders(200));
  }),

  http.post('/api/auth/register', async ({ request }) => {
    return HttpResponse.json({
      token: 'test-token',
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'user',
        name: 'Test User',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: '2024-01-01T00:00:00Z',
        settings: {
          theme: 'light',
          notifications: true,
          language: 'en',
        },
      },
    }, addCorsHeaders(201));
  }),

  http.post('/api/auth/logout', async () => {
    return new HttpResponse(null, addCorsHeaders(200));
  }),

  http.get('/api/auth/me', async () => {
    return HttpResponse.json({
      id: '1',
      email: 'test@example.com',
      role: 'admin',
      name: 'Test User',
      createdAt: '2024-01-01T00:00:00Z',
      lastLogin: '2024-01-01T00:00:00Z',
      settings: {
        theme: 'light',
        notifications: true,
        language: 'en',
      },
    }, addCorsHeaders(200));
  }),

  // Display endpoints
  http.get('/api/displays', async () => {
    return HttpResponse.json({
      success: true, 
      data: []
    }, addCorsHeaders(200));
  }),

  http.get('/api/displays/:id', async ({ params }) => {
    const { id } = params as RequestParams;
    return HttpResponse.json({
      id,
      name: 'Display 1',
      location: 'Location 1',
      status: 'online',
      lastSeen: '2024-01-01T00:00:00Z',
      ipAddress: '192.168.1.1',
      resolution: '1920x1080',
      orientation: 'landscape',
      brightness: {
        day: 100,
        night: 50,
      },
      schedule: {
        startTime: '08:00',
        endTime: '20:00',
        weekdays: [1, 2, 3, 4, 5],
      },
      content: {
        current: 'content-1',
        next: 'content-2',
        queue: ['content-3', 'content-4'],
      },
      settings: {
        autoUpdate: true,
        autoBackup: true,
        backupFrequency: 'daily',
      },
      metrics: {
        cpu: 50,
        memory: 60,
        storage: 70,
        network: {
          upload: 100,
          download: 200,
          latency: 50,
        },
      },
      alerts: [],
      logs: [],
    }, addCorsHeaders(200));
  }),

  http.post('/api/displays', async ({ request }) => {
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      id: '1',
      ...body,
      status: 'offline',
      lastSeen: null,
      content: {
        current: null,
        next: null,
        queue: [],
      },
      metrics: {
        cpu: 0,
        memory: 0,
        storage: 0,
        network: {
          upload: 0,
          download: 0,
          latency: 0,
        },
      },
      alerts: [],
      logs: [],
    }, addCorsHeaders(201));
  }),

  http.put('/api/displays/:id', async ({ params, request }) => {
    const { id } = params as RequestParams;
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      id,
      ...body,
    }, addCorsHeaders(200));
  }),

  http.delete('/api/displays/:id', async ({ params }) => {
    return new HttpResponse(null, addCorsHeaders(204));
  }),

  // Content endpoints
  http.get('/api/content', async () => {
    return HttpResponse.json([
      {
        id: '1',
        title: 'Content 1',
        type: 'image',
        url: 'https://example.com/image1.jpg',
        duration: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        metadata: {
          size: 1024,
          dimensions: '1920x1080',
          format: 'jpg',
        },
        schedule: {
          displays: ['1', '2'],
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          startTime: '08:00',
          endTime: '20:00',
          weekdays: [1, 2, 3, 4, 5],
        },
        analytics: {
          views: 1000,
          duration: 5000,
          interactions: 100,
        },
      },
    ], addCorsHeaders(200));
  }),

  http.get('/api/content/:id', async ({ params }) => {
    const { id } = params as RequestParams;
    return HttpResponse.json({
      id,
      title: 'Content 1',
      type: 'image',
      url: 'https://example.com/image1.jpg',
      duration: 10,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      metadata: {
        size: 1024,
        dimensions: '1920x1080',
        format: 'jpg',
      },
      schedule: {
        displays: ['1', '2'],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        startTime: '08:00',
        endTime: '20:00',
        weekdays: [1, 2, 3, 4, 5],
      },
      analytics: {
        views: 1000,
        duration: 5000,
        interactions: 100,
      },
    }, addCorsHeaders(200));
  }),

  http.post('/api/content', async ({ request }) => {
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      id: '1',
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      analytics: {
        views: 0,
        duration: 0,
        interactions: 0,
      },
    }, addCorsHeaders(201));
  }),

  http.put('/api/content/:id', async ({ params, request }) => {
    const { id } = params as RequestParams;
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      id,
      ...body,
      updatedAt: new Date().toISOString(),
    }, addCorsHeaders(200));
  }),

  http.delete('/api/content/:id', async () => {
    return new HttpResponse(null, addCorsHeaders(204));
  }),

  // Schedule endpoints
  http.post('/api/content/:id/schedule', async ({ params, request }) => {
    const { id } = params as RequestParams;
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      contentId: id,
      ...body,
      createdAt: new Date().toISOString(),
    }, addCorsHeaders(201));
  }),

  // Analytics endpoints
  http.get('/api/content/:id/analytics', async ({ params }) => {
    const { id } = params as RequestParams;
    return HttpResponse.json({
      contentId: id,
      views: 1000,
      duration: 5000,
      interactions: 100,
      byDisplay: [
        {
          displayId: '1',
          views: 500,
          duration: 2500,
          interactions: 50,
        },
      ],
      byTime: [
        {
          date: '2024-01-01',
          views: 100,
          duration: 500,
          interactions: 10,
        },
      ],
    }, addCorsHeaders(200));
  }),

  // System endpoints
  http.get('/api/system/settings', async () => {
    return HttpResponse.json({
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true,
        slack: false,
      },
      security: {
        twoFactor: false,
        passwordExpiry: 90,
        sessionTimeout: 30,
      },
      display: {
        defaultBrightness: {
          day: 100,
          night: 50,
        },
        defaultSchedule: {
          startTime: '08:00',
          endTime: '20:00',
          weekdays: [1, 2, 3, 4, 5],
        },
      },
      storage: {
        maxFileSize: 10485760,
        allowedTypes: ['image/*', 'video/*'],
        compression: true,
      },
      maintenance: {
        autoUpdate: true,
        updateTime: '02:00',
        backupEnabled: true,
        backupFrequency: 'daily',
        backupRetention: 30,
      },
    }, addCorsHeaders(200));
  }),

  http.put('/api/system/settings', async ({ request }) => {
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      ...body,
      updatedAt: new Date().toISOString(),
    }, addCorsHeaders(200));
  }),

  http.get('/api/system/status', async () => {
    return HttpResponse.json({
      status: 'healthy',
      uptime: 86400,
      version: '1.0.0',
      lastUpdate: '2024-01-01T00:00:00Z',
      system: {
        cpu: 50,
        memory: 60,
        storage: 70,
        network: {
          upload: 100,
          download: 200,
          latency: 50,
        },
      },
      services: {
        database: 'healthy',
        cache: 'healthy',
        storage: 'healthy',
        queue: 'healthy',
      },
      maintenance: {
        lastBackup: '2024-01-01T00:00:00Z',
        nextBackup: '2024-01-02T00:00:00Z',
        lastUpdate: '2024-01-01T00:00:00Z',
        nextUpdate: '2024-01-08T00:00:00Z',
      },
    }, addCorsHeaders(200));
  }),

  http.get('/api/system/logs', async () => {
    return HttpResponse.json([
      {
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        message: 'System started',
        service: 'system',
        metadata: {
          version: '1.0.0',
          environment: 'production',
        },
      },
    ], addCorsHeaders(200));
  }),

  http.post('/api/system/maintenance', async () => {
    return HttpResponse.json({
      status: 'scheduled',
      startTime: new Date(Date.now() + 3600000).toISOString(),
      estimatedDuration: 1800,
      tasks: [
        'backup',
        'cleanup',
        'update',
      ],
    }, addCorsHeaders(200));
  }),

  http.post('/api/system/backup', async () => {
    return HttpResponse.json({
      id: '1',
      timestamp: new Date().toISOString(),
      size: 1048576,
      type: 'full',
      status: 'completed',
      location: '/backups/2024-01-01.zip',
    }, addCorsHeaders(200));
  }),

  http.post('/api/system/update', async () => {
    return HttpResponse.json({
      status: 'scheduled',
      version: '1.1.0',
      releaseNotes: 'Bug fixes and improvements',
      startTime: new Date(Date.now() + 3600000).toISOString(),
      estimatedDuration: 1800,
    }, addCorsHeaders(200));
  }),

  // File endpoints
  http.get('/api/files/:id', async ({ params }) => {
    const { id } = params as RequestParams;
    return HttpResponse.json({
      id,
      name: 'file1.jpg',
      type: 'image/jpeg',
      size: 1048576,
      url: 'https://example.com/files/1',
      createdAt: '2024-01-01T00:00:00Z',
      metadata: {
        dimensions: '1920x1080',
        duration: null,
      },
    }, addCorsHeaders(200));
  }),

  http.post('/api/files/upload', async ({ request }) => {
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      id: '1',
      ...body,
      createdAt: new Date().toISOString(),
      url: 'https://example.com/files/1',
    }, addCorsHeaders(201));
  }),

  // Analytics events
  http.post('/api/analytics/event', async ({ request }) => {
    const body = await request.json() as RequestBody;
    return HttpResponse.json({
      id: '1',
      ...body,
      timestamp: new Date().toISOString(),
    }, addCorsHeaders(201));
  }),

  http.get('/api/analytics/display/:displayId', async ({ params }) => {
    const { displayId } = params as RequestParams;
    return HttpResponse.json({
      displayId,
      period: '24h',
      metrics: {
        views: 1000,
        duration: 5000,
        interactions: 100,
      },
      byContent: [
        {
          contentId: '1',
          views: 500,
          duration: 2500,
          interactions: 50,
        },
      ],
      byTime: [
        {
          hour: 0,
          views: 100,
          duration: 500,
          interactions: 10,
        },
      ],
    }, addCorsHeaders(200));
  }),

  // Add OPTIONS handlers for preflight requests
  http.options('*', () => {
    return new HttpResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400'
      }
    });
  }),
];

export const server = setupServer(...handlers); 