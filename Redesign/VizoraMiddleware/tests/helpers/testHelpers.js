/**
 * Test Helper Functions
 * Optimized utility functions to assist with testing
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const Display = require('../../src/models/Display');
const Content = require('../../src/models/Content');

/**
 * Create a test user with minimal required properties
 * @param {Object} userData Optional user data override
 * @returns {Promise<Object>} User object and JWT token
 */
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    username: 'testuser' + Date.now(), // Ensure unique usernames
    email: `test${Date.now()}@example.com`, // Ensure unique emails
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    status: 'active'
  };
  
  const user = await User.create({
    ...defaultUser,
    ...userData
  });
  
  // Generate token
  const token = jwt.sign(
    { id: user._id, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
  
  return { user, token };
};

/**
 * Create a test admin user
 * @returns {Promise<Object>} Admin user object and JWT token
 */
const createTestAdmin = async () => {
  return createTestUser({
    username: 'admin' + Date.now(),
    email: `admin${Date.now()}@example.com`,
    role: 'admin'
  });
};

/**
 * Create a test display device with minimal required properties
 * @param {String} userId Optional owner ID
 * @returns {Promise<Object>} Display object
 */
const createTestDisplay = async (userId = null) => {
  const timestamp = Date.now();
  const display = await Display.create({
    name: `Test Display ${timestamp}`,
    deviceId: `test-device-${timestamp}`,
    status: 'active',
    location: {
      name: 'Test Location'
    },
    owner: userId || undefined
  });
  
  return display;
};

/**
 * Create test content with minimal required properties
 * @param {String} userId Owner ID
 * @param {Array} displayIds Optional array of display IDs
 * @returns {Promise<Object>} Content object
 */
const createTestContent = async (userId, displayIds = []) => {
  const timestamp = Date.now();
  const content = await Content.create({
    title: `Test Content ${timestamp}`,
    type: 'image',
    url: `https://example.com/test-${timestamp}.jpg`,
    displays: displayIds,
    status: 'published',
    owner: userId,
    statistics: {
      views: 0,
      completions: 0,
      averageDuration: 0,
      playHistory: []
    }
  });
  
  return content;
};

/**
 * Generate auth header with token
 * @param {String} token JWT token
 * @returns {Object} Authorization header object
 */
const authHeader = (token) => ({
  Authorization: `Bearer ${token}`
});

/**
 * Clear specific collections
 * More efficient than clearing all collections when only specific ones are needed
 * @param {Array} collectionNames Array of collection names to clear
 */
const clearCollections = async (collectionNames = []) => {
  if (collectionNames.length === 0) {
    // Default to clearing all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } else {
    // Clear only specified collections
    for (const name of collectionNames) {
      if (mongoose.connection.collections[name]) {
        await mongoose.connection.collections[name].deleteMany({});
      }
    }
  }
};

/**
 * Mock request object for middleware testing with minimal properties
 */
const mockRequest = (overrides = {}) => {
  const req = {
    body: {},
    query: {},
    params: {},
    headers: {},
    cookies: {},
    ...overrides
  };
  return req;
};

/**
 * Mock response object for middleware testing
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock next function for middleware testing
 */
const mockNext = jest.fn();

/**
 * Clean up mocks and restore them
 */
const cleanupMocks = () => {
  jest.restoreAllMocks();
  if (mockNext.mockClear) {
    mockNext.mockClear();
  }
};

module.exports = {
  createTestUser,
  createTestAdmin,
  createTestDisplay,
  createTestContent,
  authHeader,
  clearCollections,
  mockRequest,
  mockResponse,
  mockNext,
  cleanupMocks
}; 