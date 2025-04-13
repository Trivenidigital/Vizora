/**
 * Content Controller
 * Handles REST endpoints for content management, delivery, and scheduling
 */

const contentService = require('../services/contentService');
const displayService = require('../services/displayService');
const { ApiError } = require('../middleware/errorMiddleware');
const socketService = require('../socket');
const Content = require('../models/Content');
const Folder = require('../models/Folder');
const path = require('path');

/**
 * @desc    Create new content
 * @route   POST /api/content
 * @access  Private
 */
const createContent = async (req, res, next) => {
  try {
    // Extract content data from request body
    const contentData = {
      title: req.body.title,
      description: req.body.description,
      type: req.body.type,
      url: req.body.url,
      thumbnail: req.body.thumbnail,
      duration: req.body.duration,
      priority: req.body.priority,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      schedule: req.body.schedule,
      displayIds: req.body.displayIds || [],
      status: req.body.status || 'draft',
      owner: req.user.id, // From auth middleware
      tags: req.body.tags,
      category: req.body.category,
      metadata: req.body.metadata
    };
    
    // Create content
    const content = await contentService.createContent(contentData);
    
    res.status(201).json({
      success: true,
      content
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all content with pagination and filtering
 * @route   GET /api/content
 * @access  Private
 */
const getAllContent = async (req, res, next) => {
  try {
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // Build filter object
    const filter = { owner: req.user.id }; // Only return content owned by the current user
    
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.tag) filter.tags = { $in: [req.query.tag] };
    if (req.query.category) filter.category = req.query.category;
    
    // Handle folder filtering
    if (req.query.folder) {
      if (req.query.folder === 'root') {
        // For "root" folder, set filter to find items with null folder
        filter.folder = { $eq: null };
      } else {
        // For any other folder, filter by folder ID
        filter.folder = req.query.folder;
      }
    }
    
    // Handle search
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex }
      ];
    }
    
    // Get total count
    const total = await Content.countDocuments(filter);
    
    // Get content with pagination
    const content = await Content.find(filter)
      .populate('folder', 'name path')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    res.status(200).json({
      success: true,
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

/**
 * @desc    Get content by ID
 * @route   GET /api/content/:contentId
 * @access  Private
 */
const getContentById = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    
    // Get content
    const content = await contentService.getContentById(contentId);
    
    res.status(200).json({
      success: true,
      content
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Content not found with ID: ${req.params.contentId}`));
    }
    next(error);
  }
};

/**
 * @desc    Update content
 * @route   PUT /api/content/:contentId
 * @access  Private
 */
const updateContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    
    // Extract update data from request body
    const updateData = {};
    
    // Only include fields that are present in the request body
    const allowedFields = [
      'title', 'description', 'type', 'url', 'thumbnail', 'duration',
      'priority', 'startDate', 'endDate', 'schedule', 'displayIds',
      'status', 'tags', 'category', 'metadata'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Update content
    const content = await contentService.updateContent(contentId, updateData);
    
    // If the content has assigned displays, notify them about the update
    if (content.displayIds && content.displayIds.length > 0) {
      await socketService.notifyContentUpdate(content.displayIds, 'update');
    }
    
    res.status(200).json({
      success: true,
      content
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Content not found with ID: ${req.params.contentId}`));
    }
    next(error);
  }
};

/**
 * @desc    Delete content
 * @route   DELETE /api/content/:contentId
 * @access  Private
 */
const deleteContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    
    // Delete content
    await contentService.deleteContent(contentId);
    
    res.status(200).json({
      success: true,
      message: `Content with ID: ${contentId} has been deleted`
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Content not found with ID: ${req.params.contentId}`));
    }
    next(error);
  }
};

/**
 * @desc    Assign content to displays
 * @route   POST /api/content/:contentId/assign
 * @access  Private
 */
const assignContentToDisplays = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const { displayIds } = req.body;
    
    if (!displayIds || !Array.isArray(displayIds) || displayIds.length === 0) {
      return next(ApiError.badRequest('Display IDs are required'));
    }
    
    // Assign content to displays
    const content = await contentService.assignContentToDisplays(contentId, displayIds);
    
    // Notify displays about the content update
    await socketService.notifyContentUpdate(displayIds, 'direct');
    
    res.status(200).json({
      success: true,
      message: `Content assigned to ${displayIds.length} display(s)`,
      content
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Content not found with ID: ${req.params.contentId}`));
    }
    next(error);
  }
};

