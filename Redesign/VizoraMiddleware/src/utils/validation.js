/**
 * Validation Utilities
 * Contains all validation schemas using Joi
 */

const Joi = require('joi');
const { ErrorHandler } = require('./errors');

// Display validation schema
const displaySchema = Joi.object({
  deviceId: Joi.string().required(),
  name: Joi.string().required(),
  model: Joi.string().allow(''),
  status: Joi.string().valid('offline', 'online', 'maintenance'),
  settings: Joi.object({
    brightness: Joi.number().min(0).max(100),
    orientation: Joi.string().valid('portrait', 'landscape'),
    resolution: Joi.object({
      width: Joi.number().positive(),
      height: Joi.number().positive()
    }),
    volume: Joi.number().min(0).max(100),
    powerSchedule: Joi.object({
      enabled: Joi.boolean(),
      onTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      offTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      daysActive: Joi.array().items(Joi.number().min(0).max(6))
    })
  })
});

// Controller validation schema
const controllerSchema = Joi.object({
  deviceId: Joi.string().required(),
  name: Joi.string().required(),
  model: Joi.string().allow(''),
  status: Joi.string().valid('offline', 'online', 'paired'),
  settings: Joi.object({
    notificationsEnabled: Joi.boolean(),
    theme: Joi.string().valid('light', 'dark', 'system'),
    layout: Joi.string().valid('grid', 'list'),
    defaultView: Joi.string().valid('displays', 'content', 'analytics')
  })
});

// Pairing validation schema
const pairingSchema = Joi.object({
  displayId: Joi.string(),
  controllerDeviceId: Joi.string(),
  pairingCode: Joi.string()
});

// Content validation schema
const contentSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  type: Joi.string().valid('image', 'video', 'webpage', 'app', 'stream', 'playlist').required(),
  url: Joi.string().required(),
  thumbnail: Joi.string().allow(''),
  duration: Joi.number().min(0),
  status: Joi.string().valid('draft', 'published', 'archived'),
  tags: Joi.array().items(Joi.string()),
  displaySettings: Joi.object({
    aspectRatio: Joi.string().valid('16:9', '4:3', '1:1', '9:16', 'custom'),
    resolution: Joi.object({
      width: Joi.number().positive(),
      height: Joi.number().positive()
    }),
    loop: Joi.boolean(),
    mute: Joi.boolean(),
    autoplay: Joi.boolean()
  }),
  permissions: Joi.object({
    public: Joi.boolean(),
    users: Joi.array().items(Joi.object({
      user: Joi.string(), // User ID
      permission: Joi.string().valid('view', 'edit')
    }))
  }),
  items: Joi.when('type', {
    is: 'playlist',
    then: Joi.array().items(Joi.object({
      contentId: Joi.string().required(),
      duration: Joi.number().min(1),
      order: Joi.number().min(0)
    })),
    otherwise: Joi.forbidden()
  })
});

// Generic validation middleware creator
const createValidator = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        message: detail.message,
        path: detail.path
      }));
      
      return next(new ErrorHandler(400, 'Validation Error', errorDetails));
    }
    
    next();
  };
};

// Export validation middleware
module.exports = {
  validateDisplay: createValidator(displaySchema),
  validateController: createValidator(controllerSchema),
  validatePairing: createValidator(pairingSchema),
  validateContent: createValidator(contentSchema),
  
  // Export schemas for direct use
  schemas: {
    display: displaySchema,
    controller: controllerSchema,
    pairing: pairingSchema,
    content: contentSchema
  }
}; 