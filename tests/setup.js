/**
 * Test setup file for VizoraMiddleware
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Import mocks
const { connectDB, disconnectDB, clearDatabase } = require('./mocks/database');
const { clearMockHandlers } = require('./mocks/socket');

// Mock implementations for external services
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((payload, secret, options) => 'mock-token'),
  verify: jest.fn().mockImplementation((token, secret, options, callback) => {
    if (token === 'expired-token') {
      throw new Error('jwt expired');
    }
    if (token === 'invalid-token') {
      throw new Error('invalid token');
    }
    return { userId: 'mock-user-id', role: 'user' };
  })
}));

// Add global test setup
beforeAll(async () => {
  // Connect to mock database
  const mongoUri = await connectDB();
  console.log(`Using mock MongoDB at ${mongoUri}`);
});

// Clean database before each test
beforeEach(async () => {
  await clearDatabase();
  clearMockHandlers();
});

// Close database connection after all tests
afterAll(async () => {
  await disconnectDB();
});

// Add global test helpers
global.createTestServer = async () => {
  const { app } = require('./mocks/app');
  const { setupSocketIO } = require('./mocks/socket');
  const { io, httpServer } = setupSocketIO(app);
  
  return {
    app,
    io,
    httpServer,
    start: () => new Promise((resolve) => {
      const server = httpServer.listen(0, () => {
        const { port } = server.address();
        console.log(`Test server running on port ${port}`);
        resolve({ server, port });
      });
    }),
    close: () => new Promise((resolve) => {
      io.close();
      httpServer.close(resolve);
    })
  };
}; 