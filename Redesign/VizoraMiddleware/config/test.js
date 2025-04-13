/**
 * Test Configuration
 * Specific configuration for test environment
 */

module.exports = {
  server: {
    port: 5000,
    nodeEnv: 'test',
    isProduction: false,
    apiUrl: 'http://localhost:5000/api',
  },
  
  database: {
    // Will be overridden by mongodb-memory-server
    uri: 'mongodb://localhost:27017/vizora_test',
    options: {
      maxPoolSize: 10
    },
  },
  
  logging: {
    level: 'error', // Minimal logging for tests
    format: 'pretty',
    colorize: true,
    directory: './logs',
  },
  
  cors: {
    allowedOrigins: ['http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  
  socketio: {
    path: '/socket.io',
    cors: {
      origin: "*",
      methods: ['GET', 'POST'],
      credentials: true,
    },
  },
  
  security: {
    jwtSecret: 'test_secret_key',
    jwtExpiration: '15m',
    jwtRefreshExpiresIn: '1h',
  },
}; 