/**
 * Authentication Routes
 * Routes for user authentication and authorization
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    console.log('Register request body:', req.body);
    
    const { email, password, firstName, lastName, company } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: email, password, firstName, lastName'
      });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create user
    const user = new User({
      email,
      password, // will be hashed in the model's pre-save hook
      firstName,
      lastName,
      company: company || '',
      role: 'user',
      isActive: true
    });
    
    console.log('User object to save:', {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company
    });
    
    await user.save();
    
    console.log(`New user registered: ${email}`);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/login
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
    
    console.log('Login attempt:', { email, passwordLength: password ? password.length : 0 });
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log(`User not found: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('User found:', { 
      id: user._id,
      email: user.email,
      hashedPasswordLength: user.password ? user.password.length : 0
    });
    
    // Check if account is active
    if (user.isActive === false) {
      console.log(`Account disabled: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Account is disabled. Please contact support.'
      });
    }
    
    // Verify password
    const isMatch = await user.matchPassword(password);
    console.log('Password comparison result:', isMatch);
    
    if (!isMatch) {
      console.log(`Invalid password for user: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Generate JWT token
    const token = user.generateAuthToken();
    
    console.log(`JWT token generated for user: ${email}`);
    
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user information',
      error: error.message
    });
  }
});

// Add a test route
router.get('/test', (req, res) => {
  console.log('[AUTH] Test route hit');
  return res.status(200).json({
    success: true,
    message: 'Auth router mounted successfully'
  });
});

// Export the router
module.exports = router; 