import { config } from 'dotenv';

// Load environment variables from .env file
config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3003', 10),
  HOST: process.env.HOST || 'localhost',
  
  // Redis Configuration
  REDIS: {
    HOST: process.env.REDIS_HOST || 'localhost',
    PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    PASSWORD: process.env.REDIS_PASSWORD,
    TLS_ENABLED: process.env.REDIS_TLS_ENABLED === 'true'
  },

  // CORS Configuration
  CORS: {
    ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
    CREDENTIALS: true
  },

  // WebSocket Configuration
  WS: {
    PING_TIMEOUT: parseInt(process.env.WS_PING_TIMEOUT || '45000', 10),
    PING_INTERVAL: parseInt(process.env.WS_PING_INTERVAL || '25000', 10)
  }
}; 