/**
 * Controller Service - handles operations related to controller devices
 */

const { Controller, Display } = require('../models');
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Register a new controller device or update an existing one
 */
async function registerController(deviceData) {
  const { deviceId, name, model } = deviceData;
  
  if (!deviceId) {
    throw new Error('Device ID is required');
  }

  // Check if controller exists
  let controller = await Controller.findOne({ deviceId });
  
  if (controller) {
    // Update existing controller
    controller.name = name || controller.name;
    controller.model = model || controller.model;
    controller.status = 'online';
    controller.lastSeen = new Date();
    
    logger.info(`Controller device updated: ${deviceId}`);
  } else {
    // Create new controller
    controller = new Controller({
      deviceId,
      name: name || 'Controller',
      model: model || '',
      status: 'online',
      lastSeen: new Date()
    });
    
    logger.info(`New controller device registered: ${deviceId}`);
  }
  
  await controller.save();
  return controller;
}

/**
 * Get a controller by device ID
 */
async function getControllerByDeviceId(deviceId) {
  const controller = await Controller.findOne({ deviceId })
    .populate('pairedDisplays')
    .populate('activeDisplay');
  
  if (!controller) {
    throw new NotFoundError(`Controller not found with deviceId: ${deviceId}`);
  }
  
  return controller;
}

/**
 * Update controller status
 */
async function updateControllerStatus(deviceId, status) {
  const controller = await getControllerByDeviceId(deviceId);
  
  controller.status = status;
  controller.lastSeen = new Date();
  
  await controller.save();
  return controller;
}

/**
 * Set active display for a controller
 */
async function setActiveDisplay(controllerDeviceId, displayDeviceId) {
  const controller = await getControllerByDeviceId(controllerDeviceId);
  
  // Find display
  const display = await Display.findOne({ deviceId: displayDeviceId });
  
  if (!display) {
    throw new NotFoundError(`Display not found with deviceId: ${displayDeviceId}`);
  }
  
  // Check if display is paired with controller
  const isPaired = controller.pairedDisplays.some(
    id => id.toString() === display._id.toString()
  );
  
  if (!isPaired) {
    throw new Error(`Display ${displayDeviceId} is not paired with controller ${controllerDeviceId}`);
  }
  
  // Set active display
  await controller.setActiveDisplay(display._id);
  
  logger.info(`Set active display ${displayDeviceId} for controller ${controllerDeviceId}`);
  
  return controller;
}

/**
 * Get active display details for a controller
 */
async function getActiveDisplay(controllerDeviceId) {
  const controller = await Controller.findOne({ deviceId: controllerDeviceId })
    .populate('activeDisplay');
  
  if (!controller) {
    throw new NotFoundError(`Controller not found with deviceId: ${controllerDeviceId}`);
  }
  
  if (!controller.activeDisplay) {
    return null;
  }
  
  return controller.activeDisplay;
}

/**
 * List all paired displays for a controller
 */
async function listPairedDisplays(controllerDeviceId) {
  const controller = await Controller.findOne({ deviceId: controllerDeviceId })
    .populate('pairedDisplays');
  
  if (!controller) {
    throw new NotFoundError(`Controller not found with deviceId: ${controllerDeviceId}`);
  }
  
  return controller.pairedDisplays || [];
}

/**
 * List all controllers (with optional filtering and pagination)
 */
async function listControllers(filter = {}, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const controllers = await Controller.find(filter)
    .populate('pairedDisplays')
    .populate('activeDisplay')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });
  
  const total = await Controller.countDocuments(filter);
  
  return {
    controllers,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Check if a controller is paired with a specific display
 */
async function isControllerPaired(controllerDeviceId, displayDeviceId) {
  const controller = await getControllerByDeviceId(controllerDeviceId);
  const display = await Display.findOne({ deviceId: displayDeviceId });
  
  if (!display) {
    return false;
  }
  
  // Check if display is in controller's paired displays
  const paired = controller.pairedDisplays.some(
    id => id.toString() === display._id.toString()
  );
  
  return paired;
}

module.exports = {
  registerController,
  getControllerByDeviceId,
  updateControllerStatus,
  setActiveDisplay,
  getActiveDisplay,
  listPairedDisplays,
  listControllers,
  isControllerPaired
}; 