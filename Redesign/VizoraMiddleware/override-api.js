/**
 * Override API server
 * This is a simplified server that implements just the /api/displays endpoint needed by the web app
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3003;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// The /api/displays endpoint
app.get('/api/displays', (req, res) => {
  console.log('[ENDPOINT] /api/displays called');
  
  // Return the format expected by the frontend
  res.status(200).json({
    success: true,
    data: [] // Empty array
  });
});

// The /api/displays/pair endpoint for pairing displays
app.post('/api/displays/pair', (req, res) => {
  console.log('[ENDPOINT] /api/displays/pair called');
  console.log('Request body:', req.body);
  
  const { pairingCode, name, location } = req.body;
  
  if (!pairingCode) {
    return res.status(400).json({
      success: false,
      message: 'Pairing code is required'
    });
  }
  
  // Create a mock display with the provided information
  const display = {
    id: `disp-${Math.random().toString(36).substring(2, 9)}`,
    name: name || `Display-${pairingCode}`,
    location: location || 'Unknown',
    status: 'online',
    qrCode: pairingCode,
    lastConnected: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  console.log(`Display paired with name: ${display.name}, location: ${display.location}`);
  
  // Return success with the new display object
  res.status(200).json({
    success: true,
    message: 'Display paired successfully',
    display
  });
});

// Also support the /displays endpoint (without /api prefix)
app.get('/displays', (req, res) => {
  console.log('[ENDPOINT] /displays called');
  
  // Return the same format
  res.status(200).json({
    success: true,
    data: [] // Empty array
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n\n=== OVERRIDE API SERVER ===`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Test the API: http://localhost:${PORT}/api/displays`);
  console.log(`===========================\n\n`);
}); 