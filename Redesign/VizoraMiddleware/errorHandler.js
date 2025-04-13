/**
 * Enhanced error handling middleware for Express
 * 
 * This middleware handles both synchronous and asynchronous errors
 * and ensures proper response formatting.
 */

// Logs errors with their full stack
const logError = (err, req) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} - ${err.message}`);
  console.error(err.stack);
};

// Format error response as JSON
const formatErrorResponse = (err) => {
  return {
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'ERR_INTERNAL',
      status: err.status || 500
    }
  };
};

// Middleware for handling errors
const errorHandler = (err, req, res, next) => {
  logError(err, req);
  
  // If headers are already sent, delegate to Express's default error handler
  if (res.headersSent) {
    return next(err);
  }
  
  // Set status code and send error response
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json(formatErrorResponse(err));
};

// This wraps async route handlers to catch promise rejections
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create 404 handler middleware
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Path not found: ${req.method} ${req.originalUrl}`,
      code: 'ERR_NOT_FOUND',
      status: 404
    }
  });
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
}; 