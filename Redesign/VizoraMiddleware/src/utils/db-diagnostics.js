/**
 * MongoDB Connection Diagnostics
 * Utility to diagnose MongoDB connection issues and provide helpful information
 */

const mongoose = require('mongoose');
const dns = require('dns');
const { promisify } = require('util');
const logger = require('./logger');

// Promisify DNS lookup
const dnsLookup = promisify(dns.lookup);

/**
 * Check if MongoDB is connected
 * @returns {boolean} True if connected, false otherwise
 */
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Get connection state as string
 * @returns {string} Connection state
 */
const getConnectionState = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * Run a basic network diagnostic on the MongoDB connection
 * @returns {Promise<object>} Diagnostic results
 */
const runNetworkDiagnostic = async () => {
  try {
    // Extract hostname from MongoDB URI
    const uri = process.env.MONGO_URI || '';
    const match = uri.match(/mongodb\+srv:\/\/.*@([^/]+)/);
    
    if (!match) {
      return {
        success: false,
        message: 'Could not extract hostname from MongoDB URI'
      };
    }
    
    const hostname = match[1];
    
    // Check if we can resolve the hostname
    try {
      const dnsResult = await dnsLookup(hostname);
      logger.info(`MongoDB hostname ${hostname} resolves to ${dnsResult.address}`);
      
      return {
        success: true,
        hostname,
        ip: dnsResult.address
      };
    } catch (error) {
      logger.error(`Failed to resolve MongoDB hostname ${hostname}:`, error);
      return {
        success: false,
        hostname,
        error: error.message
      };
    }
  } catch (error) {
    logger.error('Error running network diagnostic:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check connection health and provide diagnostics
 * @returns {Promise<object>} Connection health info
 */
const checkConnectionHealth = async () => {
  const connectionState = getConnectionState();
  const isMongoConnected = isConnected();
  
  // Basic info
  const healthInfo = {
    connected: isMongoConnected,
    state: connectionState,
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  };
  
  // If not connected, add diagnostics
  if (!isMongoConnected) {
    try {
      // Run network diagnostic
      const networkDiagnostic = await runNetworkDiagnostic();
      healthInfo.network = networkDiagnostic;
      
      // Get last error if any
      if (mongoose.connection.lastError) {
        healthInfo.lastError = {
          message: mongoose.connection.lastError.message,
          code: mongoose.connection.lastError.code
        };
      }
      
      // Include options for debugging
      if (mongoose.connection._connectionOptions) {
        healthInfo.options = { ...mongoose.connection._connectionOptions };
        
        // Remove sensitive info
        if (healthInfo.options.user) healthInfo.options.user = '[REDACTED]';
        if (healthInfo.options.pass) healthInfo.options.pass = '[REDACTED]';
      }
    } catch (error) {
      healthInfo.diagnosticError = error.message;
    }
  }
  
  return healthInfo;
};

module.exports = {
  isConnected,
  getConnectionState,
  runNetworkDiagnostic,
  checkConnectionHealth
}; 