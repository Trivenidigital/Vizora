/**
 * Data Migration Script
 * 
 * This script migrates data from the old database schema to the new one.
 * It ensures backward compatibility while adding new fields and relationships.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connect } = require('../db/connection');
const logger = require('../utils/logger');

// Import models
const Display = require('../models/Display');
const Controller = require('../models/Controller');
const User = require('../models/User');
const Content = require('../models/Content');

/**
 * Main migration function
 */
async function migrateData() {
  try {
    logger.info('Starting data migration...');
    
    // Connect to MongoDB
    await connect();
    logger.info('Connected to MongoDB');
    
    // Migrate Displays
    await migrateDisplays();
    
    // Migrate Controllers
    await migrateControllers();
    
    // Create default admin user if none exists
    await createDefaultUser();
    
    logger.info('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Migrate Display data
 */
async function migrateDisplays() {
  const displays = await Display.find({});
  logger.info(`Found ${displays.length} displays to migrate`);
  
  for (const display of displays) {
    try {
      // Add new fields with default values if they don't exist
      if (!display.content) {
        display.content = {
          currentContent: null,
          contentHistory: []
        };
      }
      
      if (!display.location) {
        display.location = {
          description: '',
          coordinates: {}
        };
      }
      
      // Enhance settings with defaults
      if (!display.settings) {
        display.settings = {};
      }
      
      if (!display.settings.brightness) {
        display.settings.brightness = 100;
      }
      
      if (!display.settings.orientation) {
        display.settings.orientation = 'landscape';
      }
      
      if (!display.settings.resolution) {
        display.settings.resolution = {
          width: 1920,
          height: 1080
        };
      }
      
      if (!display.settings.volume) {
        display.settings.volume = 50;
      }
      
      if (!display.settings.powerSchedule) {
        display.settings.powerSchedule = {
          enabled: false,
          onTime: '08:00',
          offTime: '18:00',
          daysActive: [1, 2, 3, 4, 5] // Monday-Friday
        };
      }
      
      // Update status values if they use old enum values
      if (display.status === 'pairing' || display.status === 'paired') {
        display.status = 'online';
      }
      
      // Save the updated display
      await display.save();
      logger.info(`Migrated display: ${display.deviceId}`);
    } catch (error) {
      logger.error(`Error migrating display ${display.deviceId}:`, error);
    }
  }
  
  logger.info('Display migration completed');
}

/**
 * Migrate Controller data
 */
async function migrateControllers() {
  const controllers = await Controller.find({});
  logger.info(`Found ${controllers.length} controllers to migrate`);
  
  for (const controller of controllers) {
    try {
      // Add new fields with default values if they don't exist
      if (!controller.permissions) {
        controller.permissions = 'viewer';
      }
      
      // Enhance settings with defaults
      if (!controller.settings || typeof controller.settings !== 'object') {
        controller.settings = {};
      }
      
      if (!controller.settings.notificationsEnabled) {
        controller.settings.notificationsEnabled = true;
      }
      
      if (!controller.settings.theme) {
        controller.settings.theme = 'system';
      }
      
      if (!controller.settings.layout) {
        controller.settings.layout = 'grid';
      }
      
      if (!controller.settings.defaultView) {
        controller.settings.defaultView = 'displays';
      }
      
      // Save the updated controller
      await controller.save();
      logger.info(`Migrated controller: ${controller.deviceId}`);
    } catch (error) {
      logger.error(`Error migrating controller ${controller.deviceId}:`, error);
    }
  }
  
  logger.info('Controller migration completed');
}

/**
 * Create default admin user if none exists
 */
async function createDefaultUser() {
  const adminCount = await User.countDocuments({ role: 'admin' });
  
  if (adminCount === 0) {
    logger.info('No admin users found. Creating default admin user...');
    
    try {
      const adminUser = new User({
        email: 'admin@vizora.com',
        password: 'ChangeMe123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        settings: {
          theme: 'system',
          notifications: {
            email: true,
            push: true
          },
          defaultView: 'dashboard'
        },
        organization: {
          name: 'Vizora',
          role: 'Administrator'
        }
      });
      
      await adminUser.save();
      logger.info('Default admin user created. Email: admin@vizora.com, Password: ChangeMe123!');
      logger.warn('PLEASE CHANGE THE DEFAULT ADMIN PASSWORD IMMEDIATELY AFTER FIRST LOGIN');
    } catch (error) {
      logger.error('Error creating default admin user:', error);
    }
  } else {
    logger.info('Admin users already exist. Skipping default admin creation.');
  }
}

// Run the migration
migrateData(); 