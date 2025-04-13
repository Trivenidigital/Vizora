/**
 * Folder Controller
 * Handles REST endpoints for folder management
 */

const Folder = require('../models/Folder');
const Content = require('../models/Content');
const { ApiError } = require('../middleware/errorMiddleware');

/**
 * @desc    Create a new folder
 * @route   POST /api/folders
 * @access  Private
 */
const createFolder = async (req, res, next) => {
  try {
    const { name, description, parentFolder } = req.body;
    
    // Validate folder name
    if (!name || name.trim() === '') {
      return next(ApiError.badRequest('Folder name is required'));
    }
    
    // Create folder data
    const folderData = {
      name: name.trim(),
      description: description || '',
      owner: req.user.id, // From auth middleware
      parentFolder: parentFolder || null,
      isRoot: !parentFolder,
      path: '/',
      createdBy: req.user.id,
      updatedBy: req.user.id
    };
    
    // If parent folder exists, update the path
    if (parentFolder) {
      const parent = await Folder.findById(parentFolder);
      if (!parent) {
        return next(ApiError.notFound('Parent folder not found'));
      }
      
      // Check if parent folder belongs to the same user
      if (parent.owner.toString() !== req.user.id.toString()) {
        return next(ApiError.forbidden('You do not have permission to add to this folder'));
      }
      
      folderData.path = parent.path === '/' ? `/${parent.name}` : `${parent.path}/${parent.name}`;
    }
    
    // Create the folder
    const folder = await Folder.create(folderData);
    
    res.status(201).json({
      success: true,
      folder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all folders for the current user
 * @route   GET /api/folders
 * @access  Private
 */
const getAllFolders = async (req, res, next) => {
  try {
    // Get folders for the current user
    const folders = await Folder.find({ owner: req.user.id })
      .sort({ name: 1 })
      .populate({
        path: 'contents',
        select: 'title type url thumbnail status',
        options: { limit: 5 }
      });
    
    // Add a "root" folder for the frontend to work with
    const foldersWithRoot = [
      {
        id: "root",
        name: "Root",
        path: "/",
        description: "Root folder",
        isRoot: true
      },
      ...folders.map(folder => ({
        id: folder._id,
        name: folder.name,
        path: folder.path,
        description: folder.description,
        isRoot: folder.isRoot,
        contentCount: folder.contents ? folder.contents.length : 0
      }))
    ];
    
    res.status(200).json({
      success: true,
      count: foldersWithRoot.length,
      folders: foldersWithRoot
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get folder by ID
 * @route   GET /api/folders/:folderId
 * @access  Private
 */
const getFolderById = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    
    const folder = await Folder.findById(folderId)
      .populate({
        path: 'contents',
        select: 'title type url thumbnail status'
      });
    
    if (!folder) {
      return next(ApiError.notFound(`Folder not found with ID: ${folderId}`));
    }
    
    // Check if folder belongs to the current user
    if (folder.owner.toString() !== req.user.id.toString()) {
      return next(ApiError.forbidden('You do not have permission to access this folder'));
    }
    
    res.status(200).json({
      success: true,
      folder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update folder
 * @route   PATCH /api/folders/:folderId
 * @access  Private
 */
const updateFolder = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const { name, description } = req.body;
    
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return next(ApiError.notFound(`Folder not found with ID: ${folderId}`));
    }
    
    // Check if folder belongs to the current user
    if (folder.owner.toString() !== req.user.id.toString()) {
      return next(ApiError.forbidden('You do not have permission to update this folder'));
    }
    
    // Update fields
    folder.name = name || folder.name;
    folder.description = description !== undefined ? description : folder.description;
    folder.updatedBy = req.user.id;
    
    await folder.save();
    
    res.status(200).json({
      success: true,
      folder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete folder
 * @route   DELETE /api/folders/:folderId
 * @access  Private
 */
const deleteFolder = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return next(ApiError.notFound(`Folder not found with ID: ${folderId}`));
    }
    
    // Check if folder belongs to the current user
    if (folder.owner.toString() !== req.user.id.toString()) {
      return next(ApiError.forbidden('You do not have permission to delete this folder'));
    }
    
    // Get the content in this folder
    const contentInFolder = await Content.find({ folder: folderId });
    
    // Handle content in the folder - reset the folder to null (move to root)
    if (contentInFolder.length > 0) {
      await Content.updateMany(
        { folder: folderId },
        { folder: null }
      );
    }
    
    // Delete the folder using findByIdAndDelete instead of remove()
    await Folder.findByIdAndDelete(folderId);
    
    res.status(200).json({
      success: true,
      message: `Folder with ID: ${folderId} has been deleted. ${contentInFolder.length} content items moved to root.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get content in folder
 * @route   GET /api/folders/:folderId/content
 * @access  Private
 */
const getFolderContent = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return next(ApiError.notFound(`Folder not found with ID: ${folderId}`));
    }
    
    // Check if folder belongs to the current user
    if (folder.owner.toString() !== req.user.id.toString()) {
      return next(ApiError.forbidden('You do not have permission to access this folder'));
    }
    
    // Get total count
    const total = await Content.countDocuments({ folder: folderId });
    
    // Get content in folder with pagination
    const content = await Content.find({ folder: folderId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      folder: {
        id: folder._id,
        name: folder.name,
        path: folder.path
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      content
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFolder,
  getAllFolders,
  getFolderById,
  updateFolder,
  deleteFolder,
  getFolderContent
}; 