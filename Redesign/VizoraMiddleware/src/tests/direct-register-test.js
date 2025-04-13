/**
 * Direct Display Registration Test
 * Bypasses Socket.IO and tests the displayService directly
 */

const mongoose = require('mongoose');
const { Display } = require('../models');
const displayService = require('../services/displayService');
const config = require('../../config');
const logger = require('../utils/logger');

// Configuration
const TEST_QR_CODE = 'DIRECT_REG_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Log with timestamp and color
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m', // cyan
    success: '\x1b[32m', // green
    error: '\x1b[31m', // red
    warn: '\x1b[33m' // yellow
  };
  
  const color = colors[type] || colors.info;
  console.log(`${color}[${timestamp}] ${message}\x1b[0m`);
}

// Connect to MongoDB
async function connectDB() {
  try {
    log('Connecting to MongoDB...', 'info');
    await mongoose.connect(config.database.uri);
    log('Connected to MongoDB', 'success');
    return true;
  } catch (error) {
    log(`MongoDB connection error: ${error.message}`, 'error');
    return false;
  }
}

// Main test function
async function runDirectRegistrationTest() {
  try {
    log('Starting direct display registration test', 'info');
    log(`Test QR Code: ${TEST_QR_CODE}`, 'info');
    
    // Connect to MongoDB first
    const connected = await connectDB();
    if (!connected) {
      log('Could not connect to MongoDB, exiting test', 'error');
      process.exit(1);
    }
    
    // Create display data with all required fields
    const displayData = {
      deviceId: TEST_QR_CODE,
      name: 'Direct Test Display',
      location: 'Test Location',
      qrCode: TEST_QR_CODE,
      status: 'active'
    };
    
    log(`Registering display with data: ${JSON.stringify(displayData)}`, 'info');
    
    // Register the display directly
    const display = await displayService.registerDisplay(displayData);
    
    log(`Display registered successfully: ${JSON.stringify(display.toJSON ? display.toJSON() : display)}`, 'success');
    
    // Verify the display was saved
    const savedDisplay = await Display.findOne({ qrCode: TEST_QR_CODE });
    
    if (savedDisplay) {
      log(`Verified display in database: ${savedDisplay._id}`, 'success');
      log('TEST PASSED: Direct display registration worked correctly', 'success');
      await mongoose.disconnect();
      process.exit(0);
    } else {
      log('Failed to find display in database after registration', 'error');
      log('TEST FAILED: Direct display registration did not persist', 'error');
      await mongoose.disconnect();
      process.exit(1);
    }
  } catch (error) {
    log(`Error in direct registration test: ${error.message}`, 'error');
    log(`Stack trace: ${error.stack}`, 'error');
    log('TEST FAILED: Direct display registration failed with error', 'error');
    
    // Try to disconnect from MongoDB
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      log(`Error disconnecting from MongoDB: ${disconnectError.message}`, 'error');
    }
    
    process.exit(1);
  }
}

// Run the test
runDirectRegistrationTest(); 