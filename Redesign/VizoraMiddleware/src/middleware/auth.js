/**
 * Authentication Middleware
 * Handles user authentication and authorization for protected routes
 */

const jwt = require('jsonwebtoken');
const config = require('../../config');
const { User } = require('../models');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware to check if user is authenticated
 */
const isAuthenticated = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Get the correct JWT secret
      const jwtSecret = process.env.JWT_SECRET || config.security?.jwtSecret || 'test_secret_key';
      
      // Verify token
      const decoded = jwt.verify(token, jwtSecret);
      
      // Get user from database (excluding password)
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        throw new UnauthorizedError('Invalid token. User not found.');
      }
      
      // Add user to request object
      req.user = user;
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token.');
      } else if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token expired. Please login again.');
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user has required role
 * @param {String|Array} roles - Required role(s)
 */
const isAuthorized = (roles) => {
  return (req, res, next) => {
    try {
      // Make sure user is authenticated first
      if (!req.user) {
        throw new UnauthorizedError('Authentication required.');
      }
      
      // Convert single role to array
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!requiredRoles.includes(req.user.role)) {
        throw new ForbiddenError('You do not have permission to perform this action.');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user owns the resource or is admin
 * @param {Function} getResourceOwner - Function to get the owner ID from the request
 */
const isResourceOwner = (getResourceOwner) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated.');
      }
      
      // Skip check for admins
      if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        return next();
      }
      
      // Get owner ID from request
      const ownerId = await getResourceOwner(req);
      
      // Check if user is the owner
      if (!req.user._id.equals(ownerId)) {
        throw new ForbiddenError('Access denied. You do not own this resource.');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  isAuthenticated,
  isAuthorized,
  isResourceOwner
}; 