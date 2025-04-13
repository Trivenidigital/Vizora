const request = require('supertest');
const { app } = require('../src/app');
const { setupSocketIO } = require('../src/socket');
const { Server } = require('socket.io');
const { createServer } = require('http');

describe('Content Management', () => {
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

  describe('POST /api/content', () => {
    it('should upload new content', async () => {
      const contentData = {
        title: 'Test Content',
        type: 'image',
        url: 'https://example.com/test.jpg',
        duration: 10,
        schedule: {
          startTime: '2024-04-01T00:00:00Z',
          endTime: '2024-04-02T00:00:00Z'
        }
      };

      const response = await request(app)
        .post('/api/content')
        .send(contentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.content).toMatchObject(contentData);
    });

    it('should validate content data', async () => {
      const invalidData = {
        title: 'Invalid Content'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/content')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/content', () => {
    it('should return list of content', async () => {
      const response = await request(app).get('/api/content');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.content)).toBe(true);
    });

    it('should filter content by date range', async () => {
      const response = await request(app)
        .get('/api/content')
        .query({
          startDate: '2024-04-01',
          endDate: '2024-04-02'
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.content)).toBe(true);
    });
  });

  describe('PUT /api/content/:contentId', () => {
    it('should update content details', async () => {
      const contentId = 'test-content-1';
      const updateData = {
        title: 'Updated Content',
        duration: 20
      };

      const response = await request(app)
        .put(`/api/content/${contentId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.content).toMatchObject(updateData);
    });

    it('should return 404 for non-existent content', async () => {
      const response = await request(app)
        .put('/api/content/non-existent')
        .send({ title: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/content/:contentId', () => {
    it('should delete content', async () => {
      const contentId = 'test-content-1';
      const response = await request(app).delete(`/api/content/${contentId}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent content', async () => {
      const response = await request(app).delete('/api/content/non-existent');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/content/:contentId/schedule', () => {
    it('should schedule content for display', async () => {
      const contentId = 'test-content-1';
      const scheduleData = {
        displayId: 'test-device-1',
        startTime: '2024-04-01T00:00:00Z',
        endTime: '2024-04-02T00:00:00Z'
      };

      const response = await request(app)
        .post(`/api/content/${contentId}/schedule`)
        .send(scheduleData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.schedule).toMatchObject(scheduleData);
    });

    it('should handle scheduling conflicts', async () => {
      const contentId = 'test-content-1';
      const scheduleData = {
        displayId: 'test-device-1',
        startTime: '2024-04-01T00:00:00Z',
        endTime: '2024-04-01T01:00:00Z' // Overlapping time
      };

      const response = await request(app)
        .post(`/api/content/${contentId}/schedule`)
        .send(scheduleData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('conflict');
    });
  });

  describe('GET /api/content/:contentId/analytics', () => {
    it('should return content analytics', async () => {
      const contentId = 'test-content-1';
      const response = await request(app).get(`/api/content/${contentId}/analytics`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('views');
      expect(response.body).toHaveProperty('duration');
      expect(response.body).toHaveProperty('engagement');
    });

    it('should return 404 for non-existent content', async () => {
      const response = await request(app).get('/api/content/non-existent/analytics');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
}); 