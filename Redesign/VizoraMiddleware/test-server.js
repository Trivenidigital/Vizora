/**
 * Simple Test Express server for Vizora Middleware
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Configure Express
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

// Content endpoints
app.get('/api/content', (req, res) => {
  console.log('API Request: GET /api/content');
  
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

app.post('/api/content', (req, res) => {
  console.log('API Request: POST /api/content', req.body);
  
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

app.put('/api/content/:id', (req, res) => {
  console.log('API Request: PUT /api/content/:id', req.params.id, req.body);
  
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

app.delete('/api/content/:id', (req, res) => {
  console.log('API Request: DELETE /api/content/:id', req.params.id);
  
  res.status(200).json({
    success: true,
    message: 'Content deleted successfully'
  });
});

app.post('/api/content/upload', (req, res) => {
  console.log('API Request: POST /api/content/upload');
  
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

// Displays endpoint
app.get('/api/displays', (req, res) => {
  console.log('API Request: GET /api/displays');
  
  res.status(200).json({
    success: true,
    data: [] // Empty array
  });
});

// Start server
const PORT = 3010;
app.listen(PORT, () => {
  console.log(`\n===============================`);
  console.log(`Simple Test Server running on port ${PORT}`);
  console.log(`Content API: http://localhost:${PORT}/api/content`);
  console.log(`Displays API: http://localhost:${PORT}/api/displays`);
  console.log(`===============================\n`);
}); 