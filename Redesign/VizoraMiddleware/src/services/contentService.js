/**
 * Content Service
 * Handles content management, scheduling, and delivery
 */

const mongoose = require('mongoose');
const Content = require('../models/Content');
const Display = require('../models/Display');
const { ApiError } = require('../middleware/errorMiddleware');
const socketService = require('./socketService');
const path = require('path');
const fs = require('fs');

// Create wrapper functions that will be populated once the module is loaded
let scheduleFunctions = {
  isScheduleActive: (...args) => {
    console.warn('Schedule function isScheduleActive called before initialization');
    return true; // Default fallback behavior
  },
  getActiveSchedules: (...args) => {
    console.warn('Schedule function getActiveSchedules called before initialization');
    return args[0] || []; // Return input schedules as fallback
  },
  getHighestPrioritySchedule: (...args) => {
    console.warn('Schedule function getHighestPrioritySchedule called before initialization');
    return args[0]?.[0]; // Return first schedule as fallback
  },
  getNextSchedule: (...args) => {
    console.warn('Schedule function getNextSchedule called before initialization');
    return args[0]?.[0]; // Return first schedule as fallback
  },
  validateSchedule: (...args) => {
    console.warn('Schedule function validateSchedule called before initialization');
    return { valid: true, errors: [], overlaps: [] }; // Default valid response as fallback
  }
};

// Load the common module asynchronously
(async () => {
  try {
    // Dynamic import needs to be in a try/catch block
    const common = await import('@vizora/common');
    
    // Update the function references
    scheduleFunctions.isScheduleActive = common.isScheduleActive;
    scheduleFunctions.getActiveSchedules = common.getActiveSchedules;
    scheduleFunctions.getHighestPrioritySchedule = common.getHighestPrioritySchedule;
    scheduleFunctions.getNextSchedule = common.getNextSchedule;
    scheduleFunctions.validateSchedule = common.validateSchedule;
    
    console.log('Successfully loaded schedule functions from @vizora/common');
  } catch (error) {
    console.error('Error loading @vizora/common:', error);
  }
})();

// Helper function to access schedule functions safely
const getScheduleFunction = (name) => {
  return scheduleFunctions[name];
};

// TODO: Phase 4 - Add proper content type detection library like file-type or mime
// For now using a comprehensive mapping of file extensions to content types
const FILE_TYPE_MAP = {
  // Images
  'jpg': 'image',
  'jpeg': 'image',
  'png': 'image',
  'gif': 'image',
  'webp': 'image',
  'svg': 'image',
  'bmp': 'image',
  'tiff': 'image',
  'tif': 'image',
  'heic': 'image',
  
  // Videos
  'mp4': 'video',
  'mov': 'video',
  'avi': 'video',
  'wmv': 'video',
  'flv': 'video',
  'mkv': 'video',
  'webm': 'video',
  'm4v': 'video',
  
  // Audio
  'mp3': 'audio',
  'wav': 'audio',
  'ogg': 'audio',
  'm4a': 'audio',
  'flac': 'audio',
  'aac': 'audio',
  
  // Documents
  'pdf': 'document',
  'doc': 'document',
  'docx': 'document',
  'xls': 'document',
  'xlsx': 'document',
  'ppt': 'document',
  'pptx': 'document',
  'txt': 'document',
  'rtf': 'document',
  'csv': 'document',
  'md': 'document',
  'json': 'document',
  'xml': 'document',
  'html': 'document',
  'htm': 'document',
  
  // Other
  'zip': 'other',
  'rar': 'other',
  '7z': 'other',
  'tar': 'other',
  'gz': 'other'
};

/**
 * Detect content type based on mime type and file extension
 * Uses a multi-layered approach with fallbacks
 * 
 * @param {string} mimetype - MIME type of the file
 * @param {string} filename - Original filename
 * @returns {string} - content type: 'image', 'video', 'audio', 'document', or 'other'
 */
