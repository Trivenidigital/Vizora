/**
 * Controller API Routes
 */

const express = require('express');
const router = express.Router();
const { controllerService } = require('../services');
const { validate, schemas } = require('../utils/validator');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * @route   GET /api/controllers
 * @desc    Get all controllers with pagination
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  
  const filter = {};
  if (status) {
    filter.status = status;
  }
  
  const result = await controllerService.listControllers(filter, parseInt(page), parseInt(limit));
  
  res.json(result);
}));

/**
 * @route   GET /api/controllers/:deviceId
 * @desc    Get a controller by device ID
 * @access  Public
 */
router.get('/:deviceId', asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  
  const controller = await controllerService.getControllerByDeviceId(deviceId);
  
  res.json({
    success: true,
    controller
  });
}));

/**
 * @route   POST /api/controllers/register
 * @desc    Register a new controller or update an existing one
 * @access  Public
 */
router.post('/register', validate({
  body: schemas.controller
}), asyncHandler(async (req, res) => {
  const controller = await controllerService.registerController(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Controller registered successfully',
    controller
  });
}));

/**
 * @route   GET /api/controllers/:deviceId/displays
 * @desc    Get all displays paired with a controller
 * @access  Public
 */
router.get('/:deviceId/displays', asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  
  const pairedDisplays = await controllerService.listPairedDisplays(deviceId);
  
  res.json({
    success: true,
    displays: pairedDisplays,
    count: pairedDisplays.length
  });
}));

/**
 * @route   GET /api/controllers/:deviceId/active-display
 * @desc    Get the active display for a controller
 * @access  Public
 */
router.get('/:deviceId/active-display', asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  
  const activeDisplay = await controllerService.getActiveDisplay(deviceId);
  
  res.json({
    success: true,
    display: activeDisplay
  });
}));

/**
 * @route   PUT /api/controllers/:deviceId/active-display/:displayId
 * @desc    Set the active display for a controller
 * @access  Public
 */
router.put('/:deviceId/active-display/:displayId', asyncHandler(async (req, res) => {
  const { deviceId, displayId } = req.params;
  
  const controller = await controllerService.setActiveDisplay(deviceId, displayId);
  
  res.json({
    success: true,
    message: 'Active display set successfully',
    controller
  });
}));

/**
 * @route   PUT /api/controllers/:deviceId/status
 * @desc    Update controller status
 * @access  Public
 */
router.put('/:deviceId/status', asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required'
    });
  }
  
  const controller = await controllerService.updateControllerStatus(deviceId, status);
  
  res.json({
    success: true,
    message: `Controller status updated to ${status}`,
    controller
  });
}));

module.exports = router; 