import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors, { CorsOptions } from 'cors';
import Redis from 'ioredis';
import { ENV } from '../config/env';
import { DisplayManager } from '../services/displayManager';
import { PairingManager } from '../services/pairingManager';
import { SessionManager } from '../services/sessionManager';
import { PairingRequest, ContentUpdate, ServerToClientEvents, ClientToServerEvents } from '../types';
import { ClusterManager, NODE_ID } from '../config/cluster';
import { logger } from '../utils/logger';
import { RateLimiter, rateLimits } from '../utils/rateLimiter';
import { validateInput, pairingCodeRules, contentUpdateRules } from '../utils/validation';
import { createHealthMonitor } from '../utils/health';
import { handleError, ErrorCode, VizoraError } from '../utils/errors';

interface HandshakeData {
  reconnectionToken?: string;
}

const app = express();

const corsOptions: CorsOptions = {
  origin: ENV.CORS.ORIGINS,
  credentials: ENV.CORS.CREDENTIALS
};

app.use(cors(corsOptions));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: corsOptions,
  pingTimeout: ENV.WS.PING_TIMEOUT,
  pingInterval: ENV.WS.PING_INTERVAL
});

// Initialize Redis client
const redis = new Redis({
  host: ENV.REDIS.HOST,
  port: ENV.REDIS.PORT,
  password: ENV.REDIS.PASSWORD,
  tls: ENV.REDIS.TLS_ENABLED ? {} : undefined
});

// Initialize managers
const clusterManager = new ClusterManager(redis);
const sessionManager = new SessionManager(redis);
const displayManager = new DisplayManager();
const pairingManager = new PairingManager(displayManager);
const rateLimiter = new RateLimiter(redis);
const healthMonitor = createHealthMonitor(redis, () => io.engine.clientsCount);

