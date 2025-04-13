/**
 * Content Model
 * Represents content that can be displayed on digital displays
 */

const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    type: {
      type: String,
      required: [true, 'Content type is required'],
      enum: ['image', 'video', 'webpage', 'stream', 'text', 'social', 'widget', 'custom'],
      default: 'image'
    },
    url: {
      type: String,
      required: [true, 'Content URL is required'],
      trim: true
    },
    thumbnail: {
      type: String,
      trim: true
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null
    },
    metadata: {
      size: Number, // In bytes
      format: String,
      duration: Number, // In milliseconds (for videos)
      dimensions: {
        width: Number,
        height: Number
      },
      aspectRatio: String, // e.g., "16:9"
      fileType: String,
      createdAt: Date,
      modifiedAt: Date
    },
    settings: {
      duration: {
        type: Number,
        default: 10000 // Default display duration in milliseconds
      },
      transition: {
        type: String,
        enum: ['none', 'fade', 'slide', 'zoom', 'flip'],
        default: 'fade'
      },
      transitionDuration: {
        type: Number,
        default: 500 // In milliseconds
      },
      sound: {
        enabled: {
          type: Boolean,
          default: false
        },
        volume: {
          type: Number,
          min: 0,
          max: 100,
          default: 100
        }
      },
      loop: {
        type: Boolean,
        default: false
      },
      autoplay: {
        type: Boolean,
        default: true
      },
      fit: {
        type: String,
        enum: ['contain', 'cover', 'fill', 'none'],
        default: 'contain'
      },
      position: {
        type: String,
        enum: ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        default: 'center'
      }
    },
    schedule: {
      active: {
        type: Boolean,
        default: false
      },
      startDate: Date,
      endDate: Date,
      recurrence: {
        type: String,
        enum: ['none', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'custom'],
        default: 'none'
      },
      daysOfWeek: {
        type: [Number], // 0 = Sunday, 1 = Monday, etc.
        default: []
      },
      timeRanges: [
        {
          start: String, // HH:MM format
          end: String // HH:MM format
        }
      ],
      priority: {
        type: Number,
        default: 0 // Higher number = higher priority
      },
      timezoneOffset: Number // In minutes
    },
    displays: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Display'
      }
    ],
    tags: [String],
    categories: [String],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived', 'scheduled'],
      default: 'draft'
    },
    statistics: {
      views: {
        type: Number,
        default: 0
      },
      completions: {
        type: Number,
        default: 0
      },
      averageDuration: {
        type: Number,
        default: 0 // In milliseconds
      },
      lastPlayed: Date,
      playHistory: [
        {
          displayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Display'
          },
          timestamp: Date,
          duration: Number, // How long it was displayed
          completed: Boolean // Whether it played to completion
        }
      ]
    },
    deliveryStatus: [
      {
        displayId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Display'
        },
        status: {
          type: String,
          enum: ['pending', 'downloading', 'downloaded', 'error'],
          default: 'pending'
        },
        progress: {
          type: Number,
          min: 0,
          max: 100,
          default: 0
        },
        lastUpdated: Date,
        error: String
      }
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    version: {
      type: Number,
      default: 1
    },
    previousVersions: [
      {
        version: Number,
        url: String,
        metadata: Object,
        modifiedAt: Date,
        modifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ],
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for display count
ContentSchema.virtual('displayCount').get(function() {
  return this.displays ? this.displays.length : 0;
});

// Virtual for is active
ContentSchema.virtual('isActive').get(function() {
  if (!this.schedule || !this.schedule.active) return true;
  
  const now = new Date();
  
  // Check if within start and end dates
  if (this.schedule.startDate && now < this.schedule.startDate) return false;
  if (this.schedule.endDate && now > this.schedule.endDate) return false;
  
  // Check day of week if specified
  if (this.schedule.daysOfWeek && this.schedule.daysOfWeek.length > 0) {
    const today = now.getDay();
    if (!this.schedule.daysOfWeek.includes(today)) return false;
  }
  
  // Check time ranges if specified
  if (this.schedule.timeRanges && this.schedule.timeRanges.length > 0) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    // Check if current time is within any of the time ranges
    const isInTimeRange = this.schedule.timeRanges.some(range => {
      return currentTime >= range.start && currentTime <= range.end;
    });
    
    if (!isInTimeRange) return false;
  }
  
  return true;
});

