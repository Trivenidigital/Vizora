import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import { contentService, Content } from '@/services/contentService';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Display } from '@/types/display';
import { displayPollingService } from '@/services/displayPollingService';
import { useDisplayMonitor } from '@/hooks/useDisplayMonitor';
import { ScheduleEditor } from '@/components/schedule';
import { Schedule } from '@vizora/common';
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
  const [pushSuccess, setPushSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('library');
  
  // For file upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Updated schedule state to use the Schedule type
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleData, setScheduleData] = useState<Schedule>({
    id: `schedule-${Date.now()}`,
    name: `Schedule for ${display.name}`,
    contentId: '',
    displayId: display.id,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
    repeat: 'none',
    priority: 1,
    active: true,
    createdAt: new Date().toISOString()
  });
  
  // Use the display monitor hook to track display updates
  const { 
    display: monitoredDisplay, 
    isPolling,
    refreshDisplay 
  } = useDisplayMonitor({
    displayId: display.id,
    onUpdate: (updatedDisplay) => {
      console.log('[PushContentDialog] Display updated via monitor:', updatedDisplay);
      
      // If we're in the process of pushing content and see an update, check if content changed
      if (isPushing && selectedContentId && 
          updatedDisplay.currentContent === selectedContentId) {
        setPushSuccess(true);
        setIsPushing(false);
        
        // Show success message
        toast.success(`Content pushed to "${display.name}" successfully`);
        
        // Close dialog after a short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    },
    onError: (err) => {
      console.error('[PushContentDialog] ❌ Error monitoring display:', err);
      // Only show the error if we're pushing and haven't succeeded yet
      if (isPushing && !pushSuccess) {
        toast.error(`Error monitoring display: ${err.message}`);
      }
    }
  });
  
  // Fetch content when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchContent();
      
      // If display is already monitored, refresh it
      if (displayPollingService.isMonitoring(display.id)) {
        refreshDisplay();
      }
    }
  }, [isOpen, display.id, refreshDisplay]);
  
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
      console.error('[PushContentDialog] ❌ Error fetching content:', err);
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
  
  // Handle schedule changes from ScheduleEditor
  const handleScheduleChange = (updatedSchedule: Schedule) => {
    setScheduleData(updatedSchedule);
  };
  
  // Handle pushing content to display
  const handlePushContent = async () => {
    if (!selectedContentId) {
      toast.error('Please select content to push');
      return;
    }
    
    // Update contentId in schedule
    if (scheduleEnabled) {
      setScheduleData(prev => ({
        ...prev,
        contentId: selectedContentId
      }));
    }
    
    setPushSuccess(false);
    setIsPushing(true);
    
    try {
      const selectedContent = contentList.find(content => content.id === selectedContentId);
      
      if (!selectedContent) {
        throw new Error('Selected content not found');
      }
      
      // Show "pushing" toast
      const pushingToast = toast.loading(`Pushing "${selectedContent.title}" to ${display.name}...`);
      
      try {
        // Prepare schedule data if enabled
        const schedulePayload = scheduleEnabled ? {
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          repeat: scheduleData.repeat,
          priority: scheduleData.priority,
          name: scheduleData.name
        } : undefined;
        
        // Call API with schedule data if present
        const result = await contentService.pushContentToDisplay(
          selectedContentId, 
          display.id,
          schedulePayload
        );
        
        // Update toast
        toast.success(`Content pushed to ${display.name}`, { id: pushingToast });
        
        console.log('[PushContentDialog] ✅ Content push success:', result);
        
        // Set success state but don't close dialog yet
        // We'll wait for the display monitor to confirm the update
        setPushSuccess(true);
        
        // If we don't have a display monitor, close the dialog after a delay
        if (!monitoredDisplay || !isPolling) {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } catch (pushError) {
        console.error('[PushContentDialog] ❌ Push error:', pushError);
        toast.error(`Error pushing content: ${
          pushError instanceof Error ? pushError.message : 'Unknown error'
        }`, { id: pushingToast });
        
        setPushSuccess(false);
      }
    } catch (error) {
      console.error('[PushContentDialog] ❌ Error in push handling:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          thumbnail: fileType === 'image' ? URL.createObjectURL(uploadFile) : '/assets/file-placeholder.svg',
          status: 'active' as const,
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
        setIsPushing(true);
        await contentService.pushContentToDisplay(newContent.id, display.id);
        
        // Force a refresh of the display data
        refreshDisplay();
        
        // Clear progress interval if it's still running
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        // Dismiss the upload toast and show success
        toast.dismiss(uploadToast);
        toast.success(`Content "${uploadTitle}" uploaded and pushed to "${display.name}" successfully`);
        
        // Set success flag
        setPushSuccess(true);
        setIsPushing(false);
        
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
  
  // Replace the renderScheduleOptions function with using ScheduleEditor
  const renderScheduleOptions = () => {
    if (!scheduleEnabled) {
      return (
        <div className="p-4 border border-gray-200 rounded-md mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enable-schedule"
                checked={scheduleEnabled}
                onChange={() => setScheduleEnabled(!scheduleEnabled)}
                className="mr-2"
              />
              <label htmlFor="enable-schedule" className="text-sm font-medium">
                Schedule this content
              </label>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="border border-gray-200 rounded-md p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <label htmlFor="enable-schedule" className="text-sm font-medium">
            Schedule this content
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enable-schedule"
              checked={scheduleEnabled}
              onChange={() => setScheduleEnabled(!scheduleEnabled)}
              className="mr-2"
            />
            <button
              onClick={() => setScheduleEnabled(false)}
              className="text-xs text-red-600"
            >
              Remove Schedule
            </button>
          </div>
        </div>
        
        <ScheduleEditor
          schedule={scheduleData}
          onSave={handleScheduleChange}
          onValidationError={(result) => {
            if (result.errors && result.errors.length > 0) {
              toast.error(result.errors[0]);
            }
          }}
        />
      </div>
    );
  };
  
  // Modify the library tab content to include scheduling toggle
  const renderLibraryTabContent = () => {
    return (
      <>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search content..."
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            disabled={isLoading || isPushing}
          />
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="py-4 text-center text-red-500">{error}</div>
        ) : filteredContent.length === 0 ? (
          <div className="py-4 text-center text-gray-500">No content found</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-96">
            {filteredContent.map(content => (
              <div
                key={content.id}
                className={`relative border rounded-md overflow-hidden cursor-pointer transition-all
                  ${selectedContentId === content.id ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}`}
                onClick={() => setSelectedContentId(content.id)}
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  {content.thumbnail ? (
                    <img
                      src={content.thumbnail}
                      alt={content.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-3xl text-gray-400">
                      {getContentTypeIcon(content.type)}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-xs font-medium truncate">{content.title}</div>
                  <div className="text-xs text-gray-500 capitalize">{content.type}</div>
                </div>
                {selectedContentId === content.id && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {renderScheduleOptions()}
      </>
    );
  };
  
  // Update the rendering to include the new tabs
  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <Dialog.Panel className="w-full max-w-3xl bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-semibold">
              Push Content to: {display.name}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-4">
            <div className="mb-4">
              <div className="flex border-b">
                <button
                  className={`px-4 py-2 font-medium text-sm ${
                    selectedTab === 'library' 
                      ? 'text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setSelectedTab('library')}
                  disabled={isPushing}
                >
                  Content Library
                </button>
                <button
                  className={`px-4 py-2 font-medium text-sm ${
                    selectedTab === 'upload' 
                      ? 'text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setSelectedTab('upload')}
                  disabled={isPushing}
                >
                  Upload New
                </button>
              </div>
            </div>
            
            {selectedTab === 'library' ? (
              renderLibraryTabContent()
            ) : (
              /* Upload tab content */
              <div className="mt-4">
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,video/*,.html,.htm"
                    disabled={isPushing}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-600">
                      {uploadFile ? uploadFile.name : "Click to select a file"}
                    </span>
                    {!uploadFile && (
                      <span className="mt-1 text-xs text-gray-500">
                        Supports images, videos, and HTML content
                      </span>
                    )}
                  </label>
                  {uploadFile && (
                    <button
                      type="button"
                      className="mt-3 text-xs text-red-600 hover:text-red-800"
                      onClick={() => setUploadFile(null)}
                      disabled={isPushing}
                    >
                      Remove file
                    </button>
                  )}
                </div>
                {/* Schedule options for upload */}
                {uploadFile && renderScheduleOptions()}
              </div>
            )}
            
            {/* Connection status indicator for polling/WebSocket */}
            {isPolling && (
              <div className="flex items-center text-xs text-yellow-600 mt-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a1 1 0 011.414 0 9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Using polling fallback (WebSocket unavailable)
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-4">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={onClose}
                disabled={isPushing}
              >
                Cancel
              </button>
              
              <button
                type="button"
                className={`px-4 py-2 rounded-md text-sm font-medium text-white
                  ${selectedTab === 'library' 
                    ? (selectedContentId 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-blue-400 cursor-not-allowed') 
                    : (uploadFile 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-blue-400 cursor-not-allowed')
                  }`}
                onClick={selectedTab === 'library' ? handlePushContent : handleUploadAndPush}
                disabled={isPushing || (selectedTab === 'library' ? !selectedContentId : !uploadFile)}
              >
                {isPushing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Pushing...
                  </>
                ) : (
                  `Push ${selectedTab === 'library' ? 'Content' : 'Upload'}`
                )}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}; 