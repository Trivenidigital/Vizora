const { v4: uuidv4 } = require('uuid');

/**
 * Generate a pairing code for a device
 */
const generatePairingCode = (req, res) => {
  console.log('[PAIRING] Generating pairing code for device:', req.body.deviceId);
  
  const { deviceId } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({
      success: false,
      message: 'Device ID is required',
      statusCode: 400
    });
  }
  
  // Generate a random 6-digit pairing code
  const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Log response headers before sending
  console.log('[PAIRING] Response headers:', res.getHeaders());
  
  res.json({
    success: true,
    message: 'Pairing code generated successfully',
    pairingCode,
    deviceId,
    expiresIn: 600 // 10 minutes in seconds
  });
};

/**
 * Register a new device
 */
const registerDevice = (req, res) => {
  console.log('[DEVICE] Registering device:', req.body);
  
  const { deviceId, deviceInfo } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({
      success: false,
      message: 'Device ID is required',
      statusCode: 400
    });
  }
  
  // Generate a token for the device
  const token = uuidv4();
  
  res.json({
    success: true,
    message: 'Device registered successfully',
    deviceId,
    token,
    deviceInfo
  });
};

/**
 * Validate a device token
 */
const validateDeviceToken = (req, res) => {
  console.log('[DEVICE] Validating token');
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(200).json({
      success: false,
      isValid: false,
      message: 'No token provided or invalid format'
    });
  }
  
  const token = authHeader.substring(7);
  
  // For testing, accept any token
  res.json({
    success: true,
    isValid: true,
    message: 'Token is valid'
  });
};

/**
 * Get device status
 */
const getDeviceStatus = (req, res) => {
  const { deviceId } = req.params;
  console.log('[DEVICE] Getting status for:', deviceId);
  
  res.json({
    success: true,
    deviceId,
    status: 'active',
    lastSeen: new Date().toISOString()
  });
};

module.exports = {
  generatePairingCode,
  registerDevice,
  validateDeviceToken,
  getDeviceStatus
}; 