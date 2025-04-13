/**
 * Simple Auth Token Tests
 * Basic tests for JWT token generation and validation
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { isAuthenticated } = require('../src/middleware/auth');

describe('Authentication Token Tests', () => {
  let user;
  let token;

  beforeAll(async () => {
    // Create a test user
    user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User'
    });

    // Generate a token
    token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'test_secret_key',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  describe('Token Verification', () => {
    it('should verify a valid token', async () => {
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await isAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(user._id.toString());
    });

    it('should reject an invalid token', async () => {
      const req = {
        headers: { authorization: 'Bearer invalid_token' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await isAuthenticated(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('Invalid token')
        })
      );
    });

    it('should reject request without token', async () => {
      const req = {
        headers: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await isAuthenticated(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('No token provided')
        })
      );
    });

    it('should reject request with malformed token', async () => {
      const req = {
        headers: { authorization: 'Bearer' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await isAuthenticated(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('No token provided')
        })
      );
    });
  });
}); 