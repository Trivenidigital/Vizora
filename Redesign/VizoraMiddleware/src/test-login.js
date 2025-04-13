/**
 * Test Login Script
 * This script tests the login functionality directly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Config
const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

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

async function testLogin() {
  try {
    console.log('======= Testing Login Functionality =======');
    
    // 1. Test login with test user
    console.log('\n1. Testing login with test user (test@example.com)');
    
    const testUser = await User.findOne({ email: 'test@example.com' }).select('+password');
    
    if (!testUser) {
      console.log('Test user not found, please run test-register.js first');
    } else {
      console.log('Test user found:', testUser.email);
      
      // Test password comparison
      const testPassword = 'password123';
      const isTestMatch = await testUser.comparePassword(testPassword);
      
      console.log('Password verification result:', isTestMatch);
      
      if (isTestMatch) {
        // Generate token
        const token = generateToken(testUser._id);
        console.log('Test login successful, token generated:', token.substring(0, 20) + '...');
      } else {
        console.log('Test login failed: Invalid credentials');
      }
    }
    
    // 2. Create and test login with a regular user
    console.log('\n2. Creating and testing a regular user');
    
    // Delete existing regular user if exists
    await User.deleteOne({ email: 'user@example.com' });
    
    // Create a regular user
    const regularPassword = 'regularpass123';
    const regularUser = new User({
      firstName: 'Regular',
      lastName: 'User',
      email: 'user@example.com',
      password: regularPassword,
      company: 'Example Corp',
      role: 'user'
    });
    
    await regularUser.save();
    console.log('Regular user created:', regularUser.email);
    
    // Fetch the user from database to ensure password is saved correctly
    const savedRegularUser = await User.findOne({ email: 'user@example.com' }).select('+password');
    
    console.log('Regular user retrieved from DB:', {
      id: savedRegularUser._id,
      email: savedRegularUser.email,
      hasPassword: !!savedRegularUser.password,
      passwordLength: savedRegularUser.password?.length
    });
    
    // Test password comparison
    const isRegularMatch = await savedRegularUser.comparePassword(regularPassword);
    
    console.log('Regular user password verification result:', isRegularMatch);
    
    if (isRegularMatch) {
      // Generate token
      const token = generateToken(savedRegularUser._id);
      console.log('Regular user login successful, token generated:', token.substring(0, 20) + '...');
    } else {
      console.log('Regular user login failed: Invalid credentials');
    }
    
    // 3. Test with incorrect password
    console.log('\n3. Testing login with incorrect password');
    const wrongPassword = 'wrongpassword';
    const isWrongMatch = await savedRegularUser.comparePassword(wrongPassword);
    
    console.log('Incorrect password verification result:', isWrongMatch);
    
    if (isWrongMatch) {
      console.log('ERROR: Incorrect password was accepted');
    } else {
      console.log('Success: Incorrect password was rejected');
    }
    
  } catch (err) {
    console.error('Error testing login:', err);
  } finally {
    // Close connection
    await mongoose.disconnect();
    console.log('\nTest completed, database connection closed');
  }
}

// Run the function
connectDB().then(() => {
  testLogin();
}); 