/**
 * Complete Pairing Test
 * This script verifies the full display pairing process:
 * 1. Connect to Socket.IO
 * 2. Register a display with valid parameters
 * 3. Trigger pairing via debug endpoint
 * 4. Verify pairing notification received
 */

const { io } = require('socket.io-client');
const http = require('http');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const TEST_QR_CODE = 'FULL_TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Results tracking
const testResults = {
  socketConnection: { status: 'pending' },
  displayRegistration: { status: 'pending' },
  roomJoining: { status: 'pending' },
  pairingRequest: { status: 'pending' },
  notificationReceived: { status: 'pending' }
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
function markTest(test, passed, details = '') {
  testResults[test] = {
    status: passed ? 'passed' : 'failed',
    details: details,
    timestamp: new Date().toISOString()
  };
  
  const status = passed ? '✅ PASSED' : '❌ FAILED';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  log(`${status}: ${test} - ${details}`, passed ? 'success' : 'error');
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
async function runCompletePairingTest() {
  let success = true;
  let socket = null;
  let testTimeout = null;
  
  log('Starting complete pairing test', 'info');
  log(`Test QR Code: ${TEST_QR_CODE}`, 'info');
  
  // Set overall test timeout - 15 seconds
  testTimeout = setTimeout(() => {
    log('Test timed out after 15 seconds', 'error');
    printSummary();
    cleanup(1);
  }, 15000);
  
  try {
    // STEP 1: Connect to Socket.IO
    log('Connecting to Socket.IO server...', 'info');
    
    socket = io(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      timeout: 5000
    });
    
    // Event Handlers
    socket.on('connect', () => {
      log(`Connected to server with socket ID: ${socket.id}`, 'success');
      markTest('socketConnection', true, `Connected with socket ID: ${socket.id}`);
      
      // After connection, register the display
      registerDisplay();
    });
    
    socket.on('connect_error', (error) => {
      log(`Socket connection error: ${error.message}`, 'error');
      markTest('socketConnection', false, `Connection error: ${error.message}`);
      success = false;
    });
    
    // Socket error event
    socket.on('error', (error) => {
      log(`Socket error: ${JSON.stringify(error)}`, 'error');
    });
    
    // Display registration confirmation
    socket.on('display:registered', (data) => {
      log(`Display registered: ${JSON.stringify(data)}`, 'success');
      markTest('displayRegistration', true, `Registered with deviceId: ${TEST_QR_CODE}`);
      
      // Check if the display is in the correct rooms
      checkRooms();
    });
    
    // Pairing notification
    socket.on('display:paired', (data) => {
      log(`Received pairing notification: ${JSON.stringify(data)}`, 'success');
      
      // Check if the notification is for our test QR code
      if (data.qrCode === TEST_QR_CODE) {
        markTest('notificationReceived', true, `Received notification for QR code: ${TEST_QR_CODE}`);
        
        // If all tests have passed, end the test
        if (Object.values(testResults).every(r => r.status === 'passed')) {
          log('All tests passed successfully!', 'success');
          printSummary();
          cleanup(0);
        }
      } else {
        log(`Received notification for different QR code: ${data.qrCode}`, 'warn');
      }
    });
    
    // Other events for debugging
    socket.onAny((eventName, ...args) => {
      if (!['connect', 'disconnect'].includes(eventName)) {
        log(`Received event: ${eventName} with data: ${JSON.stringify(args)}`, 'info');
      }
    });
    
    // Register the display with all required fields
    function registerDisplay() {
      log(`Registering display with ID: ${TEST_QR_CODE}`, 'info');
      
      socket.emit('register:display', {
        deviceId: TEST_QR_CODE,
        name: `Complete Test Display`,
        model: 'Automated Tester',
        qrCode: TEST_QR_CODE,  // Required field
        location: 'Test Room',  // Required field
        status: 'active',       // Valid enum value
        ipAddress: '127.0.0.1'  // Additional field
      });
      
      // Set timeout for registration response
      setTimeout(() => {
        if (testResults.displayRegistration.status === 'pending') {
          log('No display registration confirmation received within timeout', 'error');
          markTest('displayRegistration', false, 'Timeout waiting for registration confirmation');
          success = false;
        }
      }, 5000);
    }
    
    // Check if display is in the correct rooms
    async function checkRooms() {
      try {
        log('Checking if display is in the correct rooms...', 'info');
        
        // Get connected displays info
        const response = await httpRequest('GET', '/api/displays/debug/connected');
        
        if (response.success) {
          const rooms = response.rooms || [];
          const displayRooms = rooms.filter(r => 
            r.room === `display:${TEST_QR_CODE}` || 
            r.room === `qrcode:${TEST_QR_CODE}`
          );
          
          if (displayRooms.length > 0) {
            markTest('roomJoining', true, `Display is in ${displayRooms.length} room(s)`);
            
            // Continue to trigger pairing
            triggerPairing();
          } else {
            markTest('roomJoining', false, 'Display not found in any rooms');
            success = false;
          }
        } else {
          log('Failed to get room information', 'error');
          markTest('roomJoining', false, 'Failed to get room information from API');
          success = false;
        }
      } catch (error) {
        log(`Error checking rooms: ${error.message}`, 'error');
        markTest('roomJoining', false, `Error: ${error.message}`);
        success = false;
      }
    }
    
    // Trigger pairing notification
    async function triggerPairing() {
      try {
        log(`Triggering pairing notification for QR code: ${TEST_QR_CODE}`, 'info');
        
        const response = await httpRequest('POST', `/api/displays/debug/trigger-pairing/${TEST_QR_CODE}`);
        
        if (response.success) {
          log(`Pairing triggered: ${JSON.stringify(response)}`, 'success');
          markTest('pairingRequest', true, 'Pairing request sent successfully');
          
          // Set timeout for receiving notification
          setTimeout(() => {
            if (testResults.notificationReceived.status === 'pending') {
              log('No pairing notification received within timeout', 'error');
              markTest('notificationReceived', false, 'Timeout waiting for notification');
              success = false;
              printSummary();
              cleanup(1);
            }
          }, 5000);
        } else {
          log(`Failed to trigger pairing: ${JSON.stringify(response)}`, 'error');
          markTest('pairingRequest', false, 'Failed to trigger pairing');
          success = false;
        }
      } catch (error) {
        log(`Error triggering pairing: ${error.message}`, 'error');
        markTest('pairingRequest', false, `Error: ${error.message}`);
        success = false;
      }
    }
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'error');
    success = false;
    cleanup(1);
  }
  
  // Print test summary
  function printSummary() {
    log('\n=========== TEST SUMMARY ===========', 'info');
    Object.entries(testResults).forEach(([test, result]) => {
      const isPassed = result.status === 'passed';
      const color = isPassed ? '\x1b[32m' : (result.status === 'pending' ? '\x1b[33m' : '\x1b[31m');
      console.log(`${color}${test}: ${result.status.toUpperCase()}\x1b[0m`);
      if (result.details) console.log(`  ${result.details}`);
    });
    
    if (Object.values(testResults).every(r => r.status === 'passed')) {
      log('\n✅ ALL TESTS PASSED! The pairing process is working correctly.', 'success');
    } else {
      log('\n❌ SOME TESTS FAILED! The pairing process has issues.', 'error');
    }
  }
  
  // Cleanup function
  function cleanup(exitCode) {
    clearTimeout(testTimeout);
    
    if (socket && socket.connected) {
      socket.disconnect();
    }
    
    // Small delay before exiting to ensure logs are printed
    setTimeout(() => {
      process.exit(exitCode);
    }, 500);
  }
}

// Run the test
runCompletePairingTest(); 