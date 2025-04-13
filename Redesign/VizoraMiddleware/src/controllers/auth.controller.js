const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { ApiError } = require('../middleware/errorMiddleware');

// Import memory logger utility
const memoryLogger = require('../utils/memoryLogger');

// Config
const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Authentication Controller
 * Handles user authentication, registration, and profile management
 */

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (userExists) {
      if (userExists.email === email) {
        return next(ApiError.badRequest('Email already in use'));
      } else {
        return next(ApiError.badRequest('Username already in use'));
      }
    }
    
    // Create user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      emailVerified: false
    });
    
    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    
    // Generate auth token
    const token = user.generateAuthToken();
    
    // Generate refresh token
    const refreshToken = user.generateRefreshToken(
      req.ip,
      req.headers['user-agent']
    );
    
    await user.save();
    
    // Return user info
    res.status(201).json({
      success: true,
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res, next) => {
  try {
    console.log('Login attempt received:', {
      body: req.body,
      headers: {
        contentType: req.headers['content-type'],
        authorization: req.headers['authorization'] ? 'Present' : 'Not present'
      }
    });
    
    // Log initial memory state before login process
    memoryLogger.logMemoryUsage('Login - Start', { 
      endpoint: '/api/auth/login', 
      method: 'POST' 
    });
    
    const { email, password } = req.body;
    
    // Check for required fields
    if (!email || !password) {
      console.log('Missing required fields:', { 
        emailProvided: !!email, 
        passwordProvided: !!password 
      });
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    console.log(`Attempting to find user with email: ${email}`);
    
    // Log memory before DB query
    const memoryBeforeDBQuery = memoryLogger.getMemoryUsage();
    console.log('Memory before user lookup:', memoryBeforeDBQuery.formatted.heapUsed);
    
    // Find user
    let user;
    try {
      user = await User.findOne({ email }).select('+password');
      console.log('User query result:', user ? 'User found' : 'User not found');
      
      // Log memory after DB query
      const memoryAfterDBQuery = memoryLogger.getMemoryUsage();
      const memoryDiff = memoryLogger.getMemoryDiff(memoryBeforeDBQuery, memoryAfterDBQuery);
      console.log('Memory after user lookup:', memoryAfterDBQuery.formatted.heapUsed);
      console.log('Memory change during user lookup:', memoryDiff.formatted.heapUsed);
      
    } catch (dbError) {
      console.error('Database error when finding user:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error when finding user',
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
    
    // Check if user exists
    if (!user) {
      console.log(`User not found with email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('Found user:', {
      id: user._id,
      email: user.email,
      role: user.role,
      passwordLength: user.password ? user.password.length : 0
    });
    
    // Check if account is locked
    if (user.accountLocked && user.accountLockedUntil > new Date()) {
      console.log(`Account locked for user: ${email} until ${user.accountLockedUntil}`);
      return res.status(403).json({
        success: false,
        message: `Account is locked. Try again after ${user.accountLockedUntil.toLocaleString()}`
      });
    }
    
    // Log memory before password comparison
    const memoryBeforePwdCompare = memoryLogger.getMemoryUsage();
    console.log('Memory before password comparison:', memoryBeforePwdCompare.formatted.heapUsed);
    
    // Check if password matches
    let isMatch = false;
    try {
      console.log('Attempting to match password...');
      if (typeof user.matchPassword === 'function') {
        isMatch = await user.matchPassword(password);
      } else if (typeof user.comparePassword === 'function') {
        isMatch = await user.comparePassword(password);
      } else {
        console.error('No password comparison method available on user model');
        return res.status(500).json({
          success: false,
          message: 'Server configuration error'
        });
      }
      console.log('Password match result:', isMatch);
      
      // Log memory after password comparison
      const memoryAfterPwdCompare = memoryLogger.getMemoryUsage();
      const memoryDiff = memoryLogger.getMemoryDiff(memoryBeforePwdCompare, memoryAfterPwdCompare);
      console.log('Memory after password comparison:', memoryAfterPwdCompare.formatted.heapUsed);
      console.log('Memory change during password comparison:', memoryDiff.formatted.heapUsed);
      
    } catch (passwordError) {
      console.error('Error when comparing passwords:', passwordError);
      return res.status(500).json({
        success: false,
        message: 'Error when validating password',
        error: process.env.NODE_ENV === 'development' ? passwordError.message : undefined
      });
    }
    
    if (!isMatch) {
      // Record failed login attempt
      console.log(`Failed login attempt for user: ${email}`);
      try {
        await user.recordFailedLogin();
      } catch (recordError) {
        console.error('Error recording failed login:', recordError);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Log memory before token generation
    const memoryBeforeToken = memoryLogger.getMemoryUsage();
    console.log('Memory before token generation:', memoryBeforeToken.formatted.heapUsed);
    
    // Record successful login
    try {
      if (typeof user.recordLogin === 'function') {
        await user.recordLogin(req.ip, req.headers['user-agent']);
      }
    } catch (recordError) {
      console.error('Error recording successful login:', recordError);
      // Continue despite error
    }
    
    // Generate JWT token
    let token;
    try {
      console.log('Generating authentication token...');
      token = typeof user.generateAuthToken === 'function' 
        ? user.generateAuthToken()
        : generateToken(user._id);
      console.log('Token generated successfully');
    } catch (tokenError) {
      console.error('Error generating token:', tokenError);
      return res.status(500).json({
        success: false,
        message: 'Error generating authentication token',
        error: process.env.NODE_ENV === 'development' ? tokenError.message : undefined
      });
    }
    
    // Generate refresh token
    let refreshToken;
    try {
      if (typeof user.generateRefreshToken === 'function') {
        console.log('Generating refresh token...');
        refreshToken = user.generateRefreshToken(
          req.ip, 
          req.headers['user-agent']
        );
        console.log('Refresh token generated successfully');
      }
    } catch (refreshTokenError) {
      console.error('Error generating refresh token:', refreshTokenError);
      // Continue despite error - refresh token is optional
    }
    
    // Log memory before user save
    const memoryBeforeSave = memoryLogger.getMemoryUsage();
    console.log('Memory before user save:', memoryBeforeSave.formatted.heapUsed);
    
    try {
      await user.save();
      console.log('User saved after login');
      
      // Log memory after user save
      const memoryAfterSave = memoryLogger.getMemoryUsage();
      const memoryDiff = memoryLogger.getMemoryDiff(memoryBeforeSave, memoryAfterSave);
      console.log('Memory after user save:', memoryAfterSave.formatted.heapUsed);
      console.log('Memory change during user save:', memoryDiff.formatted.heapUsed);
      
    } catch (saveError) {
      console.error('Error saving user after login:', saveError);
      // Continue despite error
    }
    
    console.log('Login successful for user:', email);
    
    // Log final memory state after login completion
    memoryLogger.logMemoryUsage('Login - Complete', { 
      endpoint: '/api/auth/login', 
      userId: user._id.toString(),
      success: true
    });
    
    // Return user info
    return res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Unexpected error in login process:', error);
    
    // Log memory on error
    memoryLogger.logMemoryUsage('Login - Error', { 
      endpoint: '/api/auth/login', 
      error: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logoutUser = async (req, res, next) => {
  try {
    // Check if user object exists in request (it might not if token has expired)
    if (!req.user) {
      console.log('Logout requested without valid user session');
      return res.status(200).json({
        success: true,
        message: 'Session already ended'
      });
    }
    
    // Try to get refresh token from body, but it's optional
    const { refreshToken } = req.body;
    
    // If refresh token is provided, try to remove it
    if (refreshToken) {
      try {
        await req.user.removeRefreshToken(refreshToken);
        console.log(`Removed refresh token for user: ${req.user.id}`);
      } catch (tokenError) {
        console.warn('Error removing refresh token, continuing logout process:', tokenError.message);
        // Don't return error, continue with logout
      }
    } else {
      console.log('No refresh token provided, clearing all user sessions');
      // If no specific refresh token, clear all of them for security
      try {
        if (req.user.clearAllRefreshTokens) {
          await req.user.clearAllRefreshTokens();
          console.log(`Cleared all refresh tokens for user: ${req.user.id}`);
        } else if (req.user.refreshTokens) {
          req.user.refreshTokens = [];
          await req.user.save();
          console.log(`Cleared all refresh tokens for user: ${req.user.id}`);
        }
      } catch (clearError) {
        console.warn('Error clearing refresh tokens, continuing logout process:', clearError.message);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error during logout process:', error);
    // Still return success to client even if there was a server error
    res.status(200).json({
      success: true,
      message: 'Logout processed'
    });
  }
};

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(ApiError.badRequest('Refresh token is required'));
    }
    
    // Find user with this refresh token
    const user = await User.findOne({
      'refreshTokens.token': refreshToken
    });
    
    if (!user) {
      return next(ApiError.unauthorized('Invalid refresh token'));
    }
    
    // Check if token is valid
    const tokenData = user.refreshTokens.find(t => t.token === refreshToken);
    
    if (!tokenData) {
      return next(ApiError.unauthorized('Invalid refresh token'));
    }
    
    // Check if token is expired
    if (tokenData.expiresAt < new Date()) {
      // Remove expired token
      await user.removeRefreshToken(refreshToken);
      return next(ApiError.unauthorized('Refresh token expired'));
    }
    
    // Update last used
    tokenData.lastUsed = new Date();
    await user.save();
    
    // Generate new access token
    const newAccessToken = user.generateAuthToken();
    
    res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, preferences } = req.body;
    
    // Find user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }
    
    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences
      };
    }
    
    // Save changes
    await user.save();
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   POST /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return next(ApiError.badRequest('Current password and new password are required'));
    }
    
    // Find user
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }
    
    // Check if current password is correct
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      return next(ApiError.badRequest('Current password is incorrect'));
    }
    
    // Update password
    user.password = newPassword;
    
    // Invalidate all refresh tokens
    user.refreshTokens = [];
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(ApiError.badRequest('Email is required'));
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal that email doesn't exist for security
      return res.status(200).json({
        success: true,
        message: 'Password reset link has been sent to your email'
      });
    }
    
    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    // In a real application, send email with reset link
    // For now, just return the token in the response
    
    res.status(200).json({
      success: true,
      message: 'Password reset link has been sent to your email',
      resetToken // Remove this in production
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    
    if (!resetToken || !newPassword) {
      return next(ApiError.badRequest('Reset token and new password are required'));
    }
    
    // Find user with this reset token
    const user = await User.findOne({
      passwordResetToken: resetToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return next(ApiError.badRequest('Invalid or expired reset token'));
    }
    
    // Reset password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Invalidate all refresh tokens
    user.refreshTokens = [];
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify email
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { verificationToken } = req.body;
    
    if (!verificationToken) {
      return next(ApiError.badRequest('Verification token is required'));
    }
    
    // Find user with this verification token
    const user = await User.findOne({
      emailVerificationToken: verificationToken,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return next(ApiError.badRequest('Invalid or expired verification token'));
    }
    
    // Verify email
    await user.verifyEmail();
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }
    
    if (user.emailVerified) {
      return next(ApiError.badRequest('Email is already verified'));
    }
    
    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    
    // In a real application, send email with verification link
    // For now, just return the token in the response
    
    res.status(200).json({
      success: true,
      message: 'Verification email has been sent',
      verificationToken // Remove this in production
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
}; 