/**
 * Simple Express server for content API
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Direct implementation of content endpoints
app.get('/api/content', (req, res) => {
  console.log('GET /api/content endpoint called');
  
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
  
  res.status(200).json({
    success: true,
    data: mockContent
  });
});

// Create content endpoint
app.post('/api/content', (req, res) => {
  console.log('POST /api/content endpoint called', req.body);
  
  const newContent = {
    id: Date.now().toString(),
    ...req.body,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  res.status(201).json({
    success: true,
    data: newContent,
    message: 'Content created successfully'
  });
});

// Update content endpoint
app.put('/api/content/:id', (req, res) => {
  console.log('PUT /api/content/:id endpoint called', req.params.id, req.body);
  
  const updatedContent = {
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  res.status(200).json({
    success: true,
    data: updatedContent,
    message: 'Content updated successfully'
  });
});

// Delete content endpoint
app.delete('/api/content/:id', (req, res) => {
  console.log('DELETE /api/content/:id endpoint called', req.params.id);
  
  res.status(200).json({
    success: true,
    message: 'Content deleted successfully'
  });
});

// Upload content endpoint
app.post('/api/content/upload', (req, res) => {
  console.log('POST /api/content/upload endpoint called');
  
  const fileId = `file-${Date.now()}`;
  const mockUrl = `https://storage.example.com/${fileId}`;
  
  res.status(200).json({
    success: true,
    data: {
      uploadId: fileId,
      url: mockUrl
    },
    message: 'File uploaded successfully'
  });
});

// Fallback for compatibility
app.get('/api/api/content', (req, res) => {
  console.log('GET /api/api/content endpoint called - redirecting');
  res.redirect('/api/content');
});

// Handle 404 errors
app.use((req, res) => {
  console.warn(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

// Start server on port 3005 to avoid conflicts with the main server
const PORT = 3005;
app.listen(PORT, () => {
  console.log(`Simple Content API Server running on http://localhost:${PORT}`);
  console.log(`Test content endpoint: http://localhost:${PORT}/api/content`);
}); 