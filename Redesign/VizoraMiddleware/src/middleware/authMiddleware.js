/**
 * Authentication Middleware
 * Handles route protection and user authorization
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { User, Display } = require('../models');
const { ApiError } = require('./errorMiddleware');

// JWT settings
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Extracts token from authorization header
 * @param {string} authHeader - Authorization header
 * @returns {string|null} - The extracted token or null
 */
const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

/**
 * Verifies a JWT token and returns decoded data
 * @param {string} token - JWT token to verify
 * @returns {object} - Decoded token data
 * @throws {Error} - If token is invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.error(`Token verification failed: ${error.message}`, {
      error: error.stack,
      tokenPrefix: token ? `${token.substring(0, 10)}...` : 'undefined'
    });
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

/**
 * Enhanced middleware to protect routes from unauthorized access
 * Checks for tokens in both cookies and Authorization header
 * Attaches user to req.user if authenticated
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
const protect = async (req, res, next) => {
  try {
    // Extract token from cookies or Authorization header
    let token = null;
    
    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('[AUTH] Token extracted from Authorization header');
    } 
    // Check cookies next
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('[AUTH] Token extracted from cookies');
    }
    
    if (!token) {
      console.log('[AUTH] No token found in request for protected route:', req.originalUrl);
      return res.status(401).json({
        success: false,
        message: 'Not authenticated - no token provided'
      });
    }
    
    // Log token debugging info (not the full token)
    console.log('[AUTH] Token debug for route:', req.originalUrl, {
      prefix: token.substring(0, 10) + '...',
      length: token.length
    });
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('[AUTH] Token successfully verified for route:', req.originalUrl, { 
        userId: decoded.id,
        type: decoded.type || 'user' 
      });
    } catch (err) {
      console.error('[AUTH] Token verification failed:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Not authenticated - invalid token'
      });
    }
    
    // Check if it's a user token
    if (decoded.type === 'user' || !decoded.type) {
      // Find user by ID
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        console.log('[AUTH] User not found:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'Not authenticated - user not found'
        });
      }
      
      // Log user object (for debugging)
      console.log('[AUTH] User authenticated successfully:', {
        id: user._id,
        email: user.email,
        role: user.role
      });
      
      req.user = user;
      next();
    } 
    // Check if it's a device token
    else if (decoded.type === 'device') {
      // Find display by ID or deviceId
      const display = await Display.findOne({
        $or: [
          { _id: decoded.id },
          { deviceId: decoded.deviceId }
        ]
      });
      
      if (!display) {
        console.log('[AUTH] Device not found:', decoded.deviceId);
        return res.status(401).json({
          success: false,
          message: 'Not authenticated - device not found'
        });
      }
      
      console.log('[AUTH] Device authenticated successfully:', {
        id: display._id,
        deviceId: display.deviceId
      });
      
      req.device = display;
      req.deviceId = display.deviceId;
      next();
    } else {
      console.log('[AUTH] Invalid token type:', decoded.type);
      return res.status(401).json({
        success: false,
        message: 'Not authenticated - invalid token type'
      });
    }
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Not authenticated - ' + error.message
    });
  }
};

/**
 * Middleware to restrict access to admin users
 * Must be used after protect middleware
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return next(new ApiError('Not authorized as an admin', 403));
  }
};

/**
 * Validates a token without requiring database lookup
 * Used for lightweight token validation
 * @param {string} token - JWT token to validate
 * @returns {object} - { isValid: boolean, decoded?: object, message?: string }
 */
