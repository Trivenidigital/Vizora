const express = require('express');
const router = express.Router();
const cors = require('cors');
const controller = require('../src/controllers/device.controller');

// Specific CORS config for pairing endpoint
const pairingCors = {
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Requested-With']
};

// Debug middleware to log headers
router.use((req, res, next) => {
  console.log(`[DEVICE] ${req.method} ${req.originalUrl} from ${req.headers.origin}`);
  // Add CORS headers for preflight requests
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.status(204).end();
  }
  res.on('finish', () => {
    console.log('[DEVICE] Response headers:', res.getHeaders());
  });
  next();
});

// Use the same CORS config for all routes
router.use(cors(pairingCors));

// The actual POST route for pairing
router.post('/pairing-code', async (req, res) => {
  try {
    console.log('[PAIRING] POST /pairing-code hit');
    // For testing, return a placeholder response
    if (!controller.generatePairingCode) {
      console.log('[PAIRING] Using placeholder response');
      return res.status(200).json({ 
        pairingCode: 'TEST123',
        expiresIn: 300
      });
    }
    const result = await controller.generatePairingCode(req, res, (err) => {
      if (err) {
        console.error('[Pairing Code Error]', err);
        return res.status(500).json({ error: 'Failed to generate pairing code', message: err.message });
      }
    });
    // If the response hasn't been sent by the controller, send it here
    if (!res.headersSent) {
      return res.status(200).json(result);
    }
  } catch (err) {
    console.error('[Pairing Code Error]', err);
    return res.status(500).json({ error: 'Failed to generate pairing code', message: err.message });
  }
});

// Device registration endpoint with CORS
router.post("/register", controller.registerDevice);

// Token validation endpoint with CORS
router.post("/validate-token", controller.validateDeviceToken);

// Device status endpoint with CORS
router.get("/:deviceId/status", controller.getDeviceStatus);

module.exports = router; 