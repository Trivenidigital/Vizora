import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import contentService from '@/services/contentService';
import { Content } from '@/services/contentService';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Display } from '@/types/display';
import '@/components/PushContentDialog.css';

interface PushContentDialogProps {
  display: Display;
  isOpen: boolean;
  onClose: () => void;
}

export const PushContentDialog: React.FC<PushContentDialogProps> = ({
  display,
  isOpen,
  onClose,
}) => {
  const [contentList, setContentList] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('library');
  
  // For file upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch content when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchContent();
    }
  }, [isOpen]);
  
  // Fetch content list from API
  const fetchContent = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the contentService to fetch content data
      const content = await contentService.getContentList();
      setContentList(content);
    } catch (err) {
      setError('Failed to load content. Please try again.');
      console.error('Error fetching content:', err);
      toast.error('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter content based on search query
  const filteredContent = contentList.filter(content => 
    content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    content.type.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Handle pushing content to display from library
  const handlePushContent = async () => {
    if (!selectedContentId) {
      toast.error('Please select content to push');
      return;
    }
    
    setIsPushing(true);
    
    try {
      const selectedContent = contentList.find(content => content.id === selectedContentId);
      
      if (!selectedContent) {
        throw new Error('Selected content not found');
      }
      
      // Use contentService to push content to the display
      const displayId = display.id;
      
      // Show "pushing" toast
      const pushingToast = toast.loading(`Pushing "${selectedContent.title}" to ${display.name}...`);
      
      try {
        const result = await contentService.pushContentToDisplay(selectedContentId, displayId);
        
        // Dismiss the loading toast and show success
        toast.dismiss(pushingToast);
        toast.success(`Content "${selectedContent.title}" pushed to "${display.name}" successfully`);
        
        // Close dialog
        onClose();
      } catch (error) {
        // Dismiss the loading toast and show error
        toast.dismiss(pushingToast);
        throw error;
      }
    } catch (err) {
      console.error('Error pushing content:', err);
      toast.error('Failed to push content. Please try again.');
    } finally {
      setIsPushing(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadFile(file);
      
      // Auto-fill title from filename
      if (!uploadTitle) {
        const fileName = file.name.split('.')[0];
        setUploadTitle(fileName);
      }
    }
  };

  // Handle upload and push
  const handleUploadAndPush = async () => {
    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }
    
    if (!uploadTitle.trim()) {
      toast.error('Please enter a title for the content');
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Show upload toast
      const uploadToast = toast.loading(`Uploading "${uploadTitle}"...`);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return newProgress;
        });
      }, 300);
      
      try {
        // Create content metadata
        const fileType = getFileType(uploadFile);
        const contentData = {
          title: uploadTitle,
          type: fileType,
          url: URL.createObjectURL(uploadFile), // In a real app, this would be a server URL
          thumbnail: fileType === 'image' ? URL.createObjectURL(uploadFile) : 'https://via.placeholder.com/150',
          status: 'published' as const,
          description: `Uploaded from Push Content dialog`,
          tags: [fileType],
          fileSize: uploadFile.size,
          dimensions: fileType === 'image' || fileType === 'video' ? '1920x1080' : undefined,
          duration: fileType === 'video' ? 60 : null
        };
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Create content using service
        const newContent = await contentService.createContent(contentData);
        
        // Push the newly created content to the display
        await contentService.pushContentToDisplay(newContent.id, display.id);
        
        // Clear progress interval if it's still running
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        // Dismiss the upload toast and show success
        toast.dismiss(uploadToast);
        toast.success(`Content "${uploadTitle}" uploaded and pushed to "${display.name}" successfully`);
        
        // Close dialog
        onClose();
      } catch (error) {
        // Clear progress interval if it's still running
        clearInterval(progressInterval);
        // Dismiss the upload toast and show error
        toast.dismiss(uploadToast);
        throw error;
      }
    } catch (err) {
      console.error('Error uploading content:', err);
      toast.error('Failed to upload content. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  
  // Content type icon mapping
  const getContentTypeIcon = (type: Content['type']) => {
    switch (type) {
      case 'image':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'video':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'webpage':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        );
      case 'stream':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M12 3v10m0 0l-3-3m3 3l3-3" />
          </svg>
        );
      case 'playlist':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };
  
  // Helper to get file type
  const getFileType = (file: File): Content['type'] => {
    const fileType = file.type.split('/')[0];
    switch (fileType) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      default:
        return 'webpage';
    }
  };
  
  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={onClose}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onClose();
                    }
                  }}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-500"
                  aria-label="Close dialog"
                >
                  <XMarkIcon className="h-6 w-6" />
                </div>
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900 mb-4"
                >
                  Push Content to Display: {display.name}
                </Dialog.Title>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-500">
                    Choose content to push to this display from your content library or upload a new file.
                  </p>
                </div>
                
                <div className="mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                      <button
                        onClick={() => setSelectedTab('library')}
                        className={`${
                          selectedTab === 'library'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                      >
                        Content Library
                      </button>
                      <button
                        onClick={() => setSelectedTab('upload')}
                        className={`${
                          selectedTab === 'upload'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                      >
                        Upload from PC
                      </button>
                    </nav>
                  </div>
                </div>
                
                {selectedTab === 'library' ? (
                  <>
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Search content..."
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    {isLoading ? (
                      <div className="flex justify-center items-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                      </div>
                    ) : error ? (
                      <div className="bg-red-50 p-4 rounded-md text-red-600 text-sm mb-4">
                        {error}
                        <button
                          onClick={fetchContent}
                          className="ml-2 text-red-700 underline"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : filteredContent.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        No content found. Try a different search term.
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 gap-4">
                          {filteredContent.map((content) => (
                            <div
                              key={content.id}
                              className={`border rounded-md p-3 flex items-center cursor-pointer transition-colors ${
                                selectedContentId === content.id
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                              onClick={() => setSelectedContentId(content.id)}
                            >
                              <div className="h-14 w-14 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                                {content.thumbnail ? (
                                  <img
                                    src={content.thumbnail}
                                    alt={content.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-gray-400">
                                    {getContentTypeIcon(content.type)}
                                  </div>
                                )}
                              </div>
                              <div className="ml-3 flex-1">
                                <h4 className="text-sm font-medium text-gray-900">{content.title}</h4>
                                <div className="flex items-center mt-1">
                                  <span className="text-xs flex items-center text-gray-500 capitalize">
                                    {getContentTypeIcon(content.type)}
                                    <span className="ml-1">{content.type}</span>
                                  </span>
                                  <span className="mx-2 text-gray-300">•</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(content.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-3">
                                <input
                                  type="radio"
                                  name="content"
                                  checked={selectedContentId === content.id}
                                  onChange={() => setSelectedContentId(content.id)}
                                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded-full"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                          isPushing || !selectedContentId
                            ? 'bg-purple-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                        onClick={handlePushContent}
                        disabled={isPushing || !selectedContentId}
                      >
                        {isPushing ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Pushing...
                          </>
                        ) : (
                          'Push Content'
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Enter content title"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        disabled={isUploading}
                      />
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                      <div className="flex items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          {uploadFile ? (
                            <div className="flex flex-col items-center">
                              <div className="mb-2 flex items-center justify-center rounded-md bg-gray-100 p-2 w-16 h-16">
                                {uploadFile.type.startsWith('image/') ? (
                                  <img
                                    src={URL.createObjectURL(uploadFile)}
                                    alt="Preview"
                                    className="h-full w-full object-contain"
                                  />
                                ) : uploadFile.type.startsWith('video/') ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{uploadFile.name}</p>
                              <p className="text-xs text-gray-400">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              {!isUploading && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadFile(null);
                                    if (fileInputRef.current) {
                                      fileInputRef.current.value = '';
                                    }
                                  }}
                                  className="mt-2 text-xs text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <div className="flex text-sm text-gray-600">
                                <label
                                  htmlFor="file-upload"
                                  className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                                >
                                  <span>Upload a file</span>
                                  <input
                                    id="file-upload"
                                    name="file-upload"
                                    type="file"
                                    className="sr-only"
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                    ref={fileInputRef}
                                    disabled={isUploading}
                                  />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                              </div>
                              <p className="text-xs text-gray-500">PNG, JPG, GIF, or MP4 up to 50MB</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {uploadProgress > 0 && (
                      <div className="mb-6">
                        <div className="relative pt-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold inline-block text-purple-600">
                                Uploading
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold inline-block text-purple-600">
                                {uploadProgress}%
                              </span>
                            </div>
                          </div>
                          <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-purple-100">
                            <div 
                              style={{ width: `${uploadProgress}%` }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500 transition-all duration-300"
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                        onClick={onClose}
                        disabled={isUploading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                          isUploading || !uploadFile || !uploadTitle.trim()
                            ? 'bg-purple-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                        onClick={handleUploadAndPush}
                        disabled={isUploading || !uploadFile || !uploadTitle.trim()}
                      >
                        {isUploading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          'Upload & Push'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}; 