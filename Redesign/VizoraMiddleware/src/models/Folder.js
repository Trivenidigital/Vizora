/**
 * Folder Model
 * Represents folders for organizing content
 */

const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: [100, 'Folder name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    parentFolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null
    },
    isRoot: {
      type: Boolean,
      default: false
    },
    path: {
      type: String,
      default: '/'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for content items in this folder
FolderSchema.virtual('contents', {
  ref: 'Content',
  localField: '_id',
  foreignField: 'folder',
  justOne: false
});

// Add indexes for faster queries
FolderSchema.index({ owner: 1 });
FolderSchema.index({ parentFolder: 1 });
FolderSchema.index({ path: 1 });

module.exports = mongoose.model('Folder', FolderSchema); 