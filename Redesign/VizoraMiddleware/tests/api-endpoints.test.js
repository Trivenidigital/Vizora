const request = require('supertest');
const { app } = require('../src/server');
const { socketService } = require('../src/services');
const { createServer } = require('http');

describe('API Endpoints', () => {
  let httpServer;
  let io;

  beforeAll(() => {
    httpServer = createServer(app);
    io = socketService.initialize(httpServer);
    httpServer.listen();
  });

  afterAll(() => {
    if (io) io.close();
    if (httpServer) httpServer.close();
  });

  describe('GET /api/health', () => {
    it('should return 200 OK with status message', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('POST /api/displays/register', () => {
    it('should register a new display', async () => {
      const displayData = {
        deviceId: 'test-device-1',
        name: 'Test Display',
        location: 'Test Location'
      };

      const response = await request(app)
        .post('/api/displays/register')
        .send(displayData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.display).toMatchObject(displayData);
    });

    it('should return 400 for invalid display data', async () => {
      const invalidData = {
        name: 'Invalid Display'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/displays/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/displays', () => {
    it('should return list of registered displays', async () => {
      const response = await request(app).get('/api/displays');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.displays)).toBe(true);
    });
  });

  describe('GET /api/displays/:deviceId', () => {
    it('should return display details for valid deviceId', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app).get(`/api/displays/${deviceId}`);
      expect(response.status).toBe(200);
      expect(response.body.display).toHaveProperty('deviceId', deviceId);
    });

    it('should return 404 for non-existent display', async () => {
      const response = await request(app).get('/api/displays/non-existent');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/displays/:deviceId', () => {
    it('should update display details', async () => {
      const deviceId = 'test-device-1';
      const updateData = {
        name: 'Updated Display Name',
        location: 'Updated Location'
      };

      const response = await request(app)
        .put(`/api/displays/${deviceId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.display).toMatchObject(updateData);
    });

    it('should return 404 for non-existent display', async () => {
      const response = await request(app)
        .put('/api/displays/non-existent')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/displays/:deviceId', () => {
    it('should delete an existing display', async () => {
      const deviceId = 'test-device-1';
      const response = await request(app).delete(`/api/displays/${deviceId}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent display', async () => {
      const response = await request(app).delete('/api/displays/non-existent');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/displays/:deviceId/pair', () => {
    it('should pair a display with a user', async () => {
      const deviceId = 'test-device-2';
      const pairingData = {
        userId: 'test-user-1',
        qrCode: 'test-qr-code'
      };

      const response = await request(app)
        .post(`/api/displays/${deviceId}/pair`)
        .send(pairingData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.display).toHaveProperty('paired', true);
    });

    it('should return 404 for non-existent display', async () => {
      const response = await request(app)
        .post('/api/displays/non-existent/pair')
        .send({ userId: 'test-user-1' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/displays/:deviceId/status', () => {
    it('should return display status', async () => {
      const deviceId = 'test-device-2';
      const response = await request(app).get(`/api/displays/${deviceId}/status`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('lastSeen');
    });

    it('should return 404 for non-existent display', async () => {
      const response = await request(app).get('/api/displays/non-existent/status');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
}); 