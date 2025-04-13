require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find users
    console.log('Finding users...');
    const users = await User.find().select('email firstName lastName');
    console.log(`Found ${users.length} users:`);
    
    users.forEach(user => {
      console.log(`- ${user.email} (${user.firstName} ${user.lastName})`);
    });
    
    // Test a login
    if (users.length > 0) {
      const testUser = users[0];
      console.log(`\nTesting login for ${testUser.email}...`);
      
      try {
        // Try with password "password"
        const user = await User.findOne({ email: testUser.email }).select('+password');
        if (!user) {
          console.log('User not found');
        } else {
          // Test common passwords
          const passwords = [
            "password", "123456", "admin", "vizora", 
            "test", "1234", "12345", "welcome", 
            "welcome123", "admin123", "password123",
            "Vizora123", "Vizora@123", "Srilu123",
            "srilu", "Srilu", "srilu123", "srila",
            "srila123", "Srila", "Srila123", "Ya123",
            "vizora2023", "vizora2024", "dev123",
            "qwerty", "letmein", "000000"
          ];
          
          for (const pwd of passwords) {
            const isMatch = await user.matchPassword(pwd);
            console.log(`Password "${pwd}" matches: ${isMatch}`);
          }
        }
      } catch (error) {
        console.error('Login test error:', error);
      }
    }
    
    console.log('\nDone');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

run(); 