const { io } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { app } = require('../src/app');
const { setupSocketIO } = require('../src/socket');

describe('Socket.IO Communication', () => {
  let httpServer;
  let ioServer;
  let clientSocket;
  let serverSocket;

  beforeAll((done) => {
    httpServer = createServer(app);
    ioServer = new Server(httpServer);
    setupSocketIO(ioServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`);
      ioServer.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    ioServer.close();
    clientSocket.close();
  });

  beforeEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (serverSocket) {
      serverSocket.disconnect();
    }
  });

  it('should connect successfully', (done) => {
    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  it('should register a display', (done) => {
    const displayData = {
      deviceId: 'test-device-1',
      name: 'Test Display',
      location: 'Test Location'
    };

    clientSocket.emit('register:display', displayData);

    clientSocket.on('display:registered', (response) => {
      expect(response.success).toBe(true);
      expect(response.display).toMatchObject(displayData);
      done();
    });
  });

  it('should handle display pairing', (done) => {
    const displayData = {
      deviceId: 'test-device-2',
      name: 'Test Display 2',
      location: 'Test Location 2'
    };

    // Register the display first
    clientSocket.emit('register:display', displayData);

    clientSocket.on('display:registered', () => {
      // Simulate pairing request
      const pairingData = {
        displayId: displayData.deviceId,
        qrCode: 'test-qr-code'
      };

      clientSocket.emit('display:pair', pairingData);

      clientSocket.on('display:paired', (response) => {
        expect(response.success).toBe(true);
        expect(response.displayId).toBe(displayData.deviceId);
        done();
      });
    });
  });

  it('should handle display disconnection', (done) => {
    const displayData = {
      deviceId: 'test-device-3',
      name: 'Test Display 3',
      location: 'Test Location 3'
    };

    // Register the display
    clientSocket.emit('register:display', displayData);

    clientSocket.on('display:registered', () => {
      // Disconnect the client
      clientSocket.disconnect();

      // Wait for disconnect event
      setTimeout(() => {
        expect(clientSocket.connected).toBe(false);
        done();
      }, 100);
    });
  });

  it('should handle invalid display registration', (done) => {
    const invalidData = {
      // Missing required fields
      name: 'Invalid Display'
    };

    clientSocket.emit('register:display', invalidData);

    clientSocket.on('display:registered', (response) => {
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      done();
    });
  });

  it('should handle display status updates', (done) => {
    const displayData = {
      deviceId: 'test-device-4',
      name: 'Test Display 4',
      location: 'Test Location 4'
    };

    // Register the display
    clientSocket.emit('register:display', displayData);

    clientSocket.on('display:registered', () => {
      // Send status update
      const statusUpdate = {
        displayId: displayData.deviceId,
        status: 'online',
        lastSeen: new Date().toISOString()
      };

      clientSocket.emit('display:status', statusUpdate);

      clientSocket.on('display:status:updated', (response) => {
        expect(response.success).toBe(true);
        expect(response.displayId).toBe(displayData.deviceId);
        expect(response.status).toBe('online');
        done();
      });
    });
  });
}); 