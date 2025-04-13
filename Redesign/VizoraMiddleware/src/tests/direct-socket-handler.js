/**
 * Direct Socket Handler Test
 * This script adds a direct socket event handler to the middleware for testing
 */

const path = require('path');
const fs = require('fs');

// Path to socketService.js
const socketServicePath = path.join(__dirname, '..', 'services', 'socketService.js');

// Path to server.js
const serverPath = path.join(__dirname, '..', 'server.js');

// Backup the original file
const backupSocketService = fs.readFileSync(socketServicePath, 'utf8');
const backupServer = fs.readFileSync(serverPath, 'utf8');

// Create backup files
fs.writeFileSync(`${socketServicePath}.backup`, backupSocketService);
fs.writeFileSync(`${serverPath}.backup`, backupServer);

console.log('Created backups of original files');

// Add direct event handler for testing to socketService.js
let modifiedSocketService = backupSocketService;

// Check if the socket service already has our test handler
if (!modifiedSocketService.includes('socket.on(\'test:echo\'')) {
  // Find the handleConnection function
  const handleConnectionIndex = modifiedSocketService.indexOf('function handleConnection(socket)');
  
  if (handleConnectionIndex !== -1) {
    // Find the end of the function setup where we register handlers
    const registrationEnd = modifiedSocketService.indexOf('// Command', handleConnectionIndex);
    
    // Test handlers to add
    const testHandlers = `
  // Test handlers for diagnostics
  socket.on('test:echo', (data) => {
    console.log('TEST ECHO received:', data);
    socket.emit('test:echo:response', {
      success: true,
      receivedData: data,
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });
  });

  // Direct pairing test
  socket.on('test:pair', (data) => {
    console.log('TEST PAIR received:', data);
    
    // Emit a direct pairing notification to this socket
    socket.emit('display:paired', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: data.qrCode,
      displayId: 'test-id-123',
      name: 'Test Display',
      location: 'Test Location',
      user: {
        id: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com'
      },
      testMessage: 'This is a direct test notification'
    });
    
    // Also broadcast to ensure it works
    io.emit('display:paired:broadcast', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: data.qrCode,
      message: 'This is a broadcast test notification'
    });
  });
  `;
    
    // Insert the test handlers
    modifiedSocketService = 
      modifiedSocketService.slice(0, registrationEnd) + 
      testHandlers + 
      modifiedSocketService.slice(registrationEnd);
    
    // Write the modified file
    fs.writeFileSync(socketServicePath, modifiedSocketService);
    console.log('Added test handlers to socketService.js');
  } else {
    console.error('Could not find handleConnection function in socketService.js');
  }
} else {
  console.log('Test handlers already exist in socketService.js');
}

// Create a test client script
const testClientPath = path.join(__dirname, 'socket-client-test.js');
const testClientCode = `
/**
 * Socket.IO Test Client
 * This script tests direct socket communication with the middleware
 */

const { io } = require('socket.io-client');
const readline = require('readline');

// Configuration
const SOCKET_URL = 'http://localhost:3003';

// Test QR code
const TEST_QR_CODE = 'TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Utility functions
function log(message) {
  console.log(\`[\${new Date().toISOString()}] \${message}\`);
}

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function
function runClient() {
  log('Starting Socket.IO test client');
  log(\`Test QR Code: \${TEST_QR_CODE}\`);
  
  // Connect to Socket.IO server
  log('Connecting to Socket.IO server...');
  
  const socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true
  });
  
  // Socket event handlers
  socket.on('connect', () => {
    log(\`Connected to server with socket ID: \${socket.id}\`);
    showMenu();
  });
  
  socket.on('disconnect', (reason) => {
    log(\`Disconnected from server: \${reason}\`);
  });
  
  socket.on('connect_error', (error) => {
    log(\`Connection error: \${error.message}\`);
  });
  
  // Test response handlers
  socket.on('test:echo:response', (data) => {
    log(\`Echo response received: \${JSON.stringify(data)}\`);
  });
  
  // Listen for display events
  socket.on('display:registered', (data) => {
    log(\`Display registered: \${JSON.stringify(data)}\`);
  });
  
  socket.on('display:paired', (data) => {
    log(\`Display paired notification received: \${JSON.stringify(data)}\`);
  });
  
  socket.on('display:paired:broadcast', (data) => {
    log(\`Broadcast paired notification received: \${JSON.stringify(data)}\`);
  });
  
  // Listen for all events
  socket.onAny((eventName, ...args) => {
    log(\`Event received: \${eventName}\`);
  });
  
  // Menu functions
  function showMenu() {
    console.log('\\n--- Test Menu ---');
    console.log('1. Send Echo Test');
    console.log('2. Register Display');
    console.log('3. Test Direct Pairing');
    console.log('4. Disconnect');
    console.log('5. Exit');
    console.log('---------------');
    
    rl.question('Select an option: ', (answer) => {
      switch(answer) {
        case '1':
          sendEchoTest();
          break;
        case '2':
          registerDisplay();
          break;
        case '3':
          testDirectPairing();
          break;
        case '4':
          socket.disconnect();
          setTimeout(() => {
            socket.connect();
          }, 1000);
          break;
        case '5':
          socket.disconnect();
          rl.close();
          process.exit(0);
          break;
        default:
          console.log('Invalid option');
          showMenu();
      }
    });
  }
  
  function sendEchoTest() {
    const testData = {
      message: 'Hello server!',
      timestamp: new Date().toISOString(),
      qrCode: TEST_QR_CODE
    };
    
    log(\`Sending echo test: \${JSON.stringify(testData)}\`);
    socket.emit('test:echo', testData);
    
    setTimeout(showMenu, 1000);
  }
  
  function registerDisplay() {
    const registerData = {
      deviceId: TEST_QR_CODE,
      name: 'Test Display',
      model: 'Test Model'
    };
    
    log(\`Registering display: \${JSON.stringify(registerData)}\`);
    socket.emit('register:display', registerData);
    
    setTimeout(showMenu, 1000);
  }
  
  function testDirectPairing() {
    const pairingData = {
      qrCode: TEST_QR_CODE
    };
    
    log(\`Testing direct pairing: \${JSON.stringify(pairingData)}\`);
    socket.emit('test:pair', pairingData);
    
    setTimeout(showMenu, 1000);
  }
}

// Start the client
runClient();
`;

fs.writeFileSync(testClientPath, testClientCode);
console.log(`Created test client at ${testClientPath}`);

console.log('\nInstallation complete!');
console.log('To run the tests:');
console.log('1. Restart the middleware server');
console.log('2. Run the socket client test: node src/tests/socket-client-test.js');
console.log('3. To restore original files run: mv src/services/socketService.js.backup src/services/socketService.js'); 