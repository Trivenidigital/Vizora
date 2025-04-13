/**
 * HTTP Register and Pair Test
 * 
 * This test script:
 * 1. Registers a display using the HTTP API endpoint
 * 2. Connects to the Socket.IO server
 * 3. Verifies pairing notification is received for the registered display
 */

const io = require('socket.io-client');
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const SOCKET_PATH = '/socket.io';
const TEST_QR_CODE = `HTTP_PAIR_TEST_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Results tracking
const testResults = {
  httpRegister: false,
  socketConnect: false,
  pairingReceived: false
};

// Logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let prefix = '';
  
  switch (type) {
    case 'success':
      prefix = '✅ ';
      break;
    case 'error':
      prefix = '❌ ';
      break;
    case 'warn':
      prefix = '⚠️ ';
      break;
    default:
      prefix = '';
  }
  
  console.log(`[${timestamp}] ${prefix}${message}`);
}

// Mark test as passed or failed
function markTest(test, passed, message) {
  testResults[test] = passed;
  if (passed) {
    log(`TEST PASSED: ${message}`, 'success');
  } else {
    log(`TEST FAILED: ${message}`, 'error');
  }
}

// HTTP request helper
async function httpRequest(method, endpoint, data = null) {
  try {
    const url = `${SERVER_URL}${endpoint}`;
    log(`Making ${method} request to ${url}`);
    
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    log(`HTTP request error: ${error.message}`, 'error');
    if (error.response) {
      log(`Response status: ${error.response.status}`, 'error');
      log(`Response data: ${JSON.stringify(error.response.data)}`, 'error');
    }
    throw error;
  }
}

// Main test function
async function runTest() {
  let socket;
  let pairingTimeout;
  
  try {
    log('Starting HTTP register and pair test');
    log(`Test QR Code: ${TEST_QR_CODE}`);
    
    // Step 1: Register display using HTTP API
    log('Registering display via HTTP API...');
    const registerData = {
      deviceId: TEST_QR_CODE,
      name: 'HTTP API Test Display',
      location: 'API Test Location',
      status: 'active'
    };
    
    const registerResponse = await httpRequest('post', '/api/displays/debug/register', registerData);
    log(`Register response: ${JSON.stringify(registerResponse)}`);
    
    if (registerResponse.success) {
      markTest('httpRegister', true, 'Display registered successfully via HTTP API');
    } else {
      markTest('httpRegister', false, 'Failed to register display via HTTP API');
      return;
    }
    
    // Step 2: Connect to Socket.IO
    log('Connecting to Socket.IO server...');
    socket = io(SERVER_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      reconnection: true,
      timeout: 5000
    });
    
    // Set up socket event handlers
    socket.on('connect', () => {
      log(`Connected to Socket.IO server with ID: ${socket.id}`);
      markTest('socketConnect', true, 'Connected to Socket.IO server');
      
      // Step 3: Trigger pairing for the registered display
      setTimeout(async () => {
        try {
          log(`Triggering pairing notification for QR code: ${TEST_QR_CODE}`);
          const pairingResponse = await httpRequest('post', `/api/displays/debug/trigger-pairing/${TEST_QR_CODE}`, {});
          log(`Pairing trigger response: ${JSON.stringify(pairingResponse)}`);
        } catch (error) {
          log(`Failed to trigger pairing: ${error.message}`, 'error');
        }
      }, 1000);
    });
    
    socket.on('connect_error', (error) => {
      log(`Socket connection error: ${error.message}`, 'error');
      markTest('socketConnect', false, `Failed to connect: ${error.message}`);
    });
    
    socket.on('welcome', (data) => {
      log(`Received welcome message: ${JSON.stringify(data)}`);
    });
    
    socket.on('display:paired', (data) => {
      log(`Received pairing notification: ${JSON.stringify(data)}`);
      
      if (data.qrCode === TEST_QR_CODE) {
        markTest('pairingReceived', true, `Received pairing notification for our QR code: ${TEST_QR_CODE}`);
        clearTimeout(pairingTimeout);
        
        // Wait a moment to let any logging finish, then end the test
        setTimeout(() => {
          cleanup(true);
        }, 1000);
      }
    });
    
    socket.on('display:paired:broadcast', (data) => {
      log(`Received broadcast pairing notification: ${JSON.stringify(data)}`);
      
      if (data.qrCode === TEST_QR_CODE) {
        markTest('pairingReceived', true, `Received broadcast pairing notification for our QR code: ${TEST_QR_CODE}`);
        clearTimeout(pairingTimeout);
        
        // Wait a moment to let any logging finish, then end the test
        setTimeout(() => {
          cleanup(true);
        }, 1000);
      }
    });
    
    // Set a timeout for receiving the pairing notification
    pairingTimeout = setTimeout(() => {
      markTest('pairingReceived', false, 'Did not receive pairing notification within timeout period');
      cleanup(false);
    }, 10000);
    
  } catch (error) {
    log(`Test error: ${error.message}`, 'error');
    cleanup(false);
  }
  
  // Cleanup function to disconnect and summarize the test
  function cleanup(success) {
    if (socket && socket.connected) {
      log('Disconnecting from Socket.IO server');
      socket.disconnect();
    }
    
    // Log test summary
    log('\nTest Summary:', 'info');
    for (const [test, result] of Object.entries(testResults)) {
      log(`${test}: ${result ? 'PASSED' : 'FAILED'}`, result ? 'success' : 'error');
    }
    
    log(`\nTest ${success ? 'PASSED' : 'FAILED'}`, success ? 'success' : 'error');
    
    // Exit the process after cleanup
    setTimeout(() => {
      process.exit(success ? 0 : 1);
    }, 500);
  }
}

// Run the test
runTest(); 