const detectContentType = (mimetype, filename) => {
  // First try using the mime type (most accurate)
  if (mimetype) {
    const [type] = mimetype.split('/');
    if (['image', 'video', 'audio'].includes(type)) {
      return type;
    }
    
    // Handle common document mime types
    if (
      mimetype.includes('pdf') || 
      mimetype.includes('word') || 
      mimetype.includes('excel') || 
      mimetype.includes('powerpoint') || 
      mimetype.includes('text') || 
      mimetype.includes('msword') || 
      mimetype.includes('officedocument')
    ) {
      return 'document';
    }
  }
  
  // Fall back to file extension
  if (filename) {
    const extension = path.extname(filename).toLowerCase().replace('.', '');
    const type = FILE_TYPE_MAP[extension];
    if (type) {
      return type;
    }
  }
  
  // Default fallback
  return 'other';
};

/**
 * Get the appropriate default thumbnail for a content type
 * 
 * @param {string} contentType - Content type ('image', 'video', etc.)
 * @param {string} baseUrl - Base URL for the server (e.g., http://localhost:3003)
 * @returns {string} - URL to the default thumbnail
 */
const getDefaultThumbnail = (contentType, baseUrl) => {
  switch (contentType) {
    case 'video':
      return `${baseUrl}/thumbnails/video-default.jpg`;
    case 'audio':
      return `${baseUrl}/thumbnails/audio-default.jpg`;
    case 'document':
      return `${baseUrl}/thumbnails/document-default.jpg`;
    case 'other':
      return `${baseUrl}/thumbnails/document-default.jpg`;
    default:
      return `${baseUrl}/thumbnails/document-default.jpg`;
  }
};

/**
 * Ensure the uploads and thumbnails directories exist
 */
const ensureDirectoriesExist = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  const thumbnailDir = path.join(__dirname, '../../public/thumbnails');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
  }
};

/**
 * Create new content
 * @param {Object} contentData - Content data
 * @returns {Promise<Object>} Created content
 */
const createContent = async (contentData) => {
  try {
    const content = new Content({
      ...contentData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await content.save();
    
    // Trigger content update for associated displays if immediately active
    if (content.status === 'active' && content.displayIds && content.displayIds.length > 0) {
      await updateDisplaysWithContent(content._id, content.displayIds);
    }
    
    return content;
  } catch (error) {
    console.error('Error creating content:', error);
    throw error;
  }
};

/**
 * Get content by ID
 * @param {string} contentId - Content ID
 * @returns {Promise<Object>} Content object
 */
const getContentById = async (contentId) => {
  const content = await Content.findById(contentId);
  
  if (!content) {
    throw new ApiError(`Content not found with ID: ${contentId}`, 404);
  }
  
  return content;
};

/**
 * Get all content with optional filtering
 * @param {Object} filter - Filter criteria
 * @param {number} page - Page number
 * @param {number} limit - Page size
 * @returns {Promise<Object>} Content list with pagination
 */
const getAllContent = async (filter = {}, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const contentList = await Content.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });
  
  const total = await Content.countDocuments(filter);
  
  return {
    content: contentList,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Update content
 * @param {string} contentId - Content ID
 * @param {Object} updateData - Updated content data
 * @returns {Promise<Object>} Updated content
 */
const updateContent = async (contentId, updateData) => {
  const content = await getContentById(contentId);
  
  // Update fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      content[key] = updateData[key];
    }
  });
  
  content.updatedAt = new Date();
  
  await content.save();
  
  // If status changed to active or displayIds changed, update displays
  if (
    (updateData.status === 'active' || !updateData.status) && 
    (updateData.displayIds || content.displayIds.length > 0)
  ) {
    const displayIds = updateData.displayIds || content.displayIds;
    await updateDisplaysWithContent(contentId, displayIds);
  }
  
  return content;
};

