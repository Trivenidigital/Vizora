/**
 * MongoDB connection management
 */

const mongoose = require('mongoose');
const config = require('../../config');
const logger = require('../utils/logger');

// Track connection retry count
let connectionRetries = 0;
const MAX_RETRIES = 5;

/**
 * Connect to MongoDB
 * Handles connection to both local MongoDB and MongoDB Atlas
 */
const connect = async () => {
  try {
    // Connection options tailored for both local and Atlas MongoDB connections
    const options = {
      // Settings specifically helpful for MongoDB Atlas
      retryWrites: true,
      // Connection timeouts and limits
      serverSelectionTimeoutMS: 10000, // Timeout for server selection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      maxPoolSize: 25, // Maintain up to 25 socket connections (reduced from 50)
      minPoolSize: 5,  // Minimum of 5 connections in the pool
      bufferCommands: true, // Buffer commands when connection is lost
      autoIndex: process.env.NODE_ENV !== 'production', // Don't auto-build indexes in production
      family: 4, // Use IPv4, skip trying IPv6
      connectTimeoutMS: 30000, // 30 seconds connection timeout
      maxIdleTimeMS: 60000, // Close idle connections after 60 seconds
      heartbeatFrequencyMS: 10000, // Check server status every 10 seconds
    };

    // Check if using MongoDB Atlas (connection string starts with mongodb+srv://)
    const isAtlas = config.database.uri.startsWith('mongodb+srv://');
    if (isAtlas) {
      logger.info('Connecting to MongoDB Atlas...');
    } else {
      logger.info('Connecting to local MongoDB...');
    }

    await mongoose.connect(config.database.uri, options);
    
    // Reset connection retries on successful connection
    connectionRetries = 0;
    
    logger.info(`Connected to MongoDB at ${hideCredentials(config.database.uri)}`);
    
    // Log memory usage after connection
    const memUsage = process.memoryUsage();
    logger.info(`[MEMORY] After MongoDB connection - Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`);
    
    // Monitor MongoDB events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', { error: err });
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
      
      // Attempt reconnection if not shutting down
      if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        logger.info(`Reconnection attempt ${connectionRetries}/${MAX_RETRIES}...`);
        
        // Exponential backoff for reconnection
        const backoff = Math.min(30000, 1000 * Math.pow(2, connectionRetries));
        setTimeout(async () => {
          try {
            await mongoose.connect(config.database.uri, options);
            logger.info('MongoDB reconnected successfully');
          } catch (error) {
            logger.error('MongoDB reconnection failed:', { error });
          }
        }, backoff);
      } else {
        logger.error(`Maximum reconnection attempts (${MAX_RETRIES}) reached. Exiting...`);
        process.exit(1);
      }
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
      connectionRetries = 0; // Reset retry counter on successful reconnection
    });
    
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', { error });
    
    if (connectionRetries < MAX_RETRIES && process.env.NODE_ENV !== 'test') {
      // Exponential backoff for initial connection
      connectionRetries++;
      const backoff = Math.min(30000, 1000 * Math.pow(2, connectionRetries));
      logger.warn(`Retrying connection attempt ${connectionRetries}/${MAX_RETRIES} in ${backoff/1000}s...`);
      
      await new Promise(resolve => setTimeout(resolve, backoff));
      return connect(); // Retry connection
    } else {
      if (process.env.NODE_ENV === 'production') {
        logger.error('Could not connect to MongoDB. Exiting...');
        process.exit(1);
      }
      throw error;
    }
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnect = async () => {
  try {
    // Log memory usage before disconnection
    const memUsage = process.memoryUsage();
    logger.info(`[MEMORY] Before MongoDB disconnect - Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`);
    
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    
    // Log memory usage after disconnection
    const memUsageAfter = process.memoryUsage();
    logger.info(`[MEMORY] After MongoDB disconnect - Heap Used: ${Math.round(memUsageAfter.heapUsed / 1024 / 1024)} MB`);
  } catch (error) {
    logger.error('Error while closing MongoDB connection:', { error });
    throw error;
  }
};

/**
 * Hide credentials in MongoDB URI for logging
 */
const hideCredentials = (uri) => {
  try {
    // Handle both formats: mongodb:// and mongodb+srv://
    if (uri.includes('@')) {
      const start = uri.startsWith('mongodb+srv') ? 'mongodb+srv://' : 'mongodb://';
      const parts = uri.split('@');
      const userPass = parts[0].split('//')[1]; // Extract username:password
      const rest = parts.slice(1).join('@');
      
      return `${start}****:****@${rest}`;
    }
    return uri;
  } catch (error) {
    return 'Invalid MongoDB URI format';
  }
};

/**
 * Check if the database connection is healthy
 */
const checkConnection = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { healthy: false, status: 'disconnected' };
    }
    
    // Perform a simple ping command to test the connection
    await mongoose.connection.db.admin().ping();
    return { healthy: true, status: 'connected' };
  } catch (error) {
    logger.error('Database health check failed:', { error });
    return { healthy: false, status: 'error', message: error.message };
  }
};

module.exports = {
  connect,
  disconnect,
  getConnection: () => mongoose.connection,
  hideCredentials,
  checkConnection
}; 