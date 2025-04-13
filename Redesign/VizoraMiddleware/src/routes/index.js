/**
 * Routes Index
 * Exports all route modules from a central location
 */

const express = require('express');
const authRoutes = require('./auth.routes');
const displayRoutes = require('./display.routes');
const contentRoutes = require('./content.routes');
const folderRoutes = require('./folder.routes');
const systemRoutes = require('./system.routes');
const errorRoutes = require('./errors.routes');

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/displays', displayRoutes);
router.use('/content', contentRoutes);
router.use('/folders', folderRoutes);
router.use('/system', systemRoutes);
router.use('/errors', errorRoutes);

// API status route
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Vizora API is running',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router; 