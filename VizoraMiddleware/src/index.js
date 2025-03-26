require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Redis = require('redis');
const http = require('http');
const socketIo = require('socket.io');
const logger = require('./utils/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import routes
const authRoutes = require('./routes/auth');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*', // Allow configured origins or all in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  path: process.env.WS_PATH || '/socket.io',
  transports: ['websocket', 'polling'],
  allowEIO3: true // Allow Engine.IO version 3 clients
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5174',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Handle OPTIONS preflight requests explicitly
app.options('*', cors());

// Redis Connection
let redisClient;
try {
  redisClient = Redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD || undefined, // Only use password if provided
    retry_strategy: function(options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        logger.error('Redis connection refused. Will retry.');
        return Math.min(options.attempt * 1000, 5000); // Retry with backoff up to 5 seconds
      }
      if (options.total_retry_time > 1000 * 60 * 5) {
        logger.error('Redis retry time exhausted after 5 minutes. Continuing without Redis.');
        return undefined; // Stop retrying after 5 minutes
      }
      if (options.attempt > 15) {
        logger.error('Redis maximum retries reached (15). Continuing without Redis.');
        return undefined; // Stop after 15 attempts
      }
      return Math.min(options.attempt * 500, 3000); // Retry with backoff
    }
  });

  redisClient.on('connect', () => {
    logger.info('Connected to Redis');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });

  redisClient.on('reconnecting', () => {
    logger.info('Reconnecting to Redis...');
  });

  // Connect to Redis
  (async () => {
    try {
      await redisClient.connect();
      // Test Redis connection
      await redisClient.set('test-connection', 'success');
      const result = await redisClient.get('test-connection');
      if (result === 'success') {
        logger.info('Redis connection verified with test key');
      }
    } catch (err) {
      logger.error('Failed to connect to Redis:', err);
      logger.info('Continuing without Redis - will generate synthetic pairing codes');
    }
  })();
} catch (error) {
  logger.error('Error creating Redis client:', error);
  logger.info('Continuing without Redis - will generate synthetic pairing codes');
  redisClient = {
    isReady: false,
    set: () => Promise.resolve(null),
    get: () => Promise.resolve(null),
    expire: () => Promise.resolve(null)
  };
}

// Fallback Redis operations when Redis is not available
const fallbackRedisOperations = {
  set: async (key, value) => {
    logger.info(`[FALLBACK] Setting ${key}=${value} in memory`);
    return Promise.resolve();
  },
  expire: async (key, ttl) => {
    logger.info(`[FALLBACK] Setting expiry of ${ttl}s for ${key} in memory`);
    return Promise.resolve();
  },
  get: async (key) => {
    logger.info(`[FALLBACK] Getting ${key} from memory (will return null)`);
    return Promise.resolve(null);
  }
};

// Safe Redis operations that don't fail the application
const safeRedisOps = {
  async set(key, value, ttl = 86400) {
    try {
      if (!redisClient || !redisClient.isReady) {
        return await fallbackRedisOperations.set(key, value);
      }
      await redisClient.set(key, value);
      if (ttl) {
        await redisClient.expire(key, ttl);
      }
      return true;
    } catch (error) {
      logger.error(`Error in Redis SET operation for ${key}:`, error);
      return false;
    }
  },
  async get(key) {
    try {
      if (!redisClient || !redisClient.isReady) {
        return await fallbackRedisOperations.get(key);
      }
      return await redisClient.get(key);
    } catch (error) {
      logger.error(`Error in Redis GET operation for ${key}:`, error);
      return null;
    }
  }
};

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch(err => {
    logger.error('MongoDB connection error:', err);
    logger.info('Continuing without MongoDB');
  });

// Routes
app.use('/api/auth', authRoutes);

// Handle OPTIONS for auth endpoints directly
app.options('/api/auth/signup', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).send();
});

// Also handle OPTIONS for the direct signup endpoint
app.options('/api/auth/direct-signup', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).send();
});

