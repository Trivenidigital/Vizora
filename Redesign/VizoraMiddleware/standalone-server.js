/**
 * Standalone server for VizoraMiddleware
 * This is a simplified server that only implements the /api/displays endpoint
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = 3003;

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

// Simple logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// /api/displays endpoint
app.get('/api/displays', (req, res) => {
  console.log('[GET] /api/displays endpoint hit');
  
  // Using res.json() ensures proper content-type and content-length handling
  res.json({
    success: true,
    data: [] // Empty array
  });
});

// Health check
app.get('/api/health', (req, res) => {
  // Using res.json() ensures proper content-type and content-length handling
  res.json({ status: 'ok' });
});

// Handle 404s
app.use((req, res) => {
  console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  
  // Set status and return JSON error response
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// /api/auth/login endpoint
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

// Current user endpoint
app.get('/api/auth/me', authMiddleware, (req, res) => {
  // The user object is attached by the auth middleware
  console.log('[GET] /api/auth/me endpoint hit');
  res.json({
    success: true,
    message: 'User data retrieved successfully',
    user: req.user
  });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  console.log('[POST] /api/auth/logout endpoint hit');
  // Clear the token cookie
  res.clearCookie('token');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Handle preflight OPTIONS requests for all routes
app.options('*', (req, res) => {
  console.log(`[OPTIONS] Preflight request for ${req.originalUrl}`);
  
  // Set CORS headers manually for preflight
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Respond with 204 No Content
  res.status(204).end();
});

// Start the server
app.listen(PORT, () => {
  console.log('\n\n===================================');
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`Test API: http://localhost:${PORT}/api/displays`);
  console.log('===================================\n\n');
}); 