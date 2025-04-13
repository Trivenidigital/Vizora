import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { rest } from 'msw';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
}

interface Display {
  id: string;
  name: string;
  location: string;
  status: string;
  lastSeen: string;
}

interface Content {
  id: string;
  title: string;
  type: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

// Mock data
const mockUser: User = {
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  company: 'Test Company',
};

const mockDisplays: Display[] = [
  {
    id: '1',
    name: 'Main Lobby Display',
    location: 'Main Lobby',
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Conference Room A',
    location: 'Conference Room A',
    status: 'offline',
    lastSeen: new Date().toISOString(),
  },
];

const mockContent: Content = {
  id: '1',
  title: 'Welcome Message',
  type: 'image',
  url: 'https://example.com/image.jpg',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'active',
};

// Handlers
export const handlers = [
  // Auth endpoints
  http.post('/api/auth/register', () => {
    return HttpResponse.json(mockUser, { status: 201 });
  }),

  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      user: mockUser,
      token: 'mock-jwt-token',
    });
  }),

  http.post('/api/auth/logout', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get('/api/auth/user', () => {
    return HttpResponse.json(mockUser);
  }),

  // Display endpoints
  http.get('/api/displays', () => {
    return HttpResponse.json(mockDisplays);
  }),

  http.get('/api/displays/:id', ({ params }) => {
    const display = mockDisplays.find(d => d.id === params.id);
    if (!display) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(display);
  }),

  http.put('/api/displays/:id', async ({ params, request }) => {
    const display = mockDisplays.find(d => d.id === params.id);
    if (!display) {
      return new HttpResponse(null, { status: 404 });
    }
    const body = await request.json();
    return HttpResponse.json({ ...display, ...body });
  }),

  // Content endpoints
  http.get('/api/content', () => {
    return HttpResponse.json([mockContent]);
  }),

  http.get('/api/content/:id', () => {
    return HttpResponse.json(mockContent);
  }),

  http.post('/api/content', () => {
    return HttpResponse.json(mockContent, { status: 201 });
  }),

  http.put('/api/content/:id', () => {
    return HttpResponse.json(mockContent);
  }),

  http.delete('/api/content/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // System endpoints
  http.get('/api/system/settings', () => {
    return HttpResponse.json({
      refreshInterval: 30000,
      offlineThreshold: 300000,
    });
  }),

  http.get('/api/system/status', () => {
    return HttpResponse.json({
      status: 'healthy',
      uptime: 123456,
      version: '1.0.0',
    });
  }),

  http.get('/api/system/logs', () => {
    return HttpResponse.json([
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'System started',
      },
    ]);
  }),

  // Mock API endpoints
  rest.get('/api/content', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          title: 'Test Image',
          type: 'image',
          url: 'https://example.com/test.jpg',
          duration: 10
        },
        {
          id: '2',
          title: 'Test Video',
          type: 'video',
          url: 'https://example.com/test.mp4',
          duration: 30
        }
      ])
    );
  }),
  
  rest.get('/api/displays', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          name: 'Test Display',
          status: 'online',
          lastSeen: new Date().toISOString()
        }
      ])
    );
  })
];

// Create server
export const server = setupServer(...handlers); 