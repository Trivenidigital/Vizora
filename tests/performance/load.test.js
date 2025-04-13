const request = require('supertest');
const { app } = require('../mocks/app');
const { connectDB, disconnectDB, clearDatabase } = require('../../database');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');

describe('Performance Under Load', () => {
  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous display connections', async () => {
      const numConnections = 100;
      const startTime = Date.now();
      
      const requests = Array(numConnections).fill().map(() => 
        request(app)
          .post('/api/displays/connect')
          .send({ deviceId: Math.random().toString(36).substring(7) })
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('connectionId');
      });
      
      // Check performance metrics
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / numConnections;
      
      expect(avgResponseTime).toBeLessThan(100); // Average response time should be under 100ms
    });

    it('should maintain response times under heavy read load', async () => {
      // Create test data
      const testData = {
        name: 'Test Display',
        location: { city: 'Test City', country: 'TC' }
      };
      
      const createResponses = await Promise.all(
        Array(50).fill().map(() =>
          request(app)
            .post('/api/displays')
            .send(testData)
        )
      );
      
      const displayIds = createResponses.map(r => r.body.id);
      
      // Simulate heavy read traffic
      const numReads = 1000;
      const startTime = Date.now();
      
      const readRequests = Array(numReads).fill().map(() =>
        request(app)
          .get(`/api/displays/${displayIds[Math.floor(Math.random() * displayIds.length)]}`)
      );
      
      const responses = await Promise.all(readRequests);
      const endTime = Date.now();
      
      // Verify responses
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('name', 'Test Display');
      });
      
      const avgResponseTime = (endTime - startTime) / numReads;
      expect(avgResponseTime).toBeLessThan(50); // Average read time should be under 50ms
    });
  });

  describe('Memory Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate load
      const numOperations = 500;
      const operations = Array(numOperations).fill().map(() =>
        request(app)
          .post('/api/displays')
          .send({
            name: `Display ${Math.random()}`,
            location: { city: 'Test City', country: 'TC' }
          })
      );
      
      await Promise.all(operations);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(50); // Memory increase should be less than 50MB
    });
  });

  describe('Database Performance', () => {
    it('should handle concurrent database operations efficiently', async () => {
      const numOperations = 100;
      const operations = [];
      
      // Mix of create, read, update operations
      for (let i = 0; i < numOperations; i++) {
        if (i % 3 === 0) {
          // Create
          operations.push(
            request(app)
              .post('/api/displays')
              .send({
                name: `Display ${i}`,
                location: { city: 'Test City', country: 'TC' }
              })
          );
        } else if (i % 3 === 1) {
          // Read (assuming some IDs exist)
          operations.push(
            request(app)
              .get('/api/displays')
              .query({ page: Math.floor(i / 10), limit: 10 })
          );
        } else {
          // Update (assuming some IDs exist)
          operations.push(
            request(app)
              .put('/api/displays/test-id')
              .send({
                name: `Updated Display ${i}`
              })
          );
        }
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(operations);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const avgOperationTime = totalTime / numOperations;
      
      expect(avgOperationTime).toBeLessThan(100); // Average operation time should be under 100ms
      
      // Verify all operations completed successfully
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits effectively', async () => {
      const requests = Array(150).fill().map(() => // Exceed typical rate limit
        request(app)
          .get('/api/displays')
          .set('X-API-Key', 'test-key')
      );
      
      const responses = await Promise.all(requests);
      
      // Count rate-limited responses
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Expect some requests to be rate limited
      expect(rateLimited).toBeGreaterThan(0);
      
      // But not all requests should be rate limited
      expect(rateLimited).toBeLessThan(requests.length);
    });
  });
}); 