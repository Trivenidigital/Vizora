/**
 * Socket Registration and Pairing Test
 * Tests the full process:
 * 1. Register a display via Socket.IO
 * 2. Verify the display was saved
 * 3. Trigger pairing notification via API
 * 4. Verify pairing notification was received via Socket.IO
 */

const { io } = require('socket.io-client');
const mongoose = require('mongoose');
const http = require('http');
const { Display } = require('../models');
const config = require('../../config');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const TEST_QR_CODE = 'FULL_TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Test result tracking
const testResults = {
  socketConnection: { status: 'pending' },
  displayRegistration: { status: 'pending' },
  displaySavedToDB: { status: 'pending' },
  pairingRequest: { status: 'pending' },
  pairingNotification: { status: 'pending' }
};

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

// Mark test result
function markTest(testName, passed, details) {
  testResults[testName] = {
    status: passed ? 'passed' : 'failed',
    details: details,
    timestamp: new Date().toISOString()
  };
  
  const status = passed ? '✅ PASSED' : '❌ FAILED';
  log(`${status}: ${testName} - ${details}`, passed ? 'success' : 'error');
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

// Simple HTTP request
function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Main test function
async function runSocketAndPairingTest() {
  let socket = null;
  let dbConnected = false;
  let displayId = null;
  
  try {
    log('Starting complete socket and pairing test', 'info');
    log(`Test QR Code: ${TEST_QR_CODE}`, 'info');
    
    // Set a test timeout
    const testTimeout = setTimeout(() => {
      log('Test timed out after 30 seconds', 'error');
      printSummary();
      cleanup(1);
    }, 30000);
    
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
    
    // Event Handlers
    socket.on('connect', () => {
      log(`Connected to Socket.IO server with socket ID: ${socket.id}`, 'success');
      markTest('socketConnection', true, `Connected with socket ID: ${socket.id}`);
      
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
          name: 'Complete Test Display',
          location: 'Test Location',
          qrCode: TEST_QR_CODE,
          status: 'active'
        };
        
        log(`Registering display with data: ${JSON.stringify(registrationData)}`, 'info');
        socket.emit('register:display', registrationData);
        
        // Set a timeout to check if the display was saved even if no socket event received
        setTimeout(async () => {
          if (dbConnected && testResults.displayRegistration.status === 'pending') {
            log('No display:registered event received, checking database directly...', 'warn');
            await checkDatabaseForDisplay();
          }
        }, 8000);
      }, 2000);
    });
    
    socket.on('welcome', (data) => {
      log(`Received welcome message: ${JSON.stringify(data)}`, 'info');
    });
    
    socket.on('connect_error', (error) => {
      log(`Socket connection error: ${error.message}`, 'error');
      markTest('socketConnection', false, `Connection error: ${error.message}`);
    });
    
    socket.on('error', (error) => {
      log(`Socket error: ${JSON.stringify(error)}`, 'error');
    });
    
    socket.on('test:echo:response', (data) => {
      log(`Received echo response: ${JSON.stringify(data)}`, 'success');
    });
    
    socket.on('display:registered', (data) => {
      log(`Display registered successfully via socket: ${JSON.stringify(data)}`, 'success');
      markTest('displayRegistration', true, `Registered with deviceId: ${data.deviceId}`);
      
      if (data.displayId) {
        displayId = data.displayId;
      }
      
      // Verify in database if connected
      if (dbConnected) {
        checkDatabaseForDisplay();
      } else {
        // Proceed to pairing test
        testPairing();
      }
    });
    
    // Pairing notification
    socket.on('display:paired', (data) => {
      log(`Received pairing notification: ${JSON.stringify(data)}`, 'success');
      markTest('pairingNotification', true, `Received notification for QR code: ${data.qrCode}`);
      
      // Check if all tests are passed
      checkTestCompletion();
    });
    
    // Log all other events
    socket.onAny((eventName, ...args) => {
      if (!['connect', 'disconnect', 'test:echo:response', 'display:registered', 'display:paired', 'welcome'].includes(eventName)) {
        log(`Received event '${eventName}' with data: ${JSON.stringify(args)}`, 'info');
      }
    });
    
    // Verify display was saved to database
    async function checkDatabaseForDisplay() {
      try {
        const display = await Display.findOne({ qrCode: TEST_QR_CODE });
        
        if (display) {
          log(`Verified display in database: ${display._id}`, 'success');
          markTest('displaySavedToDB', true, `Found in DB with ID: ${display._id}`);
          displayId = display._id;
          
          // Proceed to pairing test
          testPairing();
        } else {
          log('Display not found in database', 'error');
          markTest('displaySavedToDB', false, 'Not found in database');
        }
      } catch (error) {
        log(`Error checking database: ${error.message}`, 'error');
        markTest('displaySavedToDB', false, `Error: ${error.message}`);
      }
    }
    
    // Test the pairing process
    async function testPairing() {
      try {
        log(`Triggering pairing notification for QR code: ${TEST_QR_CODE}`, 'info');
        
        // Use the debug endpoint to trigger pairing
        const response = await httpRequest('POST', `/api/displays/debug/trigger-pairing/${TEST_QR_CODE}`);
        
        if (response && response.success) {
          log(`Pairing request sent: ${JSON.stringify(response)}`, 'success');
          markTest('pairingRequest', true, 'Pairing request sent successfully');
          
          // Set timeout for pairing notification
          setTimeout(() => {
            if (testResults.pairingNotification.status === 'pending') {
              log('No pairing notification received within timeout', 'error');
              markTest('pairingNotification', false, 'Timeout waiting for notification');
              checkTestCompletion();
            }
          }, 8000);
        } else {
          log(`Failed to send pairing request: ${JSON.stringify(response)}`, 'error');
          markTest('pairingRequest', false, 'Failed to send pairing request');
          checkTestCompletion();
        }
      } catch (error) {
        log(`Error in pairing test: ${error.message}`, 'error');
        markTest('pairingRequest', false, `Error: ${error.message}`);
        checkTestCompletion();
      }
    }
    
    // Check if all tests are complete
    function checkTestCompletion() {
      // Check if all tests are completed
      const allCompleted = Object.values(testResults).every(r => 
        r.status === 'passed' || r.status === 'failed');
      
      if (allCompleted) {
        printSummary();
        
        // Check if all tests passed
        const allPassed = Object.values(testResults).every(r => r.status === 'passed');
        cleanup(allPassed ? 0 : 1);
      }
    }
    
    // Print test summary
    function printSummary() {
      log('\n=========== TEST SUMMARY ===========', 'info');
      
      for (const [test, result] of Object.entries(testResults)) {
        const status = result.status === 'passed' ? '✅ PASSED' : 
                       result.status === 'failed' ? '❌ FAILED' : '⏳ PENDING';
        log(`${test}: ${status}`, result.status === 'passed' ? 'success' : 
                                 result.status === 'failed' ? 'error' : 'warn');
        if (result.details) {
          log(`  ${result.details}`, 'info');
        }
      }
      
      // Overall result
      const allPassed = Object.values(testResults).every(r => r.status === 'passed');
      if (allPassed) {
        log('\n✅ ALL TESTS PASSED! The pairing process works correctly.', 'success');
      } else {
        log('\n❌ SOME TESTS FAILED! The pairing process has issues.', 'error');
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
            setTimeout(() => process.exit(exitCode), 500);
          })
          .catch((error) => {
            log(`Error disconnecting from MongoDB: ${error.message}`, 'error');
            setTimeout(() => process.exit(exitCode), 500);
          });
      } else {
        setTimeout(() => process.exit(exitCode), 500);
      }
    }
  } catch (error) {
    log(`Unhandled error in test: ${error.message}`, 'error');
    log(`Stack trace: ${error.stack}`, 'error');
    printSummary();
    
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
runSocketAndPairingTest(); 