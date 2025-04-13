/**
 * Global error handling middleware
 */

/**
 * Error Middleware
 * Handles API errors and provides standardized error responses
 */
const { validationResult } = require('express-validator');

/**
 * ApiError Class
 * Custom error class for API errors with status codes
 */
class ApiError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common error types
  static badRequest(message, details = null) {
    return new ApiError(message, 400, details);
  }

  static unauthorized(message, details = null) {
    return new ApiError(message || 'Unauthorized', 401, details);
  }

  static forbidden(message, details = null) {
    return new ApiError(message || 'Forbidden', 403, details);
  }

  static notFound(message, details = null) {
    return new ApiError(message || 'Resource not found', 404, details);
  }

  static methodNotAllowed(message, details = null) {
    return new ApiError(message || 'Method not allowed', 405, details);
  }

  static conflict(message, details = null) {
    return new ApiError(message || 'Conflict', 409, details);
  }

  static unprocessableEntity(message, details = null) {
    return new ApiError(message || 'Unprocessable entity', 422, details);
  }

  static internalServerError(message, details = null) {
    return new ApiError(message || 'Internal server error', 500, details);
  }

  static serviceUnavailable(message, details = null) {
    return new ApiError(message || 'Service unavailable', 503, details);
  }
}

/**
 * Not Found Error Handler
 * Catch 404 errors for undefined routes
 */
const notFound = (req, res, next) => {
  const error = new ApiError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Error Handler Middleware
 * Provides standardized error responses
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  
  // If it's not an ApiError, create one
  if (!(err instanceof ApiError)) {
    console.error('Original error:', err);
    
    // Handle Mongoose errors
    if (err.name === 'ValidationError') {
      const details = Object.values(err.errors).map(val => val.message);
      error = ApiError.badRequest('Validation error', details);
    } else if (err.name === 'CastError') {
      error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
    } else if (err.code === 11000) {
      // Duplicate key error
      const field = Object.keys(err.keyValue)[0];
      error = ApiError.conflict(`Duplicate field: ${field} already exists`);
    } else if (err.name === 'JsonWebTokenError') {
      error = ApiError.unauthorized('Invalid token');
    } else if (err.name === 'TokenExpiredError') {
      error = ApiError.unauthorized('Token expired');
    } else {
      // Default to 500 error
      error = ApiError.internalServerError(err.message || 'Server error');
    }
  } else {
    error = err;
  }

  // Log error
  console.error(`[${new Date().toISOString()}] Error: ${error.message}`, {
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Send standardized error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server error',
    details: error.details || null,
    statusCode: error.statusCode || 500,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

/**
 * Validation Handler Middleware
 * Handles express-validator validation errors
 */
const validationHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation error', errors.array());
  }
  next();
};

/**
 * Async Handler
 * Wraps async route handlers to catch errors and forward to error middleware
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  ApiError,
  notFound,
  errorHandler,
  validationHandler,
  asyncHandler
}; 