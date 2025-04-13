/**
 * Direct Pairing Test
 * Tests pairing notification delivery by:
 * 1. Setting up a socket.io client
 * 2. Directly calling the debug trigger endpoint
 * 3. Verifying the notification is received
 */

const { io } = require('socket.io-client');
const http = require('http');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const TEST_QR_CODE = 'DIRECT_TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
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
async function runDirectPairingTest() {
  let success = false;
  let socket = null;
  let notificationReceived = false;

  log('Starting direct pairing test');
  log(`Test QR Code: ${TEST_QR_CODE}`);
  
  try {
    // Connect to Socket.IO
    log('Connecting to Socket.IO server...');
    socket = io(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      timeout: 5000
    });
    
    // Setup event listeners
    socket.on('connect', async () => {
      log(`Connected to Socket.IO server with ID: ${socket.id}`);
      
      socket.onAny((eventName, ...args) => {
        log(`Received event: ${eventName}`);
      });
      
      // Listen for pairing notifications
      socket.on('display:paired', (data) => {
        log(`Received pairing notification: ${JSON.stringify(data)}`);
        
        if (data.qrCode === TEST_QR_CODE) {
          log(`✅ TEST PASSED: Received pairing notification for our QR code: ${TEST_QR_CODE}`);
          notificationReceived = true;
          success = true;
          
          // Complete test successfully
          setTimeout(() => {
            cleanup(0);
          }, 1000);
        }
      });
      
      // After connection is established, trigger pairing
      try {
        log(`Triggering pairing notification for QR code: ${TEST_QR_CODE}`);
        const response = await httpRequest('POST', `/api/displays/debug/trigger-pairing/${TEST_QR_CODE}`);
        log(`Pairing trigger response: ${JSON.stringify(response)}`);
      } catch (error) {
        log(`❌ Error triggering pairing: ${error.message}`);
      }
      
      // Set timeout for receiving notification
      setTimeout(() => {
        if (!notificationReceived) {
          log(`❌ TEST FAILED: Did not receive pairing notification within timeout`);
          cleanup(1);
        }
      }, 5000);
    });
    
    socket.on('connect_error', (error) => {
      log(`❌ Connection error: ${error.message}`);
      cleanup(1);
    });
    
  } catch (error) {
    log(`❌ Unexpected error: ${error.message}`);
    cleanup(1);
  }
  
  // Cleanup function
  function cleanup(exitCode) {
    log(`Test ${success ? 'PASSED' : 'FAILED'}`);
    
    if (socket && socket.connected) {
      socket.disconnect();
    }
    
    process.exit(exitCode);
  }
}

// Run the test
runDirectPairingTest(); 