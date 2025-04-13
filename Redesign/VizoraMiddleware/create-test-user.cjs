/**
 * Script to create a test admin user
 * Run with: node create-test-user.cjs
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config();

// Import User model
const User = require('./src/models/User');

// Test user configuration
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123', // Will be hashed before saving
  firstName: 'Test',
  lastName: 'User',
  role: 'admin'
};

// MongoDB Atlas connection
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora?retryWrites=true&w=majority&appName=Cluster0';

console.log(`Connecting to MongoDB: ${mongoURI}`);

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  // Check if test user exists
  const existingUser = await User.findOne({ email: 'admin@vizora.com' });
  
  if (existingUser) {
    console.log('Test user already exists. Updating password...');
    
    // Update password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    existingUser.password = hashedPassword;
    await existingUser.save();
    
    console.log('Test user password updated successfully');
    process.exit(0);
  }
  
  // Create test user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const user = new User({
    email: 'admin@vizora.com',
    password: hashedPassword,
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
    emailVerified: true
  });
  
  await user.save();
  console.log('Test user created successfully:');
  console.log({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  });
  
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 