// Track content view
ContentSchema.methods.trackView = async function(displayId, duration = null, completed = false) {
  // Increment view count
  this.statistics.views += 1;
  
  // Update last played
  this.statistics.lastPlayed = new Date();
  
  // Add to play history
  const playRecord = {
    displayId,
    timestamp: new Date(),
    duration,
    completed
  };
  
  if (!this.statistics.playHistory) {
    this.statistics.playHistory = [];
  }
  
  this.statistics.playHistory.push(playRecord);
  
  // Limit play history to 100 entries
  if (this.statistics.playHistory.length > 100) {
    this.statistics.playHistory = this.statistics.playHistory.slice(-100);
  }
  
  // Update completion count if completed
  if (completed) {
    this.statistics.completions += 1;
  }
  
  // Update average duration if provided
  if (duration) {
    const totalPlays = this.statistics.views;
    const oldAverage = this.statistics.averageDuration || 0;
    
    // Calculate new average
    this.statistics.averageDuration = Math.round(
      (oldAverage * (totalPlays - 1) + duration) / totalPlays
    );
  }
  
  await this.save();
};

// Update delivery status
ContentSchema.methods.updateDeliveryStatus = async function(displayId, status, progress = null, error = null) {
  // Find existing status
  let statusEntry = this.deliveryStatus.find(
    entry => entry.displayId.toString() === displayId.toString()
  );
  
  if (!statusEntry) {
    // Create new entry if not found
    statusEntry = {
      displayId,
      status,
      progress: progress || 0,
      lastUpdated: new Date()
    };
    
    this.deliveryStatus.push(statusEntry);
  } else {
    // Update existing entry
    statusEntry.status = status;
    if (progress !== null) statusEntry.progress = progress;
    statusEntry.lastUpdated = new Date();
  }
  
  // Add error if provided
  if (error) {
    statusEntry.error = error;
  } else if (status !== 'error') {
    // Clear error if status is not error
    statusEntry.error = undefined;
  }
  
  await this.save();
};

// Assign to displays
ContentSchema.methods.assignToDisplays = async function(displayIds) {
  // Convert to array if single ID
  if (!Array.isArray(displayIds)) {
    displayIds = [displayIds];
  }
  
  // Convert string IDs to ObjectIds if needed
  displayIds = displayIds.map(id => 
    typeof id === 'string' ? mongoose.Types.ObjectId(id) : id
  );
  
  // Add new displays
  this.displays = [...new Set([...this.displays, ...displayIds])];
  
  // Initialize delivery status for new displays
  displayIds.forEach(displayId => {
    if (!this.deliveryStatus.some(ds => ds.displayId.toString() === displayId.toString())) {
      this.deliveryStatus.push({
        displayId,
        status: 'pending',
        progress: 0,
        lastUpdated: new Date()
      });
    }
  });
  
  await this.save();
};

// Remove from displays
ContentSchema.methods.removeFromDisplays = async function(displayIds) {
  // Convert to array if single ID
  if (!Array.isArray(displayIds)) {
    displayIds = [displayIds];
  }
  
  // Convert string IDs to ObjectIds if needed
  displayIds = displayIds.map(id => 
    typeof id === 'string' ? mongoose.Types.ObjectId(id) : id
  );
  
  // Filter out displays
  this.displays = this.displays.filter(
    displayId => !displayIds.some(id => id.toString() === displayId.toString())
  );
  
  // Remove delivery status for removed displays
  this.deliveryStatus = this.deliveryStatus.filter(
    ds => !displayIds.some(id => id.toString() === ds.displayId.toString())
  );
  
  await this.save();
};

// Create new version
ContentSchema.methods.createNewVersion = async function(url, metadata, userId) {
  // Add current version to previous versions
  this.previousVersions.push({
    version: this.version,
    url: this.url,
    metadata: this.metadata,
    modifiedAt: new Date(),
    modifiedBy: userId || this.updatedBy || this.createdBy
  });
  
  // Update to new version
  this.version += 1;
  this.url = url;
  this.metadata = metadata;
  this.updatedBy = userId;
  
  // Reset delivery status
  this.deliveryStatus.forEach(ds => {
    ds.status = 'pending';
    ds.progress = 0;
    ds.lastUpdated = new Date();
    ds.error = undefined;
  });
  
  await this.save();
};

// Static method to find active content
ContentSchema.statics.findActiveContent = function() {
  const now = new Date();
  
  return this.find({
    status: 'published',
    $or: [
      { 'schedule.active': false },
      {
        'schedule.active': true,
        'schedule.startDate': { $lte: now },
        $or: [
          { 'schedule.endDate': { $exists: false } },
          { 'schedule.endDate': null },
          { 'schedule.endDate': { $gte: now } }
        ]
      }
    ]
  });
};

// Static method to find content for display
ContentSchema.statics.findForDisplay = function(displayId) {
  return this.find({
    displays: displayId,
    status: 'published'
  });
};

// Indexes for efficient querying
ContentSchema.index({ title: 'text', tags: 'text', categories: 'text' });
ContentSchema.index({ type: 1 });
ContentSchema.index({ owner: 1 });
ContentSchema.index({ displays: 1 });
ContentSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
ContentSchema.index({ folder: 1 });

module.exports = mongoose.model('Content', ContentSchema); 