/**
 * Express application
 */

const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import Auth Routes using absolute path
const authRoutesPath = path.join(__dirname, 'src', 'routes', 'auth.routes.js');
console.log(`[DEBUG] Attempting to require auth routes from: ${authRoutesPath}`);
const authRoutes = require(authRoutesPath);
console.log('[DEBUG] Type of imported authRoutes:', typeof authRoutes, authRoutes instanceof Function ? '(Function)' : '(Object)');

// NOTE: Assuming content routes are defined below for now, or imported correctly if in separate file

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight OPTIONS requests explicitly
app.options('*', (req, res) => {
  console.log(`[OPTIONS] Preflight request for ${req.originalUrl}`);
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173'); 
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Configure multer ...
const storage = multer.diskStorage({ /* ... */ });
const fileFilter = (req, file, cb) => { /* ... */ };
const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Define contentRoutes router and its routes
const contentRoutes = express.Router();
const mockContent = [ /* ... mock data ... */ ];
const getContentTypeFromMimetype = (mimetype) => { /* ... */ };
const generateThumbnailUrl = (fileType, filePath) => { /* ... */ };
contentRoutes.get('/content', (req, res) => { /* ... handler ... */ });
contentRoutes.get('/content/:id', (req, res) => { /* ... handler ... */ });
contentRoutes.post('/content', upload.single('file'), (req, res) => { /* ... handler ... */ });
contentRoutes.put('/content/:id', (req, res) => { /* ... handler ... */ });
contentRoutes.patch('/content/:id', (req, res) => { /* ... handler ... */ });
contentRoutes.delete('/content/:id', (req, res) => { /* ... handler ... */ });
contentRoutes.post('/content/upload', upload.single('file'), (req, res) => { /* ... handler ... */ });

// --- Route Mounting Order --- 

// Mount Auth Routes FIRST
app.use('/api/auth', authRoutes); 

// Mount Content Routes SECOND
app.use('/api/content', contentRoutes); // Use specific path

// --- Other Direct Routes --- 
app.get('/api/displays', (req, res) => { /* ... handler ... */ });
app.get('/api/displays-old', (req, res) => { /* ... handler ... */ });
app.post('/api/displays/pair', (req, res) => { /* ... handler ... */ });
app.get('/api/test', (req, res) => { /* ... handler ... */ });
app.get('/api/health', (req, res) => { /* ... handler ... */ });

// Mock auth middleware definition
const authMiddleware = (req, res, next) => { /* ... handler ... */ };
app.get('/api/protected', authMiddleware, (req, res) => { /* ... handler ... */ });
app.get('/api/admin', authMiddleware, (req, res) => { /* ... handler ... */ });

// Fallback for /displays route
app.get('/displays', (req, res) => { res.redirect('/api/displays'); });

// Error Handling Middleware (Keep at the end)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({
    success: false,
    message: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Export app (server export is handled in server.js)
module.exports = { app }; 