/**
 * MongoDB Connection Manager
 * Provides a robust connection to MongoDB with automatic retries,
 * connection monitoring, and detailed logging
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Connection state tracking
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let isConnecting = false;

/**
 * Get MongoDB connection options with optimal settings
 * @returns {object} MongoDB connection options
 */
const getConnectionOptions = () => ({
  serverSelectionTimeoutMS: 30000, // Increased timeout to 30 seconds
  socketTimeoutMS: 60000, // Close sockets after 60 seconds of inactivity
  family: 4, // Force IPv4
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 2, // Keep at least 2 connections open
  heartbeatFrequencyMS: 10000, // Check connection health every 10 seconds
  autoIndex: process.env.NODE_ENV !== 'production', // Don't build indexes automatically in production
  connectTimeoutMS: 30000 // 30 seconds connection timeout
});

/**
 * Connect to MongoDB with error handling and automatic reconnection
 * @returns {Promise<mongoose.Connection>} Mongoose connection
 */
const connectDB = async () => {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    logger.debug('Connection attempt already in progress, skipping new attempt');
    return mongoose.connection;
  }
  
  isConnecting = true;
  
  try {
    // Only use the MONGO_URI from env, with no localhost fallback
    if (!process.env.MONGO_URI || !process.env.MONGO_URI.includes('mongodb+srv')) {
      throw new Error('Invalid MongoDB Atlas connection string. Please check your .env file.');
    }
    
    const mongoURI = process.env.MONGO_URI;
    logger.info(`Attempting to connect to MongoDB Atlas: ${mongoURI.substring(0, mongoURI.indexOf('@') + 1)}[CREDENTIALS_HIDDEN]`);
    
    // Mongoose connection options
    const options = getConnectionOptions();
    
    // Track connection attempt
    connectionAttempts++;
    
    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);
    
    // Reset connection attempts on successful connection
    connectionAttempts = 0;
    logger.info(`MongoDB Atlas Connected: ${conn.connection.host}`);
    
    // Set up connection event listeners if they haven't been set up yet
    setupConnectionEventListeners();
    
    isConnecting = false;
    return conn;
  } catch (error) {
    isConnecting = false;
    
    // Log detailed error information
    logger.error(`MongoDB Atlas connection error (attempt ${connectionAttempts}):`, {
      error: error.message,
      code: error.code,
      name: error.name
    });
    
    // Handle specific errors
    if (error.name === 'MongoParseError' && error.message.includes('options')) {
      // Handle unsupported options
      logger.warn('Detected unsupported MongoDB connection options. Attempting to connect with reduced options set.');
      
      try {
        // Use minimal connection options for retry
        const minimalOptions = {
          serverSelectionTimeoutMS: 30000,
          socketTimeoutMS: 60000
        };
        
        logger.info('Retrying MongoDB connection with minimal options...');
        const conn = await mongoose.connect(process.env.MONGO_URI, minimalOptions);
        
        logger.info(`MongoDB Atlas Connected with minimal options: ${conn.connection.host}`);
        connectionAttempts = 0;
        setupConnectionEventListeners();
        isConnecting = false;
        return conn;
      } catch (retryError) {
        logger.error('Failed to connect even with minimal options:', {
          error: retryError.message
        });
        throw retryError;
      }
    } else if (error.name === 'MongoNetworkError') {
      logger.error('Network error occurred. Check your internet connection and MongoDB Atlas network settings.');
    } else if (error.name === 'MongoServerSelectionError') {
      logger.error('Server selection timed out. Verify your MongoDB Atlas connection string and network configuration.');
    }
    
    // If we've tried too many times, don't retry automatically (prevent infinite loops)
    if (connectionAttempts > MAX_RECONNECT_ATTEMPTS) {
      logger.error(`Exceeded maximum number of connection attempts (${MAX_RECONNECT_ATTEMPTS})`);
      throw error;
    }
    
    // Otherwise throw the error
    throw error;
  }
};

/**
 * Setup event listeners for MongoDB connection
 */
const setupConnectionEventListeners = () => {
  // Only add event listeners once
  if (mongoose.connection.listenerCount('disconnected') > 0) {
    return;
  }
  
  // Connection successful
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB Atlas connection established');
    connectionAttempts = 0; // Reset counter on successful connection
  });
  
  // Connection lost
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB Atlas disconnected');
  });
  
  // Connection error
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB Atlas connection error:', { error: err });
  });
  
  // Connection reconnected
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB Atlas reconnected successfully');
    connectionAttempts = 0; // Reset counter on successful reconnection
  });
  
  // Process termination, close connection
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB Atlas connection closed due to application termination');
      process.exit(0);
    } catch (error) {
      logger.error('Error during MongoDB connection close:', error);
      process.exit(1);
    }
  });
};

/**
 * Check if MongoDB is connected
 * @returns {boolean} True if connected
 */
const isConnected = () => mongoose.connection.readyState === 1;

/**
 * Get connection state as string
 * @returns {string} Connection state
 */
const getConnectionState = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};

module.exports = {
  connectDB,
  isConnected,
  getConnectionState,
  getConnectionOptions
}; 