/**
 * Socket.IO implementation for real-time communication
 */

const displayService = require('./services/displayService');
const contentService = require('./services/contentService');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const { socketAuth } = require('./middleware/authMiddleware');
const mongoose = require('mongoose');

// Store active socket connections
const activeConnections = new Map();

// Connection limits to prevent memory leaks
const MAX_CONNECTIONS = 1000; // Maximum number of concurrent connections
const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes inactivity timeout

/**
 * Configure Socket.IO with appropriate CORS settings
 * @param {Server} server - HTTP/HTTPS server
 * @returns {SocketIO.Server} Configured Socket.IO server
 */
const configureSocketIO = (server) => {
  // Create Socket.IO server with CORS settings
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4173', // Vite preview mode
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:4173',
        // Add production domains here if needed
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    // Add connection limits and timeouts
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes max recovery time
    },
    pingTimeout: 60000, // 1 minute ping timeout
    pingInterval: 25000, // 25 second ping interval
    maxHttpBufferSize: 1e6, // 1 MB max buffer size for messages
    // Add instrumentation for debugging
    connectTimeout: 30000, // 30 seconds connection timeout
    allowEIO3: true // Allow Engine.IO 3 compatibility for older clients
  });
  
  logger.info('Socket.IO configured with CORS policy for development and production origins');
  
  // Store Socket.IO instance globally for access in other parts of the application
  global.io = io;
  
  return io;
};

/**
 * Set up Socket.IO server
 * @param {Server} server - HTTP/HTTPS server
 * @returns {SocketIO.Server} Configured Socket.IO server
 */
