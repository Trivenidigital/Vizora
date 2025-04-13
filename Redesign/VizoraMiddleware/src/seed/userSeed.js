/**
 * User Seed Script
 * Creates default users for development and testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// MongoDB Atlas connection
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongoURI, {
      // Mongoose 6+ handles connection options automatically
    });
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`, { error });
    process.exit(1);
  }
};

// Seed users
const seedUsers = async () => {
  try {
    // Clear existing users
    await User.deleteMany({});
    logger.info('Cleared existing users');

    // Create admin user
    const adminUser = await User.create({
      email: 'admin@vizora.com',
      password: 'admin123', // Will be hashed by the pre-save hook
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      emailVerified: true,
      status: 'active',
      company: 'Vizora Inc.'
    });

    // Create test user
    const testUser = await User.create({
      email: 'user@vizora.com',
      password: 'user123', // Will be hashed by the pre-save hook
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      emailVerified: true,
      status: 'active'
    });

    logger.info('Users created:');
    logger.info(`- Admin: ${adminUser.email}`);
    logger.info(`- User: ${testUser.email}`);

    logger.info('User seed completed successfully!');
  } catch (error) {
    logger.error('Error seeding users:', { error });
  } finally {
    mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
};

// Run seed process
connectDB().then(() => {
  seedUsers();
});

module.exports = { seedUsers }; 