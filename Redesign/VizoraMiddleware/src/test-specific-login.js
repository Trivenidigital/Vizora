/**
 * Test Specific Login
 * Used to test login functionality with specific credentials
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Config
const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// MongoDB Atlas connection
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora?retryWrites=true&w=majority&appName=Cluster0';

async function connectDB() {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected...');
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
}

async function testUserLogin() {
  try {
    console.log('======= Testing Specific User Login =======');
    
    // Test login with specific user
    const userEmail = 'advi@gmail.com';
    const userPassword = 'Srini78$$';
    
    console.log(`Looking for user with email: ${userEmail}`);
    
    // Find user in database
    const user = await User.findOne({ email: userEmail }).select('+password');
    
    if (!user) {
      console.log(`User with email ${userEmail} not found in database`);
      console.log('\nListing all users in database:');
      
      const allUsers = await User.find({}, 'email firstName lastName');
      console.log(allUsers);
      
      return;
    }
    
    console.log('User found in database:');
    console.log({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0,
      passwordType: typeof user.password
    });
    
    // Test password comparison
    console.log(`\nTesting password "${userPassword}" for user ${userEmail}`);
    
    const isMatch = await user.comparePassword(userPassword);
    console.log('Password match result:', isMatch);
    
    if (isMatch) {
      console.log('✅ Login should succeed with these credentials');
    } else {
      console.log('❌ Login will fail with these credentials');
      
      // Try to check the stored hash
      console.log('\nDetails for debugging:');
      console.log('Password in DB:', user.password);
      console.log('Password provided:', userPassword);
      
      // Check if another password works (testing bcrypt)
      const testPassword = 'Srini789$';
      const testMatch = await user.comparePassword(testPassword);
      console.log(`Test with alternate password ("${testPassword}"): ${testMatch}`);
    }
    
  } catch (err) {
    console.error('Error testing login:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nTest completed, database connection closed');
  }
}

// Run the function
connectDB().then(() => {
  testUserLogin();
}); 