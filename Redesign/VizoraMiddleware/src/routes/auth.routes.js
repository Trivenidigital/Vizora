/**
 * Authentication Routes
 * Routes for user authentication and authorization
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// ADD DEBUG LOG HERE
console.log('[DEBUG] auth.routes.js file loaded, setting up router...');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new business user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  // ADD DEBUG LOG HERE
  console.log('[DEBUG] POST /register route handler reached'); 
  try {
    console.log('Register request body:', req.body);
    
    // Expect businessName, email, password
    const { businessName, email, password } = req.body;
    
    // Updated validation
    if (!email || !password || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: email, password, businessName'
      });
    }
    
    // Check if user exists by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create user with businessName
    const user = new User({
      email,
      password, // Hashed in pre-save hook
      businessName, // Use businessName
      role: 'business_user', // Assign a role, e.g., 'business_user'
      isActive: true,
      // Removed firstName, lastName, company
    });
    
    console.log('User object to save:', {
      email: user.email,
      businessName: user.businessName,
      role: user.role
    });
    
    await user.save();
    
    console.log(`New business user registered: ${email}`);
    
    // Updated success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        email: user.email,
        businessName: user.businessName,
        role: user.role
        // Removed firstName, lastName, company
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