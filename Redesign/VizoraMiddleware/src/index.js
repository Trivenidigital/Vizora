/**
 * Main entry point for Vizora Middleware
 */

const { startServer } = require('./server');
const logger = require('./utils/logger');

// Start the server
startServer()
  .then(() => {
    logger.info('Vizora Middleware successfully started');
  })
  .catch((error) => {
    logger.error('Failed to start Vizora Middleware:', error);
    process.exit(1);
  });

// Handle termination signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully');
  process.exit(0);
}); 