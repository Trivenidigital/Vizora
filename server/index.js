// Simple server for device discovery
const http = require('http');
const { Server } = require('socket.io');
const deviceScanner = require('./deviceScanner');

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Device Discovery Server');
});

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send connected event
  socket.emit('connected');

  // Handle scan request
  socket.on('startScan', async () => {
    console.log('Scan requested by client:', socket.id);

    // Check if a scan is already in progress
    if (deviceScanner.isScanning()) {
      socket.emit('scanStatus', { status: 'already-scanning' });
      return;
    }

    // Start the scan
    socket.emit('scanStatus', { status: 'started' });

    try {
      // Start scanning for devices
      deviceScanner.scanNetwork(
        // Progress callback
        (progress, message) => {
          socket.emit('scanProgress', { progress, message });
        },
        // Device found callback
        (device) => {
          socket.emit('deviceFound', device);
        }
      ).then(() => {
        // Scan complete
        socket.emit('scanComplete');
      }).catch((error) => {
        // Scan error
        socket.emit('scanError', { message: error.message });
      });
    } catch (error) {
      socket.emit('scanError', { message: error.message });
    }
  });

  // Handle manual device addition
  socket.on('addManualDevice', (deviceData) => {
    console.log('Manual device addition requested:', deviceData);
    
    try {
      const device = deviceScanner.addManualDevice(deviceData);
      socket.emit('deviceFound', device);
    } catch (error) {
      socket.emit('scanError', { message: error.message });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Device discovery server running on port ${PORT}`);
});
