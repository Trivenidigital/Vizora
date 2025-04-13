/**
 * Content Routes
 * Routes for content management, delivery, and scheduling
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const contentController = require('../controllers/content.controller');
const contentService = require('../services/contentService');
const { ApiError } = require('../middleware/errorMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { 
  contentSchema, 
  contentUploadSchema, 
  contentMoveSchema,
  batchContentMoveSchema
} = require('../validation/contentSchema');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Enhanced file filter with better error messages
const fileFilter = (req, file, cb) => {
  // Accepted mime types mapped by category
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'],
    video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/flac', 'audio/aac'],
    document: [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv'
    ]
  };
  
  // Flatten the allowed types
  const allAllowedTypes = Object.values(allowedTypes).flat();
  
  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Try to determine content type from extension when mimetype fails
    const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
    const contentType = contentService.detectContentType(file.mimetype, file.originalname);
    
    if (contentType !== 'other') {
      console.warn(`Accepting file with unrecognized MIME type ${file.mimetype} based on extension .${extension}`);
      cb(null, true);
    } else {
      // Return a specific error with details about accepted types
      const error = new ApiError(
        400, 
        `File type not allowed: ${file.mimetype} (${file.originalname})`,
        {
          acceptedTypes: allowedTypes,
          providedType: file.mimetype,
          fileName: file.originalname
        }
      );
      cb(error, false);
    }
  }
};

// Enhanced error handling for uploads
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Map Multer specific errors to user-friendly messages
    let message = 'File upload error';
    let statusCode = 400;
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File is too large. Maximum allowed size is 100MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum allowed is 10 files per upload';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Unexpected field name: ${err.field}. Expected 'files'`;
        break;
      default:
        message = `Upload error: ${err.message}`;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        code: err.code,
        field: err.field
      }
    });
  }
  
  // For non-Multer errors, pass to next error handler
  next(err);
};

// Configure upload limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Maximum 10 files per upload
  }
});

// Content management routes (authenticated) with validation
router.post('/', protect, validate(contentSchema), contentController.createContent);
router.get('/', protect, contentController.getAllContent);
router.get('/:contentId', protect, contentController.getContentById);
router.put('/:contentId', protect, validate(contentSchema), contentController.updateContent);
router.delete('/:contentId', protect, contentController.deleteContent);

// Content move routes with validation
router.put('/:contentId/move', protect, validate(contentMoveSchema), contentController.moveContent);
router.put('/move-batch', protect, validate(batchContentMoveSchema), contentController.moveMultipleContent);

// Multi-file upload route with validation
router.post(
  '/upload', 
  protect, 
  validate(contentUploadSchema, 'body'),
  upload.array('files', 10),
  multerErrorHandler,
  contentController.uploadMultipleContent
);

// Single-file upload route for backward compatibility
router.post(
  '/upload/single',
  protect,
  validate(contentUploadSchema, 'body'),
  upload.single('file'),
  multerErrorHandler,
  (req, res, next) => {
    // Convert single file to array format for the controller
    if (req.file) {
      req.files = [req.file];
    }
    contentController.uploadMultipleContent(req, res, next);
  }
);

// Content assignment routes
router.post('/:contentId/assign', protect, contentController.assignContentToDisplays);

// Content tracking routes
router.post('/:contentId/view', contentController.trackContentView);
router.post('/:contentId/delivery', contentController.updateDeliveryStatus);
router.post('/:contentId/playback', contentController.updatePlaybackStatus);

// Display content routes
router.get('/display/:deviceId', contentController.getContentForDisplay);
router.get('/display/:deviceId/current', contentController.getCurrentContentForDisplay);

// Pushing content to display with scheduling
router.post('/push-to-display', contentController.pushContentToDisplay);

// Content metrics routes
router.get('/metrics', protect, contentController.getContentMetrics);
router.get('/:contentId/metrics', protect, contentController.getContentMetrics);

// Export router
module.exports = router; 