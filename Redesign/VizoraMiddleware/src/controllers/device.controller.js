/**
 * Device Controller
 * Handles device registration, token validation, and pairing
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Display } = require('../models');
const logger = require('../utils/logger');
const { ApiError } = require('../middleware/errorMiddleware');
const { validateToken, generateToken } = require('../middleware/authMiddleware');
const tokenStore = require('../services/tokenStoreService');
const displayService = require('../services/displayService');
const pairingService = require('../services/pairingService');

// JWT settings (for backwards compatibility)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '30d';

// Tracking map for throttling pairing requests by device ID and active pairing codes
const pairingRequestTracker = new Map();
const activePairingCodes = new Map();
const PAIRING_THROTTLE_TIME = 15000; // 15 seconds between pairing requests per device
const PAIRING_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENT_REQUESTS_PER_DEVICE = 1; // Only allow one concurrent request per device

/**
 * @desc    Register a new device and return a JWT token
 * @route   POST /api/devices/register
 * @access  Public
 */
const registerDevice = async (req, res, next) => {
  logger.info('📱 Device registration request received');
  
  // Log the complete request payload for debugging
  logger.debug('Request body:', req.body);
  
  try {
    // Validate request body
    if (!req.body) {
      logger.error('Empty request body received for device registration');
      return res.status(400).json({
        success: false,
        message: 'Request body is required'
      });
    }
    
    const { deviceInfo } = req.body;
    
    // Enhanced validation of deviceInfo
    if (!deviceInfo) {
      logger.error('Missing deviceInfo in device registration request');
      return res.status(400).json({
        success: false,
        message: 'Missing deviceInfo in request payload'
      });
    }
    
    // Validate type is present to prevent TypeError
    if (!deviceInfo.type) {
      logger.warn('Device type is missing, setting default: "VizoraTV"');
      deviceInfo.type = 'VizoraTV';
    }
    
    // Generate a unique device ID if not provided
    const deviceId = req.body.deviceId || deviceInfo.deviceId || `device-${uuidv4()}`;
    
    logger.info(`Processing registration for device: ${deviceId}`);
    
    // Set a timeout for the database operation to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Database operation timed out'));
      }, 5000); // 5 second timeout
    });
    
    // Database operation promise
    const dbOperation = async () => {
      // Check if device already exists
      let display;
      try {
        display = await Display.findOne({ deviceId });
      } catch (dbError) {
        logger.error(`Database error looking up device: ${dbError.message}`);
        throw new Error(`Database error: ${dbError.message}`);
      }
    
    if (display) {
        logger.info(`Found existing device with ID: ${deviceId}`);
      // Update device info
      display.lastSeen = new Date();
      display.status = 'active';
        
      if (deviceInfo) {
          display.deviceInfo = { ...display.deviceInfo, ...deviceInfo };
      }
        
      await display.save();
    } else {
        logger.info(`Creating new device with ID: ${deviceId}`);
      // Create new device
        try {
      display = new Display({
        deviceId,
        name: deviceInfo?.name || `Display ${deviceId.substring(0, 8)}`,
        status: 'active',
        deviceInfo: deviceInfo || {},
            lastSeen: new Date(),
            location: {
              name: deviceInfo?.location || 'Unknown Location',
              address: deviceInfo?.address || 'Unknown Address'
            }
          });
          
          await display.save();
        } catch (createError) {
          logger.error(`Error creating device: ${createError.message}`);
          throw new Error(`Error creating device: ${createError.message}`);
        }
      }
      
      return display;
    };
    
    // Race the DB operation against the timeout
    let display;
    try {
      display = await Promise.race([dbOperation(), timeoutPromise]);
    } catch (raceError) {
      if (raceError.message === 'Database operation timed out') {
        logger.error('Device registration timed out');
        
        // If we have a valid deviceId, return success with a token anyway
        // This is a fallback to prevent app blocking in case of DB issues
        if (deviceId) {
          logger.info(`Generating fallback token for device ${deviceId} due to database timeout`);
          
          try {
            // Generate token using device ID only
            const fallbackToken = jwt.sign(
              { deviceId, type: 'device' },
              JWT_SECRET,
              { expiresIn: JWT_EXPIRY }
            );
            
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // 30 days
            
            return res.status(200).json({
              success: true,
              deviceId,
              displayId: deviceId,
              token: fallbackToken,
              expiresAt: expiryDate.toISOString(),
              metadata: {
                name: `Display ${deviceId.substring(0, 8)}`,
                location: 'Unknown Location',
                status: 'pending'
              },
              _fallback: true
            });
          } catch (tokenError) {
            logger.error(`Error generating fallback token: ${tokenError.message}`);
          }
        }
        
        return res.status(504).json({
          success: false,
          message: 'Registration timed out. Please try again later.'
        });
      }
      
      logger.error(`Error in database operation: ${raceError.message}`);
      return res.status(500).json({
        success: false,
        message: `Database error: ${raceError.message}`
      });
    }
    
    // Generate token using the token store service
    let authData;
    try {
      authData = await displayService.generateAuthToken(deviceId);
    } catch (tokenError) {
      logger.error(`Error generating token: ${tokenError.message}`);
      
      // Fallback token generation
      const fallbackToken = jwt.sign(
        { deviceId, type: 'device' },
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRY }
    );
    
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days
      
      authData = {
        token: fallbackToken,
        expiresAt: expiryDate.toISOString()
      };
      
      logger.info(`Generated fallback token for device ID: ${deviceId}`);
    }
    
    logger.info(`Generated token for device ID: ${deviceId}`);
    
    // Prepare response object
    const responseObj = {
      success: true,
      deviceId,
      displayId: deviceId,
      token: authData.token,
      expiresAt: authData.expiresAt,
      metadata: {
        name: display?.name || `Display ${deviceId.substring(0, 8)}`,
        location: display?.location?.name || 'Unknown Location',
        status: display?.status || 'active'
      }
    };
    
    // Return the device ID and token
    return res.status(200).json(responseObj);
  } catch (error) {
    logger.error(`Unhandled error in registerDevice:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to register device: ${error.message}`
    });
  }
};

