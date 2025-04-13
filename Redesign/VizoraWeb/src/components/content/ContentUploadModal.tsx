import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  ArrowUpTrayIcon, 
  XMarkIcon,
  DocumentIcon, 
  PhotoIcon, 
  FilmIcon,
  FolderIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { ContentMetadata, UploadProgress, BulkUploadResult } from '@vizora/common';
import { folderService, Folder } from '@/services/folderService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Tag } from '@/components/ui/Tag';
import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select';

// Format file size to human-readable format
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return PhotoIcon;
  if (fileType.startsWith('video/')) return FilmIcon;
  return DocumentIcon;
};

// Define our own interface for folder options
interface FolderOption {
  value: string;
  label: string;
}

const DEFAULT_ACCEPTED_TYPES = {
  'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
  'video/*': ['.mp4', '.mov', '.webm', '.avi'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

export interface ContentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, metadata: ContentMetadata, onProgress: (data: UploadProgress) => void) => Promise<void>;
  onBulkUpload?: (files: File[], metadata: ContentMetadata, onProgress: (data: UploadProgress) => void) => Promise<BulkUploadResult>;
  acceptedFileTypes?: Record<string, string[]>;
  maxFileSize?: number; // in bytes
  multipleFiles?: boolean;
}

const ContentUploadModal: React.FC<ContentUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpload,
  onBulkUpload,
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  multipleFiles = true
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<ContentMetadata>({
    title: '',
    description: '',
    category: '',
    tags: ''
  });
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Fetch folders
  const { data: folders = [], refetch: refetchFolders } = useQuery(
    ['folders'],
    () => folderService.getAllFolders(),
    { staleTime: 60000 } // 1 minute
  );

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files (too large or wrong type)
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(rejected => 
        rejected.errors.map((err: any) => `${rejected.file.name}: ${err.message}`).join(', ')
      ).join('; ');
      setFileError(errors);
      return;
    }

    if (acceptedFiles.length > 0) {
      // Check if any file exceeds the size limit
      const oversizedFiles = acceptedFiles.filter(file => file.size > maxFileSize);
      if (oversizedFiles.length > 0) {
        setFileError(`${oversizedFiles.length} file(s) exceed the maximum size of ${formatFileSize(maxFileSize)}`);
        return;
      }

      // For multi-file uploads, add to existing selection
      if (multipleFiles) {
        setSelectedFiles(prev => [...prev, ...acceptedFiles]);
      } else {
        // For single file uploads, replace selection
        setSelectedFiles([acceptedFiles[0]]);
      }
      
      setFileError(null);
    }
  }, [maxFileSize, multipleFiles]);

  // Configure dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    maxSize: maxFileSize,
    multiple: multipleFiles
  });

  // Handle metadata changes
  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  // Handle tag input
  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  // Add a tag when Enter is pressed
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() !== '') {
      e.preventDefault();
      addTag();
    }
  };

  // Add tag to the list
  const addTag = () => {
    if (tagInput.trim() !== '') {
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setMetadata(prev => ({ ...prev, tags: newTags }));
      setTagInput('');
    }
  };

  // Remove a tag
  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    setMetadata(prev => ({ ...prev, tags: newTags }));
  };
  
  // Remove a file from selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // Handle folder change
  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    console.log('Folder selected:', value);
    
    if (value === 'new-folder') {
      setShowNewFolderInput(true);
      // Don't change the selected folder yet, we'll set it after creation
    } else {
      setSelectedFolder(value);
      setShowNewFolderInput(false);
    }
  };
  
  // Handle new folder creation
  const handleCreateFolder = async () => {
    if (newFolderName.trim() === '') return;
    
    try {
      const folder = await folderService.createFolder({ name: newFolderName.trim() });
      setSelectedFolder(folder.id);
      setShowNewFolderInput(false);
      setNewFolderName('');
      refetchFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      setFileError('Failed to create new folder');
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      setFileError('Please select at least one file to upload');
      return;
    }
    
    setIsUploading(true);
    
    // Update metadata with folder selection
    const metadataWithFolder = {
      ...metadata,
      folder: selectedFolder
    };
    
    try {
      if (selectedFiles.length === 1 && !onBulkUpload) {
        // Single file upload if bulk upload not available
        await onUpload(selectedFiles[0], metadataWithFolder, setUploadProgress);
      } else if (onBulkUpload) {
        // Bulk upload if available
        await onBulkUpload(selectedFiles, metadataWithFolder, setUploadProgress);
      } else {
        throw new Error('Bulk upload not supported');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress({
        progress: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      });
      setIsUploading(false);
    }
  };

  // Reset form when modal is closed
  const resetForm = () => {
    setSelectedFiles([]);
    setMetadata({
      title: '',
      description: '',
      category: '',
      tags: ''
    });
    setTags([]);
    setTagInput('');
    setFileError(null);
    setIsUploading(false);
    setUploadProgress(null);
    setSelectedFolder(null);
    setShowNewFolderInput(false);
    setNewFolderName('');
  };

  // Close and reset if upload is complete
  useEffect(() => {
    if (uploadProgress?.status === 'complete') {
      // Auto-close after successful upload
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [uploadProgress, onClose]);

  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Prepare folder options
  const folderOptions: FolderOption[] = [
    { value: 'root', label: 'Root (No Folder)' },
    ...folders
      .filter(folder => folder.id !== 'root') // Filter out any "root" folder to prevent duplicate keys
      .map(folder => ({ value: folder.id, label: folder.name })),
    { value: 'new-folder', label: '+ Create New Folder' }
  ];

  // Debug to check folder data
  console.log("Folders for select:", folders);

  return (
    <Modal title="Upload Content" isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {fileError && (
          <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm">
            {fileError}
          </div>
        )}
        
        {uploadProgress?.status === 'error' && (
          <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm">
            {uploadProgress.message || 'An error occurred during upload'}
          </div>
        )}
        
        {/* File drop zone */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            File{multipleFiles ? 's' : ''}
          </label>
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300'}
              ${selectedFiles.length > 0 ? 'bg-gray-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {selectedFiles.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFiles([]);
                    }}
                  >
                    Clear All
                  </Button>
                </div>
                
                <div className="max-h-48 overflow-y-auto">
                  <ul className="divide-y divide-gray-200">
                    {selectedFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="py-2 px-1 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {React.createElement(getFileIcon(file.type), {
                            className: "h-6 w-6 text-gray-400 flex-shrink-0"
                          })}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="ml-2 text-gray-400 hover:text-gray-500"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                <ArrowUpTrayIcon className="h-10 w-10 mx-auto text-gray-400" />
                <p className="text-sm font-medium text-gray-500">
                  {multipleFiles ? (
                    <>Drag and drop files, or <span className="text-indigo-600">browse</span></>
                  ) : (
                    <>Drag and drop a file, or <span className="text-indigo-600">browse</span></>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  Maximum file size: {formatFileSize(maxFileSize)}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Folder selector */}
        <div className="space-y-2">
          <label htmlFor="folder" className="block text-sm font-medium text-gray-700">
            Folder
          </label>
          
          {showNewFolderInput ? (
            <div className="flex space-x-2">
              <Input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleCreateFolder}
                disabled={newFolderName.trim() === ''}
              >
                Create
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Select
              id="folder"
              value={selectedFolder || 'root'}
              onChange={handleFolderChange}
              disabled={isUploading}
            >
              {folderOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </div>
        
        {/* File metadata section (only for batch metadata) */}
        <div className="space-y-4 border-t border-gray-200 pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-700">Batch Metadata</h3>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title Prefix (optional)
            </label>
            <Input
              id="title"
              name="title"
              value={metadata.title}
              onChange={handleMetadataChange}
              placeholder="Will be combined with filenames"
              disabled={isUploading}
            />
            <p className="mt-1 text-xs text-gray-500">
              If specified, titles will be formatted as "Prefix - Filename"
            </p>
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              value={metadata.description}
              onChange={handleMetadataChange}
              placeholder="Enter content description"
              rows={3}
              disabled={isUploading}
            />
          </div>
          
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <Input
              id="category"
              name="category"
              value={metadata.category}
              onChange={handleMetadataChange}
              placeholder="e.g. Marketing, Product, Sales"
              disabled={isUploading}
            />
          </div>
          
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Tag 
                  key={tag}
                  text={tag}
                  onDelete={() => removeTag(tag)}
                  disabled={isUploading}
                />
              ))}
            </div>
            <div className="flex">
              <Input
                id="tags"
                type="text"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter"
                disabled={isUploading}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={addTag}
                disabled={isUploading || tagInput.trim() === ''}
                className="ml-2"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
        
        {/* Upload progress */}
        {uploadProgress && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {uploadProgress.status === 'pending' && 'Preparing upload...'}
                {uploadProgress.status === 'uploading' && 'Uploading...'}
                {uploadProgress.status === 'processing' && 'Processing...'}
                {uploadProgress.status === 'complete' && 'Upload complete!'}
                {uploadProgress.status === 'error' && 'Upload failed!'}
              </span>
              <span className="text-sm text-gray-500">
                {uploadProgress.progress}%
              </span>
            </div>
            <ProgressBar 
              progress={uploadProgress.progress} 
              variant={uploadProgress.status === 'error' ? 'danger' : 'success'}
            />
            {uploadProgress.message && (
              <p className={`text-sm ${
                uploadProgress.status === 'error' 
                  ? 'text-red-600' 
                  : uploadProgress.status === 'complete'
                    ? 'text-green-600'
                    : 'text-gray-500'
              }`}>
                {uploadProgress.message}
              </p>
            )}
          </div>
        )}
        
        {/* Form actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading
              </span>
            ) : (
              <>Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}</>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ContentUploadModal; 