/**
 * Direct Authentication Routes (CommonJS)
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

// JWT settings
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test route to verify router is mounted
router.get('/test', (req, res) => {
  console.log('[AUTH] Test route hit');
  return res.status(200).json({
    success: true,
    message: 'Auth router mounted successfully'
  });
});

/**
 * @route   GET /me
 * @desc    Get current user information
 * @access  Private
 */
router.get('/me', async (req, res) => {
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
      console.log('[AUTH] No token found in request');
      return res.status(401).json({
        success: false,
        message: 'Not authenticated - no token provided'
      });
    }
    
    // Log token debugging info (not the full token)
    console.log('[AUTH] Token debug:', {
      prefix: token.substring(0, 10) + '...',
      length: token.length
    });
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('[AUTH] Token successfully verified:', { userId: decoded.id });
    } catch (err) {
      console.error('[AUTH] Token verification failed:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Not authenticated - invalid token'
      });
    }
    
    // Find user by ID from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('[AUTH] User not found:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('[AUTH] /me endpoint accessed by user ID:', user._id);
    
    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('[AUTH] Error in /me endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user data',
      error: error.message
    });
  }
});

/**
 * @route   POST /login
 * @desc    Login user and return JWT token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    console.log('[AUTH] Login attempt:', { email });
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log(`[AUTH] User not found: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log(`[AUTH] Invalid password for user: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = user.generateAuthToken();
    
    // Set cookie with proper settings
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Secure in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    console.log(`[AUTH] Login successful for user: ${email}`);
    console.log(`[AUTH] Cookie set with token:`, {
      tokenPrefix: token.substring(0, 10) + '...',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    return res.status(200).json({
      success: true,
      token, // Also include token in the response body for clients that prefer token in headers
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
});

// Add demo token route for socket diagnostics
router.get('/demo-token', (req, res) => {
  try {
    // Generate a demo token with 1 hour expiry
    const payload = {
      id: 'demo-user-' + Date.now(),
      type: 'user',
      role: 'demo'
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'vizora-socket-diagnostic-secret', { expiresIn: '1h' });
    
    return res.json({
      success: true,
      token,
      message: 'Demo token generated for testing purposes only'
    });
  } catch (error) {
    console.error('Failed to generate demo token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate demo token: ' + error.message
    });
  }
});

module.exports = router; 