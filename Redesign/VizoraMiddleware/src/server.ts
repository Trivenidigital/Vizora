/**
 * Server Configuration
 * Main server file that configures Express and starts the application
 */

import path from 'path';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { app } from './app';
import { setupSocketIO, cleanupSocketIO, getSocketStatus } from './socketServer';

// Load environment variables
dotenv.config();

// Get port from environment or use default
const PORT = process.env.PORT || 3003;

// Create HTTP server
const server = http.createServer(app);

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close socket connections
    logger.info('Closing Socket.IO connections...');
    await cleanupSocketIO();
    
    // Close HTTP server
    logger.info('Closing HTTP server...');
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    
    // Disconnect from MongoDB
    logger.info('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    
    logger.info('Graceful shutdown completed.');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Set up signal handlers for graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // For critical errors, exit to allow process manager to restart
  // process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
});

// Set up Socket.IO
setupSocketIO(server)
  .then((io) => {
    logger.info(`Socket.IO initialized with adapter: ${getSocketStatus().adapterType}`);
    
    // Start server after Socket.IO is initialized
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`Socket.IO status: ${JSON.stringify(getSocketStatus())}`);
    });
  })
  .catch((error) => {
    logger.error('Failed to initialize Socket.IO:', error);
    process.exit(1);
  }); 