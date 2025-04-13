/**
 * Folder Routes
 * Handles folder management routes
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const folderController = require('../controllers/folder.controller');

// Base routes
router.route('/')
  .get(protect, folderController.getAllFolders)
  .post(protect, folderController.createFolder);

// Folder ID routes
router.route('/:folderId')
  .get(protect, folderController.getFolderById)
  .patch(protect, folderController.updateFolder)
  .delete(protect, folderController.deleteFolder);

// Get content in folder
router.route('/:folderId/content')
  .get(protect, folderController.getFolderContent);

module.exports = router; 