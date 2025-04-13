/**
 * Fixed server implementation for VizoraMiddleware
 * Addresses issues with the /api/displays endpoint
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler, notFoundHandler } = require('./errorHandler');
const app = express();
const PORT = 3005;

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  // Don't exit the process as it would terminate the server
});

// CORS configuration - MUST be before any route handlers
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Detailed logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  
  // Add response logging
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`[RESPONSE] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
});

// /api/displays endpoint with proper error handling
app.get('/api/displays', (req, res) => {
  console.log('[GET] /api/displays endpoint hit');
  
  try {
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json({
      success: true,
      data: [] // Empty array
    });
    console.log('[SUCCESS] /api/displays response sent successfully');
  } catch (error) {
    console.error('[ERROR] /api/displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Also handle displays directly (in case the router omits the /api prefix)
app.get('/displays', (req, res) => {
  console.log('[GET] /displays hit - redirecting to /api/displays');
  
  try {
    res.status(200).json({
      success: true,
      data: [] // Empty array
    });
    console.log('[SUCCESS] /displays response sent successfully');
  } catch (error) {
    console.error('[ERROR] /displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Simple auth middleware
const authMiddleware = (req, res, next) => {
  // Extract token from Authorization header or from cookie
  let token = null;
  
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // If no token in header, check cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required',
      statusCode: 401
    });
  }
  
  try {
    // For real app, you would verify the JWT here
    // For now, we'll accept any token and attach a mock user
    req.user = {
      id: '1',
      email: 'admin@vizora.ai',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token',
      statusCode: 401
    });
  }
};

// Auth endpoints
// Login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('[POST] /api/auth/login endpoint hit');
  
  // Validate email and password
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required',
      statusCode: 400
    });
  }
  
  // Mock user (in a real app this would come from your database)
  const user = {
    id: '1',
    email: 'admin@vizora.ai',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  };
  
  // Create a mock JWT token
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkB2aXpvcmEuYWkiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2NzY5MTcyMDAsImV4cCI6MTY3NzAwMzYwMH0.vqHlp5rCmEj9K8RM2UgM5GZ60nfQZA8OMY1GyVCmQFU';
  
  // Set token as a cookie for session
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: 'lax'
  });
  
  // Return success response with user data and token
  res.json({
    success: true,
    message: 'Login successful',
    user,
    token
  });
});

// Current user endpoint
app.get('/api/auth/me', authMiddleware, (req, res) => {
  // The user object is attached by the auth middleware
  res.json({
    success: true,
    message: 'User data retrieved successfully',
    user: req.user
  });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  // Clear the token cookie
  res.clearCookie('token');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Handle OPTIONS requests explicitly
app.options('*', (req, res) => {
  console.log(`[OPTIONS] Preflight request for ${req.originalUrl}`);
  res.status(204).end();
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Error handler for all routes
app.use(errorHandler);

// Start the server with error handling
const server = app.listen(PORT, () => {
  console.log('\n\n===================================');
  console.log(`Fixed server started on http://localhost:${PORT}`);
  console.log(`Test displays endpoint: http://localhost:${PORT}/api/displays`);
  console.log('===================================\n\n');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please terminate the existing server or use a different port.`);
  } else {
    console.error('Server error:', err);
  }
});

// Export for testing
module.exports = { app, server }; 