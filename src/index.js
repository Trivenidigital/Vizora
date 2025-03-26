// Health endpoint with more CORS and connection information
app.get('/health', (req, res) => {
  // Log CORS debug info if DEBUG_CORS is enabled
  if (process.env.DEBUG_CORS === 'true') {
    logger.info('Health Request Headers:', req.headers);
    logger.info('Health Origin:', req.headers.origin);
  }
  
  res.json({ 
    status: 'ok',
    timestamp: Date.now(),
    redis: redisClient && redisClient.isReady ? 'connected' : 'disconnected',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    socketio: io ? 'initialized' : 'not initialized',
    environment: process.env.NODE_ENV,
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      debug: process.env.DEBUG_CORS === 'true'
    }
  });
});

// Add a specific CORS debug endpoint
app.get('/debug-cors', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  res.json({ 
    message: 'CORS debug successful',
    origin: req.headers.origin || 'unknown',
    timestamp: Date.now(),
    headers: req.headers
  });
});

// Direct auth test endpoint with explicit CORS headers
app.post('/api/auth/test-signup', (req, res) => {
  // Set explicit CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  logger.info('Test signup request received', { body: req.body });
  
  // Return a success response
  res.status(201).json({
    message: 'Test signup successful',
    user: {
      name: req.body.name || 'Test User',
      email: req.body.email || 'test@example.com',
      company: req.body.company || 'Test Company'
    },
    token: 'test-jwt-token-' + Date.now()
  });
});

// Handle OPTIONS for the test endpoint explicitly
app.options('/api/auth/test-signup', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).send();
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
}); 