/**
 * @desc    Check if a token is valid
 * @route   POST /api/devices/validate-token
 * @access  Public
 */
const validateDeviceToken = async (req, res, next) => {
  logger.info('🔐 Token validation request received');
  
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid Authorization header');
      return res.status(200).json({
        isValid: false,
        message: 'No token provided or invalid format'
      });
    }
    
    const token = authHeader.substring(7);
    logger.info(`Validating token: ${token.substring(0, 10)}...`);
    
    try {
      // First try with new token store
      for (const [storeKey, tokenData] of tokenStore.tokens.entries()) {
        if (tokenData.tokenType === 'auth' && tokenData.token === token) {
          // Check if token has expired
          if (tokenData.expiresAt < Date.now()) {
            return res.status(200).json({
              isValid: false,
              message: 'Token has expired'
            });
          }
          
          // Update device last seen time
          const display = await Display.findOne({ deviceId: tokenData.key });
          if (display) {
            display.lastSeen = new Date();
            await display.save();
          }
          
          return res.status(200).json({
            isValid: true,
            message: 'Token is valid',
            device: {
              deviceId: tokenData.key,
              displayName: tokenData.data?.displayName || 'Unnamed Display',
              status: display?.status || 'unknown'
            }
          });
        }
      }
      
      // Fall back to JWT validation (for backward compatibility)
      const validation = validateToken(token);
      
      // If token is valid and it's a device token, check if device exists
      if (validation.isValid && validation.decoded.type === 'device' && validation.decoded.deviceId) {
        const display = await Display.findOne({ 
          $or: [
            { _id: validation.decoded.id },
            { deviceId: validation.decoded.deviceId }
          ]
        });
        
        if (!display) {
          logger.warn(`Device not found in database: ${validation.decoded.deviceId}`);
          return res.status(200).json({
            isValid: false,
            message: 'Token is valid but device not found in database'
          });
        }
        
        logger.info(`Device found in database: ${display.deviceId}`);
        
        // Update last seen timestamp
        display.lastSeen = new Date();
        await display.save();
        
        return res.status(200).json({
          isValid: true,
          message: 'Token is valid (legacy JWT)',
          device: {
            deviceId: display.deviceId,
            displayName: display.name || 'Unnamed Display',
            status: display.status
          }
        });
      }
      
      return res.status(200).json({
        isValid: false,
        message: 'Invalid token'
      });
    } catch (error) {
      logger.error(`Token validation error:`, error);
      return res.status(200).json({
        isValid: false,
        message: `Token validation error: ${error.message}`
      });
    }
  } catch (error) {
    logger.error(`Error in validateDeviceToken:`, error);
    return next(new ApiError(500, `Token validation error: ${error.message}`));
  }
};

/**
 * @desc    Generate a pairing code for a device
 * @route   POST /api/devices/pair
 * @access  Public
 */
