/**
 * Socket.IO server with Redis adapter support
 * 
 * This module configures Socket.IO with built-in support for both:
 * 1. In-memory adapter (default)
 * 2. Redis adapter (enabled via REDIS_ENABLED=true)
 * 
 * The Redis configuration is designed to be forward-compatible with scaling
 * beyond 500+ TV devices, but defaults to in-memory for development and early production.
 */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import logger from './utils/logger';
import socketAuth from './middleware/socketAuth';
import type { Server as HttpServer } from 'http';
import { ExtendedSocket } from './types/socket';

// Connection limits to prevent memory leaks
const MAX_CONNECTIONS = 1000; // Maximum number of concurrent connections
const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes inactivity timeout

// Store active socket connections
const activeConnections = new Map();

// Redis clients for adapter (only used if REDIS_ENABLED=true)
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

/**
 * Set up Redis clients for Socket.IO adapter
 * @returns A boolean indicating whether Redis setup was successful
 */
async function setupRedisClients(): Promise<boolean> {
  if (process.env.REDIS_ENABLED !== 'true') {
    logger.info('🔄 Redis adapter is DISABLED (REDIS_ENABLED != true)');
    return false;
  }

  logger.info('🔌 Setting up Redis adapter for Socket.IO');
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    pubClient = new Redis(redisUrl, {
      reconnectOnError: (err) => {
        logger.error('❌ Redis reconnect on error:', err);
        return true;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    subClient = pubClient.duplicate();

    // Set up event listeners for monitoring Redis connection
    pubClient.on('connect', () => {
      logger.info('✅ Redis pubClient connected successfully');
    });

    pubClient.on('error', (error) => {
      logger.error('❌ Redis pubClient error:', error);
    });

    subClient.on('connect', () => {
      logger.info('✅ Redis subClient connected successfully');
    });

    subClient.on('error', (error) => {
      logger.error('❌ Redis subClient error:', error);
    });

    // Wait for connections to be ready
    await Promise.all([
      new Promise<void>((resolve) => {
        if (pubClient?.status === 'ready') {
          resolve();
        } else {
          pubClient?.once('ready', resolve);
        }
      }),
      new Promise<void>((resolve) => {
        if (subClient?.status === 'ready') {
          resolve();
        } else {
          subClient?.once('ready', resolve);
        }
      }),
    ]);

    logger.info('✅ Redis clients ready for Socket.IO adapter');
    return true;
  } catch (error) {
    logger.error('❌ Failed to set up Redis clients:', error);
    
    // Cleanup if initialization failed
    if (pubClient) {
      pubClient.disconnect();
      pubClient = null;
    }
    
    if (subClient) {
      subClient.disconnect();
      subClient = null;
    }
    
    return false;
  }
}

/**
 * Gracefully close Redis connections
 */
async function closeRedisConnections(): Promise<void> {
  if (pubClient) {
    logger.info('🔌 Closing Redis pubClient connection');
    await pubClient.quit();
    pubClient = null;
  }
  
  if (subClient) {
    logger.info('🔌 Closing Redis subClient connection');
    await subClient.quit();
    subClient = null;
  }
}

/**
 * Configure Socket.IO with appropriate settings and adapters
 * @param server HTTP server instance
 * @returns Configured Socket.IO server
 */
export async function setupSocketIO(server: HttpServer): Promise<Server> {
  // Initialize Redis if enabled
  let redisEnabled = false;
  
  if (process.env.REDIS_ENABLED === 'true') {
    try {
      redisEnabled = await setupRedisClients();
    } catch (error) {
      logger.error('❌ Error initializing Redis adapter, falling back to in-memory:', error);
      redisEnabled = false;
    }
  }

  // Create Socket.IO server with CORS settings
  const io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173').split(','),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      credentials: true,
    },
    path: process.env.SOCKET_PATH || '/socket.io',
    transports: ['websocket', 'polling'],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes max recovery time
    },
    pingTimeout: 60000, // 1 minute ping timeout
    pingInterval: 25000, // 25 second ping interval
    maxHttpBufferSize: 1e6, // 1 MB max buffer size for messages
    connectTimeout: 30000, // 30 seconds connection timeout
    allowEIO3: true, // Allow Engine.IO 3 compatibility for older clients
  });

  // Set up Redis adapter if enabled and successfully connected
  if (redisEnabled && pubClient && subClient) {
    try {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('✅ Redis adapter enabled for Socket.IO');
    } catch (error) {
      logger.error('❌ Failed to set up Redis adapter, falling back to in-memory:', error);
    }
  } else {
    logger.info('ℹ️ Using default in-memory Socket.IO adapter');
  }

  // Store Socket.IO instance globally for access in other parts of the application
  global.io = io;

  // Debug middleware for logging connection attempts
  io.use((socket: ExtendedSocket, next) => {
    const clientInfo = {
      id: socket.id,
      transport: socket.conn.transport.name,
      address: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'] || 'unknown',
      query: socket.handshake.query,
      hasAuthObj: !!socket.handshake.auth,
    };

    logger.debug(`Socket connection attempt:`, clientInfo);
    socket.authenticated = false;
    socket.deviceId = socket.handshake.query.deviceId as string || undefined;
    logger.info('Socket middleware processing', { socketId: socket.id, deviceId: socket.deviceId });
    next();
  });

  // Middleware for managing concurrent connections
  io.use((socket: ExtendedSocket, next) => {
    // Check if we've reached the maximum number of connections
    if (activeConnections.size >= MAX_CONNECTIONS) {
      logger.warn(`Maximum socket connections (${MAX_CONNECTIONS}) reached. Rejecting new connection.`);
      return next(new Error('Server is at maximum capacity. Please try again later.'));
    }
    next();
  });

  // Use authentication middleware
  io.use(socketAuth);

  // Connection handler
  io.on('connection', async (socket: ExtendedSocket) => {
    logger.info(`Socket connected: ${socket.id}`, {
      deviceId: socket.deviceId || 'unknown',
      userType: socket.deviceType || (socket.user ? 'user' : 'unknown'),
      adapter: redisEnabled ? 'redis' : 'memory',
    });

    // Add to active connections
    activeConnections.set(socket.id, {
      id: socket.id,
      type: socket.deviceType || (socket.user ? 'user' : 'unknown'),
      deviceId: socket.deviceId,
      connectedAt: new Date(),
      lastActivity: new Date(),
    });

    // Set inactivity timeout
    let inactivityTimeout: NodeJS.Timeout | null = null;

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

    // Reset timeout on each activity
    socket.onAny(() => {
      resetInactivityTimeout();
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);

      // Clear inactivity timeout
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
      }

      // Remove from active connections
      activeConnections.delete(socket.id);

      // Additional disconnect handling can be added here
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });

    // Handle device registration
    socket.on('registerDevice', (data: { deviceId: string; type: 'display' | 'admin' }) => {
      socket.deviceId = data.deviceId;
      socket.deviceType = data.type;
      socket.authenticated = true;
      socket.join(`device:${data.deviceId}`);
      logger.info(`📱 Device registered/joined room: ${data.deviceId}`, { type: data.type, socketId: socket.id });
      socket.emit('registrationSuccess', { message: 'Device registered successfully' });
    });

    // Add other event handlers using the extended socket type
    // e.g., socket.on('someEvent', (payload) => { ... });
  });

  // Add engine error logging
  io.engine.on('connection_error', (err) => {
    logger.error('Socket.IO connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  return io;
}

/**
 * Get the status of the Socket.IO server and adapter
 * @returns Object containing status information
 */
export function getSocketStatus() {
  return {
    adapterType: process.env.REDIS_ENABLED === 'true' && pubClient ? 'redis' : 'memory',
    redisConnected: pubClient ? pubClient.status === 'ready' : false,
    activeConnections: activeConnections.size,
    redisEnabled: process.env.REDIS_ENABLED === 'true',
    maxConnections: MAX_CONNECTIONS,
  };
}

/**
 * Clean up all Socket.IO resources
 */
export async function cleanupSocketIO(): Promise<void> {
  await closeRedisConnections();
}

// Export socket helpers
export default {
  setupSocketIO,
  getSocketStatus,
  cleanupSocketIO,
}; 