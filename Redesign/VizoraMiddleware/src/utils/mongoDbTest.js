/**
 * MongoDB Connection Test Script
 * 
 * This script tests the connection to MongoDB using the connection string from the environment
 * Run with: node src/utils/mongoDbTest.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Get connection string from environment
const MONGO_URI = process.env.MONGO_URI;

// Check if connection string exists
if (!MONGO_URI) {
  console.error('No MongoDB connection string found in environment variables');
  process.exit(1);
}

// Mask the password in the connection string for logging
const maskedUri = MONGO_URI.replace(/(mongodb\+srv:\/\/[^:]+:)([^@]+)@/, '$1******@');
console.log(`Attempting to connect to MongoDB: ${maskedUri}`);

// Configure mongoose
mongoose.set('strictQuery', false);

// Connect with timeouts
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000, // 10 seconds
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
})
.then(() => {
  console.log('✅ MongoDB connection successful');
  console.log('Database name:', mongoose.connection.db.databaseName);
  
  // Get server information
  return mongoose.connection.db.admin().serverInfo();
})
.then((info) => {
  console.log('MongoDB version:', info.version);
  
  // Check if we can access a collection
  return mongoose.connection.db.listCollections().toArray();
})
.then((collections) => {
  console.log('Available collections:');
  collections.forEach(collection => {
    console.log(` - ${collection.name}`);
  });
  
  console.log('\nConnection test complete. You can safely use this MongoDB connection.');
  mongoose.connection.close();
  process.exit(0);
})
.catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
  
  // Additional troubleshooting information
  if (err.name === 'MongoNetworkError') {
    console.error('\nThis appears to be a network error. Please check:');
    console.error('1. Your internet connection');
    console.error('2. Any VPN or firewall restrictions');
    console.error('3. If the MongoDB Atlas IP whitelist includes your current IP');
  }
  
  if (err.message.includes('Authentication failed')) {
    console.error('\nAuthentication failed. Please check:');
    console.error('1. Your database username and password in the connection string');
    console.error('2. If the database user has appropriate permissions');
  }
  
  mongoose.connection.close();
  process.exit(1);
}); 