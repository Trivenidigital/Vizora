/**
 * Display Routes
 * Handles display management and pairing
 */

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validator');
const { isAuthenticated } = require('../middleware/auth');
const { Display, User } = require('../models');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');

const router = express.Router();

/**
 * @route   GET /api/displays
 * @desc    Get all displays for the current user
 * @access  Private
 */
router.get('/', isAuthenticated, asyncHandler(async (req, res) => {
  const displays = await Display.find({ user: req.user.id });
  
  res.json({
    success: true,
    count: displays.length,
    data: displays
  });
}));

/**
 * @route   POST /api/displays/pair
 * @desc    Pair a display with the current user
 * @access  Private
 */
router.post('/pair', isAuthenticated, validate({
  body: {
    pairingCode: 'required|string',
    name: 'required|string',
    location: 'required|string'
  }
}), asyncHandler(async (req, res) => {
  const { pairingCode, name, location } = req.body;
  
  console.log(`Pairing request: pairingCode=${pairingCode}, name=${name}, location=${location} for user ${req.user.id}`);
  
  // Validate pairing code format
  if (!/^[A-Z0-9]{6}$/.test(pairingCode)) {
    throw new BadRequestError('Invalid pairing code format. Must be 6 alphanumeric characters.');
  }
  
  // First try to find a device with this pairing code in the database
  // Check both Display and Device collections if you have separate models
  let device;
  
  try {
    // Call the devices API to validate the pairing code
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/devices/validate-pairing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization
      },
      body: JSON.stringify({ pairingCode })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      logger.error(`Pairing validation failed: ${JSON.stringify(data)}`);
      throw new BadRequestError(data.message || 'Invalid pairing code or device not found');
    }
    
    // Use the device info from the validation response
    device = data.device;
    logger.info(`Device found via pairing API: ${device.deviceId}`);
  } catch (err) {
    logger.error(`Error validating pairing code: ${err.message}`);
    
    // Fallback: Try to find a device with this pairing code directly in the database
    logger.info(`Trying direct database lookup for pairing code: ${pairingCode}`);
    
    device = await Display.findOne({ 
      'pairingCode.code': pairingCode,
      'pairingCode.expiresAt': { $gt: new Date() }
    });
    
    if (!device) {
      throw new BadRequestError('Invalid or expired pairing code. Please check the code or generate a new one.');
    }
  }
  
  // Now create or update the display record
  let display = await Display.findOne({ deviceId: device.deviceId });
  
  if (display) {
    // If display exists but is not assigned to a user
    if (!display.user) {
      // Update display with new information and assign to user
      display.name = name;
      display.location = location;
      display.user = req.user.id;
      display.status = 'active';
      display.lastConnected = new Date();
      
      await display.save();
      
      logger.info(`Display paired with user: ${req.user.id}, display: ${display._id}`);
      
      return res.json({
        success: true,
        message: 'Display paired successfully',
        data: display
      });
    } else if (display.user.toString() === req.user.id.toString()) {
      // Display already belongs to this user
      return res.json({
        success: true,
        message: 'Display already paired with this user',
        data: display
      });
    } else {
      // Display already belongs to another user
      throw new UnauthorizedError('Display is already paired with another user');
    }
  } else {
    // Create a new display
    display = new Display({
      deviceId: device.deviceId,
      name,
      location,
      user: req.user.id,
      status: 'active',
      lastConnected: new Date()
    });
    
    await display.save();
    
    logger.info(`New display created and paired with user: ${req.user.id}, display: ${display._id}`);
    
    return res.status(201).json({
      success: true,
      message: 'Display created and paired successfully',
      data: display
    });
  }
}));

/**
 * @route   GET /api/displays/:id
 * @desc    Get a specific display
 * @access  Private
 */
router.get('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const display = await Display.findById(req.params.id);
  
  if (!display) {
    throw new NotFoundError('Display not found');
  }
  
  // Check if display belongs to user
  if (display.user.toString() !== req.user.id.toString()) {
    throw new UnauthorizedError('Not authorized to access this display');
  }
  
  res.json({
    success: true,
    data: display
  });
}));

/**
 * @route   PUT /api/displays/:id
 * @desc    Update a display
 * @access  Private
 */
router.put('/:id', isAuthenticated, validate({
  body: {
    name: 'string',
    location: 'string',
    status: 'string'
  }
}), asyncHandler(async (req, res) => {
  let display = await Display.findById(req.params.id);
  
  if (!display) {
    throw new NotFoundError('Display not found');
  }
  
  // Check if display belongs to user
  if (display.user.toString() !== req.user.id.toString()) {
    throw new UnauthorizedError('Not authorized to update this display');
  }
  
  // Update fields
  if (req.body.name) display.name = req.body.name;
  if (req.body.location) display.location = req.body.location;
  if (req.body.status) display.status = req.body.status;
  
  await display.save();
  
  logger.info(`Display updated: ${display._id}`);
  
  res.json({
    success: true,
    message: 'Display updated successfully',
    data: display
  });
}));

