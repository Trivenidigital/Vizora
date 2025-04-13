/**
 * Server Configuration
 * Main server file that configures Express and starts the application
 */

require('dotenv').config();
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const dbDiagnostics = require('./utils/db-diagnostics');
const db = require('./config/db');
const jwt = require('jsonwebtoken');
const { app } = require('./app');
const { initSocketService } = require('./services/socketService');

// Create HTTP server
const server = http.createServer(app);

// Initialize socket service with the server instance
initSocketService(server);

// Add unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Add uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Memory usage monitoring
const monitorMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMemoryMB = Math.round(memUsage.rss / 1024 / 1024);
  
  logger.info(`[MEMORY] Heap Used: ${heapUsedMB} MB | Heap Total: ${heapTotalMB} MB | RSS: ${rssMemoryMB} MB`, {
    memory: {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      rss: rssMemoryMB,
      external: Math.round(memUsage.external / 1024 / 1024),
      arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024)
    }
  });
  
  // Log warning if memory usage is high
  if (heapUsedMB > 3000) {
    logger.warn(`[MEMORY WARNING] High heap usage: ${heapUsedMB} MB`);
  }
  
  // If global.gc is available, suggest a garbage collection
  if (global.gc) {
    try {
      // Record heap used before GC
      const beforeGC = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      
      // Run garbage collection
      global.gc();
      
      // Record heap used after GC
      const afterGC = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const freed = beforeGC - afterGC;
      
      logger.info(`[MEMORY] Manual GC freed ${freed} MB. Before: ${beforeGC} MB, After: ${afterGC} MB`);
    } catch (error) {
      logger.error('Error during manual garbage collection:', { error });
    }
  }
  
  // Monitor memory leak indicators
  const memoryLeakThreshold = 100; // MB
  
  // Use module-level variables instead of static variables
  if (!monitorMemoryUsage.lastHeapUsed) {
    monitorMemoryUsage.lastHeapUsed = heapUsedMB;
    monitorMemoryUsage.consecutiveIncreases = 0;
  }
  
  if (heapUsedMB - monitorMemoryUsage.lastHeapUsed > memoryLeakThreshold) {
    monitorMemoryUsage.consecutiveIncreases++;
    logger.warn(`[MEMORY LEAK INDICATOR] Heap increased by ${heapUsedMB - monitorMemoryUsage.lastHeapUsed} MB (${monitorMemoryUsage.consecutiveIncreases} consecutive large increases)`);
    
    if (monitorMemoryUsage.consecutiveIncreases >= 3) {
      logger.error('[MEMORY LEAK ALERT] Possible memory leak detected. Consider restarting the service.');
    }
  } else {
    monitorMemoryUsage.consecutiveIncreases = 0;
  }
  
  monitorMemoryUsage.lastHeapUsed = heapUsedMB;
};

// Initialize memory monitor state
monitorMemoryUsage.lastHeapUsed = 0;
monitorMemoryUsage.consecutiveIncreases = 0;

// Schedule regular memory monitoring (every 30 seconds)
const memoryMonitorInterval = setInterval(monitorMemoryUsage, 30000);

// Periodically check database connection health
const dbHealthCheckInterval = setInterval(async () => {
  try {
    const healthStatus = await dbDiagnostics.checkConnectionHealth();
    
    if (!healthStatus.connected) {
      logger.error('[DATABASE HEALTH] Connection unhealthy:', healthStatus);
      
      // If we're in a disconnected state for too long, attempt to reconnect
      if (healthStatus.state === 'disconnected') {
        logger.info('[DATABASE HEALTH] Attempting to reconnect to MongoDB...');
        
        // Mongoose will automatically try to reconnect, but we can force it
        // by closing and reopening the connection if needed
        if (mongoose.connection.readyState === 0) {
          try {
            logger.info('[DATABASE HEALTH] Forcing reconnection attempt...');
            // Only try to reconnect if we're fully disconnected
            await mongoose.disconnect();
            
            // Small delay before reconnecting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Connect with the same URI and options
            const mongoURI = process.env.MONGO_URI;
            await mongoose.connect(mongoURI);
            
            logger.info('[DATABASE HEALTH] Reconnection successful');
          } catch (reconnectError) {
            logger.error('[DATABASE HEALTH] Reconnection failed:', { 
              error: reconnectError.message,
              stack: reconnectError.stack
            });
          }
        }
      }
    } else {
      // Just log at debug level when healthy to avoid log spam
      logger.debug('[DATABASE HEALTH] Connection healthy:', { 
        state: healthStatus.state,
        readyState: healthStatus.readyState
      });
    }
  } catch (error) {
    logger.error('[DATABASE HEALTH] Check failed:', { 
      error: error.message,
      stack: error.stack
    });
  }
}, 30000); // Check every 30 seconds

