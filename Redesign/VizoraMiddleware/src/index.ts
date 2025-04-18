import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import { Socket } from 'socket.io';
import { Request, Response, NextFunction } from 'express';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Import MongoDB connection
import mongoose from 'mongoose';

// Import logger utility
const logger = require('./utils/logger');

// Import routes
// const apiRoutes = require('./routes');

// Create Express app
const app = express();
const httpServer = createServer(app);

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: function(origin: any, callback: any) {
      // Allow any localhost origin and null origins (like Postman)
      if (!origin || origin.match(/^https?:\/\/localhost:\d+$/)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'development') {
        logger.debug(`Development mode: allowing Socket.IO origin ${origin}`);
        callback(null, true);
      } else {
        logger.warn(`Socket.IO: Origin ${origin} not allowed by CORS`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'Origin', 'Accept'],
  },
});

// Configure CORS for Express
const corsOptions = {
  origin: function(origin: any, callback: any) {
    // Allow any localhost origin and null origins (like Postman)
    if (!origin || origin.match(/^https?:\/\/localhost:\d+$/)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, log the origin but still allow it
      logger.debug(`Development mode: allowing Express origin ${origin}`);
      callback(null, true);
    } else {
      logger.warn(`Express: Origin ${origin} not allowed by CORS`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'Content-Length', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Confirm-Delete'],
  maxAge: 86400, // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle CORS preflight requests explicitly
app.options('*', cors(corsOptions));

// Add CORS headers manually for additional safety
app.use((req, res, next) => {
  // Get the origin from the request
  const origin = req.headers.origin;
  
  // If it's a localhost origin or we're in development, set explicit headers
  if (origin && (origin.match(/^https?:\/\/localhost:\d+$/) || process.env.NODE_ENV === 'development')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  }
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Only use the MONGO_URI from env, with no in-memory or localhost fallback
    // This ensures we only connect to MongoDB Atlas per architecture requirements
    if (!process.env.MONGO_URI || !process.env.MONGO_URI.includes('mongodb+srv')) {
      throw new Error('Invalid MongoDB Atlas connection string. Please check your .env file.');
    }
    
    const mongoURI = process.env.MONGO_URI;
    logger.info(`Connecting to MongoDB Atlas: ${mongoURI.substring(0, mongoURI.indexOf('@') + 1)}[CREDENTIALS_HIDDEN]`);
    
    // Connection options without deprecated options
    const mongooseOptions = {
      serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };
    
    try {
      await mongoose.connect(mongoURI, mongooseOptions);
      logger.info('MongoDB Atlas connected successfully');
      
      // Ensure an admin user exists
      const User = require('./models/User');
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@vizora.com';
      
      // Check if admin user already exists
      const adminExists = await User.findOne({ email: adminEmail });
      
      if (!adminExists) {
        logger.info(`Creating default admin user: ${adminEmail}`);
        // Create admin user
        const adminUser = new User({
          email: adminEmail,
          password: process.env.ADMIN_PASSWORD || 'admin123',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true,
          emailVerified: true
        });
        
        await adminUser.save();
        logger.info('Default admin user created successfully');
      } else {
        logger.info('Admin user already exists');
      }
    } catch (dbError) {
      logger.error('MongoDB Atlas connection error:', { error: dbError });
      logger.error('Unable to connect to MongoDB Atlas. Server cannot start without database connection.');
      process.exit(1);
    }
  } catch (error) {
    logger.error('MongoDB Atlas connection error:', { error });
    const typedError = error as Error;

    if (typedError.name === 'MongoNetworkError') {
      logger.error('Network error occurred. Check your internet connection and MongoDB Atlas network settings.');
    } else if (typedError.name === 'MongoServerSelectionError') {
      logger.error('Server selection timed out. Verify your MongoDB Atlas connection string and network configuration.');
    } else if (typedError.message.includes('Invalid MongoDB Atlas connection string')) {
      logger.error('CONNECTION STRING ERROR: Make sure you have configured a valid MongoDB Atlas connection string in your .env file.');
      logger.error('Required format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
    }
    
    process.exit(1);
  }
};

// Cleanup function to close MongoDB connections when the server stops
const closeDBConnection = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB Atlas connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB Atlas connection:', { error });
  }
};

// Start MSW mock server in development if enabled
if (process.env.ENABLE_MSW_MOCK === 'true' && process.env.NODE_ENV === 'development') {
  const { server: mockServer } = require('./mocks/server');
  mockServer.listen();
  logger.info('MSW Mock Server started');
}

// API routes
// Mount API health check endpoint
app.get('/api/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ status: 'ok' });
});

// Authentication endpoints
app.get('/api/auth/me', async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const User = require('./models/User');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Return user info
    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Error in /api/auth/me:', { error });
    const typedError = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Error retrieving user',
      error: process.env.NODE_ENV === 'development' ? typedError.message : undefined
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    logger.debug('Login attempt received:', {
      email,
      passwordProvided: !!password
    });
    
    // Check for required fields
    if (!email || !password) {
      logger.debug('Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Connect to MongoDB and get User model
    const User = require('./models/User');
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      logger.debug(`User not found with email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    logger.debug('User found:', {
      id: user._id,
      email: user.email,
      role: user.role
    });
    
    // Check if password matches
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      logger.debug('Password does not match');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    logger.debug('Password match successful');
    
    // Generate token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    logger.debug('Token generated');
    
    // Return response
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    logger.error('Login error:', { error });
    const typedError = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? typedError.message : undefined
    });
  }
});

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    logger.debug('Register attempt received:', {
      email,
      passwordProvided: !!password,
      firstName,
      lastName
    });
    
    // Check for required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: email, password, firstName, lastName'
      });
    }
    
    // Connect to MongoDB and get User model
    const User = require('./models/User');
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role: 'user'
    });
    
    await user.save();
    
    // Generate token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return response
    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Register error:', { error });
    const typedError = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? typedError.message : undefined
    });
  }
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ status: 'ok' });
});

// Default Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected:', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', { socketId: socket.id });
  });
});

const PORT = process.env.PORT || 3003;

// Initialize server
const startServer = async () => {
  // Connect to MongoDB first
  await connectDB();
  
  // Then start the server
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API available at http://localhost:${PORT}/api`);
    logger.info(`Socket.IO available at http://localhost:${PORT}`);
  });
};

// Start server
startServer().catch(err => {
  logger.error('Failed to start server:', { error: err });
});

// Handle application shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  await closeDBConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  await closeDBConnection();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', { error });
  await closeDBConnection();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason });
  await closeDBConnection();
  process.exit(1);
});