const validateToken = (token) => {
  try {
    if (!token) {
      return { isValid: false, message: 'No token provided' };
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    return { isValid: true, decoded, message: 'Token is valid' };
  } catch (error) {
    logger.error(`Token validation failed: ${error.message}`, {
      error: error.stack,
      tokenPrefix: token ? `${token.substring(0, 10)}...` : 'undefined'
    });
    return { isValid: false, message: `Invalid token: ${error.message}` };
  }
};

/**
 * Socket authentication middleware
 * @param {Socket} socket - Socket.io socket
 * @param {Function} next - Socket.io next function 
 */
const socketAuth = async (socket, next) => {
  try {
    // Extract token from socket handshake auth
    let token = socket.handshake.auth?.token;
    
    // Debug log the token info (truncated for security)
    logger.info(`Socket authentication attempt [${socket.id}] with token: ${token ? token.substring(0, 10) + '...' : 'undefined'}`);
    logger.debug(`Socket handshake info:`, {
      headers: socket.handshake.headers ? 'present' : 'missing',
      query: socket.handshake.query,
      auth: socket.handshake.auth ? { present: true } : 'missing'
    });
    
    // Try to extract token from query parameters if not in auth
    if (!token && socket.handshake.query?.token) {
      token = socket.handshake.query.token;
      logger.info(`Found token in query parameters for socket [${socket.id}]`);
    }

    // Try to extract token from cookies if not in auth or query
    if (!token && socket.handshake.headers?.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').map(c => c.trim());
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      if (tokenCookie) {
        token = tokenCookie.substring(6); // 'token='.length
        logger.info(`Found token in cookies for socket [${socket.id}]`);
      }
    }
    
    // No token provided from any source
    if (!token) {
      logger.warn(`Socket connection rejected [${socket.id}]: No token provided`);
      return next(new Error('Authentication token required'));
    }
    
    // Allow dev mode connections if configured
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && token === 'dev-mode') {
      logger.info(`Development mode: Allowing connection with dev-mode token [${socket.id}]`);
      socket.user = { id: 'dev-user', role: 'admin' };
      socket.deviceId = socket.handshake.query.deviceId || 'dev-device';
      socket.authenticated = true;
      return next();
    }
    
    // First try to validate with TokenStore (more reliable/newer approach)
    try {
      const tokenStore = require('../services/tokenStoreService');
      
      // Check if token exists in token store
      for (const [storeKey, storedToken] of tokenStore.tokens.entries()) {
        if (storedToken.tokenType === 'auth' && storedToken.token === token) {
          // Check expiry with some grace period (10 minutes)
          const gracePeriod = 10 * 60 * 1000; // 10 minutes in milliseconds
          if (storedToken.expiresAt < (Date.now() - gracePeriod)) {
            logger.warn(`Socket connection [${socket.id}]: TokenStore token expired, but proceeding with warning`);
            // Continue without returning
          } else {
            logger.info(`TokenStore authentication successful for socket [${socket.id}]`);
            
            // Setup socket with user or device data
            if (storedToken.data.userId) {
              socket.userId = storedToken.data.userId;
              socket.user = { id: storedToken.data.userId };
            }
            
            if (storedToken.data.deviceId) {
              socket.deviceId = storedToken.data.deviceId;
              socket.deviceType = 'display';
            }
            
            socket.authenticated = true;
            return next();
          }
        }
      }
    } catch (error) {
      logger.error(`TokenStore validation error for socket [${socket.id}]:`, error);
      // Continue to JWT validation
    }
    
    // Fallback to JWT validation if TokenStore validation fails
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      logger.info(`JWT authentication successful for socket [${socket.id}]`);
      
      // Handle user tokens
      if (!decoded.type || decoded.type === 'user') {
        // Check if user exists
        try {
          const user = await User.findById(decoded.id);
          if (user) {
            socket.user = user;
            socket.userId = decoded.id;
            socket.authenticated = true;
            
            // Join user-specific room for targeted messages
            socket.join(`user:${decoded.id}`);
            
            // Join admin room if user is admin
            if (user.role === 'admin') {
              socket.join('admin');
            }
            
            logger.info(`User socket joined: ${decoded.id}`);
            return next();
          } else {
            logger.warn(`JWT token has valid user ID but user not found: ${decoded.id}`);
            // We'll still allow the connection for backward compatibility
            socket.userId = decoded.id;
            socket.authenticated = true;
            return next();
          }
        } catch (error) {
          logger.error(`Error finding user for socket [${socket.id}]:`, error);
          // Still allow connection, but without user object
          socket.userId = decoded.id;
          socket.authenticated = true;
          return next();
        }
      }
      // Handle device tokens
      else if (decoded.type === 'device') {
        socket.deviceId = decoded.deviceId || decoded.id;
        socket.deviceType = 'display';
        socket.authenticated = true;
        
        // Join device-specific room for targeted messages
        socket.join(`display:${socket.deviceId}`);
        socket.join('displays');
        
        logger.info(`Device socket joined: ${socket.deviceId}`);
        return next();
      }
    } catch (error) {
      // JWT validation failed
      logger.error(`JWT verification failed for socket [${socket.id}]:`, {
        error: error.message,
        tokenPrefix: token.substring(0, 10) + '...'
      });
      
      // In development mode, allow connection even with invalid token
      if (isDev) {
        logger.warn(`Development mode: Allowing connection with invalid token [${socket.id}]`);
        socket.authenticated = false;
        socket.deviceId = 'unknown-device';
        return next();
      }
      
      return next(new Error('Authentication token invalid or expired'));
    }
  } catch (error) {
    // Unexpected error in authentication middleware
    logger.error(`Socket auth middleware error [${socket.id}]:`, {
      error: error.message,
      stack: error.stack
    });
    
    return next(new Error('Authentication error: ' + error.message));
  }
};

/**
 * Generate JWT token for user or device
 * @param {Object} payload - Data to include in token
 * @param {string} expiresIn - Token expiration time
 * @returns {string} - Generated JWT token
 */
const generateToken = (payload, expiresIn = '30d') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

module.exports = {
  protect,
  admin,
  validateToken,
  socketAuth,
  generateToken,
  extractToken,
  verifyToken
}; 