const generatePairingCode = async (req, res, next) => {
  logger.info('📡 [PAIRING] Pairing code request received');
  logger.debug('[PAIRING] Request body:', req.body);
  
  try {
    const { deviceId, deviceInfo } = req.body;
    
    if (!deviceId) {
      logger.warn('[PAIRING] Missing deviceId in request');
      return next(new ApiError(400, 'Device ID is required'));
    }
    
    // Create a mutex-style lock to prevent multiple concurrent pairing requests
    // Use a normalized version of deviceId to handle prefix differences
    const normalizedDeviceId = deviceId.replace(/^device-/, '');
    
    // Track devices that are currently being processed
    const isProcessingKey = `${normalizedDeviceId}:processing`;
    if (pairingRequestTracker.get(isProcessingKey)) {
      logger.warn(`[PAIRING] Device ${deviceId} already has a pairing request in progress, rejecting concurrent request`);
      return res.status(429).json({
        success: false,
        message: 'A pairing request for this device is already in progress',
        retryAfter: 2 // Suggest to retry after 2 seconds
      });
    }
    
    // Mark this device as being processed
    pairingRequestTracker.set(isProcessingKey, true);
    
    try {
      // Check for existing valid pairing code for this device
      const existingCode = activePairingCodes.get(normalizedDeviceId);
      if (existingCode && existingCode.expiresAt > Date.now()) {
        logger.info(`[PAIRING] Found existing valid pairing code for ${deviceId}: ${existingCode.code}, expires in ${Math.round((existingCode.expiresAt - Date.now()) / 1000)}s`);
        
        // Generate QR code with existing data
        const qrcode = require('qrcode');
        const pairingData = {
          deviceId: deviceId,
          code: existingCode.code,
          expires: new Date(existingCode.expiresAt).toISOString()
        };
        
        const qrDataString = JSON.stringify(pairingData);
        const qrImageBuffer = await qrcode.toBuffer(qrDataString);
        
        logger.info(`[PAIRING] ✅ Returning existing pairing code: ${existingCode.code}`);
        
        return res.status(200).json({
          success: true,
          deviceId: deviceId,
          pairingCode: existingCode.code,
          expiresAt: new Date(existingCode.expiresAt).toISOString(),
          expiresIn: Math.max(0, Math.floor((existingCode.expiresAt - Date.now()) / 1000)),
          qrCode: qrImageBuffer.toString('base64'),
          reused: true
        });
      }
      
      // Check for throttling (time-based)
      const now = Date.now();
      const lastRequestTime = pairingRequestTracker.get(normalizedDeviceId);
      
      if (lastRequestTime && (now - lastRequestTime) < PAIRING_THROTTLE_TIME) {
        const timeRemaining = Math.ceil((PAIRING_THROTTLE_TIME - (now - lastRequestTime)) / 1000);
        logger.warn(`[PAIRING] Throttling pairing request for device ${deviceId}, too frequent (${timeRemaining}s remaining)`);
        
        // Try to find device's existing pairing code
        try {
          // Look up device using findDeviceById helper
          const existingDevice = await findDeviceById(deviceId);
          
          if (existingDevice && existingDevice.pairingCode && existingDevice.pairingCode.expiresAt > new Date()) {
            logger.info(`[PAIRING] Returning existing DB pairing code for throttled request: ${existingDevice.pairingCode.code}`);
            
            // Generate QR code
            const qrcode = require('qrcode');
            const pairingData = {
              deviceId: existingDevice.deviceId,
              code: existingDevice.pairingCode.code,
              expires: existingDevice.pairingCode.expiresAt.toISOString()
            };
            
            const qrDataString = JSON.stringify(pairingData);
            const qrImageBuffer = await qrcode.toBuffer(qrDataString);
            
            // Add to active pairing codes map
            activePairingCodes.set(normalizedDeviceId, {
              code: existingDevice.pairingCode.code,
              expiresAt: existingDevice.pairingCode.expiresAt.getTime()
            });
            
            return res.status(200).json({
              success: true,
              deviceId: existingDevice.deviceId,
              pairingCode: existingDevice.pairingCode.code,
              expiresAt: existingDevice.pairingCode.expiresAt.toISOString(),
              expiresIn: Math.max(0, Math.floor((existingDevice.pairingCode.expiresAt - new Date()) / 1000)),
              qrCode: qrImageBuffer.toString('base64'),
              throttled: true
            });
          }
        } catch (err) {
          logger.warn(`[PAIRING] Error retrieving existing pairing code: ${err.message}`);
        }
        
        // If no existing code found, return throttling error
        return res.status(429).json({
          success: false,
          message: 'Too many pairing requests, please try again later',
          retryAfter: timeRemaining
        });
      }
      
      // MongoDB error handling wrapper
      const safeDbOperation = async (operation, fallbackValue = null) => {
        try {
          return await operation();
        } catch (dbError) {
          logger.error(`[PAIRING] Database operation failed: ${dbError.message}`, dbError);
          // Check for common MongoDB errors
          if (dbError.message && (
              dbError.message.includes('buffering timed out') ||
              dbError.message.includes('ENOTFOUND') ||
              dbError.message.includes('getaddrinfo')
          )) {
            logger.error(`[PAIRING] MongoDB connection error: ${dbError.message}`);
          }
          return fallbackValue;
        }
      };
      
      // Update the last request time
      pairingRequestTracker.set(normalizedDeviceId, now);
      
      logger.info(`[PAIRING] Attempting to generate code for deviceId: ${deviceId}`);
      
      // Extract token for authentication validation
      const authHeader = req.headers.authorization;
      let authToken = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7);
        logger.info(`[PAIRING] Request includes authorization token: ${authToken.substring(0, 10)}...`);
      }
      
      // Fetch all registered devices for debugging
      const allDevices = await safeDbOperation(
        async () => await Display.find({}).select('deviceId name status').lean(),
        []
      );
      
      logger.info(`[PAIRING] Current device registry (${allDevices.length} devices):`);
      
      // Create a map of deviceIds for quick lookup
      const deviceMap = new Map();
      allDevices.forEach(device => {
        deviceMap.set(device.deviceId, device);
        
        // Also map normalized and prefixed versions
        if (device.deviceId.startsWith('device-')) {
          deviceMap.set(device.deviceId.replace(/^device-/, ''), device);
        } else {
          deviceMap.set(`device-${device.deviceId}`, device);
        }
      });
      
      // Log relevant info about the requested device
      const exactMatch = deviceMap.get(deviceId);
      if (exactMatch) {
        logger.info(`[PAIRING] Found exact match for ${deviceId} in registry`);
      } else {
        logger.info(`[PAIRING] No exact match for ${deviceId} in registry`);
        
        // Look for potential matches to debug inconsistencies
        const potentialMatches = allDevices.filter(device => 
          device.deviceId.includes(deviceId.replace(/^device-/, '')) || 
          deviceId.includes(device.deviceId.replace(/^device-/, ''))
        );
        
        if (potentialMatches.length > 0) {
          logger.info(`[PAIRING] Found ${potentialMatches.length} potential matches: ${JSON.stringify(potentialMatches.map(d => d.deviceId))}`);
        }
      }
      
      // Try multiple methods to find the device
      let registeredDevice = null;
      let normalizedId = null;
      let prefixedId = null;
      
      // 1. Direct DB lookup with exact ID
      registeredDevice = await safeDbOperation(
        async () => await Display.findOne({ deviceId })
      );
      
      if (registeredDevice) {
        logger.info(`[PAIRING] Found device with exact ID: ${deviceId}`);
      }
      
      // 2. Try without "device-" prefix
      if (!registeredDevice && deviceId.startsWith('device-')) {
        normalizedId = deviceId.replace(/^device-/, '');
        logger.info(`[PAIRING] Trying normalized ID: ${normalizedId}`);
        
        registeredDevice = await safeDbOperation(
          async () => await Display.findOne({ deviceId: normalizedId })
        );
        
        if (registeredDevice) {
          logger.info(`[PAIRING] Found device with normalized ID: ${normalizedId}`);
          
          // Update the device ID to match the one in the request for consistency
          logger.info(`[PAIRING] Updating device ID from ${normalizedId} to ${deviceId}`);
          try {
            registeredDevice.deviceId = deviceId;
            await registeredDevice.save();
          } catch (saveErr) {
            logger.warn(`[PAIRING] Error updating device ID: ${saveErr.message}`);
            // Continue even if this fails
          }
        }
      }
      
      // 3. Try with "device-" prefix
      if (!registeredDevice && !deviceId.startsWith('device-')) {
        prefixedId = `device-${deviceId}`;
        logger.info(`[PAIRING] Trying prefixed ID: ${prefixedId}`);
        
        registeredDevice = await safeDbOperation(
          async () => await Display.findOne({ deviceId: prefixedId })
        );
        
        if (registeredDevice) {
          logger.info(`[PAIRING] Found device with prefixed ID: ${prefixedId}`);
        }
      }
      
      // 4. Try using displayService.getDisplayByDeviceId with error handling
      if (!registeredDevice) {
        logger.info(`[PAIRING] Trying displayService.getDisplayByDeviceId: ${deviceId}`);
        
        registeredDevice = await safeDbOperation(
          async () => await displayService.getDisplayByDeviceId(deviceId)
        );
        
        if (registeredDevice) {
          logger.info(`[PAIRING] Found device via displayService: ${registeredDevice.deviceId}`);
        } else {
          // Try normalized ID with displayService
          if (normalizedId) {
            registeredDevice = await safeDbOperation(
              async () => await displayService.getDisplayByDeviceId(normalizedId)
            );
            
            if (registeredDevice) {
              logger.info(`[PAIRING] Found device via displayService with normalized ID: ${normalizedId}`);
            }
          }
          
          // Try prefixed ID with displayService
          if (!registeredDevice && prefixedId) {
            registeredDevice = await safeDbOperation(
              async () => await displayService.getDisplayByDeviceId(prefixedId)
            );
            
            if (registeredDevice) {
              logger.info(`[PAIRING] Found device via displayService with prefixed ID: ${prefixedId}`);
            }
          }
        }
      }
      
      // 5. As a last resort, try regex search
      if (!registeredDevice) {
        try {
          const searchTerm = deviceId.replace(/^device-/, '');
          logger.info(`[PAIRING] Trying regex search for: ${searchTerm}`);
          
          const possibleMatches = await safeDbOperation(
            async () => await Display.find({
              deviceId: { $regex: searchTerm, $options: 'i' }
            }),
            []
          );
          
          if (possibleMatches.length > 0) {
            registeredDevice = possibleMatches[0];
            logger.info(`[PAIRING] Found device via regex search: ${registeredDevice.deviceId}`);
          }
        } catch (regexErr) {
          logger.warn(`[PAIRING] Regex search error: ${regexErr.message}`);
        }
      }
      
      // If we found the device
      if (registeredDevice) {
        logger.info(`[PAIRING] Found display in DB, ID: ${registeredDevice.deviceId}, status: ${registeredDevice.status || 'unknown'}`);
        
        // Use the actual device ID from the database
        const actualDeviceId = registeredDevice.deviceId;
        
        // Check if the device ID needs to be normalized for consistency
        if (actualDeviceId !== deviceId) {
          logger.info(`[PAIRING] Note: Requested deviceId (${deviceId}) different from stored (${actualDeviceId})`);
        }
        
        try {
          // Ensure the device is marked as active
          if (registeredDevice.status !== 'active') {
            logger.info(`[PAIRING] Updating device status from ${registeredDevice.status} to active`);
            registeredDevice.status = 'active';
            registeredDevice.lastSeen = new Date();
            await registeredDevice.save();
          }
          
          // Check if there's already a valid pairing code
          let existingCode = null;
          
          if (registeredDevice.pairingCode && 
              registeredDevice.pairingCode.code &&
              registeredDevice.pairingCode.expiresAt > new Date()) {
            existingCode = registeredDevice.pairingCode.code;
            logger.info(`[PAIRING] Device already has valid pairing code: ${existingCode}`);
            
            // Check if this code is also in the token store
            let codeInTokenStore = false;
            for (const [_, tokenData] of tokenStore.tokens.entries()) {
              if (tokenData.tokenType === 'pairing' && 
                  tokenData.data && 
                  tokenData.data.code === existingCode) {
                codeInTokenStore = true;
                break;
              }
            }
            
            if (!codeInTokenStore) {
              logger.info(`[PAIRING] Existing code found in DB but not in token store, adding it`);
              // Store pairing code in token store for redundancy
              tokenStore.storeToken(
                actualDeviceId,
                'pairing',
                {
                  displayId: registeredDevice._id,
                  deviceId: actualDeviceId,
                  displayName: registeredDevice.name || 'Unnamed Display',
                  code: existingCode
                },
                300 // 5 minutes
              );
            }
          }
          
          // If there's a valid existing code, use it
          if (existingCode) {
            // Generate QR code with existing data
            const pairingData = {
              deviceId: actualDeviceId,
              code: existingCode,
              expires: registeredDevice.pairingCode.expiresAt.toISOString()
            };
            
            const qrcode = require('qrcode');
            const qrDataString = JSON.stringify(pairingData);
            const qrImageBuffer = await qrcode.toBuffer(qrDataString);
            
            logger.info(`[PAIRING] ✅ Using existing pairing code: ${existingCode}`);
            
            return res.status(200).json({
              success: true,
              deviceId: actualDeviceId,
              pairingCode: existingCode,
              expiresAt: registeredDevice.pairingCode.expiresAt.toISOString(),
              expiresIn: Math.max(0, Math.floor((registeredDevice.pairingCode.expiresAt - new Date()) / 1000)),
              qrCode: qrImageBuffer.toString('base64')
            });
          }
          
          // Generate new pairing code using the pairing service
          const pairingData = await pairingService.initiatePairing(actualDeviceId);
          
          logger.info(`[PAIRING] ✅ Successfully generated pairing code: ${pairingData.pairingCode} for device ${actualDeviceId}`);
          
          return res.status(200).json({
            success: true,
            deviceId: actualDeviceId,
            pairingCode: pairingData.pairingCode,
            expiresAt: pairingData.pairingExpiry.toISOString(),
            expiresIn: 300, // 5 minutes in seconds
            qrCode: pairingData.qrCode
          });
        } catch (pairingError) {
          logger.error(`[PAIRING] ❌ Error generating pairing code: ${pairingError.message}`, pairingError);
          
          // Try fallback method using direct DB update
          try {
            logger.info(`[PAIRING] Trying fallback method for code generation`);
            
            // Generate a random 6-digit code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Set expiration (5 minutes)
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            
            // Update the device with the new pairing code
            registeredDevice.pairingCode = {
              code,
              expiresAt
            };
            
            await registeredDevice.save();
            
            // Also store in token store for redundancy
            tokenStore.storeToken(
              actualDeviceId,
              'pairing',
              {
                displayId: registeredDevice._id,
                deviceId: actualDeviceId,
                displayName: registeredDevice.name || 'Unnamed Display',
                code
              },
              300 // 5 minutes
            );
            
            // Generate QR code
            const pairingData = {
              deviceId: actualDeviceId,
              code,
              expires: expiresAt.toISOString()
            };
            
            const qrcode = require('qrcode');
            const qrDataString = JSON.stringify(pairingData);
            const qrImageBuffer = await qrcode.toBuffer(qrDataString);
            
            logger.info(`[PAIRING] ✅ Successfully generated pairing code: ${code} using fallback method`);
            
            // Store in active pairing codes map for future requests
            const normalizedDeviceId = actualDeviceId.replace(/^device-/, '');
            activePairingCodes.set(normalizedDeviceId, {
              code,
              expiresAt: expiresAt.getTime(),
              displayId: registeredDevice._id.toString()
            });
            
            return res.status(200).json({
              success: true,
              deviceId: actualDeviceId,
              pairingCode: code,
              expiresAt: expiresAt.toISOString(),
              expiresIn: 300, // 5 minutes in seconds
              qrCode: qrImageBuffer.toString('base64')
            });
          } catch (fallbackError) {
            logger.error(`[PAIRING] ❌ Fallback method failed: ${fallbackError.message}`);
            return next(new ApiError(500, `Failed to generate pairing code: ${fallbackError.message}`));
          }
        }
      } else {
        // IMPORTANT: Even though we didn't find the device, we should create one instead of returning an error
        // The TV app is registered but might not be in the database yet (race condition)
        logger.info(`[PAIRING] Device not found in database, creating new device: ${deviceId}`);
        
        try {
          // Register the device first
          const displayData = {
            deviceId,
            name: deviceInfo?.name || `Display ${deviceId.substring(0, 8)}`,
            status: 'active',
            lastHeartbeat: new Date(),
            deviceInfo: deviceInfo || {},
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Try to create device directly first
          let display = null;
          
          try {
            // Try direct DB creation
            display = new Display(displayData);
            await display.save();
            logger.info(`[PAIRING] Created display directly in database: ${display.deviceId}`);
          } catch (createErr) {
            // If duplicate key, the device was just created
            if (createErr.code === 11000) {
              logger.info(`[PAIRING] Display appears to have been created by another process`);
              
              // Try to find it one more time
              try {
                display = await Display.findOne({ deviceId });
                
                if (!display) {
                  // Try variations once more
                  if (deviceId.startsWith('device-')) {
                    display = await Display.findOne({ deviceId: deviceId.replace(/^device-/, '') });
                  } else {
                    display = await Display.findOne({ deviceId: `device-${deviceId}` });
                  }
                }
                
                if (display) {
                  logger.info(`[PAIRING] Found display after creation attempt: ${display.deviceId}`);
                }
              } catch (findErr) {
                logger.warn(`[PAIRING] Error finding newly created display: ${findErr.message}`);
              }
            } else {
              logger.error(`[PAIRING] Error creating display directly: ${createErr.message}`);
            }
          }
          
          // If direct creation failed, try service
          if (!display) {
            try {
              display = await displayService.registerDisplay(displayData);
              logger.info(`[PAIRING] Created display via displayService: ${display.deviceId}`);
            } catch (serviceErr) {
              logger.error(`[PAIRING] Error creating display via service: ${serviceErr.message}`);
              throw serviceErr;
            }
          }
          
          // Double-check that we have a valid display
          if (!display) {
            throw new Error('Failed to create or find display record after multiple attempts');
          }
          
          // Now generate the pairing code
          try {
            const pairingData = await pairingService.initiatePairing(display.deviceId);
            logger.info(`[PAIRING] ✅ Successfully generated pairing code: ${pairingData.pairingCode} for new device ${display.deviceId}`);
            
            return res.status(200).json({
              success: true,
              deviceId: display.deviceId,
              pairingCode: pairingData.pairingCode,
              expiresAt: pairingData.pairingExpiry.toISOString(),
              expiresIn: 300, // 5 minutes in seconds
              qrCode: pairingData.qrCode
            });
          } catch (pairingError) {
            // Try fallback method
            logger.warn(`[PAIRING] Pairing service error: ${pairingError.message}. Using fallback.`);
            
            // Generate a random 6-digit code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Set expiration (5 minutes)
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            
            // Update the device with the new pairing code
            display.pairingCode = {
              code,
              expiresAt
            };
            
            await display.save();
            
            // Also store in token store for redundancy
            tokenStore.storeToken(
              display.deviceId,
              'pairing',
              {
                displayId: display._id,
                deviceId: display.deviceId,
                displayName: display.name || 'Unnamed Display',
                code
              },
              300 // 5 minutes
            );
            
            // Generate QR code
            const pairingData = {
              deviceId: display.deviceId,
              code,
              expires: expiresAt.toISOString()
            };
            
            const qrcode = require('qrcode');
            const qrDataString = JSON.stringify(pairingData);
            const qrImageBuffer = await qrcode.toBuffer(qrDataString);
            
            logger.info(`[PAIRING] ✅ Successfully generated pairing code: ${code} using fallback method`);
            
            // Store in active pairing codes map for future requests
            const normalizedDeviceId = display.deviceId.replace(/^device-/, '');
            activePairingCodes.set(normalizedDeviceId, {
              code,
              expiresAt: expiresAt.getTime(),
              displayId: display._id.toString()
            });
            
            return res.status(200).json({
              success: true,
              deviceId: display.deviceId,
              pairingCode: code,
              expiresAt: expiresAt.toISOString(),
              expiresIn: 300, // 5 minutes in seconds
              qrCode: qrImageBuffer.toString('base64')
            });
          }
        } catch (error) {
          logger.error(`[PAIRING] ❌ Device creation & pairing failed: ${error.message}`);
          return next(new ApiError(500, `Failed to create device and generate pairing code: ${error.message}`));
        }
      }
    } finally {
      // Release the processing lock
      setTimeout(() => {
        pairingRequestTracker.delete(isProcessingKey);
        logger.debug(`[PAIRING] Released processing lock for ${deviceId}`);
      }, 2000); // Keep lock for 2 seconds to prevent rapid concurrent requests
    }
  } catch (error) {
    logger.error(`[PAIRING] ❌ Error in generatePairingCode: ${error.message}`, error);
    
    // Fix the HTTP status code issue - never use error.message as status code
    return res.status(500).json({
      success: false,
      message: 'Failed to generate pairing code',
      details: error.message
    });
  }
};

