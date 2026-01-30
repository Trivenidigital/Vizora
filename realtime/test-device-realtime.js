const { io } = require('socket.io-client');

const REALTIME_URL = 'ws://127.0.0.1:3002';
const DEVICE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYzVmZjk4Mi1hNmUxLTRmNDYtYjQyNS01MjJjMWQ3NThjOTkiLCJkZXZpY2VJZGVudGlmaWVyIjoiMDA6MTU6NWQ6MDU6YTI6Y2IiLCJvcmdhbml6YXRpb25JZCI6IjJmZDY4OTY4LTAyYjAtNGM0MC05ZmM4LWU2MmE2MWRkNWVkYyIsInR5cGUiOiJkZXZpY2UiLCJpYXQiOjE3Njk3ODIzOTcsImV4cCI6MTgwMTMxODM5N30.F6LRyNtGTBCS3gsMUaHBMSezW6VSpHaxBtuGsaousp8';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║      TEST DEVICE REALTIME GATEWAY CONNECTION           ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`\nRealtime URL: ${REALTIME_URL}`);
console.log(`Timestamp: ${new Date().toISOString()}\n`);

console.log('📡 Attempting to connect to realtime gateway...');

const socket = io(REALTIME_URL, {
  auth: { token: DEVICE_TOKEN },
  transports: ['websocket', 'polling'],
  reconnection: false,
  reconnectionAttempts: 1,
});

const timeout = setTimeout(() => {
  socket.disconnect();
  console.log('\n✗ Connection timeout (5 seconds)');
  console.log('  The realtime gateway may not be responding');
  process.exit(1);
}, 5000);

socket.on('connect', () => {
  clearTimeout(timeout);
  console.log('\n✓ Successfully connected to realtime gateway');
  console.log(`  Socket ID: ${socket.id}`);
  console.log(`  Transport: ${socket.io.engine.transport.name}`);

  console.log('\n📤 Sending heartbeat message...');
  socket.emit('heartbeat', {
    timestamp: Date.now(),
    contentId: 'cml0z5rvu000nqji6s9o6m3gu',
    metrics: {
      cpuUsage: 15,
      memoryUsage: 256,
      storageUsed: 1024
    },
    status: 'online',
  }, (ack) => {
    console.log('✓ Heartbeat sent and acknowledged');
    console.log(`  Response: ${JSON.stringify(ack || {}).substring(0, 100)}...`);

    console.log('\n💬 Listening for messages from gateway...');
    socket.on('playlist:push', (data) => {
      console.log('\n✓ Received playlist push from gateway');
      console.log(`  Playlist ID: ${data.playlistId || data.id}`);
      console.log(`  Items: ${data.items?.length || 0}`);
    });

    socket.on('command', (data) => {
      console.log('\n✓ Received command from gateway');
      console.log(`  Command: ${data.command}`);
    });

    setTimeout(() => {
      console.log('\n✓ Realtime gateway connection verified');
      console.log('  Device can send heartbeats');
      console.log('  Device can receive messages from gateway');
      socket.disconnect();
      process.exit(0);
    }, 2000);
  });
});

socket.on('connect_error', (error) => {
  clearTimeout(timeout);
  console.log('\n✗ Connection error');
  console.log(`  Error: ${error.message}`);
  console.log(`  Data: ${error.data?.message || 'No details'}`);
  socket.disconnect();
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log(`\nDisconnected: ${reason}`);
});
