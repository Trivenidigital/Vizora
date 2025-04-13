const mongoose = require('mongoose');

const displaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    trim: true,
    index: true, // Add index for faster lookup
    unique: true // Ensure deviceId is unique to prevent duplicates
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'paired', 'unpaired', 'unknown'],
    default: 'active'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  pairingCode: {
    code: {
      type: String,
      trim: true
    },
    expiresAt: {
      type: Date
    }
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  deviceInfo: {
    type: Object,
    default: {}
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure deviceId is normalized before saving to avoid duplicate entries
displaySchema.pre('save', function(next) {
  // If this is a new document or the deviceId has been modified
  if (this.isNew || this.isModified('deviceId')) {
    // Normalize deviceId by removing any 'device-' prefix
    const normalizedDeviceId = this.deviceId.replace(/^device-/, '');
    
    // If the normalized ID is different and doesn't start with 'device-', add the prefix
    if (normalizedDeviceId !== this.deviceId && !this.deviceId.startsWith('device-')) {
      this.deviceId = `device-${normalizedDeviceId}`;
    } else if (normalizedDeviceId === this.deviceId) {
      // If there was no 'device-' prefix and we're using a normalized id,
      // add the standard prefix to ensure consistent IDs
      this.deviceId = `device-${normalizedDeviceId}`;
    }
  }
  
  next();
});

// Create indexes after defining the schema
displaySchema.index({ deviceId: 1 }, { unique: true });
displaySchema.index({ user: 1 });
displaySchema.index({ status: 1 });
displaySchema.index({ 'pairingCode.code': 1 });
displaySchema.index({ 'pairingCode.expiresAt': 1 });

const Display = mongoose.model('Display', displaySchema);

// Create a database index when the model is loaded to ensure uniqueness
const ensureIndexes = async () => {
  try {
    await Display.init(); // This ensures indexes are built
    console.log('Display model indexes have been created');
  } catch (error) {
    console.error('Error creating display model indexes:', error);
  }
};

ensureIndexes();

module.exports = Display; 