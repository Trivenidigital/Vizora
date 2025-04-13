require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

// MongoDB connection - using MongoDB Atlas
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

async function createTestUser() {
  try {
    // Delete existing test user if exists
    await User.deleteOne({ email: 'test@example.com' });
    
    // Create a new user with a plain text password and let the model hash it
    const newUser = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123', // Plain text password that will be hashed by the model
      company: 'Test Company',
      role: 'user'
    });
    
    // Save user to trigger the pre-save hook
    await newUser.save();
    console.log('Test user created successfully!');
    
    // Verify user was saved
    const savedUser = await User.findOne({ email: 'test@example.com' }).select('+password');
    console.log('Retrieved user:', {
      id: savedUser._id,
      email: savedUser.email,
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      hasPassword: !!savedUser.password,
      passwordLength: savedUser.password ? savedUser.password.length : 0
    });
    
    // Test password verification using the model's method
    const isMatch = await savedUser.comparePassword('password123');
    console.log('Password verification test (model method):', isMatch);
    
  } catch (err) {
    console.error('Error creating test user:', err);
  } finally {
    // Close connection
    await mongoose.disconnect();
  }
}

// Run the function
connectDB().then(() => {
  createTestUser();
}); 