const setupSocketIO = (server) => {
  // Configure Socket.IO with appropriate CORS settings
  const io = configureSocketIO(server);
  
  // Debug middleware for logging connection attempts
  io.use((socket, next) => {
    const clientInfo = {
      id: socket.id,
      transport: socket.conn.transport.name,
      address: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'] || 'unknown',
      query: socket.handshake.query,
      hasAuthObj: !!socket.handshake.auth
    };
    
    logger.debug(`Socket connection attempt:`, clientInfo);
    next();
  });
  
  // Middleware for managing concurrent connections
  io.use((socket, next) => {
    // Check if we've reached the maximum number of connections
    if (activeConnections.size >= MAX_CONNECTIONS) {
      logger.warn(`Maximum socket connections (${MAX_CONNECTIONS}) reached. Rejecting new connection.`);
      return next(new Error('Server is at maximum capacity. Please try again later.'));
    }
    next();
  });
  
  // Use our standardized socket auth middleware
  io.use(socketAuth);
  
  // Connection handler
  io.on('connection', async (socket) => {
    logger.info(`Socket connected: ${socket.id}`, { 
      deviceId: socket.deviceId || 'unknown',
      userType: socket.deviceType || (socket.user ? 'user' : 'unknown')
    });
    
    // Add to active connections
    activeConnections.set(socket.id, {
      id: socket.id,
      type: socket.deviceType || (socket.user ? 'user' : 'unknown'),
      deviceId: socket.deviceId,
      connectedAt: new Date(),
      lastActivity: new Date()
    });
    
    // Set inactivity timeout
    let inactivityTimeout = null;
    
    // Function to reset the inactivity timeout
    const resetInactivityTimeout = () => {
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
      }
      
      // Update last activity time
      if (activeConnections.has(socket.id)) {
        const connectionInfo = activeConnections.get(socket.id);
        connectionInfo.lastActivity = new Date();
        activeConnections.set(socket.id, connectionInfo);
      }
      
      // Set new timeout
      inactivityTimeout = setTimeout(() => {
        logger.warn(`Socket ${socket.id} inactive for ${INACTIVE_TIMEOUT / 1000} seconds, disconnecting`);
        socket.disconnect(true);
      }, INACTIVE_TIMEOUT);
    };
    
    // Initial timeout
    resetInactivityTimeout();
    
    try {
      // Register display if deviceId provided
      if (socket.deviceId) {
        const displayData = {
          deviceId: socket.deviceId,
          socketId: socket.id,
          lastSeen: new Date()
        };
        
        // Register or update display
        const display = await displayService.registerDisplay(displayData);
        logger.info(`Display registered: ${display.deviceId}`);
        
        // Store connection
        activeConnections.set(socket.deviceId, socket);
        
        // Join display room
        socket.join(`display:${socket.deviceId}`);
        
        // Send current content if available
        const content = await contentService.getCurrentContent(socket.deviceId);
        if (content) {
          socket.emit('content:update', content);
        }
        
        // Send device state
        socket.emit('device:state', {
          deviceId: socket.deviceId,
          name: display.name,
          status: display.status,
          isPaired: display.isPaired || false,
          owner: display.owner ? true : false
        });
      }
      
      // Track memory usage periodically
      const memoryCheckInterval = setInterval(() => {
        try {
          const memUsage = process.memoryUsage();
          const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
          
          // Log warning if memory usage is high
          if (heapUsedMB > 3000) {
            logger.warn(`[SOCKET MEMORY] High heap usage with ${activeConnections.size} active connections: ${heapUsedMB} MB`);
          }
        } catch (error) {
          logger.error('[SOCKET MEMORY] Check failed:', { 
            error: error.message,
            stack: error.stack 
          });
        }
      }, 60000); // Check every minute
      
      // Handle heartbeat
      socket.on('heartbeat', async (data) => {
        try {
          // Reset inactivity timeout
          resetInactivityTimeout();
          
          // Update display last seen time
          if (socket.deviceId) {
            await displayService.updateDisplayStatus(socket.deviceId, {
              status: 'online',
              lastSeen: new Date(),
              ...data
            });
          }
          
          // Send acknowledgment
          socket.emit('heartbeat:ack', { timestamp: Date.now() });
        } catch (error) {
          logger.error('Heartbeat error:', { error, socketId: socket.id });
        }
      });
      
      // Handle content acknowledgment
      socket.on('content:received', async (data) => {
        try {
          // Reset inactivity timeout
          resetInactivityTimeout();
          
          // Update content delivery status
          if (data.id) {
            await contentService.updateContentDeliveryStatus(data.id, {
              status: data.success ? 'delivered' : 'failed',
              deviceId: socket.deviceId,
              timestamp: new Date()
            });
          }
        } catch (error) {
          logger.error('Content acknowledgment error:', { error, socketId: socket.id });
        }
      });
      
      // Handle content playback status
      socket.on('content:playback', async (data) => {
        try {
          // Reset inactivity timeout
          resetInactivityTimeout();
          
          // Update content playback status
          if (data.id) {
            await contentService.updateContentPlaybackStatus(data.id, {
              status: data.status,
              deviceId: socket.deviceId,
              timestamp: new Date(),
              duration: data.duration,
              position: data.position
            });
          }
        } catch (error) {
          logger.error('Content playback error:', { error, socketId: socket.id });
        }
      });
      
      // Handle display status update
      socket.on('display:status', async (data) => {
        try {
          // Reset inactivity timeout
          resetInactivityTimeout();
          
          // Update display status
          if (socket.deviceId) {
            await displayService.updateDisplayStatus(socket.deviceId, {
              ...data,
              lastSeen: new Date()
            });
            
            // Acknowledge status update
            socket.emit('status:received', { success: true });
          }
        } catch (error) {
          logger.error('Display status error:', { error, socketId: socket.id });
          socket.emit('status:received', { success: false, error: error.message });
        }
      });
      
      // Handle socket events for display registration
      socket.on('register:display', async (data) => {
        try {
          if (!data || !data.deviceId) {
            logger.warn(`Invalid display registration data from socket ${socket.id}`, data);
            socket.emit('register:error', { message: 'Device ID is required' });
            return;
          }
          
          logger.info(`Socket ${socket.id} registering as display: ${data.deviceId}`);
          
          // Store device ID in socket for future reference
          socket.deviceId = data.deviceId;
          
          // Join device-specific room
          socket.join(`display:${data.deviceId}`);
          
          // Track connection
          activeConnections.set(socket.id, {
            id: socket.id,
            type: 'display',
            deviceId: data.deviceId,
            connectedAt: new Date(),
            lastActivity: new Date()
          });
          
          // Update connection map for this device ID
          activeConnections.set(data.deviceId, socket);
          
          // Ensure the display is registered in database immediately
          try {
            logger.info(`📱 Registering display in database: ${data.deviceId}`);
            
            // Check if device already exists
            const existingDisplay = await Display.findOne({ deviceId: data.deviceId });
            
            if (existingDisplay) {
              logger.info(`✅ Found existing display in database: ${data.deviceId}`);
              
              // Update existing display
              existingDisplay.socketId = socket.id;
              existingDisplay.lastHeartbeat = new Date();
              existingDisplay.status = 'active';
              
              // Update device info if provided
              if (data.deviceInfo) {
                existingDisplay.deviceInfo = {
                  ...existingDisplay.deviceInfo || {},
                  ...data.deviceInfo
                };
              }
              
              await existingDisplay.save();
              logger.info(`✅ Updated existing display: ${data.deviceId}`);
              
              // Emit success event
              socket.emit('display:registered', {
                success: true,
                deviceId: data.deviceId,
                displayId: data.deviceId
              });
              
              // Send current state
              socket.emit('device:state', {
                deviceId: data.deviceId,
                name: existingDisplay.name,
                status: existingDisplay.status,
                isPaired: existingDisplay.isPaired || false
              });
            } else {
              // Display doesn't exist, register it
              logger.info(`🆕 Creating new display record: ${data.deviceId}`);
              
              const displayData = {
                deviceId: data.deviceId,
                socketId: socket.id,
                status: 'active',
                lastHeartbeat: new Date(),
                deviceInfo: data.deviceInfo || {},
                name: data.deviceInfo?.name || `Display ${data.deviceId.substring(0, 8)}`
              };
              
              // Create new display in database
              const display = await displayService.registerDisplay(displayData);
              logger.info(`✅ Created new display in database: ${display.deviceId}`);
              
              // Verify the display was created properly
              const verifyDisplay = await Display.findOne({ deviceId: data.deviceId });
              if (!verifyDisplay) {
                logger.error(`❌ Display creation verification failed for ${data.deviceId}`);
                throw new Error('Display registration verification failed');
              }
              
              logger.info(`✅ Verified display creation for ${data.deviceId}`);
              
              // Emit success event
              socket.emit('display:registered', {
                success: true,
                deviceId: data.deviceId,
                displayId: data.deviceId,
                name: display.name
              });
              
              // Send initial device state
              socket.emit('device:state', {
                deviceId: data.deviceId,
                name: display.name,
                status: 'active',
                isPaired: false
              });
            }
            
            // Log all registered displays for debugging
            const allDisplays = await Display.find({}).select('deviceId').lean();
            logger.info(`🔍 Current registered displays: ${JSON.stringify(allDisplays.map(d => d.deviceId))}`);
            
          } catch (error) {
            logger.error(`❌ Failed to register display in database: ${error.message}`, error);
            socket.emit('register:error', { 
              message: `Database registration failed: ${error.message}`,
              error: error.message
            });
          }
        } catch (error) {
          logger.error(`Socket register:display error: ${error.message}`, error);
          socket.emit('register:error', { message: error.message });
        }
      });
      
      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, { error, socketId: socket.id });
      });
      
      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        logger.info(`Socket disconnected: ${socket.id}`, { socketId: socket.id, reason });
        
        try {
          // Clear intervals and timeouts
          if (inactivityTimeout) {
            clearTimeout(inactivityTimeout);
          }
          clearInterval(memoryCheckInterval);
          
          // Update display status to offline if deviceId is set
          if (socket.deviceId) {
            await displayService.updateDisplayStatus(socket.deviceId, {
              status: 'offline',
              lastSeen: new Date()
            });
            
            // Remove from active connections
            activeConnections.delete(socket.deviceId);
          }
          
          // Remove from socket ID map
          activeConnections.delete(socket.id);
          
          // Explicitly remove all listeners to prevent memory leaks
          socket.removeAllListeners();
        } catch (error) {
          logger.error('Disconnect handler error:', { error, socketId: socket.id });
        }
      });
    } catch (error) {
      logger.error('Socket connection error:', { error, socketId: socket.id });
      socket.disconnect();
    }
  });
  
  // Schedule periodic cleanup of inactive connections
  setInterval(() => {
    try {
      const now = Date.now();
      let cleanupCount = 0;
      
      // Check all active connections
      activeConnections.forEach((connection, key) => {
        // Skip non-socket entries
        if (!connection.connected && typeof connection.connected !== 'undefined') {
          // Disconnect inactive socket
          if (connection.connected) {
            try {
              connection.disconnect(true);
            } catch (err) {
              logger.error(`Error disconnecting socket: ${err.message}`);
            }
          }
          
          // Remove from active connections
          activeConnections.delete(key);
          cleanupCount++;
        }
      });
      
      if (cleanupCount > 0) {
        logger.info(`Cleaned up ${cleanupCount} inactive socket connections`);
      }
    } catch (error) {
      logger.error('[SOCKET CLEANUP] Failed:', { 
        error: error.message,
        stack: error.stack 
      });
    }
  }, 300000); // Clean up every 5 minutes
  
  return io;
};

