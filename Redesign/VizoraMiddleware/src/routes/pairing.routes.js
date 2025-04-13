/**
 * Pairing API Routes
 */

const express = require('express');
const router = express.Router();
const { pairingService, displayService } = require('../services');
const { validate, schemas } = require('../utils/validator');
const { asyncHandler } = require('../utils/asyncHandler');
const { isAuthenticated } = require('../middleware/auth');
const { NotFoundError, BadRequestError, UnauthorizedError } = require('../utils/errors');
const { Display } = require('../models');
const logger = require('../utils/logger');

/**
 * @route   POST /api/pairing/initiate
 * @desc    Initiate pairing process for a display
 * @access  Public - TV displays don't need authentication
 */
router.post('/initiate', asyncHandler(async (req, res) => {
  try {
    logger.info('[PAIRING-CODE][REQ]', req.body);
    
    const { displayId } = req.body;
    
    if (!displayId) {
      return res.status(400).json({
        success: false,
        message: 'Display ID is required'
      });
    }
    
    const pairingData = await pairingService.initiatePairing(displayId);
    
    logger.info('[PAIRING-CODE][SUCCESS]', pairingData);
    
    res.json({
      success: true,
      message: 'Pairing initiated successfully',
      ...pairingData
    });
  } catch (err) {
    logger.error('[PAIRING-CODE][ERROR]', {
      error: err.message,
      stack: err.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate pairing code',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}));

/**
 * @route   POST /api/pairing/complete
 * @desc    Complete pairing between controller and display and associate with logged-in user
 * @access  Private - Requires authentication
 */
router.post('/complete', isAuthenticated, asyncHandler(async (req, res) => {
  const { pairingCode, deviceId: controllerDeviceId } = req.body;
  const userId = req.user.id;
  
  if (!pairingCode || !controllerDeviceId) {
    return res.status(400).json({
      success: false,
      message: 'Pairing code and controller device ID are required'
    });
  }
  
  // Find the display with the pairing code
  const display = await Display.findOne({ pairingCode });
  
  if (!display) {
    throw new NotFoundError(`No display found with pairing code: ${pairingCode}`);
  }
  
  // Set the owner of the display to the logged-in user
  display.owner = userId;
  await display.save();
  
  logger.info(`Display ${display.deviceId} assigned to user ${userId}`);
  
  // Complete the pairing
  const result = await pairingService.completePairing(pairingCode, controllerDeviceId);
  
  res.json({
    success: true,
    message: 'Pairing completed successfully',
    alreadyPaired: result.alreadyPaired,
    display: result.display,
    controller: result.controller
  });
}));

/**
 * @route   POST /api/pairing/verify
 * @desc    Verify if a controller is paired with a display
 * @access  Private - Requires authentication
 */
router.post('/verify', isAuthenticated, asyncHandler(async (req, res) => {
  const { displayId, controllerId } = req.body;
  const userId = req.user.id;
  
  if (!displayId || !controllerId) {
    return res.status(400).json({
      success: false,
      message: 'Display ID and controller ID are required'
    });
  }
  
  // Check if display belongs to user
  const display = await Display.findOne({ deviceId: displayId });
  if (!display) {
    throw new NotFoundError(`Display not found with ID: ${displayId}`);
  }
  
  if (display.owner && display.owner.toString() !== userId) {
    throw new UnauthorizedError('You do not have permission to access this display');
  }
  
  const result = await pairingService.verifyPairing(displayId, controllerId);
  
  res.json(result);
}));

/**
 * @route   POST /api/pairing/unpair
 * @desc    Unpair a controller from a display
 * @access  Private - Requires authentication
 */
router.post('/unpair', isAuthenticated, asyncHandler(async (req, res) => {
  const { displayId, controllerId } = req.body;
  const userId = req.user.id;
  
  if (!displayId || !controllerId) {
    return res.status(400).json({
      success: false,
      message: 'Display ID and controller ID are required'
    });
  }
  
  // Check if display belongs to user
  const display = await Display.findOne({ deviceId: displayId });
  if (!display) {
    throw new NotFoundError(`Display not found with ID: ${displayId}`);
  }
  
  if (display.owner && display.owner.toString() !== userId) {
    throw new UnauthorizedError('You do not have permission to access this display');
  }
  
  const result = await pairingService.unpairDevices(displayId, controllerId);
  
  res.json({
    success: true,
    message: 'Devices unpaired successfully',
    alreadyUnpaired: result.alreadyUnpaired,
    display: result.display,
    controller: result.controller
  });
}));

/**
 * @route   GET /api/pairing/controller/:controllerDeviceId/displays
 * @desc    Get all displays paired with a controller that belong to the current user
 * @access  Private - Requires authentication
 */
router.get('/controller/:controllerDeviceId/displays', isAuthenticated, asyncHandler(async (req, res) => {
  const { controllerDeviceId } = req.params;
  const userId = req.user.id;
  
  // Get paired displays for controller
  const result = await pairingService.getPairedDisplaysForController(controllerDeviceId);
  
  // Filter displays to only include those owned by the current user
  const userDisplays = result.pairedDisplays.filter(display => 
    display.owner && display.owner.toString() === userId
  );
  
  res.json({
    success: true,
    pairedDisplays: userDisplays,
    count: userDisplays.length
  });
}));

/**
 * @route   GET /api/pairing/display/:displayDeviceId/controllers
 * @desc    Get all controllers paired with a display (if display belongs to user)
 * @access  Private - Requires authentication
 */
router.get('/display/:displayDeviceId/controllers', isAuthenticated, asyncHandler(async (req, res) => {
  const { displayDeviceId } = req.params;
  const userId = req.user.id;
  
  // Check if display belongs to user
  const display = await Display.findOne({ deviceId: displayDeviceId });
  if (!display) {
    throw new NotFoundError(`Display not found with ID: ${displayDeviceId}`);
  }
  
  if (display.owner && display.owner.toString() !== userId) {
    throw new UnauthorizedError('You do not have permission to access this display');
  }
  
  const result = await pairingService.getPairedControllersForDisplay(displayDeviceId);
  
  res.json(result);
}));

/**
 * @route   GET /api/pairing/user/displays
 * @desc    Get all displays that belong to the current user
 * @access  Private - Requires authentication
 */
router.get('/user/displays', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const displays = await Display.find({ owner: userId })
    .populate('pairedControllers')
    .sort({ createdAt: -1 });
  
  res.json({
    success: true,
    displays,
    count: displays.length
  });
}));

module.exports = router; 