/**
 * @desc    Validate a pairing code and pair a device to a user
 * @route   POST /api/devices/validate-pairing
 * @access  Private (requires user authentication)
 */
const validatePairingCode = async (req, res, next) => {
  logger.info('🔍 [PAIRING] Validating pairing code request received');
  
  try {
    const { pairingCode } = req.body;
    const userId = req.user.id; // From auth middleware
    
    if (!pairingCode) {
      logger.warn('[PAIRING] Missing pairingCode in request');
      return next(new ApiError(400, 'Pairing code is required'));
    }
    
    logger.info(`[PAIRING] Validating pairing code: ${pairingCode} for user: ${userId}`);
    
    // Find device with this pairing code
    let foundDeviceId = null;
    let displayId = null;
    let tokenData = null;
    
    // 1. First search in token store (faster)
    for (const [storeKey, data] of tokenStore.tokens.entries()) {
      if (data.tokenType === 'pairing' && 
          data.data && 
          data.data.pairingCode === pairingCode) {
        foundDeviceId = storeKey;
        displayId = data.data.displayId;
        tokenData = data;
        logger.info(`[PAIRING] Found matching pairing code in token store for device: ${foundDeviceId}`);
        break;
      }
    }
    
    // 2. If not found in token store, search in database
    if (!foundDeviceId) {
      logger.info('[PAIRING] Pairing code not found in token store, searching database...');
      const display = await Display.findOne({ 
        'pairingCode.code': pairingCode,
        'pairingCode.expiresAt': { $gt: new Date() }
      });
      
      if (display) {
        foundDeviceId = display.deviceId;
        displayId = display._id;
        logger.info(`[PAIRING] Found matching pairing code in database for device: ${foundDeviceId}`);
      } else {
        logger.warn('[PAIRING] No device found with the provided pairing code');
        return next(new ApiError(400, 'Invalid or expired pairing code'));
      }
    }
    
    if (!foundDeviceId) {
      logger.warn('[PAIRING] No device found with the provided pairing code');
      return next(new ApiError(400, 'Invalid or expired pairing code'));
    }
    
    // Find the display object
    const display = await Display.findOne({ 
      $or: [
        { _id: displayId },
        { deviceId: foundDeviceId }
      ]
    });
    
    if (!display) {
      logger.error(`[PAIRING] Display not found with deviceId: ${foundDeviceId} or displayId: ${displayId}`);
      return next(new ApiError(500, 'Device found in pairing records but not in display database'));
    }
    
    // Update display with user association
    display.user = userId;
    display.status = 'active';
    display.lastUpdated = new Date();
    await display.save();
    
    logger.info(`[PAIRING] ✅ Device ${foundDeviceId} paired successfully with user ${userId}`);
    
    // Remove the pairing code from token store to prevent reuse
    if (tokenData) {
      tokenStore.removeToken(foundDeviceId, 'pairing');
    }
    
    // Clear the pairing code from the display
    display.pairingCode = undefined;
    await display.save();
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Device paired successfully',
      deviceId: foundDeviceId,
      device: {
        id: display._id,
        deviceId: display.deviceId,
        name: display.name,
        status: display.status,
        createdAt: display.createdAt,
        updatedAt: display.updatedAt
      }
    });
  } catch (error) {
    logger.error(`[PAIRING] Error in validatePairingCode: ${error.message}`, error);
    return next(new ApiError(500, `Failed to validate pairing code: ${error.message}`));
  }
};

