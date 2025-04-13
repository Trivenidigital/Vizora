/**
 * Device Routes
 * 
 * Handles routes for device registration, token validation, and pairing
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const deviceController = require('../controllers/device.controller');
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
 * @route   POST /api/devices/register
 * @desc    Register a device and get a token
 * @access  Public
 * @payload { deviceInfo: Object }
 * @returns { success: Boolean, deviceId: String, token: String, expiresAt: Date }
 */
router.post('/register', 
  validateRequestBody(['deviceInfo']),
  deviceController.registerDevice
);

/**
 * @route   POST /api/devices/validate-token
 * @desc    Validate a device token
 * @access  Public
 * @header  Authorization: Bearer <token>
 * @returns { isValid: Boolean, message: String, device?: Object }
 */
router.post('/validate-token', 
  deviceController.validateDeviceToken
);

/**
 * @route   POST /api/devices/pair
 * @desc    Generate a pairing code for a device
 * @access  Public (device)
 * @payload { deviceId: String }
 * @returns { success: Boolean, deviceId: String, pairingCode: String, expiresAt: Date }
 */
router.post('/pair', 
  validateRequestBody(['deviceId']),
  deviceController.generatePairingCode
);

/**
 * @route   POST /api/devices/pairing-code
 * @desc    Alternative endpoint for generating a pairing code for a device
 * @access  Public (device)
 * @payload { deviceId: String }
 * @returns { success: Boolean, deviceId: String, pairingCode: String, expiresAt: Date }
 */
router.post('/pairing-code', 
  validateRequestBody(['deviceId']),
  deviceController.generatePairingCode
);

/**
 * @route   POST /api/devices/verify-registration
 * @desc    Verify if a device is registered with the server
 * @access  Public
 * @payload { deviceId: String }
 * @returns { success: Boolean, isRegistered: Boolean, deviceInfo?: Object, message: String }
 */
router.post('/verify-registration',
  validateRequestBody(['deviceId']),
  deviceController.verifyDeviceRegistration
);

/**
 * @route   POST /api/devices/confirm-pairing
 * @desc    Confirm a device pairing to mark it as paired
 * @access  Public/Protected
 * @payload { deviceId: String, pairingCode: String }
 * @returns { success: Boolean, deviceId: String, message: String }
 */
router.post('/confirm-pairing', 
  validateRequestBody(['deviceId', 'pairingCode']),
  async (req, res, next) => {
    try {
      const { deviceId, pairingCode } = req.body;
      
      logger.info(`[PAIRING] Confirming pairing for device ${deviceId} with code ${pairingCode}`);
      
      // Try to find the device
      const device = await deviceController.findDeviceById(deviceId);
      
      if (!device) {
        logger.warn(`[PAIRING] Device ${deviceId} not found`);
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }
      
      // Check if pairing code matches
      if (device.pairingCode && device.pairingCode.code === pairingCode) {
        logger.info(`[PAIRING] Valid pairing code for device ${deviceId}`);
        
        // Mark device as paired
        device.isPaired = true;
        device.pairingConfirmedAt = new Date();
        await device.save();
        
        // Emit socket event if available
        if (global.io) {
          logger.info(`[PAIRING] Emitting pairing confirmation event for device ${deviceId}`);
          global.io.to(deviceId).emit('pairing:confirmed', { 
            deviceId, 
            paired: true, 
            timestamp: new Date()
          });
        }
        
        return res.json({
          success: true,
          deviceId,
          message: 'Device pairing confirmed',
          isPaired: true
        });
      } else {
        logger.warn(`[PAIRING] Invalid pairing code for device ${deviceId}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid pairing code'
        });
      }
    } catch (error) {
      logger.error(`[PAIRING] Error confirming pairing: ${error.message}`);
      next(error);
    }
  }
);

/**
 * @route   POST /api/devices/validate-pairing
 * @desc    Validate a pairing code and pair a device to a user
 * @access  Private (requires user authentication)
 * @payload { pairingCode: String }
 * @returns { success: Boolean, deviceId: String, message: String }
 */
router.post('/validate-pairing', 
  protect,
  validateRequestBody(['pairingCode']),
  deviceController.validatePairingCode
);

/**
 * @route   GET /api/devices/:deviceId/status
 * @desc    Get status of a device
 * @access  Public
 * @params  deviceId - The ID of the device
 * @returns { success: Boolean, deviceId: String, status: Object }
 */
router.get('/:deviceId/status',
  deviceController.getDeviceStatus
);

module.exports = router; 