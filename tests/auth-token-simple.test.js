/**
 * Simplified Authentication Token Tests
 */
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { app } = require('./mocks/app');
const { connectDB, disconnectDB, clearDatabase } = require('../database');

const JWT_SECRET = 'test-secret';

// Setup database connection
beforeAll(async () => {
  await connectDB();
  
  // Add a protected route that requires authentication
  app.get('/api/protected', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.status(200).json({ 
        message: 'Protected data', 
        user: decoded 
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });
});

// Clear database between tests
beforeEach(async () => {
  await clearDatabase();
});

// Cleanup after all tests
afterAll(async () => {
  await disconnectDB();
});

describe('Authentication Token', () => {
  describe('Token Validation', () => {
    it('should allow access with valid token', async () => {
      // Create a valid token
      const payload = { userId: '123', role: 'user' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Protected data');
      expect(response.body.user).toMatchObject(payload);
    });
    
    it('should reject expired tokens', async () => {
      // Create an expired token
      const payload = { userId: '123', role: 'user' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '0s' });
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
    
    it('should reject requests without authorization header', async () => {
      const response = await request(app).get('/api/protected');
      
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject malformed tokens', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer malformed.token.here');
      
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });
}); 