/**
 * @desc    Get device status
 * @route   GET /api/devices/:deviceId/status
 * @access  Public
 */
const getDeviceStatus = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return next(new ApiError(400, 'Device ID is required'));
    }
    
    const status = await displayService.getDisplayStatus(deviceId);
    
    return res.status(200).json({
      success: true,
      deviceId,
      status
    });
  } catch (error) {
    return next(new ApiError(500, `Failed to get device status: ${error.message}`));
  }
};

/**
 * Find a device by its ID
 * Helper method used by route handlers
 * 
 * @param {string} deviceId - The device ID to find
 * @returns {Promise<Object|null>} The device document or null if not found
 */
const findDeviceById = async (deviceId) => {
  if (!deviceId) {
    throw new Error('Device ID is required');
  }
  
  try {
    // First, try direct lookup with the provided ID
    let device = await Display.findOne({ deviceId });
    
    // If not found, try without the "device-" prefix
    if (!device && deviceId.startsWith('device-')) {
      const normalizedId = deviceId.replace(/^device-/, '');
      device = await Display.findOne({ deviceId: normalizedId });
    }
    
    // If still not found, try with the "device-" prefix
    if (!device && !deviceId.startsWith('device-')) {
      const prefixedId = `device-${deviceId}`;
      device = await Display.findOne({ deviceId: prefixedId });
    }
    
    // As a last resort, try a regex search
    if (!device) {
      const searchTerm = deviceId.replace(/^device-/, '');
      const possibleMatches = await Display.find({
        deviceId: { $regex: searchTerm, $options: 'i' }
      });
      if (possibleMatches.length > 0) {
        device = possibleMatches[0];
      }
    }
    
    return device;
  } catch (error) {
    throw new Error(`Error finding device: ${error.message}`);
  }
};

