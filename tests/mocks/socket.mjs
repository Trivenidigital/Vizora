/**
 * Mock Socket.IO server for tests
 */

import { Server } from 'socket.io';
import { app } from './app.mjs';
import { createServer } from 'http';

// Create HTTP server
const server = createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Mock display connections
const connectedDisplays = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle display registration
  socket.on('display:register', (data) => {
    const { deviceId, name } = data;
    if (!deviceId || !name) {
      socket.emit('display:register:error', { error: 'Missing required fields' });
      return;
    }

    connectedDisplays.set(deviceId, {
      socketId: socket.id,
      name,
      status: 'online',
      lastSeen: new Date()
    });

    socket.emit('display:register:success', {
      id: deviceId,
      name,
      status: 'online'
    });

    // Broadcast display status update
    io.emit('display:status', {
      id: deviceId,
      status: 'online',
      name
    });
  });

  // Handle content updates
  socket.on('content:update', (data) => {
    const { displayId, content } = data;
    if (!displayId || !content) {
      socket.emit('content:update:error', { error: 'Missing required fields' });
      return;
    }

    const display = connectedDisplays.get(displayId);
    if (!display) {
      socket.emit('content:update:error', { error: 'Display not found' });
      return;
    }

    socket.emit('content:update:success', {
      displayId,
      content,
      timestamp: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find and update disconnected display
    for (const [deviceId, display] of connectedDisplays.entries()) {
      if (display.socketId === socket.id) {
        display.status = 'offline';
        display.lastSeen = new Date();
        
        // Broadcast display status update
        io.emit('display:status', {
          id: deviceId,
          status: 'offline',
          name: display.name
        });
        break;
      }
    }
  });
});

export { io, server }; 