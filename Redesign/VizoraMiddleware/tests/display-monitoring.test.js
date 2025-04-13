const request = require('supertest');
const { app } = require('../src/app');
const { setupSocketIO } = require('../src/socket');
const { Server } = require('socket.io');
const { createServer } = require('http');

describe('Display Monitoring and Analytics', () => {
  let httpServer;
  let ioServer;

  beforeAll(() => {
    httpServer = createServer(app);
    ioServer = new Server(httpServer);
    setupSocketIO(ioServer);
    httpServer.listen();
  });

  afterAll(() => {
    ioServer.close();
    httpServer.close();
  });

  describe('GET /api/displays/:deviceId/metrics', () => {
    it('should return display metrics', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app).get(`/api/displays/${deviceId}/metrics`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('network');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return 404 for non-existent display', async () => {
      const response = await request(app).get('/api/displays/non-existent/metrics');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/displays/:deviceId/logs', () => {
    it('should return display logs', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app).get(`/api/displays/${deviceId}/logs`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should filter logs by date range', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app)
        .get(`/api/displays/${deviceId}/logs`)
        .query({
          startDate: '2024-04-01',
          endDate: '2024-04-02'
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.logs)).toBe(true);
    });
  });

  describe('GET /api/displays/:deviceId/alerts', () => {
    it('should return display alerts', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app).get(`/api/displays/${deviceId}/alerts`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });

    it('should filter alerts by severity', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app)
        .get(`/api/displays/${deviceId}/alerts`)
        .query({ severity: 'high' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });
  });

  describe('POST /api/displays/:deviceId/maintenance', () => {
    it('should enable maintenance mode', async () => {
      const deviceId = 'test-device-1';
      const maintenanceData = {
        enabled: true,
        reason: 'System update',
        estimatedDuration: '1 hour'
      };

      const response = await request(app)
        .post(`/api/displays/${deviceId}/maintenance`)
        .send(maintenanceData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.maintenance).toMatchObject(maintenanceData);
    });

    it('should disable maintenance mode', async () => {
      const deviceId = 'test-device-1';
      const maintenanceData = {
        enabled: false,
        reason: 'Maintenance complete'
      };

      const response = await request(app)
        .post(`/api/displays/${deviceId}/maintenance`)
        .send(maintenanceData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.maintenance.enabled).toBe(false);
    });
  });

  describe('GET /api/displays/:deviceId/analytics', () => {
    it('should return display analytics', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app).get(`/api/displays/${deviceId}/analytics`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('contentViews');
      expect(response.body).toHaveProperty('errorRate');
    });

    it('should filter analytics by date range', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app)
        .get(`/api/displays/${deviceId}/analytics`)
        .query({
          startDate: '2024-04-01',
          endDate: '2024-04-02'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('contentViews');
    });
  });

  describe('POST /api/displays/:deviceId/health-check', () => {
    it('should perform health check', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app).post(`/api/displays/${deviceId}/health-check`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.health).toHaveProperty('status');
      expect(response.body.health).toHaveProperty('checks');
    });

    it('should return 404 for non-existent display', async () => {
      const response = await request(app).post('/api/displays/non-existent/health-check');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/displays/:deviceId/update', () => {
    it('should initiate display update', async () => {
      const deviceId = 'test-device-1';
      const updateData = {
        version: '1.2.0',
        force: false
      };

      const response = await request(app)
        .post(`/api/displays/${deviceId}/update`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.update).toHaveProperty('status');
      expect(response.body.update).toHaveProperty('progress');
    });

    it('should handle update errors', async () => {
      const deviceId = 'test-device-1';
      const updateData = {
        version: 'invalid-version',
        force: true
      };

      const response = await request(app)
        .post(`/api/displays/${deviceId}/update`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
}); 