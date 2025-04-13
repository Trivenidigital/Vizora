const mongoose = require('mongoose');
const Display = require('../model/display.model');

/**
 * Script to fix duplicate deviceId entries in the Display collection
 * 
 * This script:
 * 1. Creates a unique index on deviceId if it doesn't exist
 * 2. Identifies all duplicate deviceId entries
 * 3. For each set of duplicates, keeps the most recently updated one and renames others
 */
async function fixDuplicateDeviceIds() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vizora', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    
    console.log('✅ Connected to MongoDB');

    // First, create the unique index (will fail if duplicate entries exist)
    try {
      console.log('Creating unique index on deviceId field...');
      await Display.collection.createIndex({ deviceId: 1 }, { 
        unique: true, 
        background: true,
        name: 'deviceId_unique'
      });
      console.log('✅ Unique index created successfully');
    } catch (indexError) {
      if (indexError.code === 11000) {
        console.log('⚠️ Index already exists or failed due to duplicate keys. Proceeding with cleanup.');
      } else {
        console.error('❌ Error creating index:', indexError);
      }
    }

    // Find all duplicate deviceId entries
    console.log('Searching for duplicate deviceIds...');
    const duplicates = await Display.aggregate([
      { 
        $group: {
          _id: '$deviceId',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          docs: { $push: '$$ROOT' }
        }
      },
      { 
        $match: { 
          count: { $gt: 1 } 
        } 
      }
    ]);

    console.log(`Found ${duplicates.length} sets of duplicate deviceIds`);

    // Process each set of duplicates
    for (const dupSet of duplicates) {
      console.log(`\nProcessing duplicates for deviceId: ${dupSet._id} (${dupSet.count} duplicates)`);
      
      // Sort by last updated, most recent first
      const sortedDocs = dupSet.docs.sort((a, b) => {
        const aDate = a.updatedAt || a.createdAt || new Date(0);
        const bDate = b.updatedAt || b.createdAt || new Date(0);
        return bDate - aDate; // Descending order - newest first
      });
      
      // Keep the most recently updated document
      const keepDoc = sortedDocs[0];
      console.log(`  Keeping document: ${keepDoc._id} (${keepDoc.deviceId}, last updated: ${keepDoc.updatedAt || keepDoc.createdAt})`);
      
      // Rename the others
      for (let i = 1; i < sortedDocs.length; i++) {
        const dupDoc = sortedDocs[i];
        const oldDeviceId = dupDoc.deviceId;
        const newDeviceId = `${oldDeviceId}-duplicate-${i}-${Date.now()}`;
        
        console.log(`  Renaming document ${dupDoc._id} to ${newDeviceId}`);
        
        try {
          await Display.updateOne(
            { _id: dupDoc._id },
            { 
              $set: { 
                deviceId: newDeviceId,
                status: 'inactive', // Mark as inactive since it's a duplicate
                lastUpdated: new Date()
              },
              $unset: { 
                pairingCode: "" // Remove any pairing code
              }
            }
          );
          console.log(`  ✅ Successfully renamed document ${dupDoc._id}`);
        } catch (updateError) {
          console.error(`  ❌ Error updating document ${dupDoc._id}:`, updateError);
        }
      }
    }

    console.log('\n✅ Duplicate deviceId cleanup completed');
    
    // Verify the unique index can now be created
    try {
      console.log('\nVerifying unique index...');
      const indexInfo = await Display.collection.indexInformation();
      const hasUniqueIndex = Object.values(indexInfo).some(index => 
        index.some(field => field[0] === 'deviceId' && field[1] === 1)
      );
      
      if (hasUniqueIndex) {
        console.log('✅ Unique index exists on deviceId field');
      } else {
        console.log('Creating unique index on deviceId field...');
        await Display.collection.createIndex({ deviceId: 1 }, { 
          unique: true, 
          background: true,
          name: 'deviceId_unique'
        });
        console.log('✅ Unique index created successfully');
      }
    } catch (verifyError) {
      console.error('❌ Error verifying or creating index:', verifyError);
    }
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    // Close MongoDB connection
    console.log('\nClosing MongoDB connection...');
    await mongoose.disconnect();
    console.log('✅ MongoDB connection closed');
  }
}

// Run the script
fixDuplicateDeviceIds().then(() => {
  console.log('Script execution completed');
}); 