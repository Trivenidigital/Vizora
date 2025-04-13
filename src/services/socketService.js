/**
 * Socket Service - manages real-time communication
 */

const socketIO = require('socket.io');
const config = require('../../config');
const logger = require('../utils/logger');
const displayService = require('./displayService');
const controllerService = require('./controllerService');
const { Display } = require('../models');

// Socket.IO instance
let io;

// Connected clients by type and ID
const connectedClients = {
  displays: new Map(),
  controllers: new Map()
};

/**
 * Initialize Socket.IO server
 */
function initialize(server) {
  io = socketIO(server, {
    path: config.socketio.path,
    cors: {
      origin: config.socketio.cors.origin,
      methods: config.socketio.cors.methods,
      credentials: config.socketio.cors.credentials,
      allowedHeaders: ["*"]
    }
  });
  
  logger.info('Socket.IO server initialized');
  
  // Set up middleware for authentication if needed
  // io.use((socket, next) => {
  //   // Authentication can be added here
  //   next();
  // });
  
  // Connection handler
  io.on('connection', handleConnection);
  
  return io;
}

/**
 * Handle new socket connections
 */
function handleConnection(socket) {
  logger.info(`New socket connection: ${socket.id}`);
  
  // Verify socket works with immediate test message
  socket.emit('welcome', { 
    message: 'Welcome to Vizora Socket.IO server',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  // Log socket details
  console.log(`DEBUG: Socket connected - ID: ${socket.id}, Transport: ${socket.conn.transport.name}`);
  console.log(`DEBUG: Socket rooms:`, Array.from(socket.rooms || []));
  
  // Register handlers
  socket.on('disconnect', () => handleDisconnect(socket));
  socket.on('error', (error) => handleError(socket, error));
  
  // Device registration
  socket.on('register:display', (data) => {
    console.log(`DEBUG: register:display event received from ${socket.id} with data:`, data);
    registerDisplay(socket, data)
      .then(result => {
        console.log(`DEBUG: registerDisplay completed with result:`, result);
      })
      .catch(error => {
        console.error(`DEBUG: registerDisplay failed with error:`, error);
        socket.emit('error', { message: error.message });
      });
  });
  
  socket.on('register:controller', (data) => registerController(socket, data));
  
  // ... existing event handlers ...
}

/**
 * Register a display device
 */
async function registerDisplay(socket, data) {
  try {
    const { deviceId, name, model, location, qrCode, status } = data;
    
    console.log(`DEBUG [registerDisplay]: Starting registration with data:`, JSON.stringify(data));
    
    if (!deviceId) {
      logger.error('No device ID provided for display registration');
      console.log(`DEBUG [registerDisplay]: Registration failed - deviceId is required`);
      socket.emit('error', { message: 'Device ID is required' });
      return { success: false, error: 'Device ID is required' };
    }
    
    logger.info(`Attempting to register display: ${deviceId}`, data);
    console.log(`DEBUG [registerDisplay]: Registering display with deviceId: ${deviceId}`);
    
    // Register display in database
    try {
      // First check if a display exists with this QR code
      let display = await Display.findOne({ 
        $or: [
          { qrCode: deviceId },
          { deviceId: deviceId }
        ]
      });
      console.log(`DEBUG [registerDisplay]: Display search result:`, display ? `Found with ID ${display._id}` : 'Not found');
      
      if (display) {
        logger.info(`Found existing display with QR code ${deviceId}`);
        console.log(`DEBUG [registerDisplay]: Found existing display with QR code ${deviceId}: ${display._id}`);
        
        // Update existing display - make sure to use valid enum values
        display.status = status || 'active'; // Use 'active' not 'online'
        display.lastConnected = new Date();
        
        if (name) display.name = name;
        if (location) display.location = location;
        if (model) display.model = model;
        
        await display.save();
        console.log(`DEBUG [registerDisplay]: Updated existing display`);
      } else {
        // Create a new display directly with ALL required fields
        console.log(`DEBUG [registerDisplay]: Creating new display directly using Display model`);
        
        // Ensure we have all required fields with proper values
        const displayData = {
          qrCode: deviceId,  // Required
          name: name || 'Default Display',  // Required
          location: location || 'Unknown Location',  // Required
          status: status || 'active',  // Use valid enum value
          lastConnected: new Date()
        };
        
        console.log(`DEBUG [registerDisplay]: Creating new display with data:`, displayData);
        display = new Display(displayData);
        
        await display.save();
        console.log(`DEBUG [registerDisplay]: Created new display with ID: ${display._id}`);
      }
      
      // Add to connected clients
      connectedClients.displays.set(deviceId, socket.id);
      console.log(`DEBUG [registerDisplay]: Added to connectedClients with deviceId: ${deviceId}`);
      
      // Join display rooms
      socket.join(`display:${deviceId}`);
      socket.join(`qrcode:${deviceId}`);
      
      console.log(`DEBUG [registerDisplay]: Socket ${socket.id} joined rooms: display:${deviceId}, qrcode:${deviceId}`);
      console.log(`DEBUG [registerDisplay]: Connected clients:`, Array.from(connectedClients.displays.entries()));
      
      // Create response object
      const response = {
        success: true,
        deviceId,
        displayId: display._id,
        displayName: display.name,
        pairingCode: deviceId,
        qrCode: deviceId
      };
      
      // Send registration confirmation - try different approaches to ensure delivery
      console.log(`DEBUG [registerDisplay]: Emitting display:registered event to socket ${socket.id}`);
      
      // Method 1: Direct emit
      socket.emit('display:registered', response);
      
      // Method 2: Emit after delay
      setTimeout(() => {
        if (socket.connected) {
          console.log(`DEBUG [registerDisplay]: Retrying emit via setTimeout`);
          socket.emit('display:registered', {
            ...response,
            retryMethod: 'setTimeout'
          });
        }
      }, 500);
      
      // Method 3: Emit to room
      io.to(socket.id).emit('display:registered', {
        ...response,
        retryMethod: 'toRoom'
      });
      
      console.log(`DEBUG [registerDisplay]: Emitted registration confirmation with multiple methods`);
      
      // Notify controllers about the display status
      notifyDisplayStatusChange(deviceId, 'active');
      
      logger.info(`Display registered successfully: ${deviceId}`);
      
      return { success: true, deviceId, displayId: display._id };
    } catch (error) {
      console.log(`DEBUG [registerDisplay]: Error registering display:`, error);
      logger.error(`Error registering display: ${error.message}`, error);
      socket.emit('error', { message: error.message });
      return { success: false, error: error.message };
    }
  } catch (error) {
    console.log(`DEBUG [registerDisplay]: Outer error in registration handler:`, error);
    logger.error(`Error in display registration handler: ${error.message}`, error);
    socket.emit('error', { message: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Notify a display that it has been paired with a user
 * @param {string} qrCode - The QR code used for pairing
 * @param {object} pairingData - The pairing information
 */
async function notifyDisplayPaired(qrCode, pairingData) {
  try {
    logger.info(`Attempting to notify display with QR code ${qrCode} about pairing`);
    console.log(`DEBUG: notifyDisplayPaired called with QR code: ${qrCode}`);
    console.log(`DEBUG: Current connected displays: ${JSON.stringify(Array.from(connectedClients.displays.entries()))}`);
    
    // Find any sockets associated with this QR code
    const displaySockets = [];
    let notificationSent = false;
    
    // Iterate through connected displays and find those matching the QR code
    for (const [deviceId, socketId] of connectedClients.displays.entries()) {
      console.log(`DEBUG: Checking deviceId: ${deviceId} against QR code: ${qrCode}`);
      if (deviceId === qrCode || String(deviceId) === String(qrCode)) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.connected) {
          displaySockets.push(socketId);
          logger.info(`Found connected display socket for QR code ${qrCode}: ${socketId}`);
        } else {
          logger.warn(`Found socket ID ${socketId} for QR code ${qrCode} but socket not connected or not found`);
        }
      }
    }
    
    // Try several broadcasting approaches
    
    // 1. Emit to specific socket IDs found
    if (displaySockets.length > 0) {
      // Emit pairing event to all matched sockets
      for (const socketId of displaySockets) {
        logger.info(`Sending pairing notification to display socket ${socketId}`);
        console.log(`DEBUG: Emitting 'display:paired' event to socket: ${socketId}`);
        
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.connected) {
          socket.emit('display:paired', {
            success: true,
            timestamp: new Date().toISOString(),
            qrCode: qrCode,
            method: 'direct',
            ...pairingData
          });
          notificationSent = true;
        }
      }
    }
    
    // 2. Broadcast to room with QR code
    console.log(`DEBUG: Broadcasting to room qrcode:${qrCode}`);
    io.to(`qrcode:${qrCode}`).emit('display:paired', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: qrCode,
      method: 'room',
      ...pairingData
    });
    
    // 3. Also broadcast to room with display: prefix
    console.log(`DEBUG: Broadcasting to room display:${qrCode}`);
    io.to(`display:${qrCode}`).emit('display:paired', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: qrCode,
      method: 'display-room',
      ...pairingData
    });
    
    // 4. Broadcast to all clients as fallback
    console.log(`DEBUG: Broadcasting to all clients`);
    io.emit('display:paired:broadcast', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: qrCode,
      method: 'broadcast',
      ...pairingData
    });
    
    logger.info(`Pairing notification attempts made for QR code ${qrCode}`);
    return true;
  } catch (error) {
    logger.error(`Error notifying display about pairing:`, error);
    console.error(`DEBUG: Error in notifyDisplayPaired:`, error);
    return false;
  }
} 