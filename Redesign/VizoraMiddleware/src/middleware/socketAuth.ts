/**
 * Socket.IO authentication middleware
 * Authenticates socket connections and attaches user/device information
 */

import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { ExtendedError } from 'socket.io/dist/namespace';

// Define socket with extended interface to include user/device info
export interface AuthenticatedSocket extends Socket {
  deviceId?: string;
  deviceType?: string;
  user?: any;
  authenticated?: boolean;
}

/**
 * Middleware for authenticating Socket.IO connections
 */
const socketAuth = (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
  // Get auth token from handshake
  const token = socket.handshake.auth.token 
    || socket.handshake.headers.authorization 
    || socket.handshake.query?.token;
    
  // Attach basic security info to the socket
  socket.authenticated = false;
  
  // Get device ID from handshake if available
  const deviceId = socket.handshake.query?.deviceId || socket.handshake.auth.deviceId;
  if (deviceId) {
    socket.deviceId = String(deviceId);
    socket.deviceType = 'display';
    
    logger.debug(`Socket ${socket.id} identified as device ${deviceId}`);
  }
  
  // If no token is provided, still allow connection, but mark as unauthenticated
  if (!token) {
    logger.debug(`Socket ${socket.id} connected without token - allowing as unauthenticated`);
    return next();
  }
  
  try {
    // Verify JWT token
    const sanitizedToken = String(token).replace('Bearer ', '');
    const jwtSecret = process.env.JWT_SECRET || 'vizora-dev-secret';
    
    const decoded = jwt.verify(sanitizedToken, jwtSecret);
    
    // Attach user data to socket
    socket.user = decoded;
    socket.authenticated = true;
    
    logger.debug(`Socket ${socket.id} authenticated as user ${(decoded as any).id || 'unknown'}`);
    return next();
  } catch (error) {
    logger.warn(`Socket ${socket.id} provided invalid token:`, error);
    
    // Still allow connection, but mark as unauthenticated
    return next();
  }
};

export default socketAuth; 