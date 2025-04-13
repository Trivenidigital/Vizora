/**
 * Authentication API Server
 * 
 * A focused server that properly handles authentication endpoints with
 * correct CORS configuration to fix login issues.
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3001;

// Enhanced CORS configuration - critical for auth to work properly
const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (e.g., mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  
  // Log headers for debugging CORS issues
  if (req.method === 'OPTIONS' || req.url.includes('/auth/')) {
    console.log('Request headers:', req.headers);
  }
  
  next();
});

// Explicitly handle preflight requests for all routes
app.options('*', (req, res) => {
  console.log(`[${new Date().toISOString()}] Preflight request for ${req.originalUrl}`);
  res.status(204).end();
});

// Helper function to create route handlers for both prefixed and non-prefixed paths
function createAuthRoutes(router) {
  // Login endpoint - support both /api/auth/login and /auth/login
  router.post(['/api/auth/login', '/auth/login'], (req, res) => {
    console.log(`Login attempt for email: ${req.body.email}`);
    
    try {
      // Validate email and password
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email and password are required'
        });
      }
      
      // For testing purposes, accept any credentials
      // In a real application, you would validate against a database
      const user = {
        id: '1',
        email: email,
        firstName: 'Test',
        lastName: 'User',
        role: 'admin'
      };
      
      // Mock JWT token - in a real app, would be signed with a secret
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkB2aXpvcmEuYWkiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2NzY5MTcyMDAsImV4cCI6MTY3NzAwMzYwMH0.vqHlp5rCmEj9K8RM2UgM5GZ60nfQZA8OMY1GyVCmQFU';
      
      // Set token as a cookie with proper settings for cross-origin
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: 'lax' // or 'none' if using HTTPS
      });
      
      console.log('Login successful for:', email);
      console.log('Response headers:', res.getHeaders());
      
      // Return success response
      res.json({
        success: true,
        message: 'Login successful',
        user,
        token
      });
    } catch (error) {
      console.error('[ERROR] Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login',
        error: error.message
      });
    }
  });

  // Get current user endpoint - support both /api/auth/me and /auth/me
  router.get(['/api/auth/me', '/auth/me'], (req, res) => {
    console.log('Get current user');
    
    try {
      // In a real app, you would verify the token
      // For testing, we'll just return a mock user
      const user = {
        id: '1',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin'
      };
      
      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('[ERROR] Get current user error:', error);
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
  });

  // Logout endpoint - support both /api/auth/logout and /auth/logout
  router.post(['/api/auth/logout', '/auth/logout'], (req, res) => {
    console.log('Logout attempt');
    
    // Clear the token cookie
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
  
  // Register user endpoint - support both versions
  router.post(['/api/auth/register', '/auth/register'], (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }
      
      // Mock registration
      const user = {
        id: '2',
        email,
        firstName,
        lastName,
        role: 'user'
      };
      
      const token = 'mock-registration-token-' + Date.now();
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });
      
      res.json({
        success: true,
        message: 'Registration successful',
        user,
        token
      });
    } catch (error) {
      console.error('[ERROR] Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration'
      });
    }
  });
  
  // Update profile endpoint - support both versions
  router.put(['/api/auth/profile', '/auth/profile'], (req, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      
      // In a real app, you would update the user in the database
      const updatedUser = {
        id: '1',
        email: email || 'user@example.com',
        firstName: firstName || 'Test',
        lastName: lastName || 'User',
        role: 'admin'
      };
      
      res.json({
        success: true,
        user: updatedUser
      });
    } catch (error) {
      console.error('[ERROR] Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during profile update'
      });
    }
  });
}

// Apply auth routes
createAuthRoutes(app);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test page for auth
app.get('/test-auth', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Auth API Test</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow: auto; }
          button { padding: 8px 16px; background: #4CAF50; color: white; border: none; cursor: pointer; margin-right: 10px; margin-bottom: 10px; }
          input { padding: 8px; margin-bottom: 10px; width: 100%; }
          .success { color: green; }
          .error { color: red; }
          .form-group { margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <h1>Auth API Test</h1>
        
        <div class="form-group">
          <h2>Login Test</h2>
          <input type="email" id="email" placeholder="Email" value="user@example.com" />
          <input type="password" id="password" placeholder="Password" value="password" />
          <button onclick="testLogin()">Test Login</button>
        </div>
        
        <div class="form-group">
          <h2>Other Actions</h2>
          <button onclick="testGetMe()">Test Get Current User</button>
          <button onclick="testLogout()">Test Logout</button>
        </div>
        
        <h2>Response:</h2>
        <pre id="response">Enter credentials and click a button to test the API...</pre>
        
        <script>
          async function testLogin() {
            document.getElementById('response').innerHTML = 'Loading...';
            try {
              const email = document.getElementById('email').value;
              const password = document.getElementById('password').value;
              
              const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
              });
              
              const data = await response.json();
              document.getElementById('response').innerHTML = 
                '<span class="' + (data.success ? 'success' : 'error') + '">' + 
                (data.success ? 'SUCCESS' : 'ERROR') + '</span>\\n' + 
                'Status: ' + response.status + '\\n\\n' +
                JSON.stringify(data, null, 2);
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
          
          async function testGetMe() {
            document.getElementById('response').innerHTML = 'Loading...';
            try {
              const response = await fetch('/auth/me', {
                method: 'GET',
                credentials: 'include'
              });
              
              const data = await response.json();
              document.getElementById('response').innerHTML = 
                '<span class="' + (data.success ? 'success' : 'error') + '">' + 
                (data.success ? 'SUCCESS' : 'ERROR') + '</span>\\n' + 
                'Status: ' + response.status + '\\n\\n' +
                JSON.stringify(data, null, 2);
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
          
          async function testLogout() {
            document.getElementById('response').innerHTML = 'Loading...';
            try {
              const response = await fetch('/auth/logout', {
                method: 'POST',
                credentials: 'include'
              });
              
              const data = await response.json();
              document.getElementById('response').innerHTML = 
                '<span class="' + (data.success ? 'success' : 'error') + '">' + 
                (data.success ? 'SUCCESS' : 'ERROR') + '</span>\\n' + 
                'Status: ' + response.status + '\\n\\n' +
                JSON.stringify(data, null, 2);
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
        </script>
      </body>
    </html>
  `);
});

// 404 handler
app.use((req, res) => {
  console.log(`[${new Date().toISOString()}] 404 - ${req.method} ${req.originalUrl} not found`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
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
  console.log(`Auth API server running on http://localhost:${PORT}`);
  console.log(`Test endpoints:`);
  console.log(`- http://localhost:${PORT}/auth/login   or   /api/auth/login (POST)`);
  console.log(`- http://localhost:${PORT}/auth/me      or   /api/auth/me (GET)`);
  console.log(`- http://localhost:${PORT}/auth/logout  or   /api/auth/logout (POST)`);
  console.log(`- http://localhost:${PORT}/test-auth (HTML test page)`);
}); 