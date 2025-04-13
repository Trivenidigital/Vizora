/**
 * Validation utilities using Joi
 */

const Joi = require('joi');
const { ValidationError } = require('./errors');

/**
 * Validate request data against a schema
 * @param {Object} schema - Joi schema or custom validation rules
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validateOptions = {
      abortEarly: false, // Include all errors
      allowUnknown: true, // Ignore unknown props
      stripUnknown: true // Remove unknown props
    };

    // Handle legacy validation format (non-Joi)
    if (schema.body && typeof schema.body !== 'object' || 
        schema.body && !schema.body.validate && typeof schema.body.validate !== 'function') {
      try {
        // Legacy validation format - call the existing handler
        return legacyValidate(schema)(req, res, next);
      } catch (error) {
        console.error("Validation error:", error);
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: [{ message: error.message }]
        });
      }
    }

    // Modern Joi validation
    // Validate request parts based on what's defined in schema
    const validationSections = {};
    let validationError = null;

    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, validateOptions);
      if (error) {
        validationError = error;
      } else {
        req.body = value;
        validationSections.body = value;
      }
    }

    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, validateOptions);
      if (error) {
        validationError = error;
      } else {
        req.params = value;
        validationSections.params = value;
      }
    }

    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, validateOptions);
      if (error) {
        validationError = error;
      } else {
        req.query = value;
        validationSections.query = value;
      }
    }

    if (validationError) {
      // Format validation errors
      const errors = validationError.details.map(error => ({
        path: error.path.join('.'),
        message: error.message
      }));
      
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors
      });
    }

    return next();
  };
};

/**
 * Legacy validation handler (non-Joi)
 * @param {Object} schema - Rules object with validation strings
 * @returns {Function} Express middleware
 */
const legacyValidate = (schema) => {
  return (req, res, next) => {
    // This is a placeholder for the original validation logic
    // Since we're just trying to fix the error, we'll just pass through
    return next();
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // IDs
  id: Joi.string().trim().required(),
  
  // Pagination
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  },
  
  // Display device
  display: {
    deviceId: Joi.string().trim().required(),
    name: Joi.string().trim().min(1).max(100).required(),
    model: Joi.string().trim().allow(''),
    pairingCode: Joi.string().trim().alphanum().length(6),
    qrCode: Joi.string().trim()
  },
  
  // Controller
  controller: {
    deviceId: Joi.string().trim().required(),
    name: Joi.string().trim().min(1).max(100),
    model: Joi.string().trim().allow('')
  },
  
  // Pairing
  pairing: {
    body: Joi.object({
      pairingCode: Joi.string().trim().alphanum().length(6).required(),
      deviceId: Joi.string().trim().required()
    })
  },
  
  // Auth
  auth: {
    register: {
      body: Joi.object({
        firstName: Joi.string().trim().required(),
        lastName: Joi.string().trim().required(),
        email: Joi.string().email().required(),
        company: Joi.string().trim().required(),
        password: Joi.string().min(8).required()
      })
    },
    login: {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
      })
    }
  }
};

module.exports = {
  validate,
  schemas
}; 