/**
 * Unified Server for Vizora Middleware
 * Combines API, Auth, and Content services in a single server with proper CORS
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Sample data
const folders = [
  { id: '1', name: 'Marketing', description: 'Marketing materials', path: '/marketing', isRoot: true, itemCount: 5, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Sales', description: 'Sales presentations', path: '/sales', isRoot: true, itemCount: 3, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Events', description: 'Event assets', path: '/marketing/events', isRoot: false, itemCount: 2, createdAt: new Date(), updatedAt: new Date() }
];

const contentItems = [
  { id: '1', name: 'Q1 Presentation', folderId: '1', type: 'presentation', url: 'https://example.com/presentation1.pptx', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Brand Guidelines', folderId: '1', type: 'document', url: 'https://example.com/guidelines.pdf', createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Product Demo', folderId: '2', type: 'video', url: 'https://example.com/demo.mp4', createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Conference Banner', folderId: '3', type: 'image', url: 'https://example.com/banner.jpg', createdAt: new Date(), updatedAt: new Date() }
];

// Demo user data
const demoUser = {
  id: 'user-123',
  email: 'demo@vizora.ai',
  firstName: 'Demo',
  lastName: 'User',
  role: 'admin'
};

// CORS configuration - MUST be applied before routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger with details
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('  Body:', JSON.stringify(req.body));
  }
  next();
});

// Explicitly handle preflight requests
app.options('*', (req, res) => {
  console.log(`[${new Date().toISOString()}] Preflight request for ${req.originalUrl}`);
  res.status(204).end();
});

// Generate a mock token
function generateToken() {
  return 'mock-token-' + Math.random().toString(36).substring(2, 15);
}

// Serve static test pages
app.get('/', (req, res) => {
  res.redirect('/test-api.html');
});

app.get('/test-api.html', (req, res) => {
  fs.readFile(path.join(__dirname, 'auth-test.html'), 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Could not load test page');
      return;
    }
    res.type('html').send(data);
  });
});

// Helper function to create identical route handlers for different paths
function createAuthRoutes(router) {
  // Login endpoint - support both /api/auth/login and /auth/login
  router.post(['/api/auth/login', '/auth/login'], (req, res) => {
    const { email, password } = req.body;
    
    console.log(`Login attempt for email: ${email}`);
    
    // Simple validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Accept any credentials for demo
    const token = generateToken();
    
    // Set cookie for authentication
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      user: demoUser,
      token: token
    });
  });
  
  // Register endpoint - support both /api/auth/register and /auth/register
  router.post(['/api/auth/register', '/auth/register'], (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    
    console.log(`Registration attempt for email: ${email}`);
    
    // Simple validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Create demo user
    const token = generateToken();
    const newUser = {
      ...demoUser,
      email,
      firstName,
      lastName
    };
    
    // Set cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Return success
    res.json({
      success: true,
      message: 'Registration successful',
      user: newUser,
      token: token
    });
  });
  
  // Logout endpoint - support both /api/auth/logout and /auth/logout
  router.post(['/api/auth/logout', '/auth/logout'], (req, res) => {
    console.log('Logout attempt');
    
    // Clear cookie
    res.clearCookie('authToken');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
  
  // Get current user endpoint - support both /api/auth/me and /auth/me
  router.get(['/api/auth/me', '/auth/me'], (req, res) => {
    // In a real app, this would verify the token
    // For demo, we'll just return the demo user
    console.log('Get current user');
    
    res.json({
      success: true,
      user: demoUser
    });
  });
  
  // Update profile endpoint - support both /api/auth/profile and /auth/profile
  router.put(['/api/auth/profile', '/auth/profile'], (req, res) => {
    console.log('Update profile attempt');
    
    res.json({
      success: true,
      user: {
        ...demoUser,
        ...req.body
      }
    });
  });
}

// Apply auth routes
createAuthRoutes(app);

// Folder API Routes
// Support various URL patterns for the same endpoint
['/api/folders', '/folders', '/api/api/folders'].forEach(route => {
  app.get(route, (req, res) => {
    console.log(`GET request for folders at ${route}`);
    res.json({
      success: true,
      data: folders
    });
  });
});

// Support nested folders
app.get('/api/folders/:id/folders', (req, res) => {
  const { id } = req.params;
  const nestedFolders = folders.filter(folder => folder.path.includes(`/${id}/`) || folder.path.includes(`/${id}`));
  
  res.json({
    success: true,
    data: nestedFolders
  });
});

// Get specific folder
app.get('/api/folders/:id', (req, res) => {
  const { id } = req.params;
  const folder = folders.find(folder => folder.id === id);
  
  if (!folder) {
    return res.status(404).json({
      success: false,
      message: `Folder with ID ${id} not found`
    });
  }
  
  res.json({
    success: true,
    data: folder
  });
});

// Content API Routes
// Get all content
app.get('/api/content', (req, res) => {
  console.log('GET request for all content');
  res.json({
    success: true,
    data: contentItems
  });
});

// Get content by folder ID
app.get('/api/folders/:id/content', (req, res) => {
  const { id } = req.params;
  const folderContent = contentItems.filter(item => item.folderId === id);
  
  res.json({
    success: true,
    data: folderContent
  });
});

// Get specific content by ID
app.get('/api/content/:id', (req, res) => {
  const { id } = req.params;
  const content = contentItems.find(item => item.id === id);
  
  if (!content) {
    return res.status(404).json({
      success: false,
      message: `Content with ID ${id} not found`
    });
  }
  
  res.json({
    success: true,
    data: content
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler - MUST be at the end
app.use((req, res) => {
  console.log(`[${new Date().toISOString()}] 404 - ${req.method} ${req.originalUrl} not found`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Unified Vizora server running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('\nAuth APIs:');
  console.log('  POST /api/auth/login (or /auth/login)');
  console.log('  POST /api/auth/register (or /auth/register)');
  console.log('  POST /api/auth/logout (or /auth/logout)');
  console.log('  GET  /api/auth/me (or /auth/me)');
  console.log('  PUT  /api/auth/profile (or /auth/profile)');
  
  console.log('\nFolder APIs:');
  console.log('  GET  /api/folders or /folders');
  console.log('  GET  /api/folders/:id');
  console.log('  GET  /api/folders/:id/folders');
  
  console.log('\nContent APIs:');
  console.log('  GET  /api/content');
  console.log('  GET  /api/content/:id');
  console.log('  GET  /api/folders/:id/content');
  
  console.log('\nOther:');
  console.log('  GET  /api/health');
  console.log('  GET  /          (Test Page)');
  console.log('  GET  /test-api.html');
}); 