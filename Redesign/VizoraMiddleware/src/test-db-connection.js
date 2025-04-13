/**
 * MongoDB Connection Test Script
 * Tests connection to MongoDB Atlas with resilient options
 */

require('dotenv').config();
const mongoose = require('mongoose');
const db = require('./config/db');

console.log('MongoDB Connection Test Script');
console.log('==============================');
console.log('Node.js version:', process.version);
console.log('Mongoose version:', mongoose.version);
console.log('------------------------------');

async function testConnection() {
  console.log('Testing MongoDB connection...');
  
  try {
    // Test connection with our enhanced connection handler
    console.log('Connecting using enhanced connection manager...');
    const conn = await db.connectDB();
    
    console.log('\n✅ Connection successful!');
    console.log('Connection details:');
    console.log('- Host:', conn.connection.host);
    console.log('- Database:', conn.connection.name);
    console.log('- Connection state:', db.getConnectionState());
    console.log('- Ready state:', conn.connection.readyState);
    
    // Test a simple query to verify full functionality
    console.log('\nTesting query functionality...');
    try {
      // Just check if we can access any collection
      const collections = await conn.connection.db.listCollections().toArray();
      console.log(`✅ Query successful! Found ${collections.length} collections`);
      console.log('Collection names:');
      collections.forEach((collection, i) => {
        console.log(`  ${i+1}. ${collection.name}`);
      });
    } catch (queryError) {
      console.error('❌ Query test failed:', queryError.message);
    }
    
    // Close connection
    console.log('\nClosing connection...');
    await mongoose.connection.close();
    console.log('Connection closed');
    
    return true;
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error details:');
    console.error('- Name:', error.name);
    console.error('- Message:', error.message);
    console.error('- Stack:', error.stack);
    
    // Try with minimal options as a fallback
    console.log('\nAttempting connection with minimal options...');
    try {
      const minimalOptions = {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000
      };
      
      console.log('Minimal options:', JSON.stringify(minimalOptions, null, 2));
      const conn = await mongoose.connect(process.env.MONGO_URI, minimalOptions);
      
      console.log('\n✅ Connection with minimal options successful!');
      console.log('Connection details:');
      console.log('- Host:', conn.connection.host);
      console.log('- Database:', conn.connection.name);
      console.log('- Ready state:', conn.connection.readyState);
      
      // Close connection
      console.log('\nClosing connection...');
      await mongoose.connection.close();
      console.log('Connection closed');
      
      return true;
    } catch (fallbackError) {
      console.error('\n❌ Fallback connection also failed!');
      console.error('Fallback error details:');
      console.error('- Name:', fallbackError.name);
      console.error('- Message:', fallbackError.message);
      
      return false;
    }
  }
}

// Run the test
testConnection()
  .then(success => {
    console.log('\n==============================');
    if (success) {
      console.log('✅ MongoDB connection test PASSED');
    } else {
      console.log('❌ MongoDB connection test FAILED');
    }
    console.log('==============================');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
    process.exit(1);
  }); 