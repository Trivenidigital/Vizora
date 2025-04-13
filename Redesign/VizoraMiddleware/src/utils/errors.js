/**
 * Custom error classes for improved error handling
 */

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Operational errors are expected errors
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad request error (400)
 */
class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

/**
 * Unauthorized error (401)
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden error (403)
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Not found error (404)
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Conflict error (409)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

/**
 * Validation error (422)
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 422);
    this.errors = errors;
  }
}

/**
 * Server error (500)
 */
class ServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500);
  }
}

/**
 * Service unavailable error (503)
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503);
  }
}

/**
 * Error handling utilities
 * Provides standardized error handling across the application
 */

/**
 * Custom error handler class
 */
class ErrorHandler extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express middleware to handle errors
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong';
  
  // Log error (but not in test environment)
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] ${statusCode}: ${message}`);
    if (err.stack && process.env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
  }
  
  // Prepare response object
  const errorResponse = {
    status: 'error',
    statusCode,
    message
  };
  
  // Add details if they exist
  if (err.details) {
    errorResponse.details = err.details;
  }
  
  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }
  
  // Send response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error handler wrapper for route handlers
 * Eliminates the need for try/catch blocks in route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle uncaught exceptions at the process level
 */
const setupProcessErrorHandlers = () => {
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    // Don't exit in development mode to make debugging easier
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
  
  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Always exit on uncaught exceptions
    process.exit(1);
  });
};

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ServerError,
  ServiceUnavailableError,
  ErrorHandler,
  errorHandler,
  asyncHandler,
  setupProcessErrorHandlers
}; 