// Get multiple devices by their IDs
const findMultipleDevicesByIds = async (deviceIds) => {
  return await Display.find({ deviceId: { $in: deviceIds } });
};

/**
 * @desc    Verify if a device is registered with the server
 * @route   POST /api/devices/verify-registration
 * @access  Public
 */
const verifyDeviceRegistration = async (req, res, next) => {
  const { deviceId } = req.body;
  
  logger.info(`🔍 Verifying device registration for device ID: ${deviceId}`);
  
  if (!deviceId) {
    logger.warn('Missing deviceId in verification request');
    return res.status(400).json({
        success: false,
      isRegistered: false,
      message: 'Device ID is required'
    });
  }
  
  try {
    // Look up the device in the database
    const device = await Display.findOne({ deviceId });
    
    if (!device) {
      logger.info(`Device ${deviceId} not found in database`);
      return res.status(200).json({
        success: true,
        isRegistered: false,
        message: 'Device not registered'
      });
    }
    
    logger.info(`Device ${deviceId} found in database, status: ${device.status}`);
    
    // Return registration status
    return res.status(200).json({
      success: true,
      isRegistered: true,
      deviceInfo: {
        name: device.name,
        status: device.status,
        lastSeen: device.lastSeen
      },
      message: 'Device is registered'
    });
  } catch (error) {
    logger.error(`Error verifying device registration: ${error.message}`);
    return next(new ApiError(500, `Failed to verify device registration: ${error.message}`));
  }
};

// Export controller functions
module.exports = {
  registerDevice,
  validateDeviceToken,
  generatePairingCode,
  validatePairingCode,
  getDeviceStatus,
  findDeviceById,
  findMultipleDevicesByIds,
  verifyDeviceRegistration
}; 