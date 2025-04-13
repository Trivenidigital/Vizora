/**
 * Content Validation Schema
 * Validates request payloads for content-related endpoints
 */

const Joi = require('joi');

// Media content types
const CONTENT_TYPES = ['image', 'video', 'audio', 'document', 'webpage', 'stream', 'widget', 'custom'];

// Basic content creation/update schema
const contentSchema = Joi.object({
  title: Joi.string().max(200).required()
    .messages({
      'string.empty': 'Title is required',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
  
  description: Joi.string().max(1000).allow('', null)
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
  
  type: Joi.string().valid(...CONTENT_TYPES).required()
    .messages({
      'string.empty': 'Content type is required',
      'any.only': `Content type must be one of: ${CONTENT_TYPES.join(', ')}`,
      'any.required': 'Content type is required'
    }),
  
  url: Joi.string().uri().required()
    .messages({
      'string.empty': 'Content URL is required',
      'string.uri': 'Content URL must be a valid URL',
      'any.required': 'Content URL is required'
    }),
  
  thumbnail: Joi.string().uri().allow('', null)
    .messages({
      'string.uri': 'Thumbnail URL must be a valid URL'
    }),
  
  folder: Joi.alternatives().try(
    Joi.string().allow('root'),
    Joi.string().regex(/^[0-9a-fA-F]{24}$/)
  ).allow(null)
    .messages({
      'string.pattern.base': 'Folder ID must be a valid MongoDB ObjectId'
    }),
  
  tags: Joi.array().items(Joi.string().max(50)).default([])
    .messages({
      'array.base': 'Tags must be an array',
      'string.max': 'Each tag cannot exceed 50 characters'
    }),
  
  category: Joi.string().max(50).allow('', null)
    .messages({
      'string.max': 'Category cannot exceed 50 characters'
    }),
  
  status: Joi.string().valid('draft', 'published', 'archived', 'scheduled').default('draft')
    .messages({
      'any.only': 'Status must be one of: draft, published, archived, scheduled'
    }),
  
  // Settings schema
  settings: Joi.object({
    duration: Joi.number().integer().min(1000).max(3600000).default(10000)
      .messages({
        'number.base': 'Duration must be a number',
        'number.integer': 'Duration must be an integer',
        'number.min': 'Duration must be at least 1 second (1000ms)',
        'number.max': 'Duration cannot exceed 1 hour (3600000ms)'
      }),
    
    transition: Joi.string().valid('none', 'fade', 'slide', 'zoom', 'flip').default('fade')
      .messages({
        'any.only': 'Transition must be one of: none, fade, slide, zoom, flip'
      }),
    
    transitionDuration: Joi.number().integer().min(0).max(5000).default(500)
      .messages({
        'number.base': 'Transition duration must be a number',
        'number.integer': 'Transition duration must be an integer',
        'number.min': 'Transition duration cannot be negative',
        'number.max': 'Transition duration cannot exceed 5 seconds (5000ms)'
      }),
    
    sound: Joi.object({
      enabled: Joi.boolean().default(false),
      volume: Joi.number().min(0).max(100).default(100)
        .messages({
          'number.base': 'Volume must be a number',
          'number.min': 'Volume cannot be negative',
          'number.max': 'Volume cannot exceed 100'
        })
    }),
    
    loop: Joi.boolean().default(false),
    autoplay: Joi.boolean().default(true),
    
    fit: Joi.string().valid('contain', 'cover', 'fill', 'none').default('contain')
      .messages({
        'any.only': 'Fit must be one of: contain, cover, fill, none'
      }),
    
    position: Joi.string().valid(
      'center', 'top', 'bottom', 'left', 'right', 
      'top-left', 'top-right', 'bottom-left', 'bottom-right'
    ).default('center')
      .messages({
        'any.only': 'Position must be a valid position value'
      })
  }).default(),
  
  // Schedule schema
  schedule: Joi.object({
    active: Joi.boolean().default(false),
    
    startDate: Joi.date().iso()
      .messages({
        'date.base': 'Start date must be a valid date',
        'date.format': 'Start date must be in ISO format'
      }),
    
    endDate: Joi.date().iso().min(Joi.ref('startDate'))
      .messages({
        'date.base': 'End date must be a valid date',
        'date.format': 'End date must be in ISO format',
        'date.min': 'End date must be after start date'
      }),
    
    recurrence: Joi.string().valid(
      'none', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'custom'
    ).default('none')
      .messages({
        'any.only': 'Recurrence must be a valid recurrence pattern'
      }),
    
    daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).default([])
      .messages({
        'array.base': 'Days of week must be an array',
        'number.base': 'Day must be a number from 0-6 (0=Sunday, 6=Saturday)',
        'number.min': 'Day must be at least 0 (Sunday)',
        'number.max': 'Day cannot exceed 6 (Saturday)'
      }),
    
    timeRanges: Joi.array().items(
      Joi.object({
        start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
          .messages({
            'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
            'any.required': 'Start time is required'
          }),
        end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
          .messages({
            'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
            'any.required': 'End time is required'
          })
      })
    ).default([]),
    
    priority: Joi.number().integer().min(0).max(100).default(0)
      .messages({
        'number.base': 'Priority must be a number',
        'number.integer': 'Priority must be an integer',
        'number.min': 'Priority cannot be negative',
        'number.max': 'Priority cannot exceed 100'
      }),
    
    timezoneOffset: Joi.number().integer().min(-720).max(720)
      .messages({
        'number.base': 'Timezone offset must be a number',
        'number.integer': 'Timezone offset must be an integer',
        'number.min': 'Timezone offset cannot be less than -720 minutes',
        'number.max': 'Timezone offset cannot exceed 720 minutes'
      })
  }).default(),
  
  // Metadata schema
  metadata: Joi.object({
    size: Joi.number().integer().min(0),
    format: Joi.string(),
    duration: Joi.number().min(0),
    dimensions: Joi.object({
      width: Joi.number().integer().min(1),
      height: Joi.number().integer().min(1)
    }),
    aspectRatio: Joi.string(),
    fileType: Joi.string(),
    createdAt: Joi.date(),
    modifiedAt: Joi.date(),
    // Allow additional, unknown properties in metadata
  }).unknown(true).default({})
}).options({ stripUnknown: true });

// Schema for upload request (with folder and metadata)
const contentUploadSchema = Joi.object({
  folder: Joi.alternatives().try(
    Joi.string().allow('root'),
    Joi.string().regex(/^[0-9a-fA-F]{24}$/)
  ).allow(null, '')
    .messages({
      'string.pattern.base': 'Folder ID must be a valid MongoDB ObjectId'
    }),
  
  defaultMetadata: Joi.object({
    title: Joi.string().max(100).allow('', null),
    description: Joi.string().max(1000).allow('', null),
    tags: Joi.array().items(Joi.string().max(50)).default([]),
    category: Joi.string().max(50).allow('', null)
  }).unknown(true).default({})
}).options({ stripUnknown: false }); // Allow unknown fields for multipart form data

// Schema for content move operations
const contentMoveSchema = Joi.object({
  contentId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    .messages({
      'string.pattern.base': 'Content ID must be a valid MongoDB ObjectId',
      'any.required': 'Content ID is required'
    }),
  
  folderId: Joi.alternatives().try(
    Joi.string().allow('root'),
    Joi.string().regex(/^[0-9a-fA-F]{24}$/)
  ).required()
    .messages({
      'string.pattern.base': 'Folder ID must be a valid MongoDB ObjectId',
      'any.required': 'Folder ID is required'
    })
}).options({ stripUnknown: true });

// Schema for batch content move operations
const batchContentMoveSchema = Joi.object({
  contentIds: Joi.array().items(
    Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Content ID must be a valid MongoDB ObjectId'
      })
  ).min(1).required()
    .messages({
      'array.min': 'At least one content ID is required',
      'array.base': 'Content IDs must be an array',
      'any.required': 'Content IDs are required'
    }),
  
  folderId: Joi.alternatives().try(
    Joi.string().allow('root'),
    Joi.string().regex(/^[0-9a-fA-F]{24}$/)
  ).required()
    .messages({
      'string.pattern.base': 'Folder ID must be a valid MongoDB ObjectId',
      'any.required': 'Folder ID is required'
    })
}).options({ stripUnknown: true });

module.exports = {
  contentSchema,
  contentUploadSchema,
  contentMoveSchema,
  batchContentMoveSchema
}; 