/**
 * Folder Routes
 * Routes for folder management
 */

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const folderController = require('../controllers/folder.controller');

const router = express.Router();

// Folder routes (all authenticated)
router.post('/', protect, folderController.createFolder);
router.get('/', protect, folderController.getAllFolders);
router.get('/:folderId', protect, folderController.getFolderById);
router.patch('/:folderId', protect, folderController.updateFolder);
router.delete('/:folderId', protect, folderController.deleteFolder);
router.get('/:folderId/content', protect, folderController.getFolderContent);

module.exports = router; 