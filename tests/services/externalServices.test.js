const request = require('supertest');
const { app } = require('../mocks/app');
const { connectDB, disconnectDB, clearDatabase } = require('../../database');
const nock = require('nock');

describe('External Service Integrations', () => {
  beforeAll(async () => {
    await connectDB();
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(async () => {
    await clearDatabase();
    nock.cleanAll();
  });

  afterAll(async () => {
    await disconnectDB();
    nock.enableNetConnect();
  });

  describe('Weather Service Integration', () => {
    const WEATHER_API_BASE = 'https://api.weatherservice.com';
    
    it('should fetch and cache weather data', async () => {
      const mockWeatherData = {
        temperature: 20,
        conditions: 'sunny',
        location: 'Test City'
      };

      nock(WEATHER_API_BASE)
        .get('/current')
        .query(true)
        .reply(200, mockWeatherData);

      const response = await request(app)
        .get('/api/weather/current')
        .query({ city: 'Test City' })
        .expect(200);

      expect(response.body).toMatchObject(mockWeatherData);

      // Second request should use cached data
      const cachedResponse = await request(app)
        .get('/api/weather/current')
        .query({ city: 'Test City' })
        .expect(200);

      expect(cachedResponse.body).toMatchObject(mockWeatherData);
      expect(nock.isDone()).toBe(true); // Ensures only one external request was made
    });

    it('should handle weather service errors gracefully', async () => {
      nock(WEATHER_API_BASE)
        .get('/current')
        .query(true)
        .reply(500, { error: 'Internal Server Error' });

      const response = await request(app)
        .get('/api/weather/current')
        .query({ city: 'Test City' })
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/weather service/i);
    });
  });

  describe('Analytics Service Integration', () => {
    const ANALYTICS_API_BASE = 'https://api.analytics.com';
    
    it('should track events successfully', async () => {
      const eventData = {
        type: 'display_view',
        displayId: '123',
        duration: 300
      };

      nock(ANALYTICS_API_BASE)
        .post('/events')
        .reply(201, { received: true });

      const response = await request(app)
        .post('/api/analytics/track')
        .send(eventData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle analytics service timeout', async () => {
      const eventData = {
        type: 'display_view',
        displayId: '123',
        duration: 300
      };

      nock(ANALYTICS_API_BASE)
        .post('/events')
        .delayConnection(3000) // Simulate timeout
        .reply(200);

      const response = await request(app)
        .post('/api/analytics/track')
        .send(eventData)
        .expect(504);

      expect(response.body.error).toMatch(/timeout/i);
    });
  });

  describe('Content Delivery Network', () => {
    const CDN_API_BASE = 'https://api.cdn.com';
    
    it('should upload content to CDN', async () => {
      const mockUploadResponse = {
        url: 'https://cdn.example.com/file.jpg',
        id: 'cdn-123'
      };

      nock(CDN_API_BASE)
        .post('/upload')
        .reply(200, mockUploadResponse);

      const response = await request(app)
        .post('/api/cdn/upload')
        .attach('file', Buffer.from('test'), 'test.jpg')
        .expect(200);

      expect(response.body).toMatchObject(mockUploadResponse);
    });

    it('should handle CDN errors', async () => {
      nock(CDN_API_BASE)
        .post('/upload')
        .reply(503, { error: 'CDN Unavailable' });

      const response = await request(app)
        .post('/api/cdn/upload')
        .attach('file', Buffer.from('test'), 'test.jpg')
        .expect(502);

      expect(response.body.error).toMatch(/cdn/i);
    });

    it('should purge CDN cache', async () => {
      nock(CDN_API_BASE)
        .post('/purge')
        .reply(200, { success: true });

      const response = await request(app)
        .post('/api/cdn/purge')
        .send({ paths: ['/file.jpg'] })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
}); 