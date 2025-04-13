import { useState, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowUpTrayIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Content } from '@/services/contentService';
import { toast } from 'react-hot-toast';

// Supported file types configuration
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

interface ContentUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onContentUploaded: (content: Content) => void;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface FileUpload {
  file: File;
  type: 'image' | 'video' | 'other';
  preview: string;
  progress: number;
  error?: string;
}

const ContentUploader: React.FC<ContentUploaderProps> = ({
  isOpen,
  onClose,
  onContentUploaded
}) => {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadData, setUploadData] = useState<FileUpload | null>(null);
  const [title, setTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal is closed
  const handleClose = () => {
    resetState();
    onClose();
  };

  // Reset form state
  const resetState = () => {
    setUploadState('idle');
    setUploadData(null);
    setTitle('');
    setIsDragging(false);
  };

  // Handle file selection from the file input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    processSelectedFile(file);
  };

  // Handle file drop from drag and drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    const file = e.dataTransfer.files[0];
    processSelectedFile(file);
  }, []);

  // Process the selected file (validate and prepare for upload)
  const processSelectedFile = (file: File) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      return;
    }
    
    // Validate file type
    const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
    const isVideo = SUPPORTED_VIDEO_TYPES.includes(file.type);
    
    if (!isImage && !isVideo) {
      toast.error('Unsupported file type. Please upload an image or video.');
      return;
    }
    
    // Create file preview
    const fileType = isImage ? 'image' : 'video';
    const preview = URL.createObjectURL(file);
    
    // Auto-fill title from filename without extension
    const fileName = file.name.split('.').slice(0, -1).join('.');
    setTitle(fileName);
    
    // Set upload data and reset error state
    setUploadData({
      file,
      type: fileType,
      preview,
      progress: 0
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadData) {
      toast.error('Please select a file to upload');
      return;
    }
    
    if (!title.trim()) {
      toast.error('Please enter a title for the content');
      return;
    }
    
    // Begin upload
    setUploadState('uploading');
    
    try {
      // Simulate upload progress
      const progressInterval = simulateUploadProgress();
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Stop progress simulation
      clearInterval(progressInterval);
      
      // Move to processing state
      setUploadState('processing');
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create mock response data
      const mockResponse: Content = {
        id: `content-${Date.now()}`,
        title: title.trim(),
        type: uploadData.type,
        url: uploadData.preview,
        thumbnail: uploadData.type === 'video' ? undefined : uploadData.preview,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Move to success state
      setUploadState('success');
      
      // Notify parent component
      onContentUploaded(mockResponse);
      
      // Close modal after a short delay
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Error uploading content:', error);
      setUploadState('error');
      toast.error('Failed to upload content. Please try again.');
    }
  };

  // Simulate upload progress
  const simulateUploadProgress = () => {
    let progress = 0;
    
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      
      if (progress > 95) {
        progress = 95; // Cap at 95% until processing begins
      }
      
      setUploadData(prev => {
        if (!prev) return prev;
        return { ...prev, progress };
      });
    }, 200);
    
    return interval;
  };

  // Drag and drop event handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Opens file dialog when clicking on the drop area
  const handleDropAreaClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Render different content based on the upload state
  const renderContent = () => {
    switch (uploadState) {
      case 'idle':
        return (
          <div className="space-y-6">
            <div 
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                ${isDragging ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleDropAreaClick}
            >
              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-900">
                Drag and drop your file here
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Supports JPG, PNG, GIF, MP4, MOV, and WEBM (up to 200MB)
              </p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={[...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES].join(',')}
                onChange={handleFileSelect}
              />
            </div>

            {uploadData && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start space-x-4">
                  {uploadData.type === 'image' ? (
                    <img 
                      src={uploadData.preview} 
                      alt="Preview" 
                      className="w-16 h-16 rounded-md object-cover"
                    />
                  ) : (
                    <video 
                      src={uploadData.preview} 
                      className="w-16 h-16 rounded-md object-cover" 
                      controls
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <Input
                      label="Title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="Enter content title"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      
      case 'uploading':
        return (
          <div className="text-center py-6">
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${uploadData?.progress || 0}%` }} 
                />
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Uploading... {Math.round(uploadData?.progress || 0)}%
              </p>
            </div>
            
            <p className="text-sm text-gray-500">
              Please don't close this window while uploading
            </p>
          </div>
        );
      
      case 'processing':
        return (
          <div className="text-center py-6">
            <div className="animate-pulse mb-4">
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full w-full" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Processing your content...</p>
            <p className="text-xs text-gray-500 mt-1">
              This may take a moment depending on the file size
            </p>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-lg font-medium text-gray-900">Upload successful!</h3>
            <p className="mt-2 text-sm text-gray-500">
              Your content has been added to your library
            </p>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XMarkIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-lg font-medium text-gray-900">Upload failed</h3>
            <p className="mt-2 text-sm text-gray-500">
              There was an error uploading your content. Please try again.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={resetState}
            >
              Try Again
            </Button>
          </div>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={uploadState === 'uploading' || uploadState === 'processing' ? undefined : handleClose}
      title="Upload Content"
    >
      <form onSubmit={handleSubmit} className="mt-4">
        {renderContent()}
        
        {/* Only show action buttons in idle state */}
        {uploadState === 'idle' && (
          <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <Button
              type="submit"
              variant="primary"
              disabled={!uploadData}
              className="w-full sm:col-start-2"
            >
              Upload
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="mt-3 w-full sm:col-start-1 sm:mt-0"
            >
              Cancel
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ContentUploader; 