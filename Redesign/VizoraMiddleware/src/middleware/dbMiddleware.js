/**
 * Database Middleware
 * Functions to check database connection status and ensure connections are ready
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Middleware to check if MongoDB Atlas is connected before processing requests
 * Returns 503 Service Unavailable if not connected
 */
const requireMongoDBConnection = (req, res, next) => {
  // Skip connection check for health endpoints
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  // For auth login routes, log more detailed info
  const isAuthEndpoint = req.path.includes('/auth/login');
  if (isAuthEndpoint) {
    logger.debug(`DB Connection check for auth endpoint: ${req.path}`);
  }

  if (mongoose.connection.readyState !== 1) {
    // Log the connection state
    let connectionState = 'Unknown';
    switch (mongoose.connection.readyState) {
      case 0: connectionState = 'Disconnected'; break;
      case 1: connectionState = 'Connected'; break;
      case 2: connectionState = 'Connecting'; break;
      case 3: connectionState = 'Disconnecting'; break;
    }

    logger.error(`MongoDB not ready. Current state: ${connectionState} (${mongoose.connection.readyState})`);

    if (isAuthEndpoint) {
      // Log more detailed info for debugging auth issues
      logger.error(`Auth request failed due to MongoDB connection issue: ${req.method} ${req.originalUrl}`);
    }

    return res.status(503).json({
      success: false,
      message: 'Database connection unavailable. Please try again shortly.',
      readyState: mongoose.connection.readyState
    });
  }

  next();
};

/**
 * Middleware to add database connection status to response headers
 * For monitoring and debugging
 */
const addDbConnectionInfo = (req, res, next) => {
  res.set('X-DB-Status', mongoose.connection.readyState === 1 ? 'connected' : 'disconnected');
  next();
};

module.exports = {
  requireMongoDBConnection,
  addDbConnectionInfo
}; 