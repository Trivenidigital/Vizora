/**
 * Simple Tests
 * Basic functionality tests for the application
 */

const mongoose = require('mongoose');
const { ApiError } = require('../src/middleware/errorMiddleware');
const User = require('../src/models/User');
const Display = require('../src/models/Display');
const Content = require('../src/models/Content');
const { createTestUser, createTestDisplay, createTestContent, clearCollections, cleanupMocks } = require('./helpers/testHelpers');

// Setup and teardown for each test
beforeEach(() => {
  // Clear any mocks before each test
  jest.clearAllMocks();
});

afterEach(async () => {
  // Clean up data after each test
  await clearCollections(['users', 'displays', 'contents']);
  cleanupMocks();
});

describe('Basic Application Functionality', () => {
  describe('Models', () => {
    it('should create and find a user', async () => {
      const timestamp = Date.now();
      const userData = {
        username: `testuser_${timestamp}`,
        email: `test_${timestamp}@example.com`,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };
      
      // Create user
      const user = await User.create(userData);
      
      expect(user._id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      
      // Find user
      const foundUser = await User.findById(user._id);
      
      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(userData.email);
      
      // Clean up
      await User.deleteOne({ _id: user._id });
    });
    
    it('should create a Display with an API key', async () => {
      const { user } = await createTestUser();
      
      const timestamp = Date.now();
      const displayData = {
        name: `Test Display ${timestamp}`,
        deviceId: `test-device-${timestamp}`,
        owner: user._id,
        location: {
          name: 'Test Location'
        }
      };
      
      // Create display
      const display = await Display.create(displayData);
      
      expect(display._id).toBeDefined();
      expect(display.name).toBe(displayData.name);
      expect(display.deviceId).toBe(displayData.deviceId);
      expect(display.apiKey).toBeDefined();
      
      // API key should be generated
      expect(display.apiKey.length).toBeGreaterThan(0);
      
      // Clean up
      await Display.deleteOne({ _id: display._id });
      await User.deleteOne({ _id: user._id });
    });
    
    it('should create Content with proper references', async () => {
      const { user } = await createTestUser();
      const display = await createTestDisplay(user._id);
      
      const timestamp = Date.now();
      const contentData = {
        title: `Test Content ${timestamp}`,
        type: 'image',
        url: `https://example.com/test-${timestamp}.jpg`,
        displays: [display._id],
        owner: user._id,
        status: 'published'
      };
      
      // Create content
      const content = await Content.create(contentData);
      
      expect(content._id).toBeDefined();
      expect(content.title).toBe(contentData.title);
      expect(content.type).toBe(contentData.type);
      expect(content.url).toBe(contentData.url);
      expect(content.displays).toContainEqual(display._id);
      expect(content.owner).toEqual(user._id);
      
      // Clean up
      await Content.deleteOne({ _id: content._id });
      await Display.deleteOne({ _id: display._id });
      await User.deleteOne({ _id: user._id });
    });
  });
  
  describe('Error Handling', () => {
    it('should create ApiError instances with proper status codes', () => {
      const badRequestError = ApiError.badRequest('Bad request message');
      expect(badRequestError.statusCode).toBe(400);
      expect(badRequestError.message).toBe('Bad request message');
      
      const unauthorizedError = ApiError.unauthorized('Unauthorized message');
      expect(unauthorizedError.statusCode).toBe(401);
      expect(unauthorizedError.message).toBe('Unauthorized message');
      
      const forbiddenError = ApiError.forbidden('Forbidden message');
      expect(forbiddenError.statusCode).toBe(403);
      expect(forbiddenError.message).toBe('Forbidden message');
      
      const notFoundError = ApiError.notFound('Not found message');
      expect(notFoundError.statusCode).toBe(404);
      expect(notFoundError.message).toBe('Not found message');
      
      const internalError = ApiError.internalServerError('Internal server error');
      expect(internalError.statusCode).toBe(500);
      expect(internalError.message).toBe('Internal server error');
    });
  });
  
  describe('Model Methods', () => {
    // Use let to allow proper cleanup
    let user, display, content;
    
    // Setup test data
    beforeEach(async () => {
      user = (await createTestUser()).user;
      display = await createTestDisplay(user._id);
      content = await createTestContent(user._id, [display._id]);
    });
    
    // Clean up test data
    afterEach(async () => {
      if (content?._id) await Content.deleteOne({ _id: content._id });
      if (display?._id) await Display.deleteOne({ _id: display._id });
      if (user?._id) await User.deleteOne({ _id: user._id });
      
      // Reset variables to prevent memory leaks
      user = null;
      display = null;
      content = null;
    });
    
    it('should track content views properly', async () => {
      // Initial view count should be 0
      expect(content.statistics.views).toBe(0);
      
      // Track a view
      await content.trackView(display._id, 5000, true);
      
      // View count should be incremented
      expect(content.statistics.views).toBe(1);
      expect(content.statistics.completions).toBe(1);
      expect(content.statistics.averageDuration).toBe(5000);
      expect(content.statistics.playHistory.length).toBe(1);
      
      // Track another view
      await content.trackView(display._id, 3000, false);
      
      // View count should be incremented again
      expect(content.statistics.views).toBe(2);
      expect(content.statistics.completions).toBe(1);
      expect(content.statistics.averageDuration).toBe(4000); // (5000 + 3000) / 2
      expect(content.statistics.playHistory.length).toBe(2);
    });
  });
});
