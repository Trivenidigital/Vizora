/**
 * Controller Device Model
 * Represents a controller device in the Vizora system
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ControllerSchema = new Schema({
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Controller name is required'],
    trim: true,
    default: 'Controller'
  },
  model: {
    type: String,
    trim: true,
    default: ''
  },
  pairedDisplays: [{
    type: Schema.Types.ObjectId,
    ref: 'Display'
  }],
  activeDisplay: {
    type: Schema.Types.ObjectId,
    ref: 'Display',
    default: null
  },
  status: {
    type: String,
    enum: ['offline', 'online', 'paired'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  permissions: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],
    default: 'viewer'
  },
  metadata: {
    type: Object,
    default: {}
  },
  settings: {
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    layout: {
      type: String,
      enum: ['grid', 'list'],
      default: 'grid'
    },
    defaultView: {
      type: String,
      enum: ['displays', 'content', 'analytics'],
      default: 'displays'
    }
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for user lookup
ControllerSchema.index({ user: 1 }, { sparse: true });
// Index for status field
ControllerSchema.index({ status: 1 });

// Virtual for controller URL
ControllerSchema.virtual('controllerUrl').get(function() {
  return `/controllers/${this.deviceId}`;
});

// Method to add a display to pairedDisplays
ControllerSchema.methods.addDisplay = function(displayId) {
  if (!this.pairedDisplays.includes(displayId)) {
    this.pairedDisplays.push(displayId);
    if (this.status === 'online') {
      this.status = 'paired';
    }
  }
};

// Method to remove a display from pairedDisplays
ControllerSchema.methods.removeDisplay = function(displayId) {
  this.pairedDisplays = this.pairedDisplays.filter(
    id => id.toString() !== displayId.toString()
  );
  
  // Reset activeDisplay if it was the removed display
  if (this.activeDisplay && this.activeDisplay.toString() === displayId.toString()) {
    this.activeDisplay = null;
  }
  
  // Update status if no displays are paired anymore
  if (this.pairedDisplays.length === 0 && this.status === 'paired') {
    this.status = 'online';
  }
};

// Method to set active display
ControllerSchema.methods.setActiveDisplay = function(displayId) {
  if (this.pairedDisplays.some(id => id.toString() === displayId.toString())) {
    this.activeDisplay = displayId;
    return true;
  }
  return false;
};

// Create and export the model
const Controller = mongoose.model('Controller', ControllerSchema);
module.exports = Controller; 