/**
 * Diagnostic Routes
 * API endpoints for system diagnostics and monitoring
 */

import { Router } from 'express';
import { getSocketStatus } from '../socketServer';
import logger from '../utils/logger';

const router = Router();

/**
 * @route   GET /api/diagnostics
 * @desc    Get system diagnostics information
 * @access  Public
 */
router.get('/diagnostics', (req, res) => {
  try {
    const diagnostics = {
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV || 'development',
      },
      socket: getSocketStatus(),
      time: new Date().toISOString(),
    };
    
    return res.json({
      success: true,
      diagnostics,
    });
  } catch (error) {
    logger.error('Error generating diagnostics:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error generating diagnostics',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/socket-diagnostic
 * @desc    Get detailed Socket.IO diagnostics
 * @access  Public
 */
router.get('/socket-diagnostic', (req, res) => {
  try {
    // Check that global IO is available
    if (!global.io) {
      return res.status(500).json({
        success: false,
        message: 'Socket.IO not initialized yet',
      });
    }
    
    // Get basic socket status
    const socketStatus = getSocketStatus();
    
    // Get socket server stats
    const serverStats = {
      engine: global.io.engine ? {
        clientsCount: global.io.engine.clientsCount,
        status: 'running',
      } : 'not available',
      adapterType: socketStatus.adapterType,
      redisEnabled: socketStatus.redisEnabled,
      redisConnected: socketStatus.redisConnected,
      rooms: Array.from(global.io.sockets.adapter.rooms.keys())
        .filter(room => !room.startsWith('/'))
        .slice(0, 20), // Limit to first 20 rooms
      transports: ['polling', 'websocket'],
      activeConnections: socketStatus.activeConnections,
    };
    
    // Get a count of connections by type
    const connections = {
      total: serverStats.activeConnections,
      authenticated: 0,
      anonymous: 0,
      users: 0,
      devices: 0,
    };
    
    // Loop through all sockets
    const sockets = global.io.sockets.sockets;
    sockets.forEach(socket => {
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
    
    return res.json({
      success: true,
      status: 'Socket.IO server running',
      serverStats,
      connections,
      adapterInfo: {
        type: socketStatus.adapterType,
        redisEnabled: socketStatus.redisEnabled,
        redisConnected: socketStatus.redisConnected,
      },
    });
  } catch (error) {
    logger.error('Error generating socket diagnostic:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error generating socket diagnostic',
      error: error.message,
    });
  }
});

export default router; 