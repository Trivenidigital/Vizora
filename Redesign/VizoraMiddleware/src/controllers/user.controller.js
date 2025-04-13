/**
 * User Controller
 * Handles user profile management and device pairing
 */

const { User, Display } = require('../models');
const logger = require('../utils/logger');
const { ApiError } = require('../middleware/errorMiddleware');
const pairingService = require('../services/pairingService');
const socketService = require('../services/socketService');

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Error in getUserProfile:', error);
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const updates = req.body;
    
    // Don't allow password updates through this endpoint
    if (updates.password) {
      delete updates.password;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Error in updateUserProfile:', error);
    next(error);
  }
};

/**
 * @desc    Get user's paired devices
 * @route   GET /api/users/devices
 * @access  Private
 */
const getUserDevices = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Find displays paired with this user
    const displays = await Display.find({ 'pairing.userId': userId });
    
    res.status(200).json({
      success: true,
      count: displays.length,
      devices: displays.map(display => ({
        deviceId: display.deviceId,
        name: display.name,
        status: display.status,
        type: display.type || 'display',
        lastSeen: display.lastSeen,
        location: display.location,
        pairedAt: display.pairing?.pairedAt
      }))
    });
  } catch (error) {
    logger.error('Error in getUserDevices:', error);
    next(error);
  }
};

/**
 * @desc    Pair a device using pairing code
 * @route   POST /api/users/devices/pair
 * @access  Private
 */
const pairDevice = async (req, res, next) => {
  try {
    const { pairingCode } = req.body;
    const userId = req.user.id;
    
    // Validate pairing code and pair device
    const result = await pairingService.validateAndPairDevice(pairingCode, userId);
    
    res.status(200).json({
      success: true,
      message: 'Device paired successfully',
      deviceId: result.deviceId,
      deviceName: result.deviceName
    });
  } catch (error) {
    logger.error('Error in pairDevice:', error);
    next(new ApiError(400, error.message));
  }
};

/**
 * @desc    Unpair a device
 * @route   DELETE /api/users/devices/:deviceId
 * @access  Private
 */
const unpairDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;
    
    // Find the device
    const display = await Display.findOne({ deviceId, 'pairing.userId': userId });
    
    if (!display) {
      return next(new ApiError(404, 'Device not found or not paired with this user'));
    }
    
    // Remove pairing information
    display.pairing = undefined;
    await display.save();
    
    res.status(200).json({
      success: true,
      message: 'Device unpaired successfully',
      deviceId
    });
  } catch (error) {
    logger.error('Error in unpairDevice:', error);
    next(error);
  }
};

/**
 * @desc    Send command to a device
 * @route   POST /api/users/devices/:deviceId/command
 * @access  Private
 */
const sendDeviceCommand = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { command } = req.body;
    const userId = req.user.id;
    
    // Find the device
    const display = await Display.findOne({ deviceId, 'pairing.userId': userId });
    
    if (!display) {
      return next(new ApiError(404, 'Device not found or not paired with this user'));
    }
    
    // Send the command through socket
    const result = await socketService.sendCommandToDevice(deviceId, command);
    
    res.status(200).json({
      success: true,
      message: 'Command sent to device',
      commandSent: command,
      deviceId,
      delivered: result.delivered,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error in sendDeviceCommand:', error);
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserDevices,
  pairDevice,
  unpairDevice,
  sendDeviceCommand
}; 