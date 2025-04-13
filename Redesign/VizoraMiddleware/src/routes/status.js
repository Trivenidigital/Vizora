const express = require('express');
const router = express.Router();

/**
 * @route GET /api/status
 * @desc Get server status
 * @access Public
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown'
  });
});

/**
 * @route GET /api/connectivity-test
 * @desc Test HTTP connectivity between services
 * @access Public
 */
router.get('/connectivity-test', (req, res) => {
  // Get the client's IP and other information
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const origin = req.headers.origin || 'unknown';
  
  // Generate a unique session ID for tracing this specific request
  const sessionId = Math.random().toString(36).substring(2, 15);
  
  console.log(`Connectivity test from ${origin} (${clientIp}) with User-Agent: ${userAgent}`);
  
  // Return detailed connection information
  res.json({
    success: true,
    message: 'HTTP connectivity test successful',
    connection: {
      clientIp,
      origin,
      userAgent,
      sessionId,
      protocol: req.protocol,
      secure: req.secure,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
    },
    headers: {
      received: req.headers,
      sent: res.getHeaders(),
    },
    server: {
      software: `Node.js ${process.version}`,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
    }
  });
});

module.exports = router; 