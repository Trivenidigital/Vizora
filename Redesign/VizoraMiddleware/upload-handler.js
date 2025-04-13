/**
 * Upload Handler for Content API
 * Provides endpoints for single and multiple file uploads
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename to prevent overwrites
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// File filter to validate uploads
const fileFilter = (req, file, cb) => {
  // Accept common file types
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Create Express app
const app = express();

// Configure CORS
app.use(cors({
  origin: '*', // Allow all origins during development
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make uploads directory accessible
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Single file upload handler
app.post('/api/content/upload', upload.single('file'), (req, res) => {
  try {
    console.log('POST /api/content/upload - Single file endpoint called');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get file info
    const file = req.file;
    const fileType = file.mimetype.split('/')[0];
    
    // Get metadata from request body
    const { title, description, category, tags, folder } = req.body;
    
    // Process tags if provided
    const processedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    
    // Create content object
    const content = {
      id: uuidv4(),
      title: title || file.originalname,
      description: description || '',
      type: fileType,
      url: `http://localhost:3006/uploads/${file.filename}`,
      thumbnail: fileType === 'image' ? `http://localhost:3006/uploads/${file.filename}` : null,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      size: file.size,
      category: category || '',
      tags: processedTags,
      folder: folder || null
    };

    // Return success response
    return res.status(200).json(content);
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during file upload'
    });
  }
});

// Multiple files upload handler
app.post('/api/content/upload-multiple', upload.array('files', 20), (req, res) => {
  try {
    console.log('POST /api/content/upload-multiple endpoint called');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Get metadata from request body
    const { titlePrefix, description, category, tags, folder } = req.body;
    
    // Process tags if provided
    const processedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    
    // Process each file
    const results = req.files.map((file, index) => {
      const fileType = file.mimetype.split('/')[0];
      
      // Create content object
      const content = {
        id: uuidv4(),
        title: titlePrefix ? `${titlePrefix} ${index + 1}` : file.originalname,
        description: description || '',
        type: fileType,
        url: `http://localhost:3006/uploads/${file.filename}`,
        thumbnail: fileType === 'image' ? `http://localhost:3006/uploads/${file.filename}` : null,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        size: file.size,
        category: category || '',
        tags: processedTags,
        folder: folder || null
      };

      return {
        success: true,
        filename: file.originalname,
        content
      };
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: `Uploaded ${req.files.length} files successfully`,
      results
    });
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during file upload'
    });
  }
});

// For backwards compatibility - allow POST to /api/content/upload with 'files' field for multiple files
app.post('/api/content/upload', upload.array('files', 20), (req, res) => {
  try {
    console.log('POST /api/content/upload - Multiple files endpoint called');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Get metadata from request body
    const { titlePrefix, description, category, tags, folder } = req.body;
    
    // Process tags if provided
    const processedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    
    // Process each file
    const results = req.files.map((file, index) => {
      const fileType = file.mimetype.split('/')[0];
      
      // Create content object
      const content = {
        id: uuidv4(),
        title: titlePrefix ? `${titlePrefix} ${index + 1}` : file.originalname,
        description: description || '',
        type: fileType,
        url: `http://localhost:3006/uploads/${file.filename}`,
        thumbnail: fileType === 'image' ? `http://localhost:3006/uploads/${file.filename}` : null,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        size: file.size,
        category: category || '',
        tags: processedTags,
        folder: folder || null
      };

      return {
        success: true,
        filename: file.originalname,
        content
      };
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: `Uploaded ${req.files.length} files successfully`,
      results
    });
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during file upload'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err instanceof multer.MulterError) {
    // A Multer error occurred during file upload
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File is too large. Maximum size is 100MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }
  
  // Generic error
  return res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  console.warn(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

// Start server
const PORT = 3006;
app.listen(PORT, () => {
  console.log(`Upload API Server running on http://localhost:${PORT}`);
  console.log(`Upload endpoint: http://localhost:${PORT}/api/content/upload`);
}); 