/**
 * Diagnostic test server for /api/displays endpoint
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3004; // Using a different port to avoid conflicts

// Detailed error handling
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

// CORS configuration
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

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// /api/displays endpoint with detailed error handling
app.get('/api/displays', (req, res) => {
  console.log('[GET] /api/displays endpoint hit');
  
  try {
    // Create response data
    const responseData = {
      success: true,
      data: [] // Empty array
    };
    
    console.log('Response data:', JSON.stringify(responseData));
    
    // Using res.json() with additional debug
    res.setHeader('X-Debug-Info', 'Sent from test-displays.js');
    res.status(200).json(responseData);
    
    console.log('Response sent successfully');
  } catch (error) {
    console.error('Error in /api/displays:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Handle OPTIONS requests
app.options('*', (req, res) => {
  res.status(204).end();
});

// Catch-all for other routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Custom error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test server started on http://localhost:${PORT}`);
  console.log(`Try the displays endpoint: http://localhost:${PORT}/api/displays`);
}); 