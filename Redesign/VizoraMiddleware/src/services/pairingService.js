/**
 * Pairing Service - manages the pairing process between displays and controllers
 */

const displayService = require('./displayService');
const controllerService = require('./controllerService');
const tokenStore = require('./tokenStoreService');
const qrcode = require('qrcode');
const { Display, Controller } = require('../models');
const { ApiError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Constants
const PAIRING_TOKEN_TYPE = 'pairing';
const PAIRING_TTL_SECONDS = 300; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// Debug function to log device store state
function debugDisplayStore() {
  try {
    Display.find({}).then(displays => {
      const deviceIds = displays.map(d => d.deviceId);
      logger.info(`🔍 DEBUG: Currently registered devices: ${JSON.stringify(deviceIds)}`);
    }).catch(err => {
      logger.error('Error querying displays:', err);
    });
  } catch (error) {
    logger.error('Error in debugDisplayStore:', error);
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initiate pairing process for a display
 */
async function initiatePairing(displayDeviceId) {
  logger.info(`[PAIRING] ⚡ Initiating pairing for device ${displayDeviceId}`);
  
  // Log current device store state for debugging
  try {
    const devices = await Display.find({}).select('deviceId name status').lean();
    logger.info(`[PAIRING] Current device registry has ${devices.length} devices`);
    const matchingDevices = devices.filter(d => 
      d.deviceId === displayDeviceId || 
      (displayDeviceId.startsWith('device-') && d.deviceId === displayDeviceId.replace(/^device-/, '')) ||
      (!displayDeviceId.startsWith('device-') && d.deviceId === `device-${displayDeviceId}`)
    );
    if (matchingDevices.length > 0) {
      logger.info(`[PAIRING] Found ${matchingDevices.length} devices matching ${displayDeviceId}: ${JSON.stringify(matchingDevices)}`);
    }
  } catch (err) {
    logger.warn(`[PAIRING] Failed to query device registry: ${err.message}`);
  }
  
  let display = null;
  
  // STEP 1: Try to find the device directly in the database
  try {
    display = await Display.findOne({ deviceId: displayDeviceId });
    if (display) {
      logger.info(`[PAIRING] Found device directly with ID: ${displayDeviceId}, status: ${display.status || 'unknown'}`);
    }
  } catch (err) {
    logger.warn(`[PAIRING] Direct DB lookup failed: ${err.message}`);
  }
  
  // STEP 2: If not found with exact ID, try with/without device- prefix
  if (!display) {
    if (displayDeviceId.startsWith('device-')) {
      // Try without the device- prefix
      const normalizedId = displayDeviceId.replace(/^device-/, '');
      logger.info(`[PAIRING] Trying without device- prefix: ${normalizedId}`);
      
      try {
        display = await Display.findOne({ deviceId: normalizedId });
        if (display) {
          logger.info(`[PAIRING] Found device with normalized ID: ${normalizedId}`);
          // Update the device ID to maintain consistency
          display.deviceId = displayDeviceId;
          await display.save();
          logger.info(`[PAIRING] Updated device ID from ${normalizedId} to ${displayDeviceId}`);
        }
      } catch (err) {
        logger.warn(`[PAIRING] Normalized ID lookup failed: ${err.message}`);
      }
    } else {
      // Try with the device- prefix
      const prefixedId = `device-${displayDeviceId}`;
      logger.info(`[PAIRING] Trying with device- prefix: ${prefixedId}`);
      
      try {
        display = await Display.findOne({ deviceId: prefixedId });
        if (display) {
          logger.info(`[PAIRING] Found device with prefixed ID: ${prefixedId}`);
          // Keep the prefixed ID for consistency
        }
      } catch (err) {
        logger.warn(`[PAIRING] Prefixed ID lookup failed: ${err.message}`);
      }
    }
  }
  
  // STEP 3: As a final attempt, try creating a new display if one doesn't exist
  if (!display) {
    logger.info(`[PAIRING] Device not found, creating new device: ${displayDeviceId}`);
    
    try {
      display = new Display({
        deviceId: displayDeviceId,
        name: `Display ${displayDeviceId.substring(0, 8)}`,
        status: 'active',
        lastHeartbeat: new Date()
      });
      
      await display.save();
      logger.info(`[PAIRING] Created new display for ${displayDeviceId}`);
    } catch (createError) {
      // If duplicate key error, it means the device was just created by another process
      if (createError.code === 11000) {
        logger.info(`[PAIRING] Device was created by another process, retrying fetch`);
        try {
          // Try one more time to find it
          display = await Display.findOne({ deviceId: displayDeviceId });
          
          if (!display && displayDeviceId.startsWith('device-')) {
            // Try normalized as last resort
            display = await Display.findOne({ 
              deviceId: displayDeviceId.replace(/^device-/, '')
            });
          }
          
          if (!display && !displayDeviceId.startsWith('device-')) {
            // Try prefixed as last resort
            display = await Display.findOne({ 
              deviceId: `device-${displayDeviceId}`
            });
          }
          
          if (!display) {
            // As a desperate measure, try to find any display that might match
            const similarDevices = await Display.find({ 
              deviceId: { $regex: displayDeviceId.replace(/^device-/, '') }
            });
            
            if (similarDevices.length > 0) {
              display = similarDevices[0];
              logger.info(`[PAIRING] Found similar display by regex: ${display.deviceId}`);
            }
          }
        } catch (retryErr) {
          logger.error(`[PAIRING] Final fetch attempt failed: ${retryErr.message}`);
        }
      } else {
        logger.error(`[PAIRING] Failed to create new display: ${createError.message}`);
        
        // Try one more time with a truncated ID if it's too long
        if (displayDeviceId.length > 30) {
          try {
            const truncatedId = displayDeviceId.substring(0, 30);
            logger.info(`[PAIRING] Trying with truncated ID: ${truncatedId}`);
            
            display = new Display({
              deviceId: truncatedId,
              name: `Display ${truncatedId.substring(0, 8)}`,
              status: 'active',
              lastHeartbeat: new Date()
            });
            
            await display.save();
            logger.info(`[PAIRING] Created display with truncated ID: ${truncatedId}`);
          } catch (truncateErr) {
            logger.error(`[PAIRING] Failed to create with truncated ID: ${truncateErr.message}`);
          }
        }
      }
    }
  }
  
  // EMERGENCY FALLBACK: If we still don't have a display object, create a temporary in-memory one
  // This ensures we can still generate a pairing code even if DB operations fail
  if (!display) {
    logger.warn(`[PAIRING] ⚠️ Using emergency in-memory display object for ${displayDeviceId}`);
    
    // Create a non-persistent display object just for pairing
    display = {
      _id: new mongoose.Types.ObjectId(),
      deviceId: displayDeviceId,
      name: `Display ${displayDeviceId.substring(0, 8)}`,
      status: 'active',
      save: async () => logger.warn('[PAIRING] Using in-memory display (changes not saved to DB)')
    };
  }
  
  try {
    // Generate pairing code
    const pairingCode = tokenStore.generatePairingCode();
    logger.info(`[PAIRING] Generated pairing code: ${pairingCode} for device: ${display.deviceId}`);
    
    // Store pairing code in token store with display info
    tokenStore.storeToken(
      display.deviceId, 
      PAIRING_TOKEN_TYPE, 
      { 
        displayId: display._id,
        deviceId: display.deviceId,
        displayName: display.name || 'Unnamed Display',
        code: pairingCode
      }, 
      PAIRING_TTL_SECONDS
    );
    
    // Try to store it directly on the display model for redundancy (if it's a real DB model)
    try {
      display.pairingCode = {
        code: pairingCode,
        expiresAt: new Date(Date.now() + PAIRING_TTL_SECONDS * 1000)
      };
      await display.save();
    } catch (saveErr) {
      logger.warn(`[PAIRING] Could not save pairing code to display object: ${saveErr.message}`);
      // Continue anyway since we have it in the token store
    }
    
    // Calculate expiry time for client use
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + PAIRING_TTL_SECONDS);
    
    // Generate QR code with the pairing data
    const pairingData = {
      deviceId: display.deviceId,
      code: pairingCode,
      expires: expiresAt.toISOString()
    };
    
    const qrDataString = JSON.stringify(pairingData);
    const qrImageBuffer = await qrcode.toBuffer(qrDataString);
    
    logger.info(`[PAIRING] 🔑 Successfully generated pairing code ${pairingCode} for display ${display.deviceId}`);
    
    return {
      pairingCode,
      pairingExpiry: expiresAt,
      qrCode: qrImageBuffer.toString('base64')
    };
  } catch (error) {
    logger.error(`[PAIRING] ❌ Error generating pairing code: ${error.message}`);
    throw error;
  }
}

/**
 * Complete pairing between controller and display using pairing code
 */
async function completePairing(pairingCode, controllerDeviceId) {
  if (!pairingCode || !controllerDeviceId) {
    throw new ApiError(400, 'Pairing code and controller device ID are required');
  }
  
  logger.info(`Attempting to complete pairing with code: ${pairingCode} and controller: ${controllerDeviceId}`);
  
  try {
    // Find display with this pairing code
    const activeTokens = Array.from(tokenStore.tokens.values())
      .filter(t => t.tokenType === PAIRING_TOKEN_TYPE && t.data.code === pairingCode && t.expiresAt > Date.now());
    
    if (activeTokens.length === 0) {
      logger.error(`No active pairing found with code: ${pairingCode}`);
      throw new ApiError(404, 'Invalid or expired pairing code');
    }
    
    // Use the first matching token
    const tokenData = activeTokens[0];
    const displayDeviceId = tokenData.key;
    
    // Find the display
    const display = await Display.findOne({ deviceId: displayDeviceId });
    
    if (!display) {
      logger.error(`No display found with deviceId: ${displayDeviceId}`);
      throw new ApiError(404, 'Display not found');
    }
    
    // Find or create the controller
    let controller = await Controller.findOne({ deviceId: controllerDeviceId });
    
    if (!controller) {
      // Register new controller
      logger.info(`Creating new controller with ID: ${controllerDeviceId}`);
      controller = await controllerService.registerController({
        deviceId: controllerDeviceId,
        name: 'Web Controller',
        status: 'online'
      });
    }
    
    // Check if already paired
    const alreadyPaired = display.pairedControllers.some(
      id => id.toString() === controller._id.toString()
    );
    
    if (alreadyPaired) {
      logger.info(`Display ${display.deviceId} already paired with controller ${controllerDeviceId}`);
      
      // Still update controller's active display
      if (controller.setActiveDisplay) {
        await controller.setActiveDisplay(display._id);
      }
      
      // Invalidate the pairing code
      for (const token of activeTokens) {
        tokenStore.invalidateToken(token.key, token.tokenType, token.token);
      }
      
      return {
        success: true,
        alreadyPaired: true,
        display,
        controller
      };
    }
    
    // Pair the devices
    logger.info(`Pairing display ${display.deviceId} with controller ${controllerDeviceId}`);
    
    try {
      // Add controller to display
      display.addController(controller._id);
      await display.save();
      
      // Add display to controller
      if (controller.addDisplay) {
        controller.addDisplay(display._id);
        await controller.save();
      }
      
      // Invalidate the pairing code
      for (const token of activeTokens) {
        tokenStore.invalidateToken(token.key, token.tokenType, token.token);
      }
      
      // Find the socket ID for the display to notify it
      const socketService = require('./socketService');
      const socketIo = socketService.getSocketInstance();
      
      if (socketIo) {
        const connectedDisplays = socketService.getConnectedDisplays();
        
        if (connectedDisplays.includes(display.deviceId)) {
          logger.info(`Notifying display ${display.deviceId} about pairing`);
          socketIo.to(`display:${display.deviceId}`).emit('controller:paired', {
            controllerId: controllerDeviceId
          });
        }
      }
      
      logger.info(`Successfully paired display ${display.deviceId} with controller ${controllerDeviceId}`);
      
      return {
        success: true,
        alreadyPaired: false,
        display,
        controller
      };
    } catch (error) {
      logger.error(`Error during pairing process: ${error.message}`, error);
      throw error;
    }
  } catch (error) {
    logger.error(`Pairing failed: ${error.message}`, error);
    throw error;
  }
}

/**
 * Unpair a controller from a display
 */
async function unpairDevices(displayDeviceId, controllerDeviceId) {
  try {
    // Check if devices are paired
    const isPaired = await displayService.isDisplayPaired(displayDeviceId, controllerDeviceId);
    
    if (!isPaired) {
      logger.info(`Display ${displayDeviceId} not paired with controller ${controllerDeviceId}`);
      return {
        success: true,
        alreadyUnpaired: true
      };
    }
    
    // Unpair the devices
    const result = await displayService.unpairFromController(displayDeviceId, controllerDeviceId);
    
    logger.info(`Successfully unpaired display ${displayDeviceId} from controller ${controllerDeviceId}`);
    
    return {
      success: true,
      alreadyUnpaired: false,
      display: result.display,
      controller: result.controller
    };
  } catch (error) {
    logger.error(`Unpairing failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get all paired devices for a controller
 */
async function getPairedDisplaysForController(controllerDeviceId) {
  const pairedDisplays = await controllerService.listPairedDisplays(controllerDeviceId);
  
  return {
    success: true,
    pairedDisplays,
    count: pairedDisplays.length
  };
}

/**
 * Get all paired controllers for a display
 */
async function getPairedControllersForDisplay(displayDeviceId) {
  const display = await displayService.getDisplayByDeviceId(displayDeviceId);
  await display.populate('pairedControllers');
  
  return {
    success: true,
    pairedControllers: display.pairedControllers || [],
    count: display.pairedControllers ? display.pairedControllers.length : 0
  };
}

/**
 * Verify if a controller is paired with a display
 */
async function verifyPairing(displayDeviceId, controllerDeviceId) {
  const isPaired = await displayService.isDisplayPaired(displayDeviceId, controllerDeviceId);
  
  return {
    success: true,
    isPaired
  };
}

module.exports = {
  initiatePairing,
  completePairing,
  unpairDevices,
  getPairedDisplaysForController,
  getPairedControllersForDisplay,
  verifyPairing
}; 