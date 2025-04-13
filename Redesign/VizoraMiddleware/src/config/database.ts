import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB Configuration
export const mongoConfig = {
  // MongoDB Atlas URI (required)
  uri: process.env.MONGODB_URI || 'mongodb+srv://your-atlas-uri',
  
  // Database name
  dbName: process.env.MONGODB_DB_NAME || 'vizora',
  
  // Connection options
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    w: 'majority',
    // Connection timeout - 5 seconds
    connectTimeoutMS: 5000,
    // Socket timeout - 30 seconds
    socketTimeoutMS: 30000,
    // Max retry attempts
    maxPoolSize: 50,
    // Retry interval in milliseconds
    serverSelectionTimeoutMS: 5000,
  },
  
  // Health check configuration
  healthCheck: {
    enabled: true,
    interval: 30000, // Check every 30 seconds
    timeout: 5000,   // Timeout after 5 seconds
  }
};

// Validation
if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('your-atlas-uri')) {
  console.error('[DATABASE CONFIG] Error: MONGODB_URI environment variable is required');
  console.error('Please set MONGODB_URI in your .env file to your MongoDB Atlas connection string');
  process.exit(1);
} 