/**
 * Authentication middleware
 */

const jwt = require('jsonwebtoken');
const db = require('../tests/mocks/database');

/**
 * Verify JWT token
 */
const verifyToken = (handler) => {
  return async (req, res, next) => {
    try {
      // Get token from authorization header
      const authHeader = req.headers.authorization || req.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Authorization token required'
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      // Verify token
      jwt.verify(token, 'secret-key', async (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
              success: false,
              error: 'Token expired'
            });
          }
          
          return res.status(401).json({
            success: false,
            error: 'Invalid token'
          });
        }
        
        // Check if token is blacklisted
        const blacklisted = await db.blacklist.findOne({ token });
        if (blacklisted) {
          return res.status(401).json({
            success: false,
            error: 'Token has been revoked'
          });
        }
        
        // Get user from database
        const user = await db.user.findByPk(decoded.userId);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'User not found'
          });
        }
        
        if (!user.active) {
          return res.status(401).json({
            success: false,
            error: 'User account is inactive'
          });
        }
        
        // Attach user to request
        req.user = user;
        
        // Continue with handler or next middleware
        if (handler) {
          return handler(req, res, next);
        }
        
        next();
      });
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Check if user has admin role
 */
const isAdmin = (handler) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Admin privileges required'
      });
    }
    
    if (handler) {
      return handler(req, res, next);
    }
    
    next();
  };
};

module.exports = {
  verifyToken,
  isAdmin
}; 