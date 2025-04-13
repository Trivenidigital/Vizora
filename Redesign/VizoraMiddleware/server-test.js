require('dotenv').config();
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cors = require('cors');

// Get the JWT secret from environment or use a default for testing
const JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecret123';

// Middleware
app.use(express.json());
app.use(cors());

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running', timestamp: new Date() });
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  try {
    // Get token from header
    const bearerHeader = req.headers.authorization;
    
    if (!bearerHeader) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const token = bearerHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Invalid token format' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Protected route
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({ 
    success: true, 
    message: 'You have access to the protected route',
    user: req.user
  });
});

// Login with test user
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Validate email and password
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  
  // Check credentials - this is just for testing!
  if (email === 'test@example.com' && password === 'password123') {
    // Create token
    const token = jwt.sign(
      { id: '123456789', email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return res.json({
      success: true,
      token,
      user: {
        id: '123456789',
        email,
        role: 'admin'
      }
    });
  }
  
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// Start server
const PORT = 3005;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`API health: http://localhost:${PORT}/api/health`);
  console.log(`Login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`Protected route: GET http://localhost:${PORT}/api/protected`);
}); 