// Health check endpoint
app.get('/health', async (_, res) => {
  try {
    const [nodes, sessions, health] = await Promise.all([
      clusterManager.getActiveNodes(),
      sessionManager.getNodeSessions(NODE_ID),
      healthMonitor.getStatus()
    ]);

    res.json({
      ...health,
      nodeId: NODE_ID,
      cluster: {
        nodes: nodes.length,
        activeConnections: nodes.reduce((sum, node) => sum + node.connections, 0)
      },
      sessions: sessions.length
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json(handleError(error));
  }
});

// Initialize cluster manager
(async () => {
  try {
    await clusterManager.init();
    logger.info('Cluster manager initialized');
  } catch (error) {
    logger.error('Failed to initialize cluster manager', { error });
    process.exit(1);
  }
})();

// Clean up disconnected displays and stale sessions periodically
setInterval(async () => {
  try {
    await Promise.all([
      displayManager.cleanupDisconnectedDisplays(),
      sessionManager.cleanupStaleSessions()
    ]);
  } catch (error) {
    logger.error('Cleanup failed', { error });
  }
}, 30000);

io.on('connection', async (socket: Socket) => {
  logger.info('Client connected', { socketId: socket.id });
  
  try {
    // Check connection rate limit
    await rateLimiter.checkRateLimit({
      key: `connection:${socket.handshake.address}`,
      ...rateLimits.connection
    });

    // Check for reconnection token
    const handshakeData = socket.handshake.query as HandshakeData;
    let existingSession = null;
    
    if (handshakeData.reconnectionToken) {
      existingSession = await sessionManager.getSessionByReconnectionToken(
        handshakeData.reconnectionToken
      );
    }

    if (!existingSession) {
      existingSession = await sessionManager.getSession(socket.id);
    }

    let reconnectionToken: string;

    if (existingSession && existingSession.nodeId !== NODE_ID) {
      // Client reconnected to a different node
      logger.info('Client reconnected from different node', {
        socketId: socket.id,
        previousNode: existingSession.nodeId
      });
      
      reconnectionToken = await sessionManager.migrateSession(socket.id, NODE_ID);
      
      // Restore display connection if applicable
      if (existingSession.displayId) {
        const display = await displayManager.getDisplay(existingSession.displayId);
        if (display) {
          socket.emit('display_registered', { 
            displayId: display.id, 
            pairingCode: display.pairingCode 
          });
        }
      }
    } else {
      // New connection
      reconnectionToken = await sessionManager.createSession(socket.id, {
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      });
    }

    // Send reconnection token to client
    socket.emit('session_created', { reconnectionToken });
    
    // Update connection count
    const currentConnections = io.engine.clientsCount;
    await clusterManager.updateConnectionCount(currentConnections);

    // Handle display registration
    socket.on('register_display', async () => {
      try {
        await rateLimiter.checkRateLimit({
          key: `display:${socket.id}`,
          ...rateLimits.displayRegistration
        });

        const display = await displayManager.registerDisplay(socket);
        logger.info('Display registered', {
          socketId: socket.id,
          displayId: display.id,
          pairingCode: display.pairingCode
        });
        
        // Update session with display info
        await sessionManager.updateSession(socket.id, { displayId: display.id });
        
        socket.emit('display_registered', { 
          displayId: display.id, 
          pairingCode: display.pairingCode 
        });
      } catch (error) {
        logger.error('Display registration failed', { error, socketId: socket.id });
        socket.emit('error', handleError(error));
      }
    });

    // Handle pairing requests
    socket.on('pair-request', async (data: PairingRequest) => {
      try {
        await rateLimiter.checkRateLimit({
          key: `pair:${socket.id}`,
          ...rateLimits.pairingAttempt
        });

        validateInput(data.pairingCode, pairingCodeRules);
        
        logger.info('Received pairing request', {
          socketId: socket.id,
          pairingCode: data.pairingCode
        });

        const display = await pairingManager.handlePairingRequest(socket.id, data.pairingCode);
        
        if (!display) {
          throw new VizoraError(
            ErrorCode.INVALID_PAIRING_CODE,
            'Invalid pairing code or display not found'
          );
        }

        // Notify both parties of successful pairing
        socket.emit('pair-success', { displayId: display.id });
        display.socket.emit('paired', { 
          controllerId: socket.id,
          metadata: existingSession?.metadata
        });
        
        logger.info('Pairing successful', {
          socketId: socket.id,
          displayId: display.id
        });
      } catch (error) {
        logger.error('Pairing failed', { error, socketId: socket.id });
        socket.emit('pair-failed', handleError(error));
      }
    });

    // Handle content updates
    socket.on('content-update', async (data: ContentUpdate) => {
      try {
        await rateLimiter.checkRateLimit({
          key: `content:${socket.id}`,
          ...rateLimits.contentUpdate
        });

        validateInput(data.content, contentUpdateRules);

        const isAuthorized = await pairingManager.isDisplayConnectedToController(
          data.displayId, 
          socket.id
        );

        if (!isAuthorized) {
          throw new VizoraError(
            ErrorCode.NOT_AUTHORIZED,
            'Not authorized to update this display'
          );
        }

        const display = await displayManager.getDisplay(data.displayId);
        if (!display) {
          throw new VizoraError(
            ErrorCode.DISPLAY_NOT_FOUND,
            'Display not found'
          );
        }

        display.socket.emit('content-update', {
          content: data.content,
          timestamp: new Date().toISOString(),
          senderId: socket.id,
          metadata: data.metadata
        });
        
        logger.info('Content updated', {
          socketId: socket.id,
          displayId: data.displayId
        });
      } catch (error) {
        logger.error('Content update failed', { error, socketId: socket.id });
        socket.emit('content-update-failed', handleError(error));
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        logger.info('Client disconnected', { socketId: socket.id });
        await Promise.all([
          displayManager.removeDisplay(socket.id),
          pairingManager.removeController(socket.id)
        ]);
        
        // Keep session for potential reconnection
        await sessionManager.updateSession(socket.id, {
          lastSeen: new Date().toISOString()
        });
        
        // Update connection count
        const currentConnections = io.engine.clientsCount;
        await clusterManager.updateConnectionCount(currentConnections);
      } catch (error) {
        logger.error('Disconnect handling failed', { error, socketId: socket.id });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', { error, socketId: socket.id });
      socket.emit('error', handleError(error));
    });

  } catch (error) {
    logger.error('Connection handling failed', { error, socketId: socket.id });
    socket.emit('error', handleError(error));
    socket.disconnect(true);
  }
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  healthMonitor.recordError(reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  healthMonitor.recordError(error);
  // Gracefully shutdown
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal. Starting graceful shutdown...');
  
  try {
    await clusterManager.cleanup();
    await redis.quit();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    logger.info('Server shut down gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

// Start server
httpServer.listen(ENV.PORT, () => {
  logger.info(`WebSocket server running on port ${ENV.PORT}`);
}); 