/**
 * Automated Pairing Test
 * This script tests the full display pairing flow:
 * 1. Connect to Socket.IO
 * 2. Register a display
 * 3. Trigger pairing via API
 * 4. Validate pairing notification is received
 */

const { io } = require('socket.io-client');
const http = require('http');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const TEST_QR_CODE = 'AUTO_TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Test results
let testResults = {
  socketConnection: { status: 'pending', details: null },
  displayRegistration: { status: 'pending', details: null },
  pairingRequest: { status: 'pending', details: null },
  pairingNotification: { status: 'pending', details: null }
};

// Log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Log with color support
function logResult(test, passed, message) {
  const status = passed ? '✓ PASSED' : '✗ FAILED';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}[${status}]\x1b[0m ${test}: ${message}`);
  
  testResults[test] = {
    status: passed ? 'passed' : 'failed',
    details: message,
    timestamp: new Date().toISOString()
  };
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
async function runAutomatedTest() {
  log('Starting automated pairing test');
  log(`Test QR Code: ${TEST_QR_CODE}`);
  
  let socket = null;
  let pairingReceived = false;
  let testTimeout = null;
  
  // Set overall test timeout
  const TEST_TIMEOUT = 15000; // 15 seconds
  testTimeout = setTimeout(() => {
    log('\n=========== TEST SUMMARY ===========');
    Object.entries(testResults).forEach(([test, result]) => {
      const passed = result.status === 'passed';
      const color = passed ? '\x1b[32m' : (result.status === 'pending' ? '\x1b[33m' : '\x1b[31m');
      console.log(`${color}${test}: ${result.status.toUpperCase()}\x1b[0m`);
      if (result.details) console.log(`  ${result.details}`);
    });
    
    if (Object.values(testResults).some(r => r.status === 'failed')) {
      log('\x1b[31mAt least one test failed. See details above.\x1b[0m');
      process.exit(1);
    } else if (Object.values(testResults).some(r => r.status === 'pending')) {
      log('\x1b[33mTests did not complete within the timeout period.\x1b[0m');
      process.exit(1);
    } else {
      log('\x1b[32mAll tests passed successfully!\x1b[0m');
      process.exit(0);
    }
  }, TEST_TIMEOUT);
  
  try {
    // Step 1: Connect to Socket.IO server
    log('Connecting to Socket.IO server...');
    
    socket = io(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      timeout: 5000
    });
    
    socket.on('connect', () => {
      log(`Connected to server with socket ID: ${socket.id}`);
      logResult('socketConnection', true, `Connected with socket ID: ${socket.id}`);
      
      // Step 2: Register display
      registerDisplay();
    });
    
    socket.on('connect_error', (error) => {
      log(`Connection error: ${error.message}`);
      logResult('socketConnection', false, `Connection error: ${error.message}`);
    });
    
    socket.on('display:registered', (data) => {
      log(`Display registered: ${JSON.stringify(data)}`);
      logResult('displayRegistration', true, `Successfully registered with QR code: ${TEST_QR_CODE}`);
      
      // Step 3: Trigger pairing
      triggerPairing();
    });
    
    socket.on('display:paired', (data) => {
      log(`Received pairing notification: ${JSON.stringify(data)}`);
      
      // Validate the received data contains our QR code
      if (data.qrCode === TEST_QR_CODE) {
        pairingReceived = true;
        logResult('pairingNotification', true, `Received notification for QR code: ${TEST_QR_CODE}`);
        
        // End the test early if all steps passed
        if (Object.values(testResults).every(r => r.status === 'passed')) {
          endTest(true);
        }
      } else {
        log(`Received pairing for different QR code: ${data.qrCode}`);
      }
    });
    
    // Register the display
    function registerDisplay() {
      log(`Registering display with ID: ${TEST_QR_CODE}`);
      
      // Include required fields and valid status value
      socket.emit('register:display', {
        deviceId: TEST_QR_CODE,
        name: `Automated Test Display`,
        model: 'Test Runner',
        qrCode: TEST_QR_CODE,
        location: 'Automated Test Location',
        status: 'active'  // Using a valid enum value
      });
    }
    
    // Trigger pairing using debug endpoint
    async function triggerPairing() {
      try {
        log(`Triggering pairing for QR code: ${TEST_QR_CODE}`);
        
        const response = await httpRequest('POST', `/api/displays/debug/trigger-pairing/${TEST_QR_CODE}`);
        
        log(`Pairing trigger response: ${JSON.stringify(response)}`);
        logResult('pairingRequest', true, `Triggered pairing for QR code: ${TEST_QR_CODE}`);
        
        // Wait for notification
        setTimeout(() => {
          if (!pairingReceived) {
            log('Warning: Did not receive pairing notification within timeout');
            logResult('pairingNotification', false, 'No pairing notification received within timeout');
            endTest(false);
          }
        }, 5000);
      } catch (error) {
        log(`Error triggering pairing: ${error.message}`);
        logResult('pairingRequest', false, `Error: ${error.message}`);
        endTest(false);
      }
    }
  } catch (error) {
    log(`Unexpected error: ${error.message}`);
    endTest(false);
  }
  
  // End the test
  function endTest(success) {
    clearTimeout(testTimeout);
    
    log('\n=========== TEST SUMMARY ===========');
    Object.entries(testResults).forEach(([test, result]) => {
      const passed = result.status === 'passed';
      const color = passed ? '\x1b[32m' : (result.status === 'pending' ? '\x1b[33m' : '\x1b[31m');
      console.log(`${color}${test}: ${result.status.toUpperCase()}\x1b[0m`);
      if (result.details) console.log(`  ${result.details}`);
    });
    
    if (success) {
      log('\n\x1b[32mALL TESTS PASSED! The pairing process is working correctly.\x1b[0m');
    } else {
      log('\n\x1b[31mSOME TESTS FAILED! The pairing process has issues.\x1b[0m');
    }
    
    // Cleanup
    if (socket && socket.connected) {
      socket.disconnect();
    }
    
    process.exit(success ? 0 : 1);
  }
}

// Start the automated test
runAutomatedTest(); 