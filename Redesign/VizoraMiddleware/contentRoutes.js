/**
 * Content API routes
 */

const express = require('express');
const router = express.Router();

// Mock content data
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

// GET /content - Get all content
router.get('/content', (req, res) => {
  console.log('[CONTENT API] GET /content');
  
  // Return the content list
  res.status(200).json({
    success: true,
    data: mockContent
  });
});

// GET /content/:id - Get content by id
router.get('/content/:id', (req, res) => {
  console.log(`[CONTENT API] GET /content/${req.params.id}`);
  
  const content = mockContent.find(item => item.id === req.params.id);
  
  if (!content) {
    return res.status(404).json({
      success: false,
      message: `Content with ID ${req.params.id} not found`
    });
  }
  
  res.status(200).json({
    success: true,
    data: content
  });
});

// POST /content - Create content
router.post('/content', (req, res) => {
  console.log('[CONTENT API] POST /content', req.body);
  
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

// PUT /content/:id - Update content
router.put('/content/:id', (req, res) => {
  console.log(`[CONTENT API] PUT /content/${req.params.id}`, req.body);
  
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

// DELETE /content/:id - Delete content
router.delete('/content/:id', (req, res) => {
  console.log(`[CONTENT API] DELETE /content/${req.params.id}`);
  
  res.status(200).json({
    success: true,
    message: 'Content deleted successfully'
  });
});

// POST /content/upload - Upload content file
router.post('/content/upload', (req, res) => {
  console.log('[CONTENT API] POST /content/upload');
  
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

module.exports = router; 