/**
 * Delete content
 * @param {string} contentId - Content ID
 * @returns {Promise<boolean>} Success indicator
 */
const deleteContent = async (contentId) => {
  const content = await getContentById(contentId);
  
  // Remove content from any displays
  if (content.displayIds && content.displayIds.length > 0) {
    await Display.updateMany(
      { _id: { $in: content.displayIds } },
      { $pull: { contentIds: content._id } }
    );
  }
  
  await content.remove();
  return true;
};

/**
 * Get content for a display (scheduled and regular)
 * @param {string} displayId - Display ID
 * @returns {Promise<Object>} Content for the display
 */
const getContentForDisplay = async (displayId) => {
  try {
    // Find the display and populate content
    const display = await Display.findById(displayId)
      .populate({
        path: 'contentIds',
        model: 'Content',
        match: { status: 'active' }
      })
      .populate({
        path: 'scheduledContent.contentId',
        model: 'Content',
        match: { status: 'active' }
      });
  
  if (!display) {
    throw new ApiError(`Display not found with ID: ${displayId}`, 404);
  }
  
    // Convert scheduled content to format expected by client
    // and compatible with @vizora/common utilities
    const formattedContent = [];
    
    // Add regular content
    if (display.contentIds && display.contentIds.length > 0) {
      display.contentIds.forEach(content => {
        if (content) { // Skip null entries (from the match filter)
          formattedContent.push({
            id: content._id.toString(),
            contentId: content._id.toString(),
            title: content.title,
            type: content.type,
            url: content.url,
            thumbnail: content.thumbnail,
            duration: content.metadata?.duration || 0,
            scheduled: false,
            displaySettings: {
              autoplay: true,
              loop: true,
              mute: false,
              fit: 'contain'
            }
          });
        }
      });
    }
    
    // Add scheduled content
    const now = new Date();
    if (display.scheduledContent && display.scheduledContent.length > 0) {
      // Convert to format compatible with @vizora/common utilities
      const schedules = display.scheduledContent.map(schedule => ({
        id: schedule._id.toString(),
        contentId: schedule.contentId?._id.toString(),
        displayId: displayId,
        startTime: schedule.startTime.toISOString(),
        endTime: schedule.endTime.toISOString(),
        repeat: schedule.repeat,
        priority: schedule.priority,
        active: schedule.active !== false, // Default to true if not specified
        createdAt: schedule.createdAt.toISOString(),
        updatedAt: schedule.updatedAt?.toISOString()
      })).filter(s => s.contentId); // Filter out schedules without valid content
      
      // Use @vizora/common utilities to get active and next schedules
      const activeSchedules = getScheduleFunction('getActiveSchedules')(schedules, now);
      const highestPrioritySchedule = getScheduleFunction('getHighestPrioritySchedule')(schedules, now);
      const nextSchedule = getScheduleFunction('getNextSchedule')(schedules, now);
      
      // Add scheduled content to the formatted content list
      display.scheduledContent.forEach(schedule => {
        // Skip if content not found or not active
        if (!schedule.contentId || !schedule.active) return;
        
        const content = schedule.contentId;
        const scheduleId = schedule._id.toString();
        
        // Create content item with schedule info
        formattedContent.push({
          id: content._id.toString(),
          contentId: content._id.toString(),
          title: content.title,
          type: content.type,
          url: content.url,
          thumbnail: content.thumbnail,
          duration: content.metadata?.duration || 0,
          scheduled: true,
          scheduledInfo: {
            startTime: schedule.startTime.toISOString(),
            endTime: schedule.endTime.toISOString(),
            repeat: schedule.repeat,
            priority: schedule.priority
          },
          displaySettings: {
            autoplay: true,
            loop: true,
            mute: false,
            fit: 'contain'
          },
          // Add flags for use by the client
          isActive: activeSchedules.some(s => s.id === scheduleId),
          isHighestPriority: highestPrioritySchedule?.id === scheduleId,
          isNext: nextSchedule?.id === scheduleId
        });
      });
    }
    
    // Return the combined content
    return {
      success: true,
      displayId: displayId,
      timestamp: new Date().toISOString(),
      count: formattedContent.length,
      content: formattedContent
    };
  } catch (error) {
    console.error('Error getting content for display:', error);
    throw error;
  }
};

