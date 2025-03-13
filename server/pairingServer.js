import { Server } from 'socket.io';
import crypto from 'crypto';

/**
 * Manages device pairing sessions
 */
class PairingManager {
  constructor() {
    this.sessions = new Map();
    this.sessionCleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 60000);
  }

  /**
   * Create a new pairing session
   * @returns {Object} The created session
   */
  createSession() {
    // Generate a random 6-character alphanumeric code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Create session with 10-minute expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    
    const session = {
      id: crypto.randomUUID(),
      code,
      createdAt: now,
      expiresAt,
      status: 'pending',
      subscribers: new Set()
    };
    
    this.sessions.set(code, session);
    
    // Return a sanitized version without internal properties
    return this.sanitizeSession(session);
  }

  /**
   * Get a session by its code
   * @param {string} code The session code
   * @returns {Object|null} The session or null if not found
   */
  getSession(code) {
    const session = this.sessions.get(code);
    if (!session) return null;
    
    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      session.status = 'expired';
    }
    
    return this.sanitizeSession(session);
  }

  /**
   * Update a session with device information when paired
   * @param {string} code The session code
   * @param {Object} deviceInfo Information about the paired device
   * @returns {Object|null} The updated session or null if not found
   */
  pairDevice(code, deviceInfo) {
    const session = this.sessions.get(code);
    if (!session) return null;
    
    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      session.status = 'expired';
      return this.sanitizeSession(session);
    }
    
    // Update session with device info and mark as paired
    session.deviceInfo = deviceInfo;
    session.status = 'paired';
    
    return this.sanitizeSession(session);
  }

  /**
   * Subscribe a socket to session updates
   * @param {string} code The session code
   * @param {string} socketId The socket ID to subscribe
   */
  subscribeToSession(code, socketId) {
    const session = this.sessions.get(code);
    if (session) {
      session.subscribers.add(socketId);
    }
  }

  /**
   * Unsubscribe a socket from session updates
   * @param {string} code The session code
   * @param {string} socketId The socket ID to unsubscribe
   */
  unsubscribeFromSession(code, socketId) {
    const session = this.sessions.get(code);
    if (session) {
      session.subscribers.delete(socketId);
    }
  }

  /**
   * Get all socket IDs subscribed to a session
   * @param {string} code The session code
   * @returns {string[]} Array of socket IDs
   */
  getSessionSubscribers(code) {
    const session = this.sessions.get(code);
    return session ? Array.from(session.subscribers) : [];
  }

  /**
   * Remove expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    
    for (const [code, session] of this.sessions.entries()) {
      if (now > new Date(session.expiresAt)) {
        // Mark as expired before notifying subscribers
        session.status = 'expired';
        
        // Notify subscribers before removing
        const subscribers = this.getSessionSubscribers(code);
        if (subscribers.length > 0) {
          const sanitizedSession = this.sanitizeSession(session);
          this.notifySubscribers(subscribers, sanitizedSession);
        }
        
        // Remove the session
        this.sessions.delete(code);
      }
    }
  }

  /**
   * Notify all subscribers of a session update
   * @param {string[]} socketIds Array of socket IDs to notify
   * @param {Object} session The updated session
   */
  notifySubscribers(socketIds, session) {
    // This method will be implemented by the server
    // It's a placeholder here
    return { socketIds, session };
  }

  /**
   * Remove internal properties from session object
   * @param {Object} session The session to sanitize
   * @returns {Object} Sanitized session
   */
  sanitizeSession(session) {
    const { subscribers, ...sanitized } = session;
    return sanitized;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    clearInterval(this.sessionCleanupInterval);
  }
}

/**
 * Initialize the pairing server
 * @param {Object} io Socket.IO server instance
 * @returns {Object} The Socket.IO server instance
 */
export function setupPairingServer(io) {
  const pairingManager = new PairingManager();
  
  // Override the notifySubscribers method to use Socket.IO
  pairingManager.notifySubscribers = (socketIds, session) => {
    socketIds.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('pairingUpdate', session);
      }
    });
  };
  
  io.on('connection', (socket) => {
    console.log('Client connected to pairing server:', socket.id);
    
    // Create a new pairing session
    socket.on('createPairingSession', (data, callback) => {
      try {
        const session = pairingManager.createSession();
        callback({ success: true, session });
      } catch (error) {
        console.error('Error creating pairing session:', error);
        callback({ success: false, error: error.message });
      }
    });
    
    // Subscribe to pairing updates
    socket.on('subscribeToPairing', ({ code }) => {
      if (!code) return;
      pairingManager.subscribeToSession(code, socket.id);
    });
    
    // Unsubscribe from pairing updates
    socket.on('unsubscribeFromPairing', ({ code }) => {
      if (!code) return;
      pairingManager.unsubscribeFromSession(code, socket.id);
    });
    
    // Check pairing status
    socket.on('checkPairingStatus', ({ code }, callback) => {
      if (!code) {
        callback({ success: false, error: 'No code provided' });
        return;
      }
      
      const session = pairingManager.getSession(code);
      if (session) {
        callback({ success: true, session });
      } else {
        callback({ success: false, error: 'Invalid or expired code' });
      }
    });
    
    // Handle pairing from device
    socket.on('pairDevice', ({ code, deviceInfo }, callback) => {
      if (!code || !deviceInfo) {
        callback({ success: false, error: 'Missing code or device info' });
        return;
      }
      
      try {
        const session = pairingManager.pairDevice(code, deviceInfo);
        if (session) {
          // Notify all subscribers
          const subscribers = pairingManager.getSessionSubscribers(code);
          pairingManager.notifySubscribers(subscribers, session);
          
          callback({ success: true, session });
        } else {
          callback({ success: false, error: 'Invalid or expired code' });
        }
      } catch (error) {
        console.error('Error pairing device:', error);
        callback({ success: false, error: error.message });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected from pairing server:', socket.id);
      // Unsubscribe from all sessions
      for (const [code] of pairingManager.sessions.entries()) {
        pairingManager.unsubscribeFromSession(code, socket.id);
      }
    });
  });
  
  return io;
}
