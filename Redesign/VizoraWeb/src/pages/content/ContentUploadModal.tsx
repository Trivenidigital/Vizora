import React, { useState, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  ArrowUpTrayIcon, DocumentIcon, PhotoIcon, 
  VideoCameraIcon, GlobeAltIcon, XMarkIcon 
} from '@heroicons/react/24/outline';
import { ContentItem } from './ContentPage';
import contentService from '../../services/contentService';

interface ContentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContentUploaded: (content: ContentItem) => void;
}

type UploadStep = 'select' | 'uploading' | 'configure';

interface FileUpload {
  file: File;
  progress: number;
  preview?: string;
  error?: string;
}

export const ContentUploadModal: React.FC<ContentUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onContentUploaded 
}) => {
  const [currentStep, setCurrentStep] = useState<UploadStep>('select');
  const [uploadData, setUploadData] = useState<FileUpload | null>(null);
  const [contentData, setContentData] = useState({
    title: '',
    description: '',
    type: 'image' as ContentItem['type'],
    tags: [] as string[],
    status: 'published'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileType = getFileType(file.type);
    
    // Create file preview for images
    let preview = undefined;
    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }
    
    // Autofill title from filename
    const fileName = file.name.split('.')[0];
    setContentData(prev => ({
      ...prev,
      title: fileName,
      type: fileType
    }));
    
    setUploadData({
      file,
      progress: 0,
      preview
    });
    
    // Move to upload step
    simulateUpload();
  };
  
  const getFileType = (mimeType: string): ContentItem['type'] => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('application/pdf')) return 'document';
    if (mimeType.includes('html')) return 'webpage';
    return 'document';
  };
  
  const simulateUpload = () => {
    setCurrentStep('uploading');
    
    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      
      setUploadData(prev => {
        if (!prev) return prev;
        return { ...prev, progress };
      });
      
      if (progress >= 100) {
        clearInterval(interval);
        setCurrentStep('configure');
      }
    }, 300);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData) return;
    
    setIsSubmitting(true);
    
    try {
      // In a real implementation, you would use FormData to submit the file
      // const formData = new FormData();
      // formData.append('file', uploadData.file);
      // formData.append('title', contentData.title);
      // formData.append('description', contentData.description);
      // formData.append('type', contentData.type);
      // formData.append('status', contentData.status);
      // formData.append('tags', JSON.stringify(contentData.tags));
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create mock response data
      const mockResponse: ContentItem = {
        id: `content-${Date.now()}`,
        title: contentData.title,
        description: contentData.description,
        type: contentData.type,
        url: URL.createObjectURL(uploadData.file),
        thumbnail: uploadData.preview,
        status: contentData.status,
        tags: contentData.tags,
        owner: 'current-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        size: uploadData.file.size
      };
      
      // Call the parent callback
      onContentUploaded(mockResponse);
      
      // Reset state and close
      resetState();
      onClose();
    } catch (err) {
      console.error('Error uploading content:', err);
      setUploadData(prev => {
        if (!prev) return prev;
        return { ...prev, error: 'Failed to upload content. Please try again.' };
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    resetState();
    onClose();
  };
  
  const resetState = () => {
    setCurrentStep('select');
    setUploadData(null);
    setContentData({
      title: '',
      description: '',
      type: 'image',
      tags: [],
      status: 'published'
    });
    setIsSubmitting(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Render the current step
  const renderSelectStep = () => (
    <div className="p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <ArrowUpTrayIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-lg font-medium text-gray-900">Upload Content</h3>
      <p className="mt-2 text-sm text-gray-500">
        Choose a file from your device or drag and drop it here
      </p>
      
      <div className="mt-5">
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <PhotoIcon className="h-6 w-6" />
                </div>
                <span className="mt-2 text-xs text-gray-500">Images</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <VideoCameraIcon className="h-6 w-6" />
                </div>
                <span className="mt-2 text-xs text-gray-500">Videos</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <DocumentIcon className="h-6 w-6" />
                </div>
                <span className="mt-2 text-xs text-gray-500">Documents</span>
              </div>
            </div>
            
            <div className="mt-2 flex max-w-lg justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pb-6 pt-5">
              <div className="space-y-1 text-center">
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
                <div className="flex justify-center text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded-md bg-white font-medium text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:text-blue-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept="image/*,video/*,application/pdf"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF, MP4, PDF up to 100MB
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderUploadingStep = () => {
    if (!uploadData) return null;
    
    return (
      <div className="p-6">
        <div className="mb-4 flex items-center">
          <div className="mr-4 h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
            {uploadData.preview ? (
              <img
                src={uploadData.preview}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-100">
                <DocumentIcon className="h-6 w-6 text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {uploadData.file.name}
            </h3>
            <p className="text-xs text-gray-500">
              {(uploadData.file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900">Uploading</h4>
          <div className="mt-2 relative pt-1">
            <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                style={{ width: `${uploadData.progress}%` }}
                className="flex flex-col justify-center rounded-full bg-blue-500 text-center text-white shadow-none transition-all"
              ></div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{uploadData.progress}% complete</span>
              <span>
                {uploadData.progress < 100 ? 'Uploading...' : 'Processing...'}
              </span>
            </div>
          </div>
        </div>
        
        {uploadData.error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Upload failed</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{uploadData.error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const renderConfigureStep = () => {
    if (!uploadData) return null;
    
    return (
      <div className="p-6">
        <div className="mb-6 flex items-start">
          <div className="mr-4 h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
            {uploadData.preview ? (
              <img
                src={uploadData.preview}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-100">
                <DocumentIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">Content Details</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add information about your content
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={contentData.title}
                onChange={(e) => setContentData({ ...contentData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={contentData.description}
                onChange={(e) => setContentData({ ...contentData, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="content-type" className="block text-sm font-medium text-gray-700">
                Content Type
              </label>
              <select
                id="content-type"
                name="content-type"
                value={contentData.type}
                onChange={(e) => setContentData({ ...contentData, type: e.target.value as ContentItem['type'] })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
                <option value="webpage">Webpage</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={contentData.status}
                onChange={(e) => setContentData({ ...contentData, status: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : 'Save Content'}
            </button>
          </div>
        </form>
      </div>
    );
  };
  
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={handleCancel}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                
                {currentStep === 'select' && renderSelectStep()}
                {currentStep === 'uploading' && renderUploadingStep()}
                {currentStep === 'configure' && renderConfigureStep()}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}; 