/**
 * Get current content for a display
 * @param {string} displayId - Display ID
 * @returns {Promise<Object>} Current content
 */
const getCurrentContent = async (displayId) => {
  const contentList = await getContentForDisplay(displayId);
  
  // Return first item (highest priority)
  return contentList.length > 0 ? contentList[0] : null;
};

/**
 * Assign content to displays with schedule
 * @param {string} contentId - Content ID
 * @param {string[]} displayIds - Array of display IDs
 * @param {Object} scheduleData - Schedule data
 * @returns {Promise<boolean>} Success status
 */
const assignContentToDisplays = async (contentId, displayIds, scheduleData = null) => {
  try {
    // Check if content exists
    const content = await Content.findById(contentId);
    if (!content) {
      throw new ApiError(`Content not found with ID: ${contentId}`, 404);
    }
    
    // Validate schedule if provided
    if (scheduleData) {
      // Convert to format expected by @vizora/common validateSchedule
      const scheduleToValidate = {
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        repeat: scheduleData.repeat || 'none',
        priority: scheduleData.priority || 1
      };
      
      // Perform basic validation
      if (scheduleData.startTime && scheduleData.endTime) {
        const startTime = new Date(scheduleData.startTime);
        const endTime = new Date(scheduleData.endTime);
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          throw new ApiError('Invalid schedule dates', 400);
        }
        
        if (startTime >= endTime) {
          throw new ApiError('End time must be after start time', 400);
        }
      }
    }
    
    // For each display ID
    const updatePromises = displayIds.map(async (displayId) => {
      const display = await Display.findById(displayId);
      
      if (!display) {
        console.warn(`Display not found with ID: ${displayId}`);
        return false;
      }
      
      // Add contentId to display's content list if not already there
      if (!scheduleData && !display.contentIds.includes(contentId)) {
        display.contentIds.push(contentId);
      }
      
      // If schedule data is provided, add to scheduled content
      if (scheduleData) {
        const schedule = {
          contentId: contentId,
          startTime: new Date(scheduleData.startTime),
          endTime: new Date(scheduleData.endTime),
          repeat: scheduleData.repeat || 'none',
          priority: scheduleData.priority || 1,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // If there's a name for the schedule, include it
        if (scheduleData.name) {
          schedule.name = scheduleData.name;
        }
        
        // Add the schedule to the display's scheduled content
        if (!display.scheduledContent) {
          display.scheduledContent = [];
        }
        
        display.scheduledContent.push(schedule);
      }
      
      await display.save();
      
      // Notify display about content update via socket
      socketService.notifyDisplay(displayId, 'content_update', {
        displayId,
        contentId,
        timestamp: new Date().toISOString(),
        scheduled: scheduleData ? true : false
      });
      
      return true;
    });
    
    const results = await Promise.all(updatePromises);
    return results.every(result => result === true);
  } catch (error) {
    console.error('Error assigning content to displays:', error);
    throw error;
  }
};

/**
 * Update display content lists and push updates via socket
 * @param {string} contentId - Content ID
 * @param {Array} displayIds - Array of display IDs
 * @returns {Promise<void>}
 */
const updateDisplaysWithContent = async (contentId, displayIds) => {
  // Get content
  const content = await getContentById(contentId);
  
  // Update displays
  for (const displayId of displayIds) {
    try {
      // Add content to display's content list if not already there
      await Display.updateOne(
        { _id: displayId, contentIds: { $ne: content._id } },
        { $addToSet: { contentIds: content._id } }
      );
      
      // Get display
      const display = await Display.findById(displayId);
      
      if (display && display.deviceId) {
        // Push content update to display via socket
        await socketService.sendContentUpdate(display.deviceId, content);
      }
    } catch (error) {
      console.error(`Failed to update display ${displayId} with content:`, error);
    }
  }
};

