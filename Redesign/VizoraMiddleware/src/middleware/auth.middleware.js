const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Config
const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';

/**
 * Authentication middleware to protect routes
 * Verifies the JWT token and adds the user to the request object
 */
exports.protect = async (req, res, next) => {
  try {
    // Special handling for logout endpoint - always allow access even without valid token
    const isLogoutEndpoint = req.path.endsWith('/logout') && req.method === 'POST';
    
    let token;
    
    // Check if token exists in the Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Get token from header (Bearer token)
      token = req.headers.authorization.split(' ')[1];
    } 
    
    // If no token provided
    if (!token) {
      // For logout endpoint, allow request to continue without token
      if (isLogoutEndpoint) {
        console.log('No token provided for logout endpoint, allowing request to continue');
        return next();
      }
      
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route, no token provided',
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Find user by id from token
      const user = await User.findById(decoded.id);
      
      // Check if user still exists
      if (!user) {
        // For logout endpoint, allow request to continue even if user not found
        if (isLogoutEndpoint) {
          console.log('Token refers to deleted user, but allowing logout to proceed');
          return next();
        }
        
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists',
        });
      }
      
      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      // If token is invalid but request is to logout endpoint, allow it through
      if (isLogoutEndpoint) {
        console.log('Invalid token for logout endpoint, allowing request to continue');
        return next();
      }
      
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route, invalid token',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // For logout, still allow request to proceed even on middleware error
    if (req.path.endsWith('/logout') && req.method === 'POST') {
      console.log('Auth middleware error on logout endpoint, allowing request to continue');
      return next();
    }
    
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};

/**
 * Restrict routes to specific user roles
 * @param {Array} roles - Array of roles allowed to access the route
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
}; 