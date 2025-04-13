/**
 * User Model
 * Handles user data, authentication, and token management
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Schema = mongoose.Schema;

// Convert time string to milliseconds (e.g., '30d' to milliseconds)
const convertToMs = (timeStr) => {
  const units = {
    s: 1000,            // seconds
    m: 60 * 1000,       // minutes
    h: 60 * 60 * 1000,  // hours
    d: 24 * 60 * 60 * 1000, // days
  };
  
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // default to 30 days if invalid format
  
  const [, value, unit] = match;
  return parseInt(value, 10) * (units[unit] || units.d);
};

// JWT settings
const JWT_SECRET = process.env.JWT_SECRET || 'vizora-super-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRATION || '7d';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '90d';

const UserSchema = new Schema({
  // Basic information
  username: {
    type: String,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    sparse: true
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
      'Please enter a valid email address'
    ]
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // User profile
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  
  avatar: {
    type: String,
    default: ''
  },
  
  // Authorization
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Account management
  emailVerified: {
    type: Boolean,
    default: false
  },
  
  emailVerificationToken: String,
  
  emailVerificationExpires: Date,
  
  passwordResetToken: String,
  
  passwordResetExpires: Date,
  
  passwordChangedAt: Date,
  
  // Security & session management
  refreshTokens: [
    {
      token: String,
      expiresAt: Date,
      createdAt: Date,
      lastUsed: Date,
      ipAddress: String,
      userAgent: String
    }
  ],
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  accountLocked: {
    type: Boolean,
    default: false
  },
  
  accountLockedUntil: Date,
  
  lastLogin: Date,
  
  lastLoginIp: String,
  
  company: {
    type: String,
    default: ''
  },
  
  // Display associations
  managedDisplays: [{
    type: Schema.Types.ObjectId,
    ref: 'Display'
  }],
  
  // Content associations
  ownedContent: [{
    type: Schema.Types.ObjectId,
    ref: 'Content'
  }],
  
  // Preferences
  preferences: {
    type: Object,
    default: {
      theme: 'light',
      notifications: true,
      language: 'en'
    }
  },
  
  // Organization
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  this.updatedAt = new Date();
  
  // Only hash password if it's modified (or new)
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update passwordChangedAt timestamp
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to avoid JWT issue
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Clean up expired tokens before saving
UserSchema.pre('save', function(next) {
  // Remove expired refresh tokens
  if (this.refreshTokens && this.refreshTokens.length > 0) {
    this.refreshTokens = this.refreshTokens.filter(token => 
      token.expiresAt > new Date()
    );
  }
  next();
});

// Update the comparePassword methods in the User model with memory logging
UserSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    console.log('Comparing passwords in model...');
    
    // Memory tracking for password comparison
    console.log('--- Password comparison memory check (start) ---');
    const memBefore = process.memoryUsage();
    console.log(`Heap used before comparison: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    if (!enteredPassword) {
      console.error('No password provided for comparison');
      return false;
    }
    
    if (!this.password) {
      console.error('User has no stored password');
      return false;
    }
    
    // Use bcrypt to compare passwords
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log(`Password comparison result: ${isMatch}`);
    
    // Check memory after password comparison
    const memAfter = process.memoryUsage();
    console.log(`Heap used after comparison: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Memory difference: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
    console.log('--- Password comparison memory check (end) ---');
    
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw new Error('Password comparison failed');
  }
};

// For backwards compatibility
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return this.matchPassword(candidatePassword);
};

// Record login attempt
UserSchema.methods.recordLogin = function(ipAddress, userAgent) {
  // Reset failed login attempts
  this.loginAttempts = 0;
  this.accountLocked = false;
  this.accountLockedUntil = undefined;
  
  // Update login info
  this.lastLogin = new Date();
  this.lastLoginIp = ipAddress;
  
  return this;
};

// Record failed login
UserSchema.methods.recordFailedLogin = async function() {
  // Increment login attempts
  this.loginAttempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts >= 5) {
    this.accountLocked = true;
    
    // Lock for 15 minutes
    this.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  await this.save();
  
  return this;
};

// Generate JWT Token (with multiple aliases for compatibility)
UserSchema.methods.generateToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
};

UserSchema.methods.generateAuthToken = function() {
  return this.generateToken();
};

// Generate Email Verification Token
UserSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    
  // Token expires in 24 hours
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return token;
};

// Generate Refresh Token
UserSchema.methods.generateRefreshToken = function(ipAddress, userAgent) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + convertToMs(JWT_REFRESH_EXPIRE));
  
  this.refreshTokens.push({
    token,
    expiresAt,
    createdAt: new Date(),
    lastUsed: new Date(),
    ipAddress,
    userAgent
  });
  
  return token;
};

// Generate Password Reset Token
UserSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  // Token expires in 10 minutes
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
  
  return resetToken;
};

// Remove refresh token
UserSchema.methods.removeRefreshToken = function(tokenToRemove) {
  this.refreshTokens = this.refreshTokens.filter(
    token => token.token !== tokenToRemove
  );
  
  return this.save();
};

// Check if password was changed after JWT was issued
UserSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  
  return false;
};

// Verify email
UserSchema.methods.verifyEmail = async function() {
  this.emailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
  
  await this.save();
};

// Optimize token cleanup to prevent memory leaks
UserSchema.methods.cleanupExpiredTokens = async function() {
  const now = new Date();
  let tokensBefore = 0;
  let tokensAfter = 0;
  
  // Count before cleanup
  if (this.refreshTokens) {
    tokensBefore = this.refreshTokens.length;
  }
  
  // Remove expired refresh tokens
  if (this.refreshTokens && this.refreshTokens.length > 0) {
    this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt > now);
    tokensAfter = this.refreshTokens.length;
    
    // Log if there was a significant cleanup
    if (tokensBefore - tokensAfter > 5) {
      console.log(`Cleaned up ${tokensBefore - tokensAfter} expired refresh tokens for user ${this._id}`);
    }
  }
  
  // Limit the number of refresh tokens (prevent token explosion)
  if (this.refreshTokens && this.refreshTokens.length > 10) {
    // Keep only the 10 most recent tokens
    this.refreshTokens.sort((a, b) => b.createdAt - a.createdAt);
    const removedCount = this.refreshTokens.length - 10;
    this.refreshTokens = this.refreshTokens.slice(0, 10);
    console.log(`Limited refresh tokens for user ${this._id}, removed ${removedCount} oldest tokens`);
  }
  
  // Remove expired verification tokens
  if (this.emailVerificationExpires && this.emailVerificationExpires < now) {
    this.emailVerificationToken = undefined;
    this.emailVerificationExpires = undefined;
  }
  
  // Remove expired reset tokens
  if (this.passwordResetExpires && this.passwordResetExpires < now) {
    this.passwordResetToken = undefined;
    this.passwordResetExpires = undefined;
  }
  
  // Use lean save to prevent excessive memory usage
  try {
    if (tokensBefore !== tokensAfter || 
        !this.emailVerificationToken || 
        !this.passwordResetToken) {
      await this.save();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error saving user after token cleanup:', error);
    return false;
  }
};

// Optimize the middleware to avoid excessive token cleanup
UserSchema.pre('findOne', async function() {
  // Add a flag to determine if token cleanup should be performed
  // Only clean up tokens every 10th query to reduce overhead
  if (!global.tokenCleanupCounter) {
    global.tokenCleanupCounter = 0;
  }
  
  global.tokenCleanupCounter++;
  
  // Only run cleanup occasionally to prevent overhead
  if (global.tokenCleanupCounter % 10 === 0) {
    try {
      // Find user first
      const user = await this.model.findOne(this.getQuery());
      
      // If user found, clean up tokens
      if (user) {
        await user.cleanupExpiredTokens();
      }
    } catch (error) {
      console.error('Error cleaning up tokens:', error);
    }
  }
});

const User = mongoose.model('User', UserSchema);

module.exports = User; 