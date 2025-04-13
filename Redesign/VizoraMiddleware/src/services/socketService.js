/**
 * Socket Service - manages real-time communication
 */

const { Server } = require('socket.io');
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
function initSocketService(server) {
  if (io) {
    logger.warn('Socket.IO already initialized');
    return;
  }

  // Initialize Socket.IO with the server instance
  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    logger.info(`[Socket] ✅ New client connected: ${socket.id}`);
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`[Socket] Error for client ${socket.id}:`, error);
    });
  });

  // Add diagnostic endpoint
  io.engine.on("connection_error", (err) => {
    logger.error(`[Socket] Connection error:`, {
      code: err.code,
      message: err.message,
      context: err.context
    });
  });

  return io;
}

/**
 * Get the Socket.IO instance
 */
function getSocketInstance() {
  return io;
}

/**
 * Initialize the socket service
 * Added to provide proper initialization function 
 */
function init() {
  logger.info('Socket service initialized');
  return true;
}

/**
 * Handle new socket connections
 */
function handleConnection(socket) {
  logger.info(`New socket connection: ${socket.id}`);
  
  // Send a test welcome message to verify the socket works
  console.log(`DEBUG: Testing socket ${socket.id} with direct welcome message`);
  socket.emit('welcome', { 
    message: 'Welcome to Vizora Socket.IO server',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  // Register handlers
  socket.on('disconnect', () => handleDisconnect(socket));
  socket.on('error', (error) => handleError(socket, error));
  
  // Device registration
  socket.on('register:display', (data) => registerDisplay(socket, data));
  socket.on('register:controller', (data) => registerController(socket, data));
  
  // Pairing
  socket.on('pairing:initiate', (data) => initiatePairing(socket, data));
  socket.on('pairing:complete', (data) => completePairing(socket, data));
  socket.on('pairing:verify', (data) => verifyPairing(socket, data));
  
  // Commands
  socket.on('command', (data) => handleCommand(socket, data));

  // Test handlers
  socket.on('test:echo', (data) => handleTestEcho(socket, data));
  socket.on('test:pair', (data) => handleTestPair(socket, data));
}

/**
 * Handle socket disconnection
 */
function handleDisconnect(socket) {
  const displayId = findDisplayBySocketId(socket.id);
  const controllerId = findControllerBySocketId(socket.id);
  
  if (displayId) {
    logger.info(`Display disconnected: ${displayId}`);
    connectedClients.displays.delete(displayId);
    
    // Notify paired controllers
    notifyDisplayStatusChange(displayId, 'offline');
  }
  
  if (controllerId) {
    logger.info(`Controller disconnected: ${controllerId}`);
    connectedClients.controllers.delete(controllerId);
    
    // Notify paired displays
    notifyControllerStatusChange(controllerId, 'offline');
  }
}

/**
 * Handle socket errors
 */
function handleError(socket, error) {
  logger.error(`Socket error for ${socket.id}:`, error);
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
          deviceId: deviceId, // Explicitly set deviceId for consistent lookup
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
      
      // ENHANCED: More reliable room and connection management
      // Update connection map with consistency
      if (connectedClients instanceof Map) {
        connectedClients.set(deviceId, socket.id);
        console.log(`DEBUG [registerDisplay]: Added to connectedClients Map with deviceId: ${deviceId}`);
      } else if (connectedClients.displays && typeof connectedClients.displays.set === 'function') {
        connectedClients.displays.set(deviceId, socket.id);
        console.log(`DEBUG [registerDisplay]: Added to connectedClients.displays Map with deviceId: ${deviceId}`);
      } else {
        console.error(`DEBUG [registerDisplay]: Cannot add to connectedClients, invalid structure:`, typeof connectedClients);
      }
      
      // Ensure we leave any previous rooms before joining new ones
      if (socket.rooms) {
        const roomsToLeave = Array.from(socket.rooms)
          .filter(room => room.startsWith('display:') || room.startsWith('qrcode:'));
        
        for (const room of roomsToLeave) {
          socket.leave(room);
          console.log(`DEBUG [registerDisplay]: Left previous room: ${room}`);
        }
      }
      
      // Join display rooms with different identifiers for maximum matching
      socket.join(`display:${deviceId}`);
      socket.join(`qrcode:${deviceId}`);
      
      // Also join with display ID from database for good measure
      if (display && display._id) {
        socket.join(`displayId:${display._id}`);
      }
      
      console.log(`DEBUG [registerDisplay]: Socket ${socket.id} joined rooms: display:${deviceId}, qrcode:${deviceId}`);
      
      // Log all connected clients for debugging
      let clientsDebug = "Unknown format";
      if (connectedClients instanceof Map) {
        clientsDebug = JSON.stringify(Array.from(connectedClients.entries()));
      } else if (connectedClients.displays && typeof connectedClients.displays.entries === 'function') {
        clientsDebug = JSON.stringify(Array.from(connectedClients.displays.entries()));
      }
      console.log(`DEBUG [registerDisplay]: Current connected clients: ${clientsDebug}`);
      
      // Send registration confirmation
      console.log(`DEBUG [registerDisplay]: Emitting display:registered event to socket ${socket.id}`);
      const registrationResponse = {
        success: true,
        deviceId,
        displayId: display._id,
        displayName: display.name,
        pairingCode: deviceId,
        qrCode: deviceId
      };
      
      // Send via multiple methods
      socket.emit('display:registered', registrationResponse);
      console.log(`DEBUG [registerDisplay]: Emitted registration confirmation directly`);
      
      // Also broadcast to specific room for redundancy
      io.to(`display:${deviceId}`).emit('display:registered', {
        ...registrationResponse,
        method: 'room-broadcast'
      });
      
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
 * Register a controller device
 */
async function registerController(socket, data) {
  try {
    const { deviceId, name, model } = data;
    
    if (!deviceId) {
      return socket.emit('error', { message: 'Device ID is required' });
    }
    
    // Register in database
    const controller = await controllerService.registerController({
      deviceId,
      name,
      model
    });
    
    // Associate socket with controller
    connectedClients.controllers.set(deviceId, socket.id);
    socket.join(`controller:${deviceId}`);
    
    logger.info(`Controller registered: ${deviceId}`);
    
    // Notify paired displays
    notifyControllerStatusChange(deviceId, 'online');
    
    socket.emit('registered', {
      success: true,
      type: 'controller',
      device: controller
    });
  } catch (error) {
    logger.error(`Error registering controller:`, error);
    socket.emit('error', { message: error.message });
  }
}

/**
 * Initiate pairing process for a display
 */
async function initiatePairing(socket, data) {
  try {
    const { displayId } = data;
    
    if (!displayId) {
      return socket.emit('error', { message: 'Display ID is required' });
    }
    
    // Find socket info
    const socketId = connectedClients.displays.get(displayId);
    
    if (!socketId) {
      return socket.emit('error', { message: 'Display not connected' });
    }
    
    // Generate pairing code
    const pairingData = await displayService.generatePairingCode(displayId);
    
    // Send pairing code to display
    io.to(socketId).emit('pairing:code', pairingData);
    
    socket.emit('pairing:initiated', {
      success: true,
      displayId,
      ...pairingData
    });
  } catch (error) {
    logger.error(`Error initiating pairing:`, error);
    socket.emit('error', { message: error.message });
  }
}

/**
 * Complete pairing between controller and display
 */
async function completePairing(socket, data) {
  try {
    const { pairingCode, controllerDeviceId } = data;
    
    if (!pairingCode || !controllerDeviceId) {
      return socket.emit('error', { message: 'Pairing code and controller ID are required' });
    }
    
    // Complete pairing in database - use pairingService instead of displayService
    const pairingService = require('./pairingService');
    const result = await pairingService.completePairing(pairingCode, controllerDeviceId);
    
    // Display notification is now handled within pairingService.completePairing
    
    socket.emit('pairing:complete', {
      success: true,
      display: result.display,
      controller: result.controller
    });
  } catch (error) {
    logger.error(`Error completing pairing:`, error);
    socket.emit('error', { message: error.message });
  }
}

/**
 * Verify pairing between controller and display
 */
async function verifyPairing(socket, data) {
  try {
    const { displayId, controllerId } = data;
    
    if (!displayId || !controllerId) {
      return socket.emit('error', { message: 'Display ID and controller ID are required' });
    }
    
    // Check if paired in database
    const isPaired = await displayService.isDisplayPaired(displayId, controllerId);
    
    socket.emit('pairing:verified', {
      success: true,
      isPaired,
      displayId,
      controllerId
    });
  } catch (error) {
    logger.error(`Error verifying pairing:`, error);
    socket.emit('error', { message: error.message });
  }
}

/**
 * Handle commands from controllers to displays
 */
async function handleCommand(socket, data) {
  try {
    const { controllerId, displayId, command, payload } = data;
    
    if (!controllerId || !displayId || !command) {
      return socket.emit('error', { message: 'Controller ID, display ID and command are required' });
    }
    
    // Verify pairing
    const isPaired = await displayService.isDisplayPaired(displayId, controllerId);
    
    if (!isPaired) {
      return socket.emit('error', { message: 'Controller not paired with display' });
    }
    
    // Find display socket
    const displaySocketId = connectedClients.displays.get(displayId);
    
    if (!displaySocketId) {
      return socket.emit('error', { message: 'Display not connected' });
    }
    
    // Send command to display
    io.to(displaySocketId).emit('command', {
      controllerId,
      command,
      payload
    });
    
    socket.emit('command:sent', {
      success: true,
      command,
      displayId
    });
    
    logger.debug(`Command ${command} sent from ${controllerId} to ${displayId}`);
  } catch (error) {
    logger.error(`Error sending command:`, error);
    socket.emit('error', { message: error.message });
  }
}

/**
 * Notify paired controllers when display status changes
 */
async function notifyDisplayStatusChange(deviceId, status) {
  try {
    console.log(`Notifying status change for device: ${deviceId} to status: ${status}`);
    
    // Find socket directly from connected clients without DB lookup first
    const socketId = getSocketForDevice(deviceId);
    
    if (!socketId) {
      console.log(`No socket found for device: ${deviceId}, trying DB lookup`);
      // Only try DB lookup if socket not found in connected clients
      try {
        const display = await displayService.getDisplayByDeviceId(deviceId);
        if (display) {
          // Emit to all clients in case socket rooms aren't properly set up
          io.emit('display:status', {
            deviceId,
            displayId: display._id,
            status,
            timestamp: new Date().toISOString()
          });
          console.log(`Broadcasted status change for ${deviceId} to all clients`);
        }
      } catch (err) {
        // Continue even if DB lookup fails - don't throw
        console.log(`DB lookup failed for ${deviceId}, but continuing: ${err.message}`);
      }
    } else {
      // Send to specific socket and broadcast
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('display:status', {
          deviceId,
          status,
          timestamp: new Date().toISOString()
        });
        console.log(`Sent status change to socket ${socketId} for device ${deviceId}`);
      }
      
      // Also broadcast to all for redundancy
      io.emit('display:status', {
        deviceId,
        status,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`Error in notifyDisplayStatusChange for ${deviceId}:`, error);
    // Don't rethrow - continue execution
  }
}

/**
 * Get socket ID for a specific device
 * @param {string} deviceId - Device ID to find socket for
 * @returns {string|null} - Socket ID if found, null otherwise
 */
function getSocketForDevice(deviceId) {
  try {
    console.log(`DEBUG: getSocketForDevice called for deviceId: ${deviceId}`);
    console.log(`DEBUG: connectedClients type: ${typeof connectedClients}`);
    
    // Check if connectedClients is a Map
    if (connectedClients instanceof Map) {
      console.log(`DEBUG: connectedClients is a Map, searching directly`);
      return connectedClients.get(deviceId) || null;
    } 
    // Check if connectedClients has a displays property that is a Map
    else if (connectedClients && connectedClients.displays && connectedClients.displays instanceof Map) {
      console.log(`DEBUG: Using connectedClients.displays Map to find device`);
      return connectedClients.displays.get(deviceId) || null;
    }
    // Fallback to manual search if structure is unknown
    else {
      console.log(`DEBUG: connectedClients structure unknown, trying manual search`);
      // Try to search in various possible structures
      if (connectedClients && typeof connectedClients === 'object') {
        // Try to access displays property if it exists
        if (connectedClients.displays) {
          const entries = Object.entries(connectedClients.displays);
          for (const [device, socketId] of entries) {
            if (device === deviceId) {
              return socketId;
            }
          }
        }
        // Try direct access if displays doesn't exist
        else {
          const entries = Object.entries(connectedClients);
          for (const [device, socketId] of entries) {
            if (device === deviceId) {
              return socketId;
            }
          }
        }
      }
    }
    
    console.log(`DEBUG: No socket found for deviceId: ${deviceId}`);
    return null;
  } catch (error) {
    console.error(`Error in getSocketForDevice:`, error);
    return null;
  }
}

/**
 * Notify paired displays when controller status changes
 */
async function notifyControllerStatusChange(controllerId, status) {
  try {
    // Find displays paired with this controller
    const controller = await controllerService.getControllerByDeviceId(controllerId);
    
    // Update controller status
    await controllerService.updateControllerStatus(controllerId, status);
    
    if (controller && controller.pairedDisplays && controller.pairedDisplays.length > 0) {
      // Find all paired displays
      for (const displayId of controller.pairedDisplays) {
        const display = await displayService.getDisplayByDeviceId(displayId);
        
        if (display) {
          const socketId = connectedClients.displays.get(display.deviceId);
          
          if (socketId) {
            io.to(socketId).emit('controller:status', {
              controllerId,
              status
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Error notifying controller status change:`, error);
  }
}

/**
 * Find display by socket ID
 */
function findDisplayBySocketId(socketId) {
  for (const [deviceId, id] of connectedClients.displays.entries()) {
    if (id === socketId) {
      return deviceId;
    }
  }
  return null;
}

/**
 * Find controller by socket ID
 */
function findControllerBySocketId(socketId) {
  for (const [deviceId, id] of connectedClients.controllers.entries()) {
    if (id === socketId) {
      return deviceId;
    }
  }
  return null;
}

/**
 * Get connected displays
 */
function getConnectedDisplays() {
  try {
    console.log(`DEBUG: getConnectedDisplays called`);
    console.log(`DEBUG: connectedClients type: ${typeof connectedClients}`);
    
    // Handle different client structures
    if (connectedClients.displays && connectedClients.displays instanceof Map) {
      console.log(`DEBUG: Using connectedClients.displays Map`);
      return Array.from(connectedClients.displays.keys());
    } 
    else if (connectedClients instanceof Map) {
      console.log(`DEBUG: connectedClients is a Map, returning keys`);
      return Array.from(connectedClients.keys());
    }
    else if (connectedClients.displays && typeof connectedClients.displays === 'object') {
      console.log(`DEBUG: connectedClients.displays is an object, returning keys`);
      return Object.keys(connectedClients.displays);
    }
    
    // Fallback to empty array if structure can't be determined
    console.log(`DEBUG: Could not determine connectedClients structure, returning empty array`);
    return [];
  } catch (error) {
    console.error(`Error in getConnectedDisplays:`, error);
    return [];
  }
}

/**
 * Get connected controllers
 */
function getConnectedControllers() {
  return Array.from(connectedClients.controllers.keys());
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
    
    let displayEntries = [];
    try {
      // Try different approaches to get the entries
      if (connectedClients.displays instanceof Map) {
        displayEntries = Array.from(connectedClients.displays.entries());
        console.log(`DEBUG: Got entries from connectedClients.displays Map`);
      } else if (connectedClients instanceof Map) {
        displayEntries = Array.from(connectedClients.entries());
        console.log(`DEBUG: Got entries from connectedClients Map`);
      } else if (connectedClients.displays && typeof connectedClients.displays === 'object') {
        displayEntries = Object.entries(connectedClients.displays);
        console.log(`DEBUG: Got entries from connectedClients.displays object`);
      }
    } catch (err) {
      console.log(`DEBUG: Error getting entries: ${err.message}, using empty array`);
      displayEntries = [];
    }
    
    console.log(`DEBUG: Display entries: ${JSON.stringify(displayEntries)}`);
    
    // Find any sockets associated with this QR code
    const displaySockets = new Set();
    
    // Approach 1: Direct lookup from connected clients
    // Iterate through connected displays and find those matching the QR code
    for (const [deviceId, socketId] of displayEntries) {
      console.log(`DEBUG: Checking deviceId: ${deviceId} against QR code: ${qrCode}`);
      if (String(deviceId) === String(qrCode)) {
        displaySockets.add(socketId);
        logger.info(`Found connected display socket for QR code ${qrCode}: ${socketId}`);
      }
    }
    
    // Approach 2: Find by socket rooms
    console.log(`DEBUG: Checking socket rooms for deviceId: ${qrCode}`);
    try {
      if (io && io.sockets && io.sockets.adapter && io.sockets.adapter.rooms) {
        // Check display room
        const displayRoom = `display:${qrCode}`;
        if (io.sockets.adapter.rooms.has(displayRoom)) {
          const socketIds = io.sockets.adapter.rooms.get(displayRoom);
          if (socketIds) {
            for (const socketId of socketIds) {
              displaySockets.add(socketId);
              console.log(`DEBUG: Found socket ${socketId} in room ${displayRoom}`);
            }
          }
        }
        
        // Check QR code room
        const qrCodeRoom = `qrcode:${qrCode}`;
        if (io.sockets.adapter.rooms.has(qrCodeRoom)) {
          const socketIds = io.sockets.adapter.rooms.get(qrCodeRoom);
          if (socketIds) {
            for (const socketId of socketIds) {
              displaySockets.add(socketId);
              console.log(`DEBUG: Found socket ${socketId} in room ${qrCodeRoom}`);
            }
          }
        }
      }
    } catch (err) {
      console.log(`DEBUG: Error checking socket rooms: ${err.message}`);
    }
    
    // Approach 3: Broadcast to all as a fallback for maximum coverage
    if (displaySockets.size === 0) {
      logger.warn(`No direct sockets found for QR code ${qrCode}, using broadcast`);
      console.log(`DEBUG: No direct sockets found, using broadcast to all clients`);
    }
    
    // Method 1: Send to specific sockets if any were found
    if (displaySockets.size > 0) {
      for (const socketId of displaySockets) {
        logger.info(`Sending direct pairing notification to display socket ${socketId}`);
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('display:paired', {
            success: true,
            timestamp: new Date().toISOString(),
            qrCode: qrCode,
            ...pairingData,
            method: 'direct'
          });
          console.log(`DEBUG: Sent direct notification to socket ${socketId}`);
        } else {
          console.log(`DEBUG: Could not find socket with ID ${socketId}`);
        }
      }
    }
    
    // Method 2: Broadcast to rooms
    const displayRoom = `display:${qrCode}`;
    io.to(displayRoom).emit('display:paired', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: qrCode,
      ...pairingData,
      method: 'room-broadcast'
    });
    console.log(`DEBUG: Sent broadcast to room ${displayRoom}`);
    
    const qrCodeRoom = `qrcode:${qrCode}`;
    io.to(qrCodeRoom).emit('display:paired', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: qrCode,
      ...pairingData,
      method: 'room-broadcast'
    });
    console.log(`DEBUG: Sent broadcast to room ${qrCodeRoom}`);
    
    // Method 3: Broadcast to all connected clients as ultimate fallback
    io.emit('display:paired', {
      success: true,
      timestamp: new Date().toISOString(),
      qrCode: qrCode,
      ...pairingData,
      broadcast: true
    });
    console.log(`DEBUG: Sent global broadcast to all clients`);
    
    logger.info(`Pairing notification sent via multiple methods for QR code ${qrCode}`);
    return true;
  } catch (error) {
    logger.error(`Error notifying display about pairing:`, error);
    console.error(`DEBUG: Error in notifyDisplayPaired:`, error);
    
    // Try one last broadcast in case of error
    try {
      io.emit('display:paired', {
        success: true,
        timestamp: new Date().toISOString(),
        qrCode: qrCode,
        ...pairingData,
        broadcast: true,
        error_recovery: true
      });
      console.log(`DEBUG: Sent error recovery broadcast to all clients`);
    } catch (e) {
      console.error(`DEBUG: Could not send error recovery broadcast:`, e);
    }
    
    return false;
  }
}

/**
 * Handle test echo event
 */
function handleTestEcho(socket, data) {
  logger.info(`Test echo received from ${socket.id}:`, data);
  
  // Echo the data back with a timestamp
  socket.emit('test:echo:response', {
    ...data,
    receivedAt: new Date().toISOString(),
    serverMessage: 'Echo test successful'
  });
}

/**
 * Handle test pair event
 */
async function handleTestPair(socket, data) {
  logger.info(`Test pair received from ${socket.id}:`, data);
  
  try {
    const { qrCode } = data;
    
    if (!qrCode) {
      logger.error('No QR code provided for test pairing');
      return socket.emit('error', { message: 'QR code is required' });
    }
    
    // Send direct notification to the socket that initiated the test
    socket.emit('display:paired', {
      success: true,
      qrCode,
      display: {
        name: 'Test Display',
        location: 'Test Location',
        status: 'active'
      },
      user: {
        name: 'Test User',
        email: 'test@example.com'
      },
      timestamp: new Date().toISOString()
    });
    
    // Broadcast to all clients
    io.emit('display:paired:broadcast', {
      qrCode,
      message: 'Test pairing broadcast notification',
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Test pairing notification sent for QR code: ${qrCode}`);
  } catch (error) {
    logger.error(`Error in test pair handler: ${error.message}`, error);
    socket.emit('error', { message: error.message });
  }
}

/**
 * Push content to a specific display
 * @param {string} displayId - The ID of the display (qrCode, deviceId, or MongoDB ID)
 * @param {object} contentData - The content to push to the display
 * @returns {object} Result of the operation
 */
async function pushContentToDisplay(displayId, contentData) {
  try {
    logger.info(`Pushing content to display: ${displayId}`);
    console.log(`DEBUG [pushContentToDisplay]: Pushing content to display: ${displayId}, content ID: ${contentData.contentId}`);
    
    // Validate required content data
    if (!contentData || !contentData.contentId) {
      logger.error('Invalid content data for push content operation');
      return { success: false, error: 'Invalid content data' };
    }
    
    // Find the socket ID for this device
    const socketId = getSocketForDevice(displayId);
    
    if (!socketId) {
      logger.error(`No connected socket found for display: ${displayId}`);
      return { success: false, error: 'Display not connected' };
    }
    
    // Get the socket directly
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      logger.error(`Socket not found for ID: ${socketId}`);
      return { success: false, error: 'Socket not found' };
    }
    
    // Prepare the content push data
    const pushData = {
      timestamp: new Date().toISOString(),
      content: contentData,
      displayId: displayId
    };
    
    // Method 1: Send directly to the socket
    socket.emit('content:push', pushData);
    logger.info(`Content push sent to socket ${socketId} for display ${displayId}`);
    
    // Method 2: Send to display room (backup)
    io.to(`display:${displayId}`).emit('content:push', {
      ...pushData,
      method: 'room'
    });
    
    // Method 3: Send to displayId room (backup)
    io.to(`displayId:${displayId}`).emit('content:push', {
      ...pushData,
      method: 'displayId-room'
    });
    
    // Method 4: Send to qrCode room (backup)
    io.to(`qrcode:${displayId}`).emit('content:push', {
      ...pushData,
      method: 'qrcode-room'
    });
    
    return { 
      success: true, 
      message: 'Content push sent',
      displayId,
      contentId: contentData.contentId,
      socketId
    };
  } catch (error) {
    logger.error(`Error pushing content to display ${displayId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify a display about scheduled content changes
 * @param {string} displayId - The ID of the display to notify
 * @param {object} scheduleData - Schedule data
 * @returns {boolean} Whether the notification was sent successfully
 */
async function notifyScheduleChange(displayId, scheduleData) {
  try {
    logger.info(`Notifying display ${displayId} about schedule changes`);
    
    // Find the socket ID for this device
    const socketId = getSocketForDevice(displayId);
    
    if (!socketId) {
      logger.warn(`No connected socket found for display: ${displayId}, schedule update will be picked up on next content fetch`);
      return false;
    }
    
    // Get the socket directly
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      logger.error(`Socket not found for ID: ${socketId}`);
      return false;
    }
    
    // Prepare the schedule update data
    const notificationData = {
      type: 'schedule_update',
      timestamp: new Date().toISOString(),
      displayId: displayId,
      scheduleData
    };
    
    // Send directly to the socket
    socket.emit('content:update', notificationData);
    logger.info(`Schedule update notification sent to socket ${socketId} for display ${displayId}`);
    
    // Also send to display room (backup)
    io.to(`display:${displayId}`).emit('content:update', {
      ...notificationData,
      method: 'room'
    });
    
    return true;
  } catch (error) {
    logger.error(`Error notifying display ${displayId} about schedule changes:`, error);
    return false;
  }
}

/**
 * Notify displays about content updates
 * @param {Array<string>} displayIds - Array of display IDs to notify
 * @param {string} updateType - Type of update (e.g., 'push', 'remove')
 * @param {Object} updateData - Additional data about the update
 * @returns {Object} Results of the notification
 */
async function notifyContentUpdate(displayIds, updateType, updateData = {}) {
  if (!Array.isArray(displayIds) || displayIds.length === 0) {
    logger.warn('No display IDs provided for content update notification');
    return { success: false, error: 'No display IDs provided' };
  }
  
  logger.info(`Notifying ${displayIds.length} displays about content update (type: ${updateType})`);
  
  const results = {
    success: true,
    notified: 0,
    offline: 0,
    displayResults: []
  };
  
  // Send notification to each display
  for (const displayId of displayIds) {
    try {
      // Find the socket for this display
      const socketId = getSocketForDevice(displayId);
      
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          // Send update notification directly to the socket
          socket.emit('content:update', {
            type: updateType,
            timestamp: new Date().toISOString(),
            displayId,
            ...updateData
          });
          
          // Also send to display room (backup)
          io.to(`display:${displayId}`).emit('content:update', {
            type: updateType,
            timestamp: new Date().toISOString(),
            displayId,
            method: 'room',
            ...updateData
          });
          
          results.notified++;
          results.displayResults.push({
            displayId,
            notified: true,
            socketId
          });
          
          logger.info(`Content update notification sent to display ${displayId} (socket: ${socketId})`);
        } else {
          logger.warn(`Socket not found for ID ${socketId} (display: ${displayId})`);
          results.offline++;
          results.displayResults.push({
            displayId,
            notified: false,
            error: 'Socket not found'
          });
        }
      } else {
        logger.warn(`No connected socket found for display ${displayId}`);
        results.offline++;
        results.displayResults.push({
          displayId,
          notified: false,
          error: 'Not connected'
        });
      }
    } catch (error) {
      logger.error(`Error notifying display ${displayId} about content update:`, error);
      results.displayResults.push({
        displayId,
        notified: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// Export all functions
module.exports = {
  initSocketService,
  getSocketInstance,
  init,
  notifyDisplayPaired,
  getConnectedDisplays,
  getConnectedControllers,
  completePairing,
  initiatePairing,
  handleTestEcho,
  handleTestPair,
  getSocketForDevice,
  notifyDisplayStatusChange,
  notifyControllerStatusChange,
  pushContentToDisplay,
  notifyScheduleChange,
  notifyContentUpdate
}; 