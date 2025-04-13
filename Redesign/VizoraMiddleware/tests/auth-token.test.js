const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// Mock the database
jest.mock('../database');

// Mock jwt
jest.mock('jsonwebtoken');

describe('Authentication Token Validation', () => {
  // Test data
  const validUserId = 'user-123';
  const invalidUserId = 'user-invalid';
  const adminUserId = 'admin-123';
  
  const validToken = 'valid-token';
  const expiredToken = 'expired-token';
  const invalidToken = 'invalid-token';
  const adminToken = 'admin-token';
  
  const mockUser = {
    id: validUserId,
    email: 'user@example.com',
    role: 'user',
    active: true
  };
  
  const mockAdmin = {
    id: adminUserId,
    email: 'admin@example.com',
    role: 'admin',
    active: true
  };
  
  const mockInactiveUser = {
    id: invalidUserId,
    email: 'inactive@example.com',
    role: 'user',
    active: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database user lookup
    db.user.findByPk.mockImplementation((id) => {
      if (id === validUserId) {
        return Promise.resolve(mockUser);
      } else if (id === adminUserId) {
        return Promise.resolve(mockAdmin);
      } else if (id === invalidUserId) {
        return Promise.resolve(mockInactiveUser);
      } else {
        return Promise.resolve(null);
      }
    });
    
    // Mock JWT verification
    jwt.verify.mockImplementation((token, secret, callback) => {
      if (token === validToken) {
        callback(null, { userId: validUserId, exp: Date.now() / 1000 + 3600 });
      } else if (token === expiredToken) {
        callback({ name: 'TokenExpiredError', message: 'Token expired' });
      } else if (token === invalidToken) {
        callback({ name: 'JsonWebTokenError', message: 'Invalid token' });
      } else if (token === adminToken) {
        callback(null, { userId: adminUserId, exp: Date.now() / 1000 + 3600 });
      } else {
        callback({ name: 'JsonWebTokenError', message: 'Invalid token' });
      }
    });
  });

  describe('Token Validation Middleware', () => {
    it('should allow requests with valid tokens', async () => {
      // Create a test route with auth middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.verifyToken(testRoute);
      
      // Create mock request and response
      const req = {
        headers: { authorization: `Bearer ${validToken}` },
        get: jest.fn().mockReturnValue(`Bearer ${validToken}`)
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Check that user was attached to request
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(validUserId);
      
      // Check that next was called
      expect(next).toHaveBeenCalled();
    });

    it('should reject requests with expired tokens', async () => {
      // Create a test route with auth middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.verifyToken(testRoute);
      
      // Create mock request and response
      const req = {
        headers: { authorization: `Bearer ${expiredToken}` },
        get: jest.fn().mockReturnValue(`Bearer ${expiredToken}`)
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Check that appropriate error response was sent
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('expired')
      }));
      
      // Next should not be called
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid tokens', async () => {
      // Create a test route with auth middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.verifyToken(testRoute);
      
      // Create mock request and response
      const req = {
        headers: { authorization: `Bearer ${invalidToken}` },
        get: jest.fn().mockReturnValue(`Bearer ${invalidToken}`)
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Check that appropriate error response was sent
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Invalid token')
      }));
      
      // Next should not be called
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests without authorization header', async () => {
      // Create a test route with auth middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.verifyToken(testRoute);
      
      // Create mock request and response
      const req = {
        headers: {},
        get: jest.fn().mockReturnValue(null)
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Check that appropriate error response was sent
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('No token provided')
      }));
      
      // Next should not be called
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject tokens for inactive users', async () => {
      // Mock JWT to return an inactive user
      jwt.verify.mockImplementationOnce((token, secret, callback) => {
        callback(null, { userId: invalidUserId, exp: Date.now() / 1000 + 3600 });
      });
      
      // Create a test route with auth middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.verifyToken(testRoute);
      
      // Create mock request and response
      const req = {
        headers: { authorization: 'Bearer some-token' },
        get: jest.fn().mockReturnValue('Bearer some-token')
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Check that appropriate error response was sent
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('inactive')
      }));
      
      // Next should not be called
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject tokens for non-existent users', async () => {
      // Mock JWT to return a non-existent user
      jwt.verify.mockImplementationOnce((token, secret, callback) => {
        callback(null, { userId: 'non-existent', exp: Date.now() / 1000 + 3600 });
      });
      
      // Create a test route with auth middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.verifyToken(testRoute);
      
      // Create mock request and response
      const req = {
        headers: { authorization: 'Bearer some-token' },
        get: jest.fn().mockReturnValue('Bearer some-token')
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Check that appropriate error response was sent
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('not found')
      }));
      
      // Next should not be called
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow admin access to admin-only routes', async () => {
      // Create a test route with admin middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.isAdmin(testRoute);
      
      // Create mock request with admin user
      const req = {
        user: mockAdmin
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Admin should be allowed
      expect(next).toHaveBeenCalled();
    });

    it('should deny non-admin access to admin-only routes', async () => {
      // Create a test route with admin middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.isAdmin(testRoute);
      
      // Create mock request with regular user
      const req = {
        user: mockUser
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Regular user should be denied
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('admin')
      }));
      
      // Next should not be called
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('API Endpoints with Authentication', () => {
    it('should protect private routes from unauthenticated access', async () => {
      // Protected route test
      const response = await request(app)
        .get('/api/protected-resource')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should allow access to private routes with valid token', async () => {
      // Mock app behavior to accept the valid token
      app.request.get = jest.fn().mockImplementation((url) => {
        if (url.includes('authorization')) {
          return `Bearer ${validToken}`;
        }
        return null;
      });
      
      const response = await request(app)
        .get('/api/protected-resource')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
    });

    it('should deny access to admin routes for non-admin users', async () => {
      // Mock app behavior to accept the valid token but detect non-admin role
      app.request.get = jest.fn().mockImplementation((url) => {
        if (url.includes('authorization')) {
          return `Bearer ${validToken}`;
        }
        return null;
      });
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should allow access to admin routes for admin users', async () => {
      // Mock app behavior to accept the admin token
      app.request.get = jest.fn().mockImplementation((url) => {
        if (url.includes('authorization')) {
          return `Bearer ${adminToken}`;
        }
        return null;
      });
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Token Refresh Functionality', () => {
    it('should issue a new token when refresh token is valid', async () => {
      // Mock token refresh endpoint
      const refreshToken = 'valid-refresh-token';
      const newAccessToken = 'new-access-token';
      
      // Mock JWT sign to return new token
      jwt.sign = jest.fn().mockReturnValue(newAccessToken);
      
      // Mock refresh token validation
      db.refreshToken.findOne.mockResolvedValue({
        userId: validUserId,
        token: refreshToken,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Valid for 7 days
      });
      
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);
      
      expect(response.body).toHaveProperty('accessToken', newAccessToken);
    });

    it('should reject expired refresh tokens', async () => {
      // Mock expired refresh token
      const expiredRefreshToken = 'expired-refresh-token';
      
      // Mock refresh token validation to return expired token
      db.refreshToken.findOne.mockResolvedValue({
        userId: validUserId,
        token: expiredRefreshToken,
        expires: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired 1 day ago
      });
      
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: expiredRefreshToken })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('expired');
    });

    it('should reject invalid refresh tokens', async () => {
      // Mock invalid refresh token
      const invalidRefreshToken = 'invalid-refresh-token';
      
      // Mock refresh token validation to return null (not found)
      db.refreshToken.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: invalidRefreshToken })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('invalid');
    });
  });

  describe('Token Blacklisting', () => {
    it('should reject blacklisted tokens', async () => {
      // Mock a blacklisted token
      const blacklistedToken = 'blacklisted-token';
      
      // Mock JWT to return valid payload for blacklisted token
      jwt.verify.mockImplementationOnce((token, secret, callback) => {
        callback(null, { userId: validUserId, exp: Date.now() / 1000 + 3600 });
      });
      
      // Mock token blacklist check
      db.tokenBlacklist.findOne.mockResolvedValue({
        token: blacklistedToken,
        blacklistedAt: new Date()
      });
      
      // Create a test route with auth middleware
      const testRoute = (req, res) => {
        res.status(200).json({ success: true });
      };
      
      // Apply middleware to test route
      const middlewareApplied = authMiddleware.verifyToken(testRoute);
      
      // Create mock request and response
      const req = {
        headers: { authorization: `Bearer ${blacklistedToken}` },
        get: jest.fn().mockReturnValue(`Bearer ${blacklistedToken}`)
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Execute middleware
      await middlewareApplied(req, res, next);
      
      // Check that appropriate error response was sent
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('blacklisted')
      }));
      
      // Next should not be called
      expect(next).not.toHaveBeenCalled();
    });

    it('should successfully blacklist a token on logout', async () => {
      // Token to be blacklisted
      const tokenToBlacklist = 'token-to-blacklist';
      
      // Mock token blacklisting
      db.tokenBlacklist.create.mockResolvedValue({
        token: tokenToBlacklist,
        blacklistedAt: expect.any(Date)
      });
      
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokenToBlacklist}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(db.tokenBlacklist.create).toHaveBeenCalledWith(expect.objectContaining({
        token: tokenToBlacklist
      }));
    });
  });

  describe('Security Headers and Rate Limiting', () => {
    it('should include security headers in API responses', async () => {
      const response = await request(app)
        .get('/api/public-resource')
        .expect(200);
      
      // Check security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should rate limit excessive authentication attempts', async () => {
      // Simulate multiple failed login attempts
      const loginAttempts = 10;
      const requests = [];
      
      for (let i = 0; i < loginAttempts; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // At least one of the last responses should be rate limited
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
}); 