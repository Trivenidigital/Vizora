/**
 * Token Store Service
 * Provides storage for short-lived tokens like pairing codes with TTL support
 * Phase 4: This in-memory implementation can be easily swapped with Redis or MongoDB TTL indexes
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * In-memory token store with TTL and cleanup
 * This is a temporary implementation that will be replaced with Redis or DB in Phase 4
 */
class TokenStore {
  constructor() {
    this.tokens = new Map();
    this.expirations = new Map();
    
    // Setup cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60 * 1000); // Run cleanup every minute
    
    logger.info('TokenStore initialized with in-memory storage');
  }
  
  /**
   * Store a token with associated data and expiration
   * @param {string} key - Unique identifier for the token (e.g., deviceId)
   * @param {string} tokenType - Type of token (e.g., 'pairing', 'refresh')
   * @param {any} data - Data to store with the token
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {string} The generated token
   */
  storeToken(key, tokenType, data = {}, ttlSeconds = 300) {
    try {
      // Generate a unique token
      const token = this.generateToken();
      
      // Calculate expiration timestamp
      const expiresAt = Date.now() + ttlSeconds * 1000;
      
      // Create compound key for storage
      const storeKey = `${tokenType}:${key}:${token}`;
      
      // Store token data
      this.tokens.set(storeKey, {
        key,
        tokenType,
        token,
        data,
        createdAt: Date.now(),
        expiresAt
      });
      
      // Also store in expirations map for cleanup
      this.expirations.set(storeKey, expiresAt);
      
      logger.debug(`Token stored: ${tokenType} for ${key}, expires in ${ttlSeconds} seconds`);
      
      return token;
    } catch (error) {
      logger.error(`Error storing token: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Validate and retrieve token data
   * @param {string} key - Unique identifier for the token
   * @param {string} tokenType - Type of token
   * @param {string} token - Token to validate
   * @returns {object|null} Token data or null if invalid/expired
   */
  validateToken(key, tokenType, token) {
    try {
      const storeKey = `${tokenType}:${key}:${token}`;
      
      // Check if token exists
      if (!this.tokens.has(storeKey)) {
        logger.debug(`Token not found: ${tokenType} for ${key}`);
        return null;
      }
      
      const tokenData = this.tokens.get(storeKey);
      
      // Check if token has expired
      if (tokenData.expiresAt < Date.now()) {
        logger.debug(`Token expired: ${tokenType} for ${key}`);
        // Clean up expired token
        this.tokens.delete(storeKey);
        this.expirations.delete(storeKey);
        return null;
      }
      
      logger.debug(`Token validated: ${tokenType} for ${key}`);
      
      return tokenData;
    } catch (error) {
      logger.error(`Error validating token: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Invalidate a token
   * @param {string} key - Unique identifier for the token
   * @param {string} tokenType - Type of token
   * @param {string} token - Token to invalidate
   * @returns {boolean} True if token was invalidated
   */
  invalidateToken(key, tokenType, token) {
    try {
      const storeKey = `${tokenType}:${key}:${token}`;
      
      // Check if token exists
      if (!this.tokens.has(storeKey)) {
        return false;
      }
      
      // Delete token
      this.tokens.delete(storeKey);
      this.expirations.delete(storeKey);
      
      logger.debug(`Token invalidated: ${tokenType} for ${key}`);
      
      return true;
    } catch (error) {
      logger.error(`Error invalidating token: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get all active tokens for a key and type
   * @param {string} key - Unique identifier 
   * @param {string} tokenType - Type of token
   * @returns {Array} Array of active tokens
   */
  getActiveTokens(key, tokenType) {
    const activeTokens = [];
    const prefix = `${tokenType}:${key}:`;
    
    for (const [storeKey, tokenData] of this.tokens.entries()) {
      if (storeKey.startsWith(prefix) && tokenData.expiresAt > Date.now()) {
        activeTokens.push(tokenData);
      }
    }
    
    return activeTokens;
  }
  
  /**
   * Clean up expired tokens
   * @private
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [storeKey, expiresAt] of this.expirations.entries()) {
      if (expiresAt < now) {
        this.tokens.delete(storeKey);
        this.expirations.delete(storeKey);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired tokens`);
    }
  }
  
  /**
   * Generate a secure random token
   * @private
   * @returns {string} Random token
   */
  generateToken() {
    // For pairing codes, use a human-readable format
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  
  /**
   * Generate a numeric pairing code
   * @returns {string} 6-digit numeric code
   */
  generatePairingCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  /**
   * Get the store size (for monitoring)
   * @returns {object} Store size information
   */
  getStoreSize() {
    return {
      tokens: this.tokens.size,
      expirations: this.expirations.size
    };
  }
  
  /**
   * Clean up resources when shutting down
   */
  shutdown() {
    clearInterval(this.cleanupInterval);
    this.tokens.clear();
    this.expirations.clear();
    logger.info('TokenStore shut down');
  }
}

// Export singleton instance
const tokenStore = new TokenStore();

module.exports = tokenStore; 