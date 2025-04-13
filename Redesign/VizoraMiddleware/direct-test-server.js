/**
 * Standalone Express server to test the /api/displays endpoint
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS
app.use(cors());

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Endpoints
app.get('/api/displays', (req, res) => {
  console.log('Serving /api/displays endpoint');
  
  // Return a success response with an empty array
  res.status(200).json({
    success: true,
    data: []
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Try opening: http://localhost:${PORT}/api/displays in your browser`);
}); 