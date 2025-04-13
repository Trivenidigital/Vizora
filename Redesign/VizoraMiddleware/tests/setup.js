/**
 * Test Setup
 * Configures the test environment for Jest
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key';
process.env.JWT_EXPIRE = '1h';
process.env.JWT_REFRESH_EXPIRE = '1d';

// Create a MongoDB memory server
let mongoServer;

// For CI/CD testing, use a test database on MongoDB Atlas
// For local testing, use an in-memory database
if (process.env.CI) {
  // Use MongoDB Atlas test database for CI environments
  process.env.MONGO_URI = process.env.MONGO_URI
    ? process.env.MONGO_URI.replace('vizora', 'vizora_test') 
    : 'mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora_test?retryWrites=true&w=majority&appName=Cluster0';
} else {
  // Use in-memory database for local testing
  process.env.MONGO_URI = 'mongodb://localhost:27017/vizora_test';
}

// Configure mongoose
mongoose.set('strictQuery', true);

// Setup before all tests
beforeAll(async () => {
  jest.setTimeout(60000); // Increase timeout for slow tests
  
  // Force close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  try {
    // Create in-memory MongoDB server with optimized settings
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'vizora_test',
        // Lower memory usage settings for tests
        args: [
          '--wiredTigerCacheSizeGB=0.25',
          '--nojournal'
        ]
      }
    });
    
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database with optimized settings
    await mongoose.connect(mongoUri, {
      // Modern mongoose doesn't need deprecated options
      maxPoolSize: 5
    });
    
    console.log(`MongoDB successfully connected to ${mongoUri}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clean up all collections efficiently
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
  
  // Clean up mocks
  jest.restoreAllMocks();
  
  // Force garbage collection if possible
  if (global.gc) {
    global.gc();
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Disconnect from MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // Stop MongoDB server
  if (mongoServer) {
    await mongoServer.stop({ doCleanup: true }); // Ensure cleanup is done
    console.log('MongoDB server stopped');
  }
});

// Global test helpers
global.createTestUser = async (User, userData = {}) => {
  const defaultUser = {
    username: 'testuser',
    email: 'test@example.com',
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
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
  
  return { user, token };
};

// Helper function to create a test admin
global.createTestAdmin = async (User) => {
  return global.createTestUser(User, {
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin'
  });
};

// Optimized test display helper - minimal required fields
global.createTestDisplay = async (Display, userId) => {
  const display = await Display.create({
    name: 'Test Display',
    deviceId: 'test-device-' + Date.now(), // Ensure unique deviceIds
    status: 'active',
    location: {
      name: 'Test Location'
    },
    owner: userId
  });
  
  return display;
};

// Optimized content helper - minimal required fields
global.createTestContent = async (Content, userId, displayIds = []) => {
  const content = await Content.create({
    title: 'Test Content',
    type: 'image',
    url: 'https://example.com/test.jpg',
    displays: displayIds,
    owner: userId,
    status: 'published',
    statistics: {
      views: 0,
      completions: 0,
      averageDuration: 0,
      playHistory: []
    }
  });
  
  return content;
};

// Auth header helper
global.authHeader = (token) => ({
  Authorization: `Bearer ${token}`
});

// API request helpers
global.testRequest = (app) => ({
  get: (url, token) => 
    request(app).get(url)
      .set(token ? global.authHeader(token) : {}),
    
  post: (url, data, token) => 
    request(app).post(url)
      .set(token ? global.authHeader(token) : {})
      .send(data),
    
  put: (url, data, token) => 
    request(app).put(url)
      .set(token ? global.authHeader(token) : {})
      .send(data),
    
  delete: (url, token) => 
    request(app).delete(url)
      .set(token ? global.authHeader(token) : {})
});

// Extend Jest matchers
expect.extend({
  toBeValidMongoId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    return {
      message: () => `expected ${received} to be a valid MongoDB ObjectId`,
      pass
    };
  },
  
  toContainObject(received, expected) {
    const pass = this.equals(
      received.find(item => this.equals(item, expected)),
      expected
    );
    return {
      pass,
      message: () => `expected ${received} to contain object ${expected}`
    };
  }
}); 