// Start the server
const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  logger.info(`[Server] Listening on port ${PORT}`);
  logger.info(`[Server] Socket.IO path: /socket.io`);
  logger.info(`[Server] CORS enabled for: http://localhost:3000, http://localhost:3001`);
});

// Add diagnostic API endpoint for socket connections
app.get('/api/socket-diagnostic', (req, res) => {
  try {
    // Get active connections info
    const io = global.io;
    
    if (!io) {
    return res.status(500).json({
      success: false,
        message: 'Socket.IO not initialized yet'
      });
    }
    
    // Get socket server stats
    const serverStats = {
      engine: io.engine ? {
        clientsCount: io.engine.clientsCount,
        status: 'running'
      } : 'not available',
      rooms: Array.from(io.sockets.adapter.rooms.keys())
        .filter(room => !room.startsWith('/'))
        .slice(0, 20), // Limit to first 20 rooms
      transports: ['polling', 'websocket'],
      activeConnections: 0
    };
    
    // Get a count of connections by type
    const connections = {
      total: 0,
      authenticated: 0,
      anonymous: 0,
      users: 0,
      devices: 0
    };
    
    // Loop through all sockets
    const sockets = io.sockets.sockets;
    sockets.forEach(socket => {
      connections.total++;
      
      if (socket.authenticated) {
        connections.authenticated++;
      } else {
        connections.anonymous++;
      }
      
      if (socket.user) {
        connections.users++;
      }
      
      if (socket.deviceId) {
        connections.devices++;
      }
    });
    
    serverStats.activeConnections = connections.total;
    
    return res.json({
      success: true,
      status: 'Socket.IO server running',
      serverStats,
      connections
    });
  } catch (error) {
    console.error('Error generating socket diagnostic:', error);
    logger.error('Socket diagnostic error:', { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error generating socket diagnostic',
      error: error.message
    });
  }
});

