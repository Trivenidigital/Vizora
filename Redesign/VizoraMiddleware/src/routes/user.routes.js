/**
 * User Routes
 * 
 * Handles routes for user profile management and device pairing
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const userController = require('../controllers/user.controller');
const logger = require('../utils/logger');
const { ApiError } = require('../middleware/errorMiddleware');

// Middleware to validate request body has required fields
const validateRequestBody = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      logger.warn(`Missing required fields in request: ${missingFields.join(', ')}`);
      return next(new ApiError(400, `Missing required fields: ${missingFields.join(', ')}`));
    }
    
    next();
  };
};

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', protect, userController.getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, userController.updateUserProfile);

/**
 * @route   GET /api/users/devices
 * @desc    Get user's paired devices
 * @access  Private
 */
router.get('/devices', protect, userController.getUserDevices);

/**
 * @route   POST /api/users/devices/pair
 * @desc    Pair a device using pairing code
 * @access  Private
 */
router.post(
  '/devices/pair',
  protect,
  validateRequestBody(['pairingCode']),
  userController.pairDevice
);

/**
 * @route   DELETE /api/users/devices/:deviceId
 * @desc    Unpair a device
 * @access  Private
 */
router.delete('/devices/:deviceId', protect, userController.unpairDevice);

/**
 * @route   POST /api/users/devices/:deviceId/command
 * @desc    Send command to a device
 * @access  Private
 */
router.post(
  '/devices/:deviceId/command',
  protect,
  validateRequestBody(['command']),
  userController.sendDeviceCommand
);

module.exports = router; 