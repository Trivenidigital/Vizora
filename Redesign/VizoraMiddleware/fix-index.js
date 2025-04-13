/**
 * Script to fix MongoDB indexes
 * Run with: node fix-index.js
 */

const mongoose = require('mongoose');
const config = require('./config');

async function fixIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB successfully');
    
    // Get database instance
    const db = mongoose.connection.db;
    
    // Get current indexes
    console.log('Fetching current indexes...');
    const indexes = await db.collection('displays').indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Check if displayId_1 index exists
    const hasDisplayIdIndex = indexes.some(index => index.name === 'displayId_1');
    
    if (hasDisplayIdIndex) {
      console.log('Found displayId_1 index. Dropping it...');
      await db.collection('displays').dropIndex('displayId_1');
      console.log('Successfully dropped displayId_1 index');
    } else {
      console.log('displayId_1 index not found');
    }
    
    // Verify indexes after change
    const updatedIndexes = await db.collection('displays').indexes();
    console.log('Updated indexes:', JSON.stringify(updatedIndexes, null, 2));
    
    console.log('Index fix completed successfully');
  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
}

// Run the fix
fixIndexes(); 