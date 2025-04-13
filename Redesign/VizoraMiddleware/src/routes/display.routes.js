/**
 * Display Routes
 * Routes for display management, monitoring, and control
 */

const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const displayController = require('../controllers/display.controller');

const router = express.Router();

// Public route for device registration
router.post('/register', displayController.registerDisplay);

// Direct pairing route (for VizoraTV compatibility)
router.post('/pair', async (req, res, next) => {
  try {
    const { deviceId, deviceInfo } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }
    
    // Generate a random 6-character pairing code
    const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    console.log(`Generated pairing code ${pairingCode} for device ${deviceId}`);
    
    // Store the pairing code (implementation depends on your storage mechanism)
    // You can use the displayService or directly with the database
    
    return res.status(200).json({
      success: true,
      deviceId,
      pairingCode,
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    next(error);
  }
});

// Routes requiring authentication
router.get('/', protect, displayController.getAllDisplays);
router.get('/:deviceId', protect, displayController.getDisplayByDeviceId);
router.put('/:deviceId', protect, displayController.updateDisplay);
router.delete('/:deviceId', protect, admin, displayController.deleteDisplay);

// Pairing routes
router.post('/:deviceId/pair', protect, displayController.generatePairingCode);
router.post('/:deviceId/confirm-pairing', protect, displayController.confirmPairing);

// Content routes
router.get('/:deviceId/content', displayController.getDisplayContent);

// Status and metrics routes
router.get('/:deviceId/status', protect, displayController.getDisplayStatus);
router.get('/:deviceId/metrics', protect, displayController.getDisplayMetrics);

// Control routes
router.post('/:deviceId/command', protect, displayController.sendDisplayCommand);
router.put('/:deviceId/settings', protect, displayController.updateDisplaySettings);
router.post('/:deviceId/maintenance', protect, displayController.toggleMaintenanceMode);

// Display routes
router.get('/', protect, (req, res) => {
  res.json({
    message: 'Display routes'
  });
});

module.exports = router; 