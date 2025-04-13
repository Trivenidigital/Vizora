/**
 * Main server for VizoraMiddleware
 * This implements all the required endpoints with standardized responses
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = 3003;

// CORS debug logging middleware
app.use((req, res, next) => {
  console.log(`[CORS] ${req.method} ${req.originalUrl} from ${req.headers.origin}`);
  next();
});

// Enhanced response header logger
app.use((req, res, next) => {
  // Capture original methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // Log before any response is sent
  const logHeaders = () => {
    console.log(`[RESPONSE HEADERS] ${req.method} ${req.originalUrl}`, {
      origin: req.headers.origin,
      headers: res.getHeaders(),
      status: res.statusCode
    });
  };

  // Override send
  res.send = function (body) {
    logHeaders();
    return originalSend.call(this, body);
  };

  // Override json
  res.json = function (body) {
    logHeaders();
    return originalJson.call(this, body);
  };

  // Override end
  res.end = function (chunk, encoding) {
    logHeaders();
    return originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Body parser and cookie middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount device routes
const deviceRoutes = require('./routes/device.routes');
app.use("/api/devices", deviceRoutes);

// Add debug logging for route mounting
console.log('[ROUTES] Mounted device routes at /api/devices');

// Health check with CORS
app.get("/api/health", cors(), (req, res) => {
  console.log('[HEALTH] Health check request received');
  res.status(200).json({ status: "ok" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Global 404 fallback
app.use((req, res) => {
  console.warn("⚠️ Unhandled API request:", req.method, req.originalUrl);
  console.log("📦 Body:", req.body);
  console.log("🔑 Headers:", req.headers);
  res.status(404).json({ 
    success: false,
    error: "Unhandled route",
    path: req.originalUrl,
    method: req.method
  });
});

// Log memory usage every 30s
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`[MEMORY] Heap Used: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
}, 30000);

// Start server
app.listen(PORT, () => {
  console.log('\n\n===================================');
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`Test API: http://localhost:${PORT}/api/health`);
  console.log('===================================\n\n');
});

module.exports = { app };
