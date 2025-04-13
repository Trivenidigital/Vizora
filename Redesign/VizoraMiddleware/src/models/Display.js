/**
 * Display Model
 * Represents a physical display device in the system
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const DisplaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [100, 'Display name cannot exceed 100 characters']
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true
    },
    apiKey: {
      type: String,
      unique: true,
      select: false // Hide API key by default
    },
    pairingCode: {
      code: String,
      expiresAt: Date
    },
    status: {
      type: String,
      enum: ['active', 'offline', 'maintenance', 'error', 'pending'],
      default: 'pending'
    },
    location: {
      name: {
        type: String,
        trim: true
      },
      address: {
        type: String,
        trim: true
      },
      coordinates: {
        lat: Number,
        lng: Number
      },
      floor: String,
      room: String,
      notes: String
    },
    specs: {
      resolution: {
        width: Number,
        height: Number
      },
      orientation: {
        type: String,
        enum: ['portrait', 'landscape'],
        default: 'landscape'
      },
      model: String,
      manufacturer: String,
      diagonalSize: Number, // in inches
      screenType: String
    },
    lastHeartbeat: Date,
    lastSeenIp: String,
    connectivity: {
      type: {
        type: String,
        enum: ['wifi', 'ethernet', 'cellular', 'other'],
        default: 'wifi'
      },
      strength: Number, // Signal strength percentage
      details: Object
    },
    settings: {
      volume: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
      },
      brightness: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
      },
      autoTurnOn: {
        enabled: {
          type: Boolean,
          default: false
        },
        time: String // HH:MM format
      },
      autoTurnOff: {
        enabled: {
          type: Boolean,
          default: false
        },
        time: String // HH:MM format
      },
      rotation: {
        type: Number,
        enum: [0, 90, 180, 270],
        default: 0
      },
      contentFit: {
        type: String,
        enum: ['contain', 'cover', 'fill', 'none'],
        default: 'contain'
      }
    },
    metrics: {
      uptime: Number, // in seconds
      temperature: Number, // in celsius
      freeStorage: Number, // in bytes
      totalStorage: Number, // in bytes
      freeMemory: Number, // in bytes
      totalMemory: Number, // in bytes
      cpuUsage: Number, // percentage
      lastUpdated: Date
    },
    software: {
      version: String,
      osVersion: String,
      lastUpdated: Date
    },
    tags: [String],
    activeContent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content'
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisplayGroup'
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Make owner optional to support auto-creation
    },
    notes: String,
    maintenanceMode: {
      enabled: {
        type: Boolean,
        default: false
      },
      reason: String,
      startedAt: Date,
      scheduledEndAt: Date
    },
    diagnostic: {
      lastDiagnostic: Date,
      status: {
        type: String,
        enum: ['ok', 'warning', 'error', 'unknown'],
        default: 'unknown'
      },
      details: [
        {
          component: String,
          status: String,
          message: String,
          timestamp: Date
        }
      ]
    },
    history: [
      {
        event: {
          type: String,
          enum: [
            'created',
            'updated',
            'online',
            'offline',
            'maintenance',
            'error',
            'content-changed',
            'settings-changed',
            'software-updated'
          ]
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        details: Object,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ],
    // Content scheduling
    scheduledContent: [{
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
        required: true
      },
      startTime: Date,
      endTime: Date,
      repeat: {
        type: String, 
        enum: ['none', 'daily', 'weekly', 'monthly'],
        default: 'none'
      },
      priority: {
        type: Number,
        default: 0
      },
      active: {
        type: Boolean,
        default: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for display status duration
DisplaySchema.virtual('statusDuration').get(function() {
  if (!this.history || this.history.length === 0) return 0;
  
  // Find last status change event
  const statusEvents = this.history.filter(h => 
    ['online', 'offline', 'maintenance', 'error'].includes(h.event)
  ).sort((a, b) => b.timestamp - a.timestamp);
  
  if (statusEvents.length === 0) return 0;
  
  // Return duration in seconds
  return Math.floor((Date.now() - statusEvents[0].timestamp) / 1000);
});

// Generate API key
DisplaySchema.methods.generateApiKey = function() {
  this.apiKey = crypto.randomBytes(32).toString('hex');
  return this.apiKey;
};

// Generate pairing code
DisplaySchema.methods.generatePairingCode = async function() {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiration (10 minutes)
  this.pairingCode = {
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  };
  
  await this.save();
  return code;
};

// Verify pairing code
DisplaySchema.methods.verifyPairingCode = function(code) {
  if (!this.pairingCode || !this.pairingCode.code) {
    return false;
  }
  
  if (this.pairingCode.expiresAt < new Date()) {
    return false;
  }
  
  return this.pairingCode.code === code;
};

// Mark as paired
DisplaySchema.methods.markAsPaired = async function() {
  this.status = 'active';
  this.pairingCode = undefined;
  
  // Add event to history
  this.history.push({
    event: 'updated',
    details: { status: 'active', action: 'paired' }
  });
  
  await this.save();
  return this;
};

// Update status
DisplaySchema.methods.updateStatus = async function(status, details = {}, userId = null) {
  this.status = status;
  
  // Add event to history
  this.history.push({
    event: status,
    timestamp: new Date(),
    details,
    user: userId
  });
  
  await this.save();
};

// Record heartbeat
DisplaySchema.methods.recordHeartbeat = async function(ip, metrics = {}) {
  this.lastHeartbeat = new Date();
  this.lastSeenIp = ip;
  
  // Update status if offline
  if (this.status === 'offline') {
    this.status = 'active';
    
    // Add online event to history
    this.history.push({
      event: 'online',
      timestamp: new Date(),
      details: { ip }
    });
  }
  
  // Update metrics if provided
  if (Object.keys(metrics).length > 0) {
    this.metrics = {
      ...this.metrics,
      ...metrics,
      lastUpdated: new Date()
    };
  }
  
  await this.save();
};

// Statics
DisplaySchema.statics.findOfflineDisplays = function() {
  const offlineThreshold = new Date(Date.now() - (process.env.DISPLAY_OFFLINE_THRESHOLD || 5 * 60 * 1000));
  
  return this.find({
    lastHeartbeat: { $lt: offlineThreshold },
    status: { $ne: 'maintenance' }
  });
};

// Get displays by tag
DisplaySchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag });
};

// Get displays by owner
DisplaySchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId });
};

// Get displays by group
DisplaySchema.statics.findByGroup = function(groupId) {
  return this.find({ groupId });
};

// Get displays by location (coordinates and radius in km)
DisplaySchema.statics.findByLocation = function(lat, lng, radiusKm = 1) {
  const radiusInDegrees = radiusKm / 111.12; // Approx conversion from km to degrees
  
  return this.find({
    'location.coordinates.lat': { $gte: lat - radiusInDegrees, $lte: lat + radiusInDegrees },
    'location.coordinates.lng': { $gte: lng - radiusInDegrees, $lte: lng + radiusInDegrees }
  });
};

// Indexes for efficient querying
DisplaySchema.index({ owner: 1 });
DisplaySchema.index({ groupId: 1 });
DisplaySchema.index({ 'location.coordinates.lat': 1, 'location.coordinates.lng': 1 });
DisplaySchema.index({ tags: 1 });

// Pre-save middleware
DisplaySchema.pre('save', function(next) {
  // Generate API key if new display
  if (this.isNew && !this.apiKey) {
    this.generateApiKey();
    
    // Add creation event to history
    this.history = [{
      event: 'created',
      timestamp: new Date()
    }];
  }
  
  next();
});

module.exports = mongoose.model('Display', DisplaySchema); 