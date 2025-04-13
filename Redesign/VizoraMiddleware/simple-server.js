/**
 * Simple Express API Server for Content Management
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();

// Middleware
app.use(cors({ 
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Content API Routes
app.get('/api/content', (req, res) => {
  console.log('[API] Content endpoint called');
  
  // Return mock content data
  const mockContent = [
    {
      id: '1',
      title: 'Product Banner',
      type: 'image',
      url: 'https://picsum.photos/id/1/800/600',
      thumbnail: 'https://picsum.photos/id/1/800/600',
      status: 'active',
      createdAt: '2023-05-01T10:30:00Z',
      updatedAt: '2023-05-01T10:30:00Z',
      size: 1024 * 1024 * 2.5, // 2.5 MB
    },
    {
      id: '2',
      title: 'Company Introduction',
      type: 'video',
      url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbnail: 'https://picsum.photos/id/2/800/600',
      status: 'active',
      createdAt: '2023-05-10T14:45:00Z',
      updatedAt: '2023-05-15T09:20:00Z',
      size: 1024 * 1024 * 15, // 15 MB
    },
    {
      id: '3',
      title: 'Summer Sale Promo',
      type: 'image',
      url: 'https://picsum.photos/id/3/800/600',
      thumbnail: 'https://picsum.photos/id/3/800/600',
      status: 'active',
      createdAt: '2023-06-05T11:15:00Z',
      updatedAt: '2023-06-05T11:15:00Z',
      size: 1024 * 1024 * 1.2, // 1.2 MB
    }
  ];
  
  res.json(mockContent);
});

// Optional fallback for double-prefixed URLs that might come from API client
app.get('/api/api/content', (req, res) => {
  console.log('[API] Fallback content endpoint called');
  res.redirect('/api/content');
});

// Content CRUD operations
app.post('/api/content', (req, res) => {
  console.log('[API] Create content called', req.body);
  res.json({ id: Date.now().toString(), ...req.body, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
});

app.put('/api/content/:id', (req, res) => {
  console.log('[API] Update content called', req.params.id, req.body);
  res.json({ id: req.params.id, ...req.body, updatedAt: new Date().toISOString() });
});

app.delete('/api/content/:id', (req, res) => {
  console.log('[API] Delete content called', req.params.id);
  res.json({ success: true });
});

// Add auth routes
app.post('/auth/login', (req, res) => {
  console.log('[API] Auth login endpoint called', req.body);
  
  const { email, password } = req.body;
  
  // Simple validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  
  // Mock successful login
  // In a real app, you would verify credentials against a database
  const user = {
    id: '1',
    email: email,
    firstName: 'Test',
    lastName: 'User',
    role: 'admin'
  };
  
  // Set a cookie for the session
  res.cookie('authToken', 'mock-jwt-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  // Return success response with user data and token
  res.status(200).json({
    success: true,
    message: 'Login successful',
    user,
    token: 'mock-jwt-token'
  });
});

// Start the server
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`Simple API server running on http://localhost:${PORT}`);
  console.log(`Test content endpoint: http://localhost:${PORT}/api/content`);
}); 