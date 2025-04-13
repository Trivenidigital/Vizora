/**
 * Socket Display Registration Test
 * Tests registration over socket.io with better error handling
 */

const { io } = require('socket.io-client');
const mongoose = require('mongoose');
const { Display } = require('../models');
const config = require('../../config');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const TEST_QR_CODE = 'SOCKET_REG_' + Math.random().toString(36).substring(2, 10).toUpperCase();

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
async function runSocketRegistrationTest() {
  let socket = null;
  let testSuccess = false;
  let dbConnected = false;
  
  try {
    log('Starting socket display registration test', 'info');
    log(`Test QR Code: ${TEST_QR_CODE}`, 'info');
    
    // First connect to the database to check results
    dbConnected = await connectDB();
    if (!dbConnected) {
      log('Could not connect to MongoDB, but will continue with socket test', 'warn');
    }
    
    // Connect to Socket.IO
    log('Connecting to Socket.IO server...', 'info');
    
    socket = io(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      timeout: 10000
    });
    
    // Set a test timeout
    const testTimeout = setTimeout(() => {
      if (!testSuccess) {
        log('Test timed out after 20 seconds', 'error');
        cleanup(1);
      }
    }, 20000);
    
    // Event Handlers
    socket.on('connect', () => {
      log(`Connected to Socket.IO server with socket ID: ${socket.id}`, 'success');
      
      // First verify server connectivity with an echo test
      log('Testing echo handler...', 'info');
      socket.emit('test:echo', {
        message: 'Echo test before registration',
        timestamp: new Date().toISOString()
      });
      
      // Wait 2 seconds then register
      setTimeout(() => {
        // Register display with all required fields
        const registrationData = {
          deviceId: TEST_QR_CODE,
          name: 'Socket Test Display',
          location: 'Test Location',
          qrCode: TEST_QR_CODE,
          status: 'active'
        };
        
        log(`Registering display with data: ${JSON.stringify(registrationData)}`, 'info');
        socket.emit('register:display', registrationData);
        
        // Set a timeout for registration confirmation
        setTimeout(async () => {
          if (dbConnected) {
            // Even if we don't get a socket event, check if it was saved to DB
            const display = await Display.findOne({ qrCode: TEST_QR_CODE });
            if (display) {
              log(`Display was saved to database even though no confirmation was received via socket`, 'warn');
              log(`Display in DB: ${JSON.stringify(display.toJSON ? display.toJSON() : display)}`, 'info');
            }
          }
        }, 8000);
      }, 2000);
    });
    
    socket.on('connect_error', (error) => {
      log(`Socket connection error: ${error.message}`, 'error');
    });
    
    socket.on('error', (error) => {
      log(`Socket error: ${JSON.stringify(error)}`, 'error');
    });
    
    socket.on('disconnect', (reason) => {
      log(`Socket disconnected: ${reason}`, 'warn');
    });
    
    socket.on('test:echo:response', (data) => {
      log(`Received echo response: ${JSON.stringify(data)}`, 'success');
    });
    
    socket.on('display:registered', (data) => {
      log(`Display registered successfully via socket: ${JSON.stringify(data)}`, 'success');
      testSuccess = true;
      
      // Verify in database if connected
      if (dbConnected) {
        verifyInDatabase();
      } else {
        cleanup(0);
      }
    });
    
    // Log all events
    socket.onAny((eventName, ...args) => {
      if (!['connect', 'disconnect'].includes(eventName)) {
        log(`Received event '${eventName}' with data: ${JSON.stringify(args)}`, 'info');
      }
    });
    
    // Verify display was saved to database
    async function verifyInDatabase() {
      try {
        const display = await Display.findOne({ qrCode: TEST_QR_CODE });
        
        if (display) {
          log(`Verified display in database: ${display._id}`, 'success');
          log('TEST PASSED: Socket display registration worked and saved to database', 'success');
          cleanup(0);
        } else {
          log('Display was registered via socket but not found in database', 'error');
          cleanup(1);
        }
      } catch (error) {
        log(`Error verifying display in database: ${error.message}`, 'error');
        cleanup(1);
      }
    }
    
    // Cleanup function
    function cleanup(exitCode) {
      if (socket) {
        log('Disconnecting socket...', 'info');
        socket.disconnect();
      }
      
      if (dbConnected) {
        log('Disconnecting from MongoDB...', 'info');
        mongoose.disconnect()
          .then(() => {
            log('Disconnected from MongoDB', 'info');
            processExit(exitCode);
          })
          .catch((error) => {
            log(`Error disconnecting from MongoDB: ${error.message}`, 'error');
            processExit(exitCode);
          });
      } else {
        processExit(exitCode);
      }
      
      function processExit(code) {
        if (testSuccess) {
          log('TEST PASSED: Socket display registration worked correctly', 'success');
        } else {
          log('TEST FAILED: Could not register display via socket', 'error');
        }
        
        setTimeout(() => {
          process.exit(code);
        }, 500);
      }
    }
  } catch (error) {
    log(`Error in socket registration test: ${error.message}`, 'error');
    log(`Stack trace: ${error.stack}`, 'error');
    
    if (socket) {
      socket.disconnect();
    }
    
    if (dbConnected) {
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        log(`Error disconnecting from MongoDB: ${disconnectError.message}`, 'error');
      }
    }
    
    process.exit(1);
  }
}

// Run the test
runSocketRegistrationTest(); 