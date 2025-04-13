/**
 * Display Registration Test
 * Tests only the display registration functionality
 */

const { io } = require('socket.io-client');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const TEST_QR_CODE = 'REGISTER_TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

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

// Main test function
async function runDisplayRegistrationTest() {
  log('Starting display registration test', 'info');
  log(`Test QR Code: ${TEST_QR_CODE}`, 'info');
  
  // Connect to Socket.IO
  log('Connecting to Socket.IO server...', 'info');
  
  const socket = io(SERVER_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true
  });
  
  let testSuccess = false;
  let timer = setTimeout(() => {
    log('Test timed out after 15 seconds', 'error');
    cleanup(1);
  }, 15000);
  
  // Event Handlers
  socket.on('connect', () => {
    log(`Connected to server with socket ID: ${socket.id}`, 'success');
    
    // First test the echo handler to make sure socket.io is working properly
    log('Testing echo handler...', 'info');
    socket.emit('test:echo', {
      message: 'Hello from test client',
      timestamp: new Date().toISOString()
    });
    
    // Wait 2 seconds before sending the registration
    setTimeout(() => {
      // After testing echo, register the display with EXACT fields required by the model
      const registrationData = {
        deviceId: TEST_QR_CODE,  // Used to identify the device in socketService
        name: 'Test Display',    // Required by Display model
        location: 'Test Location', // Required by Display model
        qrCode: TEST_QR_CODE,    // Required by Display model
        status: 'active'         // Valid enum value in Display model
      };
      
      log(`Registering display with data: ${JSON.stringify(registrationData)}`, 'info');
      socket.emit('register:display', registrationData);
    }, 2000);
  });
  
  socket.on('connect_error', (error) => {
    log(`Socket connection error: ${error.message}`, 'error');
  });
  
  socket.on('error', (error) => {
    log(`Socket error: ${JSON.stringify(error)}`, 'error');
  });
  
  socket.on('test:echo:response', (data) => {
    log(`Received echo response: ${JSON.stringify(data)}`, 'success');
  });
  
  socket.on('display:registered', (data) => {
    log(`Display registered successfully: ${JSON.stringify(data)}`, 'success');
    testSuccess = true;
    cleanup(0);
  });
  
  // Log all events
  socket.onAny((eventName, ...args) => {
    if (!['connect', 'disconnect'].includes(eventName)) {
      log(`Received event: ${eventName} with data: ${JSON.stringify(args)}`, 'info');
    }
  });
  
  // Cleanup function
  function cleanup(exitCode) {
    clearTimeout(timer);
    log('Disconnecting socket...', 'info');
    socket.disconnect();
    
    if (testSuccess) {
      log('TEST PASSED: Display registration worked correctly', 'success');
    } else {
      log('TEST FAILED: Could not register display', 'error');
    }
    
    setTimeout(() => {
      process.exit(exitCode);
    }, 500);
  }
}

// Run the test
runDisplayRegistrationTest(); 