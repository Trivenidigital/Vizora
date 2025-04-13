/**
 * Configuration module for the Vizora Middleware
 * Loads environment variables and provides configuration objects
 */
require('dotenv').config();

// Import test configuration
const testConfig = require('./test');

// Helper to get env variables with defaults
const getEnv = (key, defaultValue = undefined) => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return defaultValue;
  }
  return value;
};

// Use test configuration if in test environment
if (process.env.NODE_ENV === 'test') {
  module.exports = testConfig;
} else {
  // Server configuration
  const server = {
    port: parseInt(getEnv('PORT', 3003), 10),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    isProduction: getEnv('NODE_ENV', 'development') === 'production',
    apiUrl: getEnv('API_URL', 'http://localhost:3003/api'),
  };

  // Database configuration - using MongoDB Atlas as per architecture requirements
  const database = {
    uri: getEnv('MONGO_URI', 'mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora?retryWrites=true&w=majority&appName=Cluster0'),
    options: {
      // Mongoose 6+ handles connection options automatically
    },
  };

  // Logging configuration
  const logging = {
    level: getEnv('LOG_LEVEL', server.isProduction ? 'info' : 'debug'),
    format: server.isProduction ? 'json' : 'pretty',
    colorize: getEnv('LOG_COLORIZE', 'true') !== 'false',
    directory: getEnv('LOG_DIR', './logs'),
  };

  // CORS configuration
  const cors = {
    allowedOrigins: getEnv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:5175,http://localhost:3000').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };

  // Socket.IO configuration
  const socketio = {
    path: getEnv('SOCKET_PATH', '/socket.io'),
    cors: {
      origin: "*", // Allow all origins for socket connections
      methods: cors.methods,
      credentials: true,
    },
  };

  // Security configuration
  const security = {
    jwtSecret: getEnv('JWT_SECRET', server.isProduction ? undefined : 'dev_secret_key'),
    jwtExpiration: getEnv('JWT_EXPIRATION', '1d'),
    jwtRefreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  };

  // Export configuration
  module.exports = {
    server,
    database,
    logging,
    cors,
    socketio,
    security,
  };
} 