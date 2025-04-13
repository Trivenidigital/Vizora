/**
 * Socket.IO Client Test Script
 * 
 * Tests Socket.IO connections with Vizora Middleware
 * Run with: node socket-client-test.js
 */

const { io } = require('socket.io-client');
const readline = require('readline');

// Configuration
const SERVER_URL = 'http://localhost:3003';
const DEVICE_ID = 'TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Create Socket.IO client
let socket = null;
let connected = false;
let registered = false;

// Create readline interface for command input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Print usage information
function printUsage() {
  console.log('\nAvailable commands:');
  console.log('  connect    - Connect to the server');
  console.log('  disconnect - Disconnect from the server');
  console.log('  register   - Register as a display');
  console.log('  echo       - Send an echo test');
  console.log('  pair       - Test direct pairing');
  console.log('  help       - Show this help');
  console.log('  exit       - Exit the test client');
  console.log('');
}

// Connect to the Socket.IO server
function connectToServer() {
  if (connected) {
    console.log('Already connected to the server');
    return;
  }

  console.log(`Connecting to ${SERVER_URL}...`);
  
  socket = io(SERVER_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 3,
    timeout: 5000
  });
  
  // Set up event listeners
  socket.on('connect', () => {
    connected = true;
    console.log(`Connected to server with ID: ${socket.id}`);
    printUsage();
  });
  
  socket.on('disconnect', (reason) => {
    connected = false;
    registered = false;
    console.log(`Disconnected: ${reason}`);
  });
  
  socket.on('connect_error', (error) => {
    console.error(`Connection error: ${error.message}`);
  });
  
  // Display registration response
  socket.on('display:registered', (data) => {
    console.log('Display registered:', data);
    registered = true;
  });
  
  // Pairing events
  socket.on('display:paired', (data) => {
    console.log('=======================================');
    console.log('DISPLAY PAIRED EVENT RECEIVED!');
    console.log('=======================================');
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on('display:paired:broadcast', (data) => {
    console.log('=======================================');
    console.log('BROADCAST PAIRING NOTIFICATION RECEIVED!');
    console.log('=======================================');
    console.log(JSON.stringify(data, null, 2));
  });
  
  // Echo test response
  socket.on('test:echo:response', (data) => {
    console.log('Echo response:', data);
  });
  
  // Listen for all events
  socket.onAny((eventName, ...args) => {
    if (!['connect', 'disconnect'].includes(eventName)) {
      console.log(`Event received: ${eventName}`);
    }
  });
}

// Register as a display
function registerDisplay() {
  if (!connected) {
    console.log('Not connected to the server. Use "connect" first.');
    return;
  }
  
  console.log(`Registering display with ID: ${DEVICE_ID}`);
  
  socket.emit('register:display', {
    deviceId: DEVICE_ID,
    name: `Test Display ${DEVICE_ID}`,
    model: 'CLI Test Model'
  });
}

// Send an echo test
function sendEchoTest() {
  if (!connected) {
    console.log('Not connected to the server. Use "connect" first.');
    return;
  }
  
  const testData = {
    message: 'Hello, server!',
    timestamp: new Date().toISOString(),
    deviceId: DEVICE_ID
  };
  
  console.log(`Sending echo test:`, testData);
  socket.emit('test:echo', testData);
}

// Test direct pairing
function testDirectPairing() {
  if (!connected) {
    console.log('Not connected to the server. Use "connect" first.');
    return;
  }

  if (!registered) {
    console.log('Display not registered. Use "register" first for better results.');
  }
  
  const pairData = {
    qrCode: DEVICE_ID
  };
  
  console.log(`Testing direct pairing with QR code: ${DEVICE_ID}`);
  socket.emit('test:pair', pairData);
}

// Disconnect from the server
function disconnectFromServer() {
  if (!connected) {
    console.log('Not connected to the server');
    return;
  }
  
  console.log('Disconnecting from server...');
  socket.disconnect();
}

// Process user commands
function processCommand(command) {
  switch (command.trim().toLowerCase()) {
    case 'connect':
      connectToServer();
      break;
      
    case 'disconnect':
      disconnectFromServer();
      break;
      
    case 'register':
      registerDisplay();
      break;
      
    case 'echo':
      sendEchoTest();
      break;
      
    case 'pair':
      testDirectPairing();
      break;
      
    case 'help':
      printUsage();
      break;
      
    case 'exit':
      console.log('Exiting...');
      if (connected) {
        socket.disconnect();
      }
      rl.close();
      break;
      
    default:
      console.log(`Unknown command: ${command}`);
      printUsage();
      break;
  }
}

// Main function
function main() {
  console.log('===== Socket.IO Client Test =====');
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log('Server URL:', SERVER_URL);
  console.log('Type "help" for a list of commands');
  
  // Auto-connect
  connectToServer();
  
  // Handle user input
  rl.setPrompt('> ');
  rl.prompt();
  
  rl.on('line', (line) => {
    processCommand(line);
    if (line.trim().toLowerCase() !== 'exit') {
      rl.prompt();
    }
  });
  
  rl.on('close', () => {
    if (socket) {
      socket.disconnect();
    }
    process.exit(0);
  });
}

// Start the client
main(); 