// Signup endpoint with explicit CORS headers
app.post('/api/auth/signup', async (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if user already exists
    const User = mongoose.model('User');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Send response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  // Get device information from the connection query
  const { deviceId, deviceType } = socket.handshake.query;
  
  if (deviceId) {
    logger.info(`Device connected: ${deviceId} (${deviceType || 'unknown type'})`);
    
    // Join a room for this specific device
    socket.join(deviceId);
    
    // Send a welcome message
    socket.emit('message', { 
      type: 'welcome',
      message: `Welcome device ${deviceId}!`,
      timestamp: Date.now()
    });
    
    // If this is a TV device, register it and generate a pairing code
    if (deviceType === 'tv') {
      sendRegistrationResponse(socket, deviceId);
    }
  }
  
  // Handle both register_display and register-display events with the same handler
  const registerHandler = async (data, callback) => {
    logger.info(`Received register_display request from ${socket.id}:`, data);
    
    // Extract the device ID from the data or socket query parameters
    const deviceId = data.deviceId || socket.handshake.query.deviceId || `display-${Date.now()}`;
    
    // Join a room for this specific device if not already done
    const isInRoom = Array.from(socket.rooms || []).includes(deviceId);
    if (!isInRoom) {
      socket.join(deviceId);
      logger.info(`Socket ${socket.id} joined room for device ${deviceId}`);
    }
    
    await sendRegistrationResponse(socket, deviceId, callback);
  };
  
  // Register both event name formats for compatibility
  socket.on('register_display', registerHandler);
  socket.on('register-display', registerHandler);
  
  // Handle ping for diagnostics
  socket.on('ping', (data, callback) => {
    logger.debug(`Received ping from ${socket.id}`);
    const response = {
      serverTime: Date.now(),
      clientTime: data?.timestamp,
      socketId: socket.id,
      deviceId: socket.handshake.query.deviceId,
      deviceType: socket.handshake.query.deviceType
    };
    
    // Use callback if provided (newer Socket.IO clients)
    if (typeof callback === 'function') {
      callback(response);
    } else {
      // Otherwise emit response (older clients)
      socket.emit('pong', response);
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Function to handle registration and send response
async function sendRegistrationResponse(socket, deviceId, callback) {
  try {
    // Generate a new pairing code
    const pairingCode = generatePairingCode();
    logger.info(`Generated pairing code for device ${deviceId}: ${pairingCode}`);
    
    // Store the pairing code in Redis with a TTL (24 hours)
    const storedSuccessfully = await safeRedisOps.set(`pairing:${deviceId}`, pairingCode, 24 * 60 * 60);
    if (storedSuccessfully) {
      logger.info(`Successfully stored pairing code for ${deviceId} with 24h expiry`);
    } else {
      logger.warn(`Using in-memory (volatile) pairing code for ${deviceId}: ${pairingCode}`);
    }
    
    // Create response object
    const response = {
      displayId: deviceId,
      pairingCode: pairingCode,
      timestamp: Date.now()
    };
    
    // Send the registration response in two ways
    logger.info(`Sending display_registered event to ${socket.id} for device ${deviceId}`);
    
    // Emit the event to the socket
    socket.emit('display_registered', response);
    
    // Use callback if provided (Socket.IO acknowledgement)
    if (typeof callback === 'function') {
      logger.info(`Sending callback response to ${socket.id} for device ${deviceId}`);
      callback(response);
    }
    
    return response;
  } catch (error) {
    logger.error(`Error in registration process for ${deviceId}:`, error);
    const errorResponse = {
      displayId: deviceId,
      error: 'Failed to register display due to server error',
      timestamp: Date.now()
    };
    
    // Send error both ways
    socket.emit('error', {
      type: 'registration_error',
      message: 'Failed to register display due to server error',
      timestamp: Date.now()
    });
    
    if (typeof callback === 'function') {
      callback(errorResponse);
    }
    
    return errorResponse;
  }
}

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  // Log CORS debug info if DEBUG_CORS is enabled
  if (process.env.DEBUG_CORS === 'true') {
    logger.info('CORS Test Request Headers:', req.headers);
    logger.info('CORS Origin:', req.headers.origin);
    logger.info('CORS Test Allowed Origins:', process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*');
  }
  
  res.json({ 
    message: 'CORS test successful', 
    origin: req.headers.origin || 'unknown',
    headers: req.headers,
    corsConfig: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      debug: process.env.DEBUG_CORS === 'true'
    }
  });
});

// Add a specific forced-cors endpoint for testing
app.get('/forced-cors', (req, res) => {
  // Always allow CORS for this endpoint
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  res.json({ 
    message: 'Forced CORS test successful',
    timestamp: Date.now()
  });
});

// Health endpoint with more CORS and connection information
app.get('/health', (req, res) => {
  // Log CORS debug info if DEBUG_CORS is enabled
  if (process.env.DEBUG_CORS === 'true') {
    logger.info('Health Request Headers:', req.headers);
    logger.info('Health Origin:', req.headers.origin);
  }
  
  res.json({ 
    status: 'ok',
    timestamp: Date.now(),
    redis: redisClient && redisClient.isReady ? 'connected' : 'disconnected',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    socketio: io ? 'initialized' : 'not initialized',
    environment: process.env.NODE_ENV,
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      debug: process.env.DEBUG_CORS === 'true'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Helper function to generate a random pairing code
function generatePairingCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const PORT = process.env.PORT || 3003; // Default to 3003 explicitly
server.listen(PORT, () => {
  logger.info(`Middleware server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Socket.IO path: ${process.env.WS_PATH || '/socket.io'}`);
}); 