/**
 * @desc    Get content for display
 * @route   GET /api/content/display/:deviceId
 * @access  Public (with device authentication)
 */
const getContentForDisplay = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Get content for display
    const contentList = await contentService.getContentForDisplay(deviceId);
    
    res.status(200).json({
      success: true,
      count: contentList.length,
      content: contentList
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Get current content for display
 * @route   GET /api/content/display/:deviceId/current
 * @access  Public (with device authentication)
 */
const getCurrentContentForDisplay = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    // Get current content for display
    const content = await contentService.getCurrentContent(deviceId);
    
    if (!content) {
      return res.status(200).json({
        success: true,
        content: null,
        message: 'No active content found for display'
      });
    }
    
    res.status(200).json({
      success: true,
      content
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Display not found with deviceId: ${req.params.deviceId}`));
    }
    next(error);
  }
};

/**
 * @desc    Track content view
 * @route   POST /api/content/:contentId/view
 * @access  Public (with device authentication)
 */
const trackContentView = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return next(ApiError.badRequest('Device ID is required'));
    }
    
    // Get content
    const content = await contentService.getContentById(contentId);
    
    // Track view
    await content.trackView(deviceId);
    
    res.status(200).json({
      success: true,
      message: 'Content view tracked successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Content not found with ID: ${req.params.contentId}`));
    }
    next(error);
  }
};

/**
 * @desc    Update content delivery status
 * @route   POST /api/content/:contentId/delivery-status
 * @access  Public (with device authentication)
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const { deviceId, status } = req.body;
    
    if (!deviceId || !status) {
      return next(ApiError.badRequest('Device ID and status are required'));
    }
    
    // Update delivery status
    await contentService.updateContentDeliveryStatus(contentId, {
      deviceId,
      status,
      timestamp: new Date()
    });
    
    res.status(200).json({
      success: true,
      message: 'Content delivery status updated'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Content not found with ID: ${req.params.contentId}`));
    }
    next(error);
  }
};

/**
 * @desc    Update content playback status
 * @route   POST /api/content/:contentId/playback-status
 * @access  Public (with device authentication)
 */
const updatePlaybackStatus = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const { deviceId, status, position, duration } = req.body;
    
    if (!deviceId || !status) {
      return next(ApiError.badRequest('Device ID and status are required'));
    }
    
    // Update playback status
    await contentService.updateContentPlaybackStatus(contentId, {
      deviceId,
      status,
      position,
      duration,
      timestamp: new Date()
    });
    
    res.status(200).json({
      success: true,
      message: 'Content playback status updated'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return next(ApiError.notFound(`Content not found with ID: ${req.params.contentId}`));
    }
    next(error);
  }
};

/**
 * @desc    Upload multiple content files
 * @route   POST /api/content/upload
 * @access  Private
 */
