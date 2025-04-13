/**
 * API Routes
 * Central router for all API endpoints
 */

// Import required modules
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { protect, admin } = require('../middleware/authMiddleware');
const { requireMongoDBConnection } = require('../middleware/dbMiddleware');
const User = require('../models/User');

// JWT settings
const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRATION || '7d';

// Health check endpoints
/**
 * @route   GET /health
 * @desc    Basic API health check
 * @access  Public
 */
router.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /health/db
 * @desc    Directly check MongoDB connection status using readyState
 * @access  Public
 */
router.get('/health/db', (req, res) => {
  try {
    const mongoose = require('mongoose');
    const readyState = mongoose.connection.readyState;
    
    // Translate readyState to a human-readable status
    let status;
    switch(readyState) {
      case 0: status = 'disconnected'; break;
      case 1: status = 'connected'; break;
      case 2: status = 'connecting'; break;
      case 3: status = 'disconnecting'; break;
      default: status = 'unknown';
    }
    
    console.log(`[DB HEALTH] MongoDB connection status: ${status} (readyState: ${readyState})`);
    
    return res.status(200).json({
      success: readyState === 1,
      status,
      readyState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking MongoDB readyState:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'Error checking MongoDB status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export router
module.exports = router; 