/**
 * @route   DELETE /api/displays/:id
 * @desc    Unpair a display
 * @access  Private
 */
router.delete('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const display = await Display.findById(req.params.id);
  
  if (!display) {
    throw new NotFoundError('Display not found');
  }
  
  // Check if display belongs to user
  if (display.user.toString() !== req.user.id.toString()) {
    throw new UnauthorizedError('Not authorized to unpair this display');
  }
  
  // Remove user association but keep the display in the database
  display.user = null;
  display.status = 'inactive';
  await display.save();
  
  logger.info(`Display unpaired: ${display._id}`);
  
  res.json({
    success: true,
    message: 'Display unpaired successfully'
  });
}));

/**
 * @route   GET /api/displays/:id/schedule
 * @desc    Get schedule for a specific display
 * @access  Private
 */
router.get('/:id/schedule', isAuthenticated, asyncHandler(async (req, res) => {
  const display = await Display.findById(req.params.id);
  
  if (!display) {
    throw new NotFoundError('Display not found');
  }
  
  // Check if display belongs to user
  if (display.user.toString() !== req.user.id.toString()) {
    throw new UnauthorizedError('Not authorized to access this display');
  }
  
  // Return the schedule
  res.json({
    success: true,
    displayId: display._id,
    deviceId: display.deviceId,
    name: display.name,
    scheduledContent: display.scheduledContent || []
  });
}));

/**
 * @route   POST /api/displays/:id/schedule
 * @desc    Add or update scheduled content for a display
 * @access  Private
 */
router.post('/:id/schedule', isAuthenticated, validate({
  body: {
    contentId: 'required|string',
    startTime: 'date',
    endTime: 'date',
    repeat: 'string',
    priority: 'number'
  }
}), asyncHandler(async (req, res) => {
  const display = await Display.findById(req.params.id);
  
  if (!display) {
    throw new NotFoundError('Display not found');
  }
  
  // Check if display belongs to user
  if (display.user.toString() !== req.user.id.toString()) {
    throw new UnauthorizedError('Not authorized to update this display');
  }
  
  // Create schedule entry
  const scheduleEntry = {
    contentId: req.body.contentId,
    startTime: req.body.startTime ? new Date(req.body.startTime) : null,
    endTime: req.body.endTime ? new Date(req.body.endTime) : null,
    repeat: req.body.repeat || 'none',
    priority: req.body.priority || 0,
    active: true,
    createdAt: new Date()
  };
  
  // Initialize scheduledContent array if it doesn't exist
  if (!display.scheduledContent) {
    display.scheduledContent = [];
  }
  
  // Add to display's scheduled content array
  display.scheduledContent.push(scheduleEntry);
  await display.save();
  
  // Log the schedule creation
  console.log(`Created schedule for content ${req.body.contentId} on display ${display._id}`);
  
  // Notify the display about the schedule change using WebSockets
  if (display.deviceId) {
    socketService.notifyScheduleChange(display.deviceId, {
      action: 'add',
      scheduleId: scheduleEntry._id.toString(),
      contentId: scheduleEntry.contentId,
      displayId: display._id
    });
  }
  
  res.status(201).json({
    success: true,
    message: 'Schedule created successfully',
    displayId: display._id,
    schedule: scheduleEntry
  });
}));

/**
 * @route   DELETE /api/displays/:id/schedule/:scheduleId
 * @desc    Remove scheduled content from a display
 * @access  Private
 */
router.delete('/:id/schedule/:scheduleId', isAuthenticated, asyncHandler(async (req, res) => {
  const display = await Display.findById(req.params.id);
  
  if (!display) {
    throw new NotFoundError('Display not found');
  }
  
  // Check if display belongs to user
  if (display.user.toString() !== req.user.id.toString()) {
    throw new UnauthorizedError('Not authorized to update this display');
  }
  
  // Find the schedule entry
  if (!display.scheduledContent) {
    throw new NotFoundError('No scheduled content found');
  }
  
  // Find the schedule before removing it
  const scheduleToRemove = display.scheduledContent.find(
    schedule => schedule._id.toString() === req.params.scheduleId
  );
  
  if (!scheduleToRemove) {
    throw new NotFoundError('Schedule not found');
  }
  
  // Remove the schedule entry
  display.scheduledContent = display.scheduledContent.filter(
    schedule => schedule._id.toString() !== req.params.scheduleId
  );
  
  await display.save();
  
  // Notify the display about the schedule change using WebSockets
  if (display.deviceId) {
    socketService.notifyScheduleChange(display.deviceId, {
      action: 'remove',
      scheduleId: req.params.scheduleId,
      contentId: scheduleToRemove.contentId,
      displayId: display._id
    });
  }
  
  res.json({
    success: true,
    message: 'Schedule removed successfully',
    displayId: display._id
  });
}));

module.exports = router; 