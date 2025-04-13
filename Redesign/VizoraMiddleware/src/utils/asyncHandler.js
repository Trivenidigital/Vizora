/**
 * Async handler utility for Express route handlers
 * Eliminates need for try/catch blocks in each route handler
 */

/**
 * Wraps an async function and catches any errors
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  asyncHandler
}; 