/**
 * Update content delivery status
 * @param {string} contentId - Content ID
 * @param {Object} statusData - Status data
 * @returns {Promise<Object>} Updated content delivery status
 */
const updateContentDeliveryStatus = async (contentId, statusData) => {
  const content = await getContentById(contentId);
  
  // Add delivery status
  if (!content.deliveryStatus) {
    content.deliveryStatus = [];
  }
  
  content.deliveryStatus.push({
    displayId: statusData.deviceId,
    status: statusData.status,
    timestamp: statusData.timestamp || new Date()
  });
  
  content.updatedAt = new Date();
  
  await content.save();
  
  return content;
};

/**
 * Update content playback status
 * @param {string} contentId - Content ID
 * @param {Object} statusData - Status data
 * @returns {Promise<Object>} Updated content playback status
 */
const updateContentPlaybackStatus = async (contentId, statusData) => {
  const content = await getContentById(contentId);
  
  // Add playback status
  if (!content.playbackStatus) {
    content.playbackStatus = [];
  }
  
  content.playbackStatus.push({
    displayId: statusData.deviceId,
    status: statusData.status,
    timestamp: statusData.timestamp || new Date(),
    duration: statusData.duration,
    position: statusData.position
  });
  
  content.updatedAt = new Date();
  
  await content.save();
  
  return content;
};

/**
 * Get metrics about content performance
 * @param {string} contentId - Content ID to get metrics for (optional)
 * @param {string} timeframe - Time period for metrics (day, week, month)
 * @returns {Promise<Object>} Content metrics
 */
const getContentMetrics = async (contentId = null, timeframe = 'week') => {
  try {
    const Content = mongoose.model('Content');
    const query = contentId ? { _id: contentId } : {};
    
    // Get base data about the content
    const pipeline = [
      { $match: query },
      { $project: {
        _id: 1,
        title: 1,
        type: 1,
        createdAt: 1,
        deliveryCount: { $size: { $ifNull: ["$deliveryStatus", []] } },
        playbackCount: { $size: { $ifNull: ["$playbackStatus", []] } },
        completionRate: {
          $cond: {
            if: { $eq: [{ $size: { $ifNull: ["$playbackStatus", []] } }, 0] },
            then: 0,
            else: {
              $multiply: [
                {
                  $divide: [
                    { $size: { $filter: {
                      input: "$playbackStatus",
                      as: "status",
                      cond: { $eq: ["$$status.status", "completed"] }
                    } } },
                    { $size: { $ifNull: ["$playbackStatus", []] } }
                  ]
                },
                100
              ]
            }
          }
        }
      }}
    ];
    
    const metrics = await Content.aggregate(pipeline);
    
    // Prepare response based on whether we're looking at a single content or all
    if (contentId) {
      return metrics.length > 0 ? metrics[0] : null;
    } else {
      return {
        totalContent: metrics.length,
        metrics,
        summary: {
          totalDeliveries: metrics.reduce((sum, content) => sum + content.deliveryCount, 0),
          totalPlaybacks: metrics.reduce((sum, content) => sum + content.playbackCount, 0),
          averageCompletionRate: metrics.length ? 
            metrics.reduce((sum, content) => sum + content.completionRate, 0) / metrics.length : 0
        }
      };
    }
  } catch (error) {
    console.error('Error getting content metrics:', error);
    throw error;
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
  getCurrentContent,
  getContentMetrics,
  updateContentDeliveryStatus,
  updateContentPlaybackStatus,
  detectContentType,
  getDefaultThumbnail,
  ensureDirectoriesExist
}; 