/**
 * @route   POST /api/displays/debug/register
 * @desc    Register a display directly for testing
 * @access  Public - for debugging only
 */
router.post('/debug/register', asyncHandler(async (req, res) => {
  try {
    console.log(`DEBUG: /api/displays/debug/register called with data:`, req.body);
    const { deviceId, qrCode, name, location, status } = req.body;
    
    if (!deviceId && !qrCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either deviceId or qrCode is required' 
      });
    }
    
    // Find or create display
    let display = await Display.findOne({
      $or: [
        { deviceId: deviceId || qrCode },
        { qrCode: qrCode || deviceId }
      ]
    });
    
    if (display) {
      console.log(`DEBUG: Found existing display, updating: ${display._id}`);
      
      // Update existing display
      if (name) display.name = name;
      if (location) display.location = location;
      if (status && ['active', 'inactive', 'maintenance'].includes(status)) {
        display.status = status;
      } else {
        display.status = 'active';
      }
      
      display.lastConnected = new Date();
      await display.save();
      
      return res.json({
        success: true,
        message: 'Display updated successfully',
        display
      });
    } else {
      // Create new display
      console.log(`DEBUG: Creating new display`);
      
      display = new Display({
        qrCode: qrCode || deviceId,
        deviceId: deviceId || qrCode,
        name: name || 'Debug Display',
        location: location || 'Debug Location',
        status: status || 'active',
        lastConnected: new Date()
      });
      
      await display.save();
      
      // Notify socket service
      try {
        const { socketService } = require('../services');
        
        // Add to connected clients manually
        socketService.getSocketInstance().emit('display:registered', {
          success: true,
          deviceId: deviceId || qrCode,
          displayId: display._id,
          displayName: display.name,
          qrCode: qrCode || deviceId,
          http: true
        });
      } catch (err) {
        console.error("Error notifying socket service:", err);
      }
      
      return res.status(201).json({
        success: true,
        message: 'Display created successfully',
        display
      });
    }
  } catch (error) {
    console.error(`DEBUG: Error in debug register endpoint:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error registering display',
      error: error.message
    });
  }
})); 