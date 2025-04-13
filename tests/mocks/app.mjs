/**
 * Mock Express app for tests
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';

// Create Express app
const app = express();

// Apply middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(compression());

// Only log in test mode if explicitly enabled
if (process.env.TEST_LOGGING) {
  app.use(morgan('dev'));
}

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: 'test' });
});

// Mock API endpoints for testing
// Display endpoints
app.post('/api/displays/register', (req, res) => {
  const { deviceId, name } = req.body;
  if (!deviceId || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  res.status(200).json({ id: 'mock-display-id', deviceId, name });
});

app.get('/api/displays', (req, res) => {
  res.status(200).json([
    { id: 'display-1', name: 'Lobby Display', status: 'online' },
    { id: 'display-2', name: 'Meeting Room Display', status: 'offline' }
  ]);
});

// Content endpoints
app.get('/api/content', (req, res) => {
  res.status(200).json([
    { id: 'content-1', name: 'Welcome Slide', type: 'image', url: 'https://example.com/image1.jpg' },
    { id: 'content-2', name: 'Company Video', type: 'video', url: 'https://example.com/video1.mp4' }
  ]);
});

app.post('/api/content', (req, res) => {
  const { name, type, url } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  res.status(201).json({ id: 'new-content-id', name, type, url, createdAt: new Date().toISOString() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Default error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

export { app }; 