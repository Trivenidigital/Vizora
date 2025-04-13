/**
 * Real Pairing Flow Test
 * 
 * This test script simulates a complete real-world pairing flow:
 * 1. A display (TV) connects via Socket.IO and registers
 * 2. A web app user initiates pairing with the display via HTTP
 * 3. The display receives the pairing notification
 * 
 * This validates the complete integration flow and verifies that
 * socket connections and room assignments are working correctly.
 */

const io = require('socket.io-client');
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const SOCKET_PATH = '/socket.io';
const TEST_QR_CODE = `TV_REAL_FLOW_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Results tracking
const testResults = {
  displaySocketConnect: false,
  displayRegistration: false,
  webPairingRequest: false,
  pairingNotificationReceived: false
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
  let displaySocket;
  let pairingTimeout;
  
  try {
    log('Starting real pairing flow test');
    log(`Test QR Code: ${TEST_QR_CODE}`);
    
    // Step 1: Connect to Socket.IO as a display (TV app)
    log('Connecting to Socket.IO server as display...');
    displaySocket = io(SERVER_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      reconnection: true,
      timeout: 5000
    });
    
    // Set up display socket event handlers
    displaySocket.on('connect', () => {
      log(`Display connected to Socket.IO server with ID: ${displaySocket.id}`);
      markTest('displaySocketConnect', true, 'Display connected to Socket.IO server');
      
      // Register the display with the QR code
      log('Registering display via Socket.IO...');
      displaySocket.emit('register:display', {
        deviceId: TEST_QR_CODE,
        name: 'Real Flow Test Display',
        location: 'Test Location',
        status: 'active'
      });
    });
    
    displaySocket.on('connect_error', (error) => {
      log(`Display socket connection error: ${error.message}`, 'error');
      markTest('displaySocketConnect', false, `Failed to connect: ${error.message}`);
    });
    
    displaySocket.on('welcome', (data) => {
      log(`Display received welcome message: ${JSON.stringify(data)}`);
    });
    
    displaySocket.on('display:registered', (data) => {
      log(`Display registration response: ${JSON.stringify(data)}`);
      
      if (data.success && data.deviceId === TEST_QR_CODE) {
        markTest('displayRegistration', true, 'Display registered successfully via Socket.IO');
        
        // Step 2: After display is registered, simulate a web app user pairing with the display
        setTimeout(async () => {
          try {
            log('Simulating web app pairing request...');
            
            // Use the debug trigger-pairing endpoint for simulating a user pairing 
            const pairingResponse = await httpRequest('post', `/api/displays/debug/trigger-pairing/${TEST_QR_CODE}`, {});
            log(`Web pairing response: ${JSON.stringify(pairingResponse)}`);
            
            if (pairingResponse.success) {
              markTest('webPairingRequest', true, 'Web app pairing request successful');
            } else {
              markTest('webPairingRequest', false, 'Web app pairing request failed');
            }
          } catch (error) {
            log(`Failed to trigger web pairing: ${error.message}`, 'error');
            markTest('webPairingRequest', false, `Web app pairing request failed: ${error.message}`);
          }
        }, 2000);
      } else {
        markTest('displayRegistration', false, 'Display registration failed');
      }
    });
    
    displaySocket.on('display:paired', (data) => {
      log(`Display received pairing notification: ${JSON.stringify(data)}`);
      
      if (data.qrCode === TEST_QR_CODE) {
        markTest('pairingNotificationReceived', true, `Display received pairing notification for QR code: ${TEST_QR_CODE}`);
        clearTimeout(pairingTimeout);
        
        // Wait a moment to let any logging finish, then end the test
        setTimeout(() => {
          cleanup(true);
        }, 1000);
      }
    });
    
    displaySocket.on('display:paired:broadcast', (data) => {
      log(`Display received broadcast pairing notification: ${JSON.stringify(data)}`);
      
      if (data.qrCode === TEST_QR_CODE) {
        markTest('pairingNotificationReceived', true, `Display received broadcast pairing notification for QR code: ${TEST_QR_CODE}`);
        clearTimeout(pairingTimeout);
        
        // Wait a moment to let any logging finish, then end the test
        setTimeout(() => {
          cleanup(true);
        }, 1000);
      }
    });
    
    // Set a timeout for the entire test
    pairingTimeout = setTimeout(() => {
      log('Test timeout reached', 'error');
      
      // Check what stage the test failed at
      if (!testResults.displaySocketConnect) {
        markTest('displaySocketConnect', false, 'Display failed to connect to Socket.IO server');
      } else if (!testResults.displayRegistration) {
        markTest('displayRegistration', false, 'Display registration timed out');
      } else if (!testResults.webPairingRequest) {
        markTest('webPairingRequest', false, 'Web app pairing request timed out');
      } else if (!testResults.pairingNotificationReceived) {
        markTest('pairingNotificationReceived', false, 'Display did not receive pairing notification within timeout period');
      }
      
      cleanup(false);
    }, 20000);
    
  } catch (error) {
    log(`Test error: ${error.message}`, 'error');
    cleanup(false);
  }
  
  // Cleanup function to disconnect and summarize the test
  function cleanup(success) {
    if (displaySocket && displaySocket.connected) {
      log('Disconnecting display socket from Socket.IO server');
      displaySocket.disconnect();
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