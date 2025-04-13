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

// Import the configured Express app
const { app } = require('./app');

// Create HTTP server
const server = http.createServer(app);

// Import socket.io setup
const { setupSocketIO } = require('./socket');

// Add unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise);
  console.error('[FATAL] Reason:', reason);
  if (reason && reason.stack) {
    console.error(reason.stack);
  }
  // Optionally shut down the server
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

// Start server
const PORT = process.env.PORT || 3003;

// Set up WebSocket after server is created
setupSocketIO(server);

// Start the server
async function startServer() {
  try {
    // Connect to MongoDB
    await db.connect();
    
    // Start listening for requests
    server.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
      logger.info(`🚀 Server started on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
}

// Clean up resources before process exit
process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  clearInterval(memoryMonitorInterval);
  clearInterval(dbHealthCheckInterval);
  mongoose.disconnect()
    .then(() => {
      logger.info('MongoDB disconnected');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Error disconnecting from MongoDB:', err);
      process.exit(1);
    });
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export the server and MongoDB status checker
module.exports = {
  server,
  startServer,
  isMongoDBConnected: () => mongoose.connection && mongoose.connection.readyState === 1
}; 