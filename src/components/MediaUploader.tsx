import React, { useState, useRef } from 'react';

interface MediaUploaderProps {
  onUpload?: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  onUpload,
  accept = 'image/*,video/*',
  maxSize = 100 * 1024 * 1024, // 100MB
  multiple = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (file: File): boolean => {
    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      return false;
    }

    const fileType = file.type.split('/')[0];
    const acceptedTypes = accept.split(',').map(type => type.trim().replace('*', ''));
    
    if (!acceptedTypes.some(type => file.type.startsWith(type.replace('/*', '')))) {
      setError('Unsupported file type');
      return false;
    }

    return true;
  };

  const handleFiles = async (files: FileList) => {
    setError(null);
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (validateFile(file)) {
          await onUpload?.(file);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    setIsUploading(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        data-testid="file-input"
      />

      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-1 text-sm text-gray-600">
          {isUploading ? 'Uploading...' : 'Drop files here or click to upload'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Supported file types: {accept.split(',').join(', ')} up to {maxSize / (1024 * 1024)}MB
        </p>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-600" data-testid="error-message">
          {error}
        </div>
      )}

      {isUploading && (
        <button
          onClick={handleCancel}
          className="mt-4 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
          data-testid="cancel-button"
        >
          Cancel Upload
        </button>
      )}
    </div>
  );
};

export default MediaUploader; 