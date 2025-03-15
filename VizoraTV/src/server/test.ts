import { io, Socket } from 'socket.io-client';

// Test display client
async function testDisplay() {
  const socket = io('http://localhost:3003', {
    transports: ['websocket'],
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('Display connected');
    socket.emit('register_display');
  });

  socket.on('display_registered', (data) => {
    console.log('Display registered:', data);
  });

  socket.on('pair_success', (data) => {
    console.log('Display paired:', data);
  });

  socket.on('content_update', (data) => {
    console.log('Content received:', data);
  });

  socket.on('error', (error) => {
    console.error('Display error:', error);
  });
}

// Test controller client
async function testController(pairingCode: string) {
  const socket = io('http://localhost:3003', {
    transports: ['websocket'],
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('Controller connected');
    socket.emit('pair_request', { pairingCode });
  });

  socket.on('pair_success', (data) => {
    console.log('Controller paired:', data);
    // Send test content
    socket.emit('content_update', {
      displayId: data.displayId,
      content: {
        type: 'text',
        text: 'Test content from controller'
      }
    });
  });

  socket.on('pair_failed', (error) => {
    console.error('Pairing failed:', error);
  });

  socket.on('content_update_failed', (error) => {
    console.error('Content update failed:', error);
  });
}

// Run tests
async function runTests() {
  console.log('Starting display test...');
  await testDisplay();

  // Wait for display to register
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\nStarting controller test...');
  // You'll need to replace this with the actual pairing code from the display
  const pairingCode = 'ENTER_PAIRING_CODE_HERE';
  await testController(pairingCode);
}

runTests().catch(console.error); 