// Add a diagnostic HTML page for socket testing
app.get('/socket-diagnostic.html', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vizora Socket Diagnostic</title>
      <script src="/socket.io/socket.io.js"></script>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .log { background: #f5f5f5; padding: 10px; margin: 10px 0; border: 1px solid #ddd; height: 300px; overflow-y: auto; font-family: monospace; }
        button { padding: 10px; margin: 5px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        button:disabled { background: #cccccc; cursor: not-allowed; }
        .input-group { margin: 10px 0; }
        .token-input { width: 100%; padding: 10px; margin: 5px 0; }
        .status { font-weight: bold; margin: 10px 0; }
        .status.connected { color: green; }
        .status.disconnected { color: red; }
        .status.error { color: orange; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Vizora Socket.IO Diagnostic Tool</h1>
        <div class="status disconnected" id="status">Disconnected</div>
        
        <div class="input-group">
          <label>Authentication Token:</label>
          <input type="text" id="authToken" class="token-input" placeholder="Enter token or leave empty for anonymous">
        </div>
        
        <button id="connectBtn">Connect</button>
        <button id="disconnectBtn" disabled>Disconnect</button>
        
        <h3>Event Log</h3>
        <div class="log" id="log"></div>
        
        <h3>Diagnostics</h3>
        <div>
          <button id="checkApi">Check API Status</button>
          <button id="getTokenBtn">Get Demo Token</button>
          <button id="testEvent">Send Test Event</button>
        </div>
      </div>
      
      <script>
        const logEl = document.getElementById('log');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const authTokenEl = document.getElementById('authToken');
        const statusEl = document.getElementById('status');
        const checkApiBtn = document.getElementById('checkApi');
        const testEventBtn = document.getElementById('testEvent');
        const getTokenBtn = document.getElementById('getTokenBtn');
        
        let socket = null;
        
        function log(message, type = 'info') {
          const now = new Date().toISOString();
          const entry = document.createElement('div');
          entry.className = \`log-entry \${type}\`;
          entry.innerHTML = \`[\${now}] <strong>\${type.toUpperCase()}</strong>: \${message}\`;
          logEl.appendChild(entry);
          logEl.scrollTop = logEl.scrollHeight;
        }
        
        function updateStatus(status, cssClass) {
          statusEl.textContent = status;
          statusEl.className = \`status \${cssClass}\`;
        }
        
        connectBtn.addEventListener('click', () => {
          try {
            const token = authTokenEl.value.trim();
            const options = {
              transports: ['websocket', 'polling'],
              reconnection: true,
              reconnectionDelay: 1000,
              reconnectionAttempts: 5,
              timeout: 10000
            };
            
            if (token) {
              options.auth = { token };
              log(\`Connecting with token: \${token.substring(0, 10)}...\`);
            } else {
              log('Connecting without authentication token');
            }
            
            socket = io('', options);
            
            socket.on('connect', () => {
              log(\`Connected with ID: \${socket.id}\`, 'success');
              updateStatus('Connected', 'connected');
              connectBtn.disabled = true;
              disconnectBtn.disabled = false;
              testEventBtn.disabled = false;
            });
            
            socket.on('disconnect', (reason) => {
              log(\`Disconnected: \${reason}\`, 'warning');
              updateStatus(\`Disconnected: \${reason}\`, 'disconnected');
              connectBtn.disabled = false;
              disconnectBtn.disabled = true;
              testEventBtn.disabled = true;
            });
            
            socket.on('connect_error', (error) => {
              log(\`Connection error: \${error.message}\`, 'error');
              updateStatus(\`Error: \${error.message}\`, 'error');
            });
            
            socket.on('error', (error) => {
              log(\`Socket error: \${error.message || error}\`, 'error');
            });
            
            socket.onAny((eventName, ...args) => {
              log(\`Event: \${eventName}, Data: \${JSON.stringify(args)}\`);
            });
            
            updateStatus('Connecting...', 'connecting');
  } catch (error) {
            log(\`Error initializing socket: \${error.message}\`, 'error');
          }
        });
        
        disconnectBtn.addEventListener('click', () => {
          if (socket) {
            socket.disconnect();
            socket = null;
            log('Manually disconnected', 'info');
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            testEventBtn.disabled = true;
          }
        });
        
        testEventBtn.addEventListener('click', () => {
          if (socket && socket.connected) {
            const event = 'test:event';
            const data = { timestamp: Date.now(), message: 'Test event from diagnostic page' };
            socket.emit(event, data);
            log(\`Sent event: \${event}, Data: \${JSON.stringify(data)}\`, 'info');
  } else {
            log('Cannot send event - not connected', 'error');
          }
        });
        
        checkApiBtn.addEventListener('click', async () => {
          try {
            const response = await fetch('/api/socket-diagnostic');
            const data = await response.json();
            log(\`API Status: \${JSON.stringify(data, null, 2)}\`, 'info');
  } catch (error) {
            log(\`API Check Error: \${error.message}\`, 'error');
          }
        });
        
        getTokenBtn.addEventListener('click', async () => {
          try {
            const response = await fetch('/api/auth/demo-token');
            const data = await response.json();
            if (data.token) {
              authTokenEl.value = data.token;
              log('Retrieved demo token successfully', 'success');
            } else {
              log(\`Failed to get demo token: \${data.message || 'Unknown error'}\`, 'error');
    }
  } catch (error) {
            log(\`Demo Token Error: \${error.message}\`, 'error');
          }
        });
        
        log('Socket.IO Diagnostic Tool initialized');
      </script>
    </body>
    </html>
  `);
});

// Also create a demo token endpoint for testing
app.get('/api/auth/demo-token', (req, res) => {
  // Generate a demo token with 1 hour expiry
  const payload = {
    id: 'demo-user-' + Date.now(),
    type: 'user',
    role: 'demo'
  };
  
  try {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    return res.json({
          success: true,
      token,
      message: 'Demo token generated for testing purposes only'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate demo token: ' + error.message
    });
  }
});

// Clean up resources before process exit
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Cleaning up...');
  clearInterval(memoryMonitorInterval);
  clearInterval(dbHealthCheckInterval);
  mongoose.disconnect()
    .then(() => {
      logger.info('MongoDB disconnected');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    })
    .catch(err => {
      logger.error('Error disconnecting from MongoDB:', err);
    process.exit(1);
    });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Cleaning up...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Export the server and MongoDB status checker
module.exports = {
  server,
  startServer: () => server.listen(PORT, () => {
    logger.info(`[Server] Listening on port ${PORT}`);
    logger.info(`[Server] Socket.IO path: /socket.io`);
    logger.info(`[Server] CORS enabled for: http://localhost:3000, http://localhost:3001`);
  }),
  isMongoDBConnected: () => mongoose.connection && mongoose.connection.readyState === 1
}; 