const uploadMultipleContent = async (req, res, next) => {
  try {
    // Check if files were provided
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded'
      });
    }

    console.log(`Processing ${req.files.length} uploaded files`);
    
    // Extract metadata from request body
    const { 
      title, 
      titlePrefix,
      description, 
      tags: rawTags, 
      category,
      folder 
    } = req.body;
    
    // Process tags - convert comma-separated string to array
    const tags = rawTags ? 
      (typeof rawTags === 'string' ? rawTags.split(',').map(tag => tag.trim()) : rawTags) 
      : [];
    
    // Process each file and create content records
    const results = await Promise.all(req.files.map(async (file, index) => {
      try {
        // Generate content title based on file or provided titles
        const contentTitle = titlePrefix 
          ? `${titlePrefix} ${index + 1}` 
          : title || file.originalname;
          
        // Determine content type based on MIME type
        const contentType = file.mimetype.split('/')[0] || 'other';
        
        // Create a path for the file relative to the uploads directory
        const relativePath = `uploads/${file.filename}`;
        
        // Create file URL (in production, this might be a CDN URL)
        const fileUrl = `${req.protocol}://${req.get('host')}/${relativePath}`;
        
        // Generate a thumbnail URL for images
        const thumbnailUrl = contentType === 'image' ? fileUrl : null;
        
        // Create the content record
        const content = {
          id: `content-${Date.now()}-${index}`,
          title: contentTitle,
          description: description || `Uploaded file: ${file.originalname}`,
          type: contentType,
          url: fileUrl,
          thumbnail: thumbnailUrl,
          filename: file.originalname,
          path: relativePath,
          size: file.size,
          mimeType: file.mimetype,
          tags,
          category,
          folder: folder || null,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // In a real implementation, save to database
        // For now, just return the content object
        
        return {
          success: true,
          filename: file.originalname,
          content
        };
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        return {
          success: false,
          filename: file.originalname,
          error: error.message || 'Failed to process file'
        };
      }
    }));
    
    // Count successful uploads
    const successCount = results.filter(r => r.success).length;
    
    // Return response with results
    return res.status(200).json({
      success: true,
      message: `Successfully processed ${successCount} of ${req.files.length} files`,
      results
    });
    
  } catch (error) {
    console.error('Error in uploadMultipleContent:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing uploads',
      error: error.message
    });
  }
};

/**
 * @desc    Move content to a folder
 * @route   PUT /api/content/:contentId/move
 * @access  Private
 */
const moveContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const { folderId } = req.body;
    
    // Find the content
    const content = await Content.findById(contentId);
    
    if (!content) {
      return next(ApiError.notFound(`Content not found with ID: ${contentId}`));
    }
    
    // Check if content belongs to the current user
    if (content.owner.toString() !== req.user.id.toString()) {
      return next(ApiError.forbidden('You do not have permission to move this content'));
    }
    
    // If folderId is 'root', set folder to null
    if (folderId === 'root') {
      content.folder = null;
    } else {
      // Check if folder exists and belongs to the user
      const folder = await Folder.findById(folderId);
      
      if (!folder) {
        return next(ApiError.notFound(`Folder not found with ID: ${folderId}`));
      }
      
      if (folder.owner.toString() !== req.user.id.toString()) {
        return next(ApiError.forbidden('You do not have permission to move content to this folder'));
      }
      
      content.folder = folderId;
    }
    
    content.updatedBy = req.user.id;
    await content.save();
    
    res.status(200).json({
      success: true,
      message: `Content moved successfully`,
      content
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Move multiple content items to a folder
 * @route   PUT /api/content/move-batch
 * @access  Private
 */
const moveMultipleContent = async (req, res, next) => {
  try {
    const { contentIds, folderId } = req.body;
    
    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      return next(ApiError.badRequest('Content IDs are required'));
    }
    
    // Check if the folder exists (unless it's 'root')
    if (folderId !== 'root') {
      const folder = await Folder.findById(folderId);
      
      if (!folder) {
        return next(ApiError.notFound(`Folder not found with ID: ${folderId}`));
      }
      
      // Check if folder belongs to the current user
      if (folder.owner.toString() !== req.user.id.toString()) {
        return next(ApiError.forbidden('You do not have permission to move content to this folder'));
      }
    }
    
    // Update all content items that belong to the user
    const updateResult = await Content.updateMany(
      { 
        _id: { $in: contentIds },
        owner: req.user.id
      },
      { 
        folder: folderId === 'root' ? null : folderId,
        updatedBy: req.user.id
      }
    );
    
    res.status(200).json({
      success: true,
      message: `${updateResult.modifiedCount} content items moved successfully`,
      success: updateResult.modifiedCount,
      failed: contentIds.length - updateResult.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get metrics about content performance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} Content metrics
 */
const getContentMetrics = async (req, res, next) => {
  try {
    const contentId = req.params.contentId;
    const timeframe = req.query.timeframe || 'week';
    
    const metrics = await contentService.getContentMetrics(contentId, timeframe);
    
    if (!metrics && contentId) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      metrics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Push content to a display with optional scheduling
 * @route   POST /api/content/push-to-display
 * @access  Private
 */
const pushContentToDisplay = async (req, res, next) => {
  try {
    const { contentId, displayId, schedulePayload } = req.body;
    
    if (!contentId || !displayId) {
      return next(ApiError.badRequest('Content ID and Display ID are required'));
    }
    
    console.log(`Pushing content ${contentId} to display ${displayId}`, 
      schedulePayload ? 'with scheduling' : 'without scheduling');
    
    // Get content and display
    const content = await contentService.getContentById(contentId);
    const display = await displayService.getDisplayById(displayId);
    
    if (!display) {
      return next(ApiError.notFound(`Display not found with ID: ${displayId}`));
    }
    
    // Create schedule entry if scheduling is requested
    if (schedulePayload) {
      // Validate schedule data
      const { startTime, endTime, repeat = 'none' } = schedulePayload;
      
      // Add to display's scheduled content
      const scheduleEntry = {
        contentId: content._id,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        repeat,
        priority: 0, // Default priority
        active: true,
        createdAt: new Date()
      };
      
      // Add to display's scheduled content array
      if (!display.scheduledContent) {
        display.scheduledContent = [];
      }
      
      display.scheduledContent.push(scheduleEntry);
      await display.save();
      
      console.log(`Created schedule for content ${contentId} on display ${displayId}`, scheduleEntry);
    }
    
    // Update display's content array if not already there
    if (!display.contentIds.includes(content._id)) {
      display.contentIds.push(content._id);
      await display.save();
    }
    
    // Push content to display via socket service
    const pushResult = await socketService.pushContentToDisplay(display.deviceId, {
      contentId: content._id.toString(),
      type: content.type,
      title: content.title,
      url: content.url,
      thumbnail: content.thumbnail,
      mimeType: content.mimeType,
      size: content.size,
      duration: content.duration,
      displaySettings: content.displaySettings || {},
      scheduled: !!schedulePayload,
      scheduleInfo: schedulePayload ? {
        startTime: schedulePayload.startTime,
        endTime: schedulePayload.endTime,
        repeat: schedulePayload.repeat
      } : null
    });
    
    // Also emit a 'content-pushed' event for the web app to detect
    if (pushResult.success) {
      // Emit an event that the socket server can relay to any connected web clients
      // This allows the web UI to update immediately when content is pushed
      socketService.notifyContentUpdate([displayId], 'push', {
        contentId: content._id.toString(),
        displayId: display._id.toString(),
        timestamp: new Date().toISOString(),
        success: true,
        scheduleInfo: schedulePayload || null
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Content pushed to display${schedulePayload ? ' with scheduling' : ''}`,
      content: {
        id: content._id,
        title: content.title,
        type: content.type
      },
      display: {
        id: display._id,
        name: display.name,
        deviceId: display.deviceId
      },
      scheduleInfo: schedulePayload ? {
        startTime: schedulePayload.startTime,
        endTime: schedulePayload.endTime,
        repeat: schedulePayload.repeat
      } : null,
      socketResult: pushResult
    });
  } catch (error) {
    console.error('Error pushing content to display:', error);
    if (error.statusCode === 404) {
      return next(ApiError.notFound(error.message));
    }
    next(error);
  }
};

module.exports = {
  createContent,
  getAllContent,
  getContentById,
  updateContent,
  deleteContent,
  assignContentToDisplays,
  getContentForDisplay,
  getCurrentContentForDisplay,
  trackContentView,
  updateDeliveryStatus,
  updatePlaybackStatus,
  uploadMultipleContent,
  moveContent,
  moveMultipleContent,
  getContentMetrics,
  pushContentToDisplay
}; 