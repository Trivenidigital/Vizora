/**
 * Display Controller
 * Handles REST endpoints for display registration, monitoring, and management
 */

const displayService = require('../services/displayService');
const { ApiError } = require('../middleware/errorMiddleware');
const socketService = require('../socket');
const qrcode = require('qrcode');
const logger = require('../utils/logger');

/**
 * @desc    Register a new display or update existing
 * @route   POST /api/displays/register
 * @access  Public
 */
const registerDisplay = async (req, res, next) => {
  try {
    const displayData = {
      deviceId: req.body.deviceId,
      name: req.body.name,
      model: req.body.model,
      location: req.body.location || 'Unknown Location',
      qrCode: req.body.qrCode || req.body.deviceId,
      status: 'active',
      lastSeen: new Date()
    };
    
    // Register display
    const display = await displayService.registerDisplay(displayData);
    
    res.status(200).json({
      success: true,
      display
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all displays
 * @route   GET /api/displays
 * @access  Private
 */
const getAllDisplays = async (req, res, next) => {
  try {
    // Parse query params for filtering
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.location) filter.location = new RegExp(req.query.location, 'i');
    
    // Get displays
    const displays = await displayService.getAllDisplays(filter);
    
    // Enhance displays with scheduled content information
    const enhancedDisplays = displays.map(display => {
      // Get current time
      const now = new Date();
      
      // Find currently active scheduled content
      let activeSchedule = null;
      let nextSchedule = null;
      
      if (display.scheduledContent && display.scheduledContent.length > 0) {
        // Filter active schedules
        const activeSchedules = display.scheduledContent.filter(schedule => {
          if (!schedule.active) return false;
          
          const startTime = schedule.startTime ? new Date(schedule.startTime) : null;
          const endTime = schedule.endTime ? new Date(schedule.endTime) : null;
          
          // Check if current time is within schedule
          if (startTime && now < startTime) return false; // Not started yet
          if (endTime && now > endTime) return false; // Already ended
          
          // For recurring schedules, we would need more complex logic here
          return true;
        });
        
        // Sort by priority
        if (activeSchedules.length > 0) {
          activeSchedule = activeSchedules.sort((a, b) => b.priority - a.priority)[0];
        }
        
        // Find next scheduled content (with start time in the future)
        const futureSchedules = display.scheduledContent
          .filter(schedule => {
            if (!schedule.active) return false;
            if (!schedule.startTime) return false;
            return new Date(schedule.startTime) > now;
          })
          .sort((a, b) => {
            if (!a.startTime || !b.startTime) return 0;
            return new Date(a.startTime) - new Date(b.startTime);
          });
        
        if (futureSchedules.length > 0) {
          nextSchedule = futureSchedules[0];
        }
      }
      
      // Return display with enhanced information
      return {
        ...display.toObject(),
        currentSchedule: activeSchedule,
        nextSchedule: nextSchedule
      };
    });
    
    res.status(200).json({
      success: true,
      count: enhancedDisplays.length,
      displays: enhancedDisplays
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get display by deviceId
 * @route   GET /api/displays/:deviceId
 * @access  Private
 */
const getDisplayByDeviceId = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Get display
    const display = await displayService.getDisplayByDeviceId(deviceId);
    
    res.status(200).json({
      success: true,
      display
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Update display
 * @route   PUT /api/displays/:deviceId
 * @access  Private
 */
const updateDisplay = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Get display first to ensure it exists
    const display = await displayService.getDisplayByDeviceId(deviceId);
    
    // Update fields from request body
    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.location) updateData.location = req.body.location;
    if (req.body.model) updateData.model = req.body.model;
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.settings) updateData.settings = req.body.settings;
    
    // Apply all updates
    Object.keys(updateData).forEach(key => {
      display[key] = updateData[key];
    });
    
    // Save updates
    await display.save();
    
    res.status(200).json({
      success: true,
      display
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Delete display
 * @route   DELETE /api/displays/:deviceId
 * @access  Private
 */
const deleteDisplay = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Delete display
    await displayService.deleteDisplay(deviceId);
    
    res.status(200).json({
      success: true,
      message: `Display with deviceId: ${deviceId} has been deleted`
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Generate pairing code
 * @route   POST /api/displays/:deviceId/pair
 * @access  Private
 */
const generatePairingCode = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Generate pairing code
    const pairingData = await displayService.generatePairingCode(deviceId);
    
    res.status(200).json({
      success: true,
      ...pairingData
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Pair display with user
 * @route   POST /api/displays/:deviceId/confirm-pairing
 * @access  Private
 */
const confirmPairing = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { pairingCode } = req.body;
    const userId = req.user.id; // From auth middleware
    
    if (!pairingCode) {
      return next(ApiError.badRequest('Pairing code is required'));
    }
    
    // Pair display with user
    const display = await displayService.pairWithController(deviceId, pairingCode, userId);
    
    // Emit pairing confirmation event via socket
    await socketService.emitPairingConfirmed(deviceId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Display paired successfully',
      display
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Get display status
 * @route   GET /api/displays/:deviceId/status
 * @access  Private
 */
const getDisplayStatus = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Get display
    const display = await displayService.getDisplayByDeviceId(deviceId);
    
    // Extract status information
    const status = {
      deviceId: display.deviceId,
      status: display.status,
      online: display.isOnline, // Using virtual
      lastSeen: display.lastSeen,
      metrics: display.metrics || {}
    };
    
    res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Get display metrics
 * @route   GET /api/displays/:deviceId/metrics
 * @access  Private
 */
const getDisplayMetrics = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Get display
    const display = await displayService.getDisplayByDeviceId(deviceId);
    
    // Return metrics or default
    const metrics = display.metrics || {
      cpu: { usage: 0 },
      memory: { total: 0, used: 0, free: 0 },
      storage: { total: 0, used: 0, free: 0 },
      network: { type: 'unknown', strength: 0 },
      uptime: 0
    };
    
    res.status(200).json({
      success: true,
      deviceId: display.deviceId,
      metrics
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Send a command to display
 * @route   POST /api/displays/:deviceId/command
 * @access  Private
 */
const sendDisplayCommand = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { command, params } = req.body;
    
    if (!command) {
      return next(ApiError.badRequest('Command is required'));
    }
    
    // Check if display exists
    await displayService.getDisplayByDeviceId(deviceId);
    
    // Send command via socket
    const sent = await socketService.sendContentUpdate(deviceId, {
      type: 'command',
      command,
      params: params || {}
    });
    
    if (!sent) {
      return next(ApiError.badRequest(`Display with deviceId: ${deviceId} is not connected`));
    }
    
    res.status(200).json({
      success: true,
      message: `Command sent to display: ${deviceId}`
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Update display settings
 * @route   PUT /api/displays/:deviceId/settings
 * @access  Private
 */
const updateDisplaySettings = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { settings } = req.body;
    
    if (!settings) {
      return next(ApiError.badRequest('Settings are required'));
    }
    
    // Get display
    const display = await displayService.getDisplayByDeviceId(deviceId);
    
    // Update settings
    display.settings = {
      ...display.settings,
      ...settings
    };
    
    await display.save();
    
    // Send settings update via socket if display is connected
    socketService.sendContentUpdate(deviceId, {
      type: 'settings',
      settings: display.settings
    });
    
    res.status(200).json({
      success: true,
      message: 'Settings updated',
      settings: display.settings
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Maintenance mode toggle
 * @route   POST /api/displays/:deviceId/maintenance
 * @access  Private
 */
const toggleMaintenanceMode = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { enabled, reason, estimatedDuration } = req.body;
    
    // Get display
    const display = await displayService.getDisplayByDeviceId(deviceId);
    
    // Update maintenance status
    display.maintenance = {
      inMaintenance: !!enabled,
      maintenanceNotes: reason || '',
      scheduledMaintenance: enabled ? new Date() : null
    };
    
    if (enabled) {
      display.status = 'maintenance';
    } else {
      display.status = 'active';
    }
    
    await display.save();
    
    // Notify display via socket
    socketService.sendContentUpdate(deviceId, {
      type: 'maintenance',
      enabled: !!enabled,
      reason,
      estimatedDuration
    });
    
    res.status(200).json({
      success: true,
      maintenance: display.maintenance
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Get display content
 * @route   GET /api/displays/:deviceId/content
 * @access  Public (secured by deviceId)
 */
const getDisplayContent = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Validate the deviceId exists
    const display = await displayService.getDisplayByDeviceId(deviceId);
    
    if (!display) {
      return res.status(404).json({
        success: false,
        message: `Display not found with deviceId: ${deviceId}`
      });
    }
    
    // Fetch content assigned to this display with scheduling support
    const contentList = await displayService.getDisplayContent(deviceId);
    
    // Format the content for display consumption
    const formattedContent = contentList.map(item => ({
      id: item._id || item.id,
      contentId: item._id || item.id, // For backward compatibility
      contentType: item.type,
      type: item.type, // For backward compatibility
      url: item.url,
      duration: item.duration || 30, // Default 30 seconds if not specified
      title: item.name || item.title || 'Untitled',
      description: item.description || '',
      scheduled: !!item.scheduledInfo,
      scheduledInfo: item.scheduledInfo || null,
      displaySettings: {
        autoplay: item.displaySettings?.autoplay !== false, // Default to true
        loop: item.displaySettings?.loop || false,
        mute: item.displaySettings?.mute || false,
        fit: item.displaySettings?.fit || 'contain'
      }
    }));
    
    // Update the display's last seen timestamp
    display.lastSeen = new Date();
    await display.save();
    
    // Log content retrieval for analytics
    console.log(`Content fetched for device ${deviceId} at ${new Date().toISOString()}`);
    
    res.status(200).json({
      success: true,
      displayId: deviceId,
      timestamp: new Date().toISOString(),
      count: formattedContent.length,
      content: formattedContent || []
    });
  } catch (error) {
    console.error(`Error fetching content for device ${req.params.deviceId}:`, error);
    next(error);
  }
};

module.exports = {
  registerDisplay,
  getAllDisplays,
  getDisplayByDeviceId,
  updateDisplay,
  deleteDisplay,
  generatePairingCode,
  confirmPairing,
  getDisplayStatus,
  getDisplayMetrics,
  sendDisplayCommand,
  updateDisplaySettings,
  toggleMaintenanceMode,
  getDisplayContent
}; 