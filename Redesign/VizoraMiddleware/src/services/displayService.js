/**
 * Display Service
 * Handles display registration, status updates, pairing, and monitoring
 */

const mongoose = require('mongoose');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Display = require('../models/Display');
const { ApiError } = require('../middleware/errorMiddleware');
const Content = require('../models/Content');

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Register or update a display
 * @param {Object} displayData - Display data
 * @returns {Promise<Object>} Display object
 */
const registerDisplay = async (displayData) => {
  try {
    console.log(`DEBUG [displayService.registerDisplay]: Display search result: ${displayData.deviceId}`);
    
    // Check if display already exists
    let display = await Display.findOne({ deviceId: displayData.deviceId });
    
    if (display) {
      console.log(`DEBUG [displayService.registerDisplay]: Found existing display with ID ${display._id}`);
      
      // Update existing display with new data
      // Only update provided fields
      Object.keys(displayData).forEach(key => {
        if (displayData[key] !== undefined) {
          display[key] = displayData[key];
        }
      });
      
      // Always update lastHeartbeat
      display.lastHeartbeat = new Date();
      display.status = 'active';
      
      await display.save();
      
      return display;
    } else {
      // Create new display
      console.log(`DEBUG [displayService.registerDisplay]: Creating new display with data:`, {
        qrCode: displayData.deviceId || uuidv4(),
        name: displayData.name || 'Test Display',
        location: displayData.location || { name: 'Unknown Location' },
        status: 'active',
        lastSeen: new Date()
      });
      
      // Generate QR code if not provided
      const qrCode = displayData.qrCode || displayData.deviceId || uuidv4();
      
      // Create display
      display = new Display({
        deviceId: displayData.deviceId,
        name: displayData.name || 'New Display',
        location: displayData.location || { name: 'Unknown Location' },
        status: 'active',
        lastHeartbeat: new Date(),
        socketId: displayData.socketId,
        ...displayData
      });
      
      await display.save();
      
      console.log(`DEBUG [displayService.registerDisplay]: Created new display with ID ${display._id}`);
      
      return display;
    }
  } catch (error) {
    console.error('Display registration error:', error);
    throw error;
  }
};

/**
 * Get display by deviceId
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>} Display object
 */
const getDisplayByDeviceId = async (deviceId) => {
  console.log(`DEBUG [displayService.getDisplayByDeviceId]: Looking for display with deviceId: ${deviceId}`);
  
  if (!deviceId) {
    throw new ApiError(400, 'Device ID is required to get display');
  }
  
  const display = await Display.findOne({ deviceId });
  
  if (!display) {
    console.error(`DEBUG [displayService.getDisplayByDeviceId]: Display not found with deviceId: ${deviceId}`);
    
    // Query the database to see what devices exist for debug purposes
    const allDevices = await Display.find({}).select('deviceId name').lean();
    console.log(`DEBUG [displayService.getDisplayByDeviceId]: Current devices in database:`, 
      allDevices.map(d => `${d.deviceId} (${d.name})`));
    
    throw new NotFoundError(`Display not found with deviceId: ${deviceId}`);
  }
  
  console.log(`DEBUG [displayService.getDisplayByDeviceId]: Found display ${display._id} with deviceId: ${deviceId}`);
  return display;
};

/**
 * Get all displays
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Array>} Array of displays
 */
const getAllDisplays = async (filter = {}) => {
  return Display.find(filter);
};

/**
 * Update display status
 * @param {string} deviceId - Device ID
 * @param {Object} statusData - Status data
 * @returns {Promise<Object>} Updated display
 */
const updateDisplayStatus = async (deviceId, statusData) => {
  const display = await getDisplayByDeviceId(deviceId);
  
  // Update status fields
  display.status = statusData.status || display.status;
  display.lastHeartbeat = statusData.lastHeartbeat || new Date();
  
  // Update metrics if provided
  if (statusData.metrics) {
    display.metrics = {
      ...display.metrics,
      ...statusData.metrics
    };
  }
  
  await display.save();
  return display;
};

/**
 * Generate pairing code for display
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>} Pairing code and QR code
 */
const generatePairingCode = async (deviceId) => {
  // Get display
  const display = await getDisplayByDeviceId(deviceId);
  
  // Generate random 6-digit pairing code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiry time (5 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);
  
  // Update display with pairing code
  display.pairingCode = {
    code,
    expiresAt
  };
  
  await display.save();
  
  // Generate QR code with the pairing data
  const pairingData = {
    deviceId: display.deviceId,
    code,
    expires: expiresAt.toISOString()
  };
  
  const qrDataString = JSON.stringify(pairingData);
  const qrImageBuffer = await qrcode.toBuffer(qrDataString);
  
  return {
    pairingCode: code,
    pairingExpiry: expiresAt,
    qrCode: qrImageBuffer.toString('base64')
  };
};

/**
 * Pair a display with a controller
 * @param {string} deviceId - Device ID
 * @param {string} pairingCode - Pairing code
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Paired display
 */
const pairWithController = async (deviceId, pairingCode, userId) => {
  // Get display
  const display = await getDisplayByDeviceId(deviceId);
  
  // Check if pairing code is valid
  if (!display.pairingCode || display.pairingCode.code !== pairingCode) {
    throw new ApiError('Invalid pairing code', 400);
  }
  
  // Check if pairing code has expired
  if (display.pairingCode.expiresAt < new Date()) {
    throw new ApiError('Pairing code has expired', 400);
  }
  
  // Update display with controller info
  display.controlledBy = userId;
  display.pairingCode = undefined;
  display.status = 'active';
  
  await display.save();
  
  return display;
};

/**
 * Check if display is paired with a controller
 * @param {string} deviceId - Device ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Whether display is paired with controller
 */
const isDisplayPaired = async (deviceId, userId) => {
  const display = await getDisplayByDeviceId(deviceId);
  return display.controlledBy && display.controlledBy.toString() === userId;
};

/**
 * Delete a display
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} Whether display was deleted
 */
const deleteDisplay = async (deviceId) => {
  const display = await getDisplayByDeviceId(deviceId);
  await display.remove();
  return true;
};

/**
 * Generate auth token for display
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>} Auth token data
 */
const generateAuthToken = async (deviceId) => {
  const tokenStore = require('./tokenStoreService');
  
  try {
    // Get the display to verify it exists
    const display = await getDisplayByDeviceId(deviceId);
    
    // Generate JWT token (this will be used in Phase 4+)
    // For now, using a secure random token from token store
    const token = tokenStore.storeToken(
      deviceId,
      'auth',
      {
        displayId: display._id,
        deviceId: display.deviceId,
        displayName: display.name || 'Unnamed Display',
        status: display.status
      },
      // 7 day TTL
      7 * 24 * 60 * 60
    );
    
    return {
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      displayId: display.deviceId
    };
  } catch (error) {
    console.error('Error generating auth token:', error);
    throw error;
  }
};

/**
 * Validate auth token for display
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Token data if valid
 */
const validateAuthToken = async (token) => {
  const tokenStore = require('./tokenStoreService');
  
  try {
    // Find the token in the token store
    for (const [storeKey, tokenData] of tokenStore.tokens.entries()) {
      if (tokenData.tokenType === 'auth' && tokenData.token === token) {
        // Check if token has expired
        if (tokenData.expiresAt < Date.now()) {
          throw new ApiError(401, 'Token has expired');
        }
        
        return tokenData.data;
      }
    }
    
    throw new ApiError(401, 'Invalid token');
  } catch (error) {
    console.error('Error validating auth token:', error);
    throw error;
  }
};

/**
 * Get display status and stats
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>} Display status and stats
 */
const getDisplayStatus = async (deviceId) => {
  const display = await getDisplayByDeviceId(deviceId);
  
  return {
    status: display.status,
    metrics: display.metrics || {},
    lastHeartbeat: display.lastHeartbeat
  };
};

/**
 * Get content assigned to a display with scheduling
 * @param {string} deviceId - Display device ID
 * @returns {Promise<Array>} Content assigned to display
 */
const getDisplayContent = async (deviceId) => {
  try {
    // Get the display
    const display = await getDisplayByDeviceId(deviceId);
    
    if (!display) {
      throw new Error(`Display not found with deviceId: ${deviceId}`);
    }
    
    console.log(`[DisplayService] Fetching content for display ${deviceId} (${display.name || 'unnamed'})`);
    
    // Get the current time
    const now = new Date();
    console.log(`[DisplayService] Current time: ${now.toISOString()}`);
    
    // First, handle scheduled content
    let scheduledContent = [];
    if (display.scheduledContent && display.scheduledContent.length > 0) {
      console.log(`[DisplayService] Display has ${display.scheduledContent.length} scheduled content items`);
      
      // Filter for currently active scheduled content
      const activeScheduled = display.scheduledContent.filter(schedule => {
        // Must be active
        if (!schedule.active) {
          console.log(`[DisplayService] Schedule ${schedule._id} is inactive, skipping`);
          return false;
        }
        
        // Check time boundaries if present
        if (schedule.startTime && new Date(schedule.startTime) > now) {
          console.log(`[DisplayService] Schedule ${schedule._id} hasn't started yet (starts ${new Date(schedule.startTime).toISOString()})`);
          return false; // Not started yet
        }
        
        if (schedule.endTime && new Date(schedule.endTime) < now) {
          console.log(`[DisplayService] Schedule ${schedule._id} has already ended (ended ${new Date(schedule.endTime).toISOString()})`);
          return false; // Already ended
        }
        
        // Check recurring schedules
        if (schedule.repeat !== 'none') {
          const startDate = new Date(schedule.startTime);
          const endDate = schedule.endTime ? new Date(schedule.endTime) : null;
          
          // For daily repeats
          if (schedule.repeat === 'daily') {
            // Check if current time is within the time range for today
            const todayStart = new Date(now);
            todayStart.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
            
            let todayEnd;
            if (endDate) {
              todayEnd = new Date(now);
              todayEnd.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds());
            } else {
              todayEnd = new Date(todayStart);
              todayEnd.setHours(23, 59, 59);
            }
            
            const isActive = now >= todayStart && now <= todayEnd;
            console.log(`[DisplayService] Daily schedule ${schedule._id} active period today: ${todayStart.toISOString()} to ${todayEnd.toISOString()}, isActive: ${isActive}`);
            return isActive;
          }
          
          // For weekly repeats
          if (schedule.repeat === 'weekly') {
            // Check if current day of week matches
            if (startDate.getDay() !== now.getDay()) {
              console.log(`[DisplayService] Weekly schedule ${schedule._id} is not active today (expected day: ${startDate.getDay()}, current day: ${now.getDay()})`);
              return false;
            }
            
            // Check time range
            const todayStart = new Date(now);
            todayStart.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
            
            let todayEnd;
            if (endDate) {
              todayEnd = new Date(now);
              todayEnd.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds());
            } else {
              todayEnd = new Date(todayStart);
              todayEnd.setHours(23, 59, 59);
            }
            
            const isActive = now >= todayStart && now <= todayEnd;
            console.log(`[DisplayService] Weekly schedule ${schedule._id} active period today: ${todayStart.toISOString()} to ${todayEnd.toISOString()}, isActive: ${isActive}`);
            return isActive;
          }
          
          // For monthly repeats
          if (schedule.repeat === 'monthly') {
            // Check if current day of month matches
            if (startDate.getDate() !== now.getDate()) {
              console.log(`[DisplayService] Monthly schedule ${schedule._id} is not active today (expected date: ${startDate.getDate()}, current date: ${now.getDate()})`);
              return false;
            }
            
            // Check time range
            const todayStart = new Date(now);
            todayStart.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
            
            let todayEnd;
            if (endDate) {
              todayEnd = new Date(now);
              todayEnd.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds());
            } else {
              todayEnd = new Date(todayStart);
              todayEnd.setHours(23, 59, 59);
            }
            
            const isActive = now >= todayStart && now <= todayEnd;
            console.log(`[DisplayService] Monthly schedule ${schedule._id} active period today: ${todayStart.toISOString()} to ${todayEnd.toISOString()}, isActive: ${isActive}`);
            return isActive;
          }
        }
        
        console.log(`[DisplayService] Schedule ${schedule._id} is active`);
        return true; // Default to active if no time restrictions
      });
      
      console.log(`[DisplayService] Found ${activeScheduled.length} active schedules`);
      
      // Get content for active schedules
      if (activeScheduled.length > 0) {
        // Check for multiple active schedules
        if (activeScheduled.length > 1) {
          console.log(`[DisplayService] Multiple schedules (${activeScheduled.length}) are active simultaneously! Using priority to determine which to show.`);
        }
        
        // Sort by priority
        activeScheduled.sort((a, b) => b.priority - a.priority);
        
        if (activeScheduled.length > 1) {
          console.log(`[DisplayService] Highest priority schedule: ${activeScheduled[0]._id} (${activeScheduled[0].priority})`);
          console.log(`[DisplayService] Other active schedules with lower priorities:`);
          activeScheduled.slice(1).forEach(schedule => {
            console.log(`[DisplayService]   - Schedule ${schedule._id} (priority: ${schedule.priority})`);
          });
        }
        
        // Populate content details
        for (const schedule of activeScheduled) {
          try {
            const content = await Content.findById(schedule.contentId);
            if (content) {
              console.log(`[DisplayService] Found content for schedule ${schedule._id}: "${content.title}" (${content._id})`);
              scheduledContent.push({
                ...content.toObject(),
                scheduledInfo: {
                  startTime: schedule.startTime,
                  endTime: schedule.endTime,
                  repeat: schedule.repeat,
                  priority: schedule.priority
                }
              });
            } else {
              console.error(`[DisplayService] Content not found for schedule ${schedule._id} (contentId: ${schedule.contentId})`);
            }
          } catch (err) {
            console.error(`[DisplayService] Error fetching scheduled content ${schedule.contentId}:`, err);
          }
        }
      }
    } else {
      console.log(`[DisplayService] No scheduled content found for display ${deviceId}`);
    }
    
    // Then, handle regular content
    let regularContent = [];
    if (display.contentIds && display.contentIds.length > 0) {
      console.log(`[DisplayService] Display has ${display.contentIds.length} regular content items assigned`);
      
      // Get content items that aren't already included in scheduledContent
      const scheduledIds = scheduledContent.map(item => item._id.toString());
      const remainingIds = display.contentIds.filter(
        id => !scheduledIds.includes(id.toString())
      );
      
      if (remainingIds.length > 0) {
        console.log(`[DisplayService] Fetching ${remainingIds.length} regular content items that are not part of currently active schedules`);
        
        // Get all content items
        regularContent = await Content.find({
          _id: { $in: remainingIds },
          status: 'active'
        });
        
        console.log(`[DisplayService] Found ${regularContent.length} active regular content items`);
      } else {
        console.log(`[DisplayService] All assigned content is already part of active schedules, no additional content needed`);
      }
    } else {
      console.log(`[DisplayService] No regular content assigned to display ${deviceId}`);
    }
    
    // Combine scheduled (with higher priority) and regular content
    const allContent = [...scheduledContent, ...regularContent];
    
    console.log(`[DisplayService] Returning ${allContent.length} total content items (${scheduledContent.length} scheduled, ${regularContent.length} regular)`);
    
    if (allContent.length === 0) {
      console.log(`[DisplayService] WARNING: No content available for display ${deviceId}`);
    } else {
      console.log(`[DisplayService] First content item: "${allContent[0].title || 'Untitled'}" (${allContent[0]._id})`);
      if (allContent[0].scheduledInfo) {
        console.log(`[DisplayService] First content is scheduled (priority: ${allContent[0].scheduledInfo.priority})`);
      } else {
        console.log(`[DisplayService] First content is regular (non-scheduled)`);
      }
    }
    
    return allContent;
  } catch (error) {
    console.error(`[DisplayService] Error getting display content: ${error.message}`);
    throw error;
  }
};

module.exports = {
  registerDisplay,
  getDisplayByDeviceId,
  getAllDisplays,
  updateDisplayStatus,
  generatePairingCode,
  pairWithController,
  isDisplayPaired,
  deleteDisplay,
  generateAuthToken,
  validateAuthToken,
  getDisplayStatus,
  getDisplayContent
}; 