/**
 * Broadcast message to specific displays
 * @param {string} event - Event name to emit
 * @param {object} data - Data to send
 * @param {string[]} [displayIds] - Array of display IDs to target. If not provided, broadcasts to all displays
 */
const broadcastToDisplays = (event, data, displayIds = null) => {
  try {
    // Get Socket.IO instance
    const io = global.io;
    if (!io) {
      throw new Error('Socket.IO instance not available');
    }
    
    if (displayIds) {
      // Send to specific displays
      displayIds.forEach(displayId => {
        const socket = activeConnections.get(displayId);
        if (socket && socket.connected) {
          io.to(socket.id).emit(event, data);
        } else {
          io.to(`display:${displayId}`).emit(event, data);
        }
      });
    } else {
      // Broadcast to all displays
      io.to('displays').emit(event, data);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to broadcast to displays:', { error, event });
    return false;
  }
};

/**
 * Send content update to specific displays
 * @param {string[]} displayIds - Array of display IDs to target
 * @param {object} content - Content data to send
 */
const sendContentUpdate = async (displayIds, content) => {
  try {
    if (!Array.isArray(displayIds)) {
      displayIds = [displayIds];
    }
    
    const updateData = {
      content,
      timestamp: new Date().toISOString(),
      type: 'content:update'
    };
    
    return broadcastToDisplays('content:update', updateData, displayIds);
  } catch (error) {
    console.error('Failed to send content update:', error);
    return false;
  }
};

/**
 * Send schedule update to specific displays
 * @param {string[]} displayIds - Array of display IDs to target
 * @param {object} schedule - Schedule data to send
 */
const sendScheduleUpdate = async (displayIds, schedule) => {
  try {
    if (!Array.isArray(displayIds)) {
      displayIds = [displayIds];
    }
    
    const updateData = {
      schedule,
      timestamp: new Date().toISOString(),
      type: 'schedule:update'
    };
    
    return broadcastToDisplays('schedule:update', updateData, displayIds);
  } catch (error) {
    console.error('Failed to send schedule update:', error);
    return false;
  }
};

/**
 * Send display status update to a specific display
 * @param {string} displayId - Display ID to target
 * @param {object} status - Status data to send
 */
const sendDisplayStatus = async (displayId, status) => {
  try {
    const updateData = {
      status,
      timestamp: new Date().toISOString(),
      type: 'display:status'
    };
    
    return broadcastToDisplays('display:status', updateData, [displayId]);
  } catch (error) {
    console.error('Failed to send display status:', error);
    return false;
  }
};

/**
 * Get a list of all connected displays
 * @returns {Array} Array of connected display IDs
 */
const getConnectedDisplays = () => {
  return Array.from(activeConnections.keys());
};

/**
 * Emit a pairing confirmation event to a display
 * @param {string} displayId - Display ID that was paired
 * @param {string} userId - User ID that paired the display
 * @param {Object} displayMetadata - Additional display metadata
 * @returns {Promise<boolean>} Whether the event was sent
 */
const emitPairingConfirmed = async (displayId, userId, displayMetadata = {}) => {
  try {
    // Get the display from database to ensure it exists and get its socket ID
    const Display = mongoose.model('Display');
    const display = await Display.findOne({ deviceId: displayId });
    
    if (!display) {
      logger.warn(`Cannot emit pairing event: Display not found with ID ${displayId}`);
      return false;
    }
    
    // Prepare event payload
    const eventPayload = {
      displayId: displayId,
      userId: userId,
      displayName: display.name || 'Unnamed Display',
      pairedAt: new Date().toISOString(),
      metadata: {
        name: display.name,
        location: display.location,
        ...(displayMetadata || {})
      }
    };
    
    logger.info(`Emitting pairing confirmation for display ${displayId}`, { userId });
    
    // Emit to the specific display room
    global.io.to(`display:${displayId}`).emit('pairing:confirmed', eventPayload);
    
    // If we have a socket ID for this display, also emit directly to that socket
    if (display.socketId) {
      global.io.to(display.socketId).emit('pairing:confirmed', eventPayload);
      logger.debug(`Sent pairing confirmation directly to socket ${display.socketId}`);
    }
    
    // For backward compatibility, also emit these events
    global.io.to(`display:${displayId}`).emit('display:paired', eventPayload);
    global.io.to(`display:${displayId}`).emit('paired', eventPayload);
    
    // Also broadcast to admin room for synchronization
    global.io.to('admin').emit('display:paired', { 
      displayId, 
      userId,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    logger.error('Error emitting pairing confirmation event:', error);
    return false;
  }
};

/**
 * Emit a content update notification
 * Sends an update event to displays with no actual content,
 * signaling them to fetch the latest content from the API
 * 
 * @param {string|Array<string>} displayIds - Display ID(s) to notify
 * @param {string} updateType - Type of update ('schedule', 'direct', 'emergency')
 */
const notifyContentUpdate = async (displayIds, updateType = 'direct') => {
  try {
    // Handle both single ID and array of IDs
    const ids = Array.isArray(displayIds) ? displayIds : [displayIds];
    
    if (ids.length === 0) {
      logger.warn('No display IDs provided for content update notification');
      return;
    }
    
    logger.info(`Notifying ${ids.length} display(s) of content update`, {
      displayCount: ids.length,
      updateType
    });
    
    // Event payload with bare minimum data to trigger a content fetch
    const updateEvent = {
      displayId: ids.length === 1 ? ids[0] : null,
      updateType,
      timestamp: new Date().toISOString()
    };
    
    // Send to each display room individually
    for (const displayId of ids) {
      // Update the specific displayId in the event
      updateEvent.displayId = displayId;
      
      // Emit to the display room
      global.io.to(`display:${displayId}`).emit('content:updated', updateEvent);
      
      logger.debug(`Sent content update notification to display ${displayId}`);
    }
    
    // Also broadcast to admin room for synchronization
    global.io.to('admin').emit('content:batch_updated', {
      displayIds: ids,
      updateType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error emitting content update notification:', error);
  }
};

module.exports = {
  setupSocketIO,
  broadcastToDisplays,
  sendContentUpdate,
  sendScheduleUpdate,
  sendDisplayStatus,
  getConnectedDisplays,
  emitPairingConfirmed,
  notifyContentUpdate
}; 