/**
 * Validation Middleware
 * Provides middleware for validating request data using Joi schemas
 */

const { ApiError } = require('./errorMiddleware');

/**
 * Validates request data against a Joi schema
 * 
 * @param {Object} schema - Joi schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      if (!req[source]) {
        return next(ApiError.badRequest(`Request ${source} is undefined`));
      }
      
      const { error, value } = schema.validate(req[source]);
      
      if (error) {
        // Extract the specific validation error message
        const errorMessage = error.details.map(detail => detail.message).join(', ');
        
        // Create a structured error response with validation details
        const validationError = ApiError.badRequest(
          `Validation error: ${errorMessage}`,
          {
            validationErrors: error.details.map(detail => ({
              field: detail.context.key,
              message: detail.message,
              type: detail.type
            }))
          }
        );
        
        return next(validationError);
      }
      
      // Replace the request data with the validated and sanitized data
      req[source] = value;
      next();
    } catch (err) {
      next(ApiError.internal(`Validation middleware error: ${err.message}`));
    }
  };
};

module.exports = {
  validate
}; 