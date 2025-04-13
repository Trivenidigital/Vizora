const request = require('supertest');
const app = require('../app');
const db = require('../database');
const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');

// Mock the database for isolation
jest.mock('../database');

// Helper functions
const generateRandomContent = (size) => {
  const content = [];
  for (let i = 0; i < size; i++) {
    content.push({
      id: `content-${i}`,
      title: `Test Content ${i}`,
      type: i % 2 === 0 ? 'image' : 'video',
      url: i % 2 === 0 ? `/images/test-${i}.jpg` : `/videos/test-${i}.mp4`,
      duration: i % 2 === 0 ? null : Math.floor(Math.random() * 120),
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    });
  }
  return content;
};

const generateRandomDisplays = (size) => {
  const displays = [];
  for (let i = 0; i < size; i++) {
    displays.push({
      id: `display-${i}`,
      name: `Display ${i}`,
      location: `Location ${Math.floor(i / 10)}`,
      ipAddress: `192.168.1.${100 + i}`,
      lastSeen: new Date(),
      status: i % 10 === 0 ? 'offline' : 'online',
      version: '1.0.0'
    });
  }
  return displays;
};

const generateRandomSchedule = (contentSize, displaySize) => {
  const schedule = [];
  for (let i = 0; i < displaySize; i++) {
    const displaySchedule = [];
    const itemCount = Math.floor(Math.random() * 5) + 1; // 1-5 items per display
    
    for (let j = 0; j < itemCount; j++) {
      displaySchedule.push({
        id: `schedule-${i}-${j}`,
        displayId: `display-${i}`,
        contentId: `content-${Math.floor(Math.random() * contentSize)}`,
        startTime: '08:00',
        endTime: '17:00',
        daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        priority: Math.floor(Math.random() * 10)
      });
    }
    schedule.push(...displaySchedule);
  }
  return schedule;
};

// Set up test data
const SMALL_DATA_SIZE = 10;
const MEDIUM_DATA_SIZE = 100;
const LARGE_DATA_SIZE = 1000;

// Performance testing
describe('API Performance Tests', () => {
  // Setup and teardown
  beforeAll(async () => {
    // Create temp directory for file uploads if it doesn't exist
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Additional cleanup if needed
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Content API Performance', () => {
    it('should handle listing content with small dataset efficiently', async () => {
      // Mock database response
      const mockContent = generateRandomContent(SMALL_DATA_SIZE);
      db.content.findAll.mockResolvedValue(mockContent);

      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/content')
        .expect(200);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(response.body.length).toBe(SMALL_DATA_SIZE);
      expect(duration).toBeLessThan(100); // Response should be under 100ms
    });

    it('should handle listing content with medium dataset efficiently', async () => {
      // Mock database response
      const mockContent = generateRandomContent(MEDIUM_DATA_SIZE);
      db.content.findAll.mockResolvedValue(mockContent);

      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/content')
        .expect(200);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(response.body.length).toBe(MEDIUM_DATA_SIZE);
      expect(duration).toBeLessThan(300); // Response should be under 300ms
    });

    it('should handle listing content with large dataset efficiently', async () => {
      // Mock database response
      const mockContent = generateRandomContent(LARGE_DATA_SIZE);
      db.content.findAll.mockResolvedValue(mockContent);

      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/content')
        .expect(200);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(response.body.length).toBe(LARGE_DATA_SIZE);
      expect(duration).toBeLessThan(1000); // Response should be under 1000ms
    });

    it('should handle content filtering efficiently', async () => {
      // Mock database response
      const mockContent = generateRandomContent(LARGE_DATA_SIZE);
      // Mock filtered response (half the items)
      const filteredContent = mockContent.filter(item => item.type === 'image');
      
      db.content.findAll.mockImplementation((options) => {
        if (options && options.where && options.where.type === 'image') {
          return Promise.resolve(filteredContent);
        }
        return Promise.resolve(mockContent);
      });

      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/content?type=image')
        .expect(200);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(response.body.length).toBe(filteredContent.length);
      expect(duration).toBeLessThan(500); // Response should be under 500ms
    });
  });

  describe('Display API Performance', () => {
    it('should handle concurrent display status updates efficiently', async () => {
      // Mock database response
      const mockDisplays = generateRandomDisplays(MEDIUM_DATA_SIZE);
      db.display.findByPk.mockImplementation((id) => {
        const display = mockDisplays.find(d => d.id === id);
        return Promise.resolve(display ? { ...display, save: jest.fn() } : null);
      });
      
      const startTime = performance.now();
      
      // Simulate 20 concurrent requests
      const concurrentRequests = 20;
      const requestPromises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        const displayId = `display-${i % MEDIUM_DATA_SIZE}`;
        requestPromises.push(
          request(app)
            .put(`/api/displays/${displayId}/status`)
            .send({ status: 'online' })
        );
      }
      
      await Promise.all(requestPromises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Average time per request should be reasonable
      const avgTime = duration / concurrentRequests;
      expect(avgTime).toBeLessThan(50); // Avg time should be under 50ms per request
    });
  });

  describe('Schedule API Performance', () => {
    it('should handle retrieving complex schedules efficiently', async () => {
      // Generate complex test data
      const contentSize = MEDIUM_DATA_SIZE;
      const displaySize = MEDIUM_DATA_SIZE;
      const mockContent = generateRandomContent(contentSize);
      const mockDisplays = generateRandomDisplays(displaySize);
      const mockSchedule = generateRandomSchedule(contentSize, displaySize);
      
      // Mock database responses
      db.schedule.findAll.mockResolvedValue(mockSchedule);
      db.content.findByPk.mockImplementation((id) => {
        return Promise.resolve(mockContent.find(c => c.id === id));
      });
      db.display.findByPk.mockImplementation((id) => {
        return Promise.resolve(mockDisplays.find(d => d.id === id));
      });
      
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/schedule')
        .expect(200);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(response.body.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1500); // Complex operation should be under 1.5s
    });
  });

  describe('File Upload Performance', () => {
    it('should handle multiple file uploads efficiently', async () => {
      // Mock file data (1MB file)
      const fileSize = 1024 * 1024; // 1MB
      const filePath = path.join(__dirname, 'test-file.jpg');
      
      // Create a test file
      const buffer = Buffer.alloc(fileSize, 'x');
      fs.writeFileSync(filePath, buffer);
      
      // Mock database response
      db.content.create.mockResolvedValue({
        id: 'content-new',
        title: 'Uploaded Content',
        type: 'image',
        url: '/uploads/test-file.jpg',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const startTime = performance.now();
      
      // Upload the file 5 times
      const uploadCount = 5;
      const uploadPromises = [];
      
      for (let i = 0; i < uploadCount; i++) {
        uploadPromises.push(
          request(app)
            .post('/api/content/upload')
            .attach('file', filePath)
            .field('title', `Uploaded Content ${i}`)
            .field('type', 'image')
        );
      }
      
      await Promise.all(uploadPromises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Clean up test file
      fs.unlinkSync(filePath);
      
      // Average time per upload should be reasonable
      const avgTime = duration / uploadCount;
      expect(avgTime).toBeLessThan(500); // Avg time should be under 500ms per upload
    });
  });

  describe('API Stress Tests', () => {
    it('should handle a burst of API requests without errors', async () => {
      // Mock database responses
      const mockContent = generateRandomContent(MEDIUM_DATA_SIZE);
      const mockDisplays = generateRandomDisplays(MEDIUM_DATA_SIZE);
      
      db.content.findAll.mockResolvedValue(mockContent);
      db.display.findAll.mockResolvedValue(mockDisplays);
      db.display.findByPk.mockImplementation((id) => {
        const display = mockDisplays.find(d => d.id === id);
        return Promise.resolve(display ? { ...display, save: jest.fn() } : null);
      });
      
      // Generate a mix of different API requests
      const requestCount = 100;
      const requests = [];
      
      for (let i = 0; i < requestCount; i++) {
        const requestType = i % 4;
        
        switch (requestType) {
          case 0:
            // Get content list
            requests.push(
              request(app).get('/api/content')
            );
            break;
          case 1:
            // Get displays list
            requests.push(
              request(app).get('/api/displays')
            );
            break;
          case 2:
            // Update display status
            requests.push(
              request(app)
                .put(`/api/displays/display-${i % MEDIUM_DATA_SIZE}/status`)
                .send({ status: 'online' })
            );
            break;
          case 3:
            // Get specific content
            requests.push(
              request(app).get(`/api/content/content-${i % MEDIUM_DATA_SIZE}`)
            );
            break;
        }
      }
      
      const startTime = performance.now();
      
      // Execute all requests
      const results = await Promise.allSettled(requests);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Check success rate
      const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successfulRequests / requestCount) * 100;
      
      expect(successRate).toBeGreaterThanOrEqual(95); // At least 95% should succeed
      expect(duration).toBeLessThan(10000); // All requests should complete within 10 seconds
    });
  });

  describe('Database Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      db.content.findAll.mockRejectedValue(new Error('Database connection error'));
      
      const response = await request(app)
        .get('/api/content')
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database query timeouts gracefully', async () => {
      // Mock database timeout
      db.content.findAll.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Query timeout'));
          }, 300);
        });
      });
      
      const response = await request(app)
        .get('/api/content')
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Memory Usage Tests', () => {
    it('should handle large datasets without excessive memory usage', async () => {
      // Store initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Mock large dataset
      const mockContent = generateRandomContent(LARGE_DATA_SIZE);
      db.content.findAll.mockResolvedValue(mockContent);
      
      // Make request
      await request(app).get('/api/content').expect(200);
      
      // Get memory usage after request
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDiff = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      const memoryIncreaseMB = memoryDiff / (1024 * 1024);
      expect(memoryIncreaseMB).toBeLessThan(50);
    });
  });
}); 