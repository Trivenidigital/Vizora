/**
 * Socket.IO Test Script for Display Pairing
 * This script tests the Socket.IO communication between middleware and TV apps
 */

const { io } = require('socket.io-client');
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3003/api';
const SOCKET_URL = 'http://localhost:3003';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZThiZDA4MzZhYTRiNzhiOTkxYWI5MyIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzQzMzA5MzUwLCJleHAiOjE3NDMzOTU3NTB9.oZe4DbXwT4rd8I8c8E13lFmUaOUdDr0LLjkFtgPin2Y';

// Test QR code - generated randomly
const TEST_QR_CODE = 'TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Test display info
const TEST_DISPLAY = {
  name: 'Test Display',
  location: 'Test Location',
  qrCode: TEST_QR_CODE
};

// Create HTTP client with authentication
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

// Utility functions
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logError(message, error) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
  if (error) {
    console.error(error);
  }
}

// Main test function
async function runTests() {
  log('Starting Socket.IO pairing tests');
  log(`Test QR Code: ${TEST_QR_CODE}`);
  
  // Connect Socket.IO client (simulating TV app)
  let socket = null;
  let pairingReceived = false;
  
  try {
    log('Connecting to Socket.IO server...');
    
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true
    });
    
    // Setup event listeners
    socket.on('connect', () => {
      log(`Connected to socket server with ID: ${socket.id}`);
      
      // Register the display
      log(`Registering display with QR code: ${TEST_QR_CODE}`);
      socket.emit('register:display', {
        deviceId: TEST_QR_CODE,
        name: 'Automated Test TV',
        model: 'Test Model'
      });
    });
    
    socket.on('disconnect', (reason) => {
      log(`Disconnected from socket server: ${reason}`);
    });
    
    socket.on('connect_error', (error) => {
      logError(`Connection error: ${error.message}`);
    });
    
    socket.on('display:registered', (data) => {
      log(`Display registered: ${JSON.stringify(data)}`);
      
      // After successful registration, pair the display via API
      pairDisplayViaAPI();
    });
    
    socket.on('display:paired', (data) => {
      log(`Received pairing notification: ${JSON.stringify(data)}`);
      
      // Check if this pairing is for our test device
      if (data.qrCode === TEST_QR_CODE) {
        log('✅ TEST PASSED: Pairing notification received successfully!');
        pairingReceived = true;
        
        // Cleanup and exit with success
        setTimeout(() => {
          cleanupAndExit(0);
        }, 1000);
      } else {
        log(`Received pairing for a different device: ${data.qrCode}`);
      }
    });
    
    // Listen for all events for debugging
    socket.onAny((eventName, ...args) => {
      log(`Received event: ${eventName}`);
    });
    
    // Set timeout for the entire test
    setTimeout(() => {
      if (!pairingReceived) {
        logError('❌ TEST FAILED: Did not receive pairing notification within timeout period');
        cleanupAndExit(1);
      }
    }, 10000); // 10 second timeout
    
  } catch (error) {
    logError('Error setting up socket connection', error);
    cleanupAndExit(1);
  }
  
  // Function to pair the display via API
  async function pairDisplayViaAPI() {
    try {
      log('Pairing display via API...');
      
      const response = await api.post('/displays/pair', TEST_DISPLAY);
      
      log(`API pairing response: ${JSON.stringify(response.data)}`);
      
      // Check if we received the pairing after some time
      setTimeout(() => {
        if (!pairingReceived) {
          log('Testing direct notification endpoint...');
          
          // Try the test notification endpoint as a fallback
          api.post(`/displays/test-notification/${TEST_QR_CODE}`)
            .then(response => {
              log(`Test notification response: ${JSON.stringify(response.data)}`);
            })
            .catch(error => {
              logError('Error sending test notification', error);
            });
        }
      }, 3000);
      
    } catch (error) {
      logError('Error pairing display via API', error.response?.data || error);
      cleanupAndExit(1);
    }
  }
  
  // Function to clean up and exit
  function cleanupAndExit(code) {
    log('Cleaning up...');
    
    if (socket && socket.connected) {
      socket.disconnect();
    }
    
    // Optionally clean up created display from database
    api.get(`/displays`)
      .then(response => {
        const displays = response.data.data;
        const testDisplay = displays.find(d => d.qrCode === TEST_QR_CODE);
        
        if (testDisplay) {
          log(`Found test display in database: ${testDisplay._id}`);
          
          // Unpair the display
          return api.delete(`/displays/${testDisplay._id}`);
        }
      })
      .then(() => {
        log('Test display cleaned up');
        process.exit(code);
      })
      .catch(error => {
        logError('Error during cleanup', error);
        process.exit(code);
      });
  }
}

// Run the tests
runTests(); 