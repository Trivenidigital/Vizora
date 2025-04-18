/**
 * Diagnostic Routes
 * API endpoints for system diagnostics and monitoring
 */

import { Router } from 'express';
import express from 'express';
import os from 'os';
import mongoose from 'mongoose';
import { ExtendedSocket } from '../types/socket';
import { Server } from 'socket.io';
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
    const typedError = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Error generating diagnostics',
      error: typedError.message,
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
    const typedError = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Error generating socket diagnostic',
      error: typedError.message,
    });
  }
});

// Route to get system diagnostics
router.get('/system', async (req, res) => {
  // ... existing code ...
});

// Route to get socket diagnostics
router.get('/sockets', async (req, res) => {
  const io = (req.app.get('io') as Server); // Get io instance from app settings
  if (!io) {
    return res.status(500).json({ success: false, message: 'Socket.IO server not available' });
  }
  try {
    const sockets = await io.fetchSockets();
    const socketDetails = sockets.map((socket: ExtendedSocket) => { // Use ExtendedSocket
      const clientIp = socket.handshake.address;
      return {
        id: socket.id,
        ip: clientIp,
        connectedAt: socket.handshake.time, // Or use a connection timestamp if stored elsewhere
        transport: socket.conn.transport.name,
        secure: socket.handshake.secure,
        // Add any custom properties if available and needed
        deviceId: socket.deviceId,
        deviceType: socket.deviceType,
        authenticated: socket.authenticated,
        user: socket.user ? { 
          id: typeof socket.user === 'object' && socket.user && 'id' in socket.user ? socket.user.id : 'N/A',
          role: typeof socket.user === 'object' && socket.user && 'role' in socket.user ? socket.user.role : 'N/A',
        } : null,
      };
    });

    res.json({ success: true, sockets: socketDetails });
  } catch (error) {
    // ... existing code ...
  });

// Route to get specific socket details
router.get('/sockets/:socketId', async (req, res) => {
  const { socketId } = req.params;
  const io = (req.app.get('io') as Server); // Get io instance from app settings
  if (!io) {
    return res.status(500).json({ success: false, message: 'Socket.IO server not available' });
  }

  try {
    // Fetch the specific socket using its ID
    const remoteSockets = await io.in(socketId).fetchSockets();
    const socket = remoteSockets.length > 0 ? (remoteSockets[0] as ExtendedSocket) : undefined; // Cast to ExtendedSocket

    if (!socket) {
      return res.status(404).json({ success: false, message: 'Socket not found' });
    }

    const socketInfo: any = {
      id: socket.id,
      ip: socket.handshake.address,
      connectedAt: socket.handshake.time,
      transport: socket.conn.transport.name,
      secure: socket.handshake.secure,
      rooms: Array.from(socket.rooms),
    };

    // Add custom properties safely
    if (socket.authenticated) {
      socketInfo.isAuthenticated = socket.authenticated;
    }
    if (socket.user) {
      socketInfo.user = {
        id: typeof socket.user === 'object' && socket.user && 'id' in socket.user ? socket.user.id : 'N/A',
        role: typeof socket.user === 'object' && socket.user && 'role' in socket.user ? socket.user.role : 'N/A',
      };
    }
    if (socket.deviceId) {
      socketInfo.deviceId = socket.deviceId;
    }
    if (socket.deviceType) {
      socketInfo.deviceType = socket.deviceType;
    }

    res.json({ success: true, socketInfo });

  } catch (error) {
    // ... existing code ...
  });

export default router; 