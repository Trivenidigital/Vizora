/**
 * Error reporting routes for Vizora
 * Handles error reports from clients, logs them, and provides diagnostics
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const rateLimiter = require('../middleware/rateLimiter');
const { memoryLogger } = require('../utils/memoryLogger');

// In-memory storage for error reports (will be cleared on server restart)
// For production, consider using a database or persistent storage
const errorReports = new Map();

// Maximum number of error reports to store per device
const MAX_ERRORS_PER_DEVICE = 50;

// Error report rate limiter: max 10 reports per minute per device
const reportRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many error reports submitted, please try again later',
  keyGenerator: (req) => req.body.deviceId || req.ip
});

/**
 * @route POST /api/errors/report
 * @desc Report an error from a client device
 * @access Public
 */
router.post('/report', [
  reportRateLimiter,
  check('errorKey').notEmpty().withMessage('Error key is required'),
  check('message').notEmpty().withMessage('Error message is required'),
  check('timestamp').isNumeric().withMessage('Timestamp must be a valid number'),
  check('count').isInt({ min: 1 }).withMessage('Count must be a positive integer'),
  check('isFatal').isBoolean().withMessage('isFatal must be a boolean')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Validation error', 
        errors: errors.array() 
      });
    }

    // Extract error data
    const {
      errorKey,
      message,
      stack,
      component,
      metadata,
      timestamp,
      deviceId,
      appVersion,
      count,
      isFatal,
      userAction,
      context
    } = req.body;

    // Add a unique report ID
    const reportId = uuidv4();
    
    // Prepare error report for storage
    const errorReport = {
      reportId,
      errorKey,
      message,
      stack: stack || null,
      component: component || 'unknown',
      metadata: metadata || {},
      timestamp,
      receivedAt: Date.now(),
      deviceId: deviceId || 'anonymous',
      appVersion: appVersion || 'unknown',
      count,
      isFatal,
      userAction: userAction || null,
      context: context || {},
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Get device errors collection or create new one
    if (!errorReports.has(deviceId)) {
      errorReports.set(deviceId, new Map());
    }
    
    const deviceErrors = errorReports.get(deviceId);
    
    // Limit number of errors stored per device
    if (deviceErrors.size >= MAX_ERRORS_PER_DEVICE) {
      // Find oldest error to remove
      let oldestKey = null;
      let oldestTimestamp = Infinity;
      
      for (const [key, report] of deviceErrors.entries()) {
        if (report.timestamp < oldestTimestamp) {
          oldestTimestamp = report.timestamp;
          oldestKey = key;
        }
      }
      
      // Remove oldest error
      if (oldestKey) {
        deviceErrors.delete(oldestKey);
      }
    }
    
    // Store new error report
    deviceErrors.set(errorKey, errorReport);
    
    // Log error
    const logLevel = isFatal ? 'error' : 'warn';
    logger[logLevel](`[ERROR REPORT] ${message}`, {
      errorKey,
      component,
      deviceId: deviceId || 'anonymous',
      isFatal,
      count,
      reportId
    });

    // Log more details at debug level
    logger.debug('Error report details:', {
      reportId,
      errorKey,
      stack,
      metadata,
      context
    });

    // Trigger memory logging if it's a crash report
    if (isFatal) {
      try {
        memoryLogger.logMemoryUsage(`Crash report received: ${errorKey}`);
      } catch (memoryError) {
        logger.error('Error logging memory usage', memoryError);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Error report received',
      reportId
    });
  } catch (error) {
    logger.error('Error processing error report', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Error processing error report'
    });
  }
});

/**
 * @route GET /api/errors/device/:deviceId
 * @desc Get all errors for a specific device
 * @access Private
 */
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({
        status: 'error',
        message: 'Device ID is required'
      });
    }
    
    // Get device errors
    const deviceErrors = errorReports.get(deviceId) || new Map();
    
    // Convert to array
    const errorsArray = Array.from(deviceErrors.values());
    
    return res.status(200).json({
      status: 'success',
      count: errorsArray.length,
      errors: errorsArray
    });
  } catch (error) {
    logger.error('Error retrieving device errors', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving device errors'
    });
  }
});

/**
 * @route GET /api/errors/stats
 * @desc Get error reporting statistics
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    // Count total errors
    let totalErrors = 0;
    let devices = 0;
    let fatalErrors = 0;
    
    for (const deviceErrors of errorReports.values()) {
      totalErrors += deviceErrors.size;
      devices++;
      
      // Count fatal errors
      for (const error of deviceErrors.values()) {
        if (error.isFatal) {
          fatalErrors++;
        }
      }
    }
    
    return res.status(200).json({
      status: 'success',
      stats: {
        totalErrors,
        devices,
        fatalErrors
      }
    });
  } catch (error) {
    logger.error('Error retrieving error statistics', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving error statistics'
    });
  }
});

/**
 * @route DELETE /api/errors/device/:deviceId
 * @desc Clear all errors for a specific device
 * @access Private
 */
router.delete('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({
        status: 'error',
        message: 'Device ID is required'
      });
    }
    
    // Remove device errors
    errorReports.delete(deviceId);
    
    return res.status(200).json({
      status: 'success',
      message: `Errors cleared for device: ${deviceId}`
    });
  } catch (error) {
    logger.error('Error clearing device errors', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Error clearing device errors'
    });
  }
});

module.exports = router; 