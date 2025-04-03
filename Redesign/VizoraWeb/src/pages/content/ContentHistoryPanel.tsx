import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ArrowPathIcon, ClockIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { ContentItem } from './ContentPage';

interface ContentVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  changeDescription?: string;
  previewUrl?: string;
}

interface ContentHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentItem;
  onRevertToVersion?: (versionId: string) => Promise<void>;
}

const ContentHistoryPanel: React.FC<ContentHistoryPanelProps> = ({
  isOpen,
  onClose,
  content,
  onRevertToVersion
}) => {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  
  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      
      try {
        // In a real app, this would call an API
        // const response = await fetch(`/api/content/${content.id}/versions`);
        // const data = await response.json();
        
        // For demo purposes, we'll create mock data
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockVersions = generateMockVersions();
        setVersions(mockVersions);
        
        // Pre-select the latest version
        if (mockVersions.length > 0) {
          setSelectedVersion(mockVersions[0]);
        }
      } catch (error) {
        console.error('Error fetching versions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen) {
      fetchVersions();
    }
  }, [content.id, isOpen]);
  
  const generateMockVersions = (): ContentVersion[] => {
    const currentVersion: ContentVersion = {
      id: `${content.id}-v${content.version || 1}`,
      versionNumber: content.version || 1,
      createdAt: content.updatedAt,
      createdBy: content.owner || 'Admin User',
      changeDescription: 'Current version',
      previewUrl: content.url
    };
    
    const versions: ContentVersion[] = [currentVersion];
    
    // Generate previous versions
    const versionCount = Math.floor(Math.random() * 5) + 1;
    
    for (let i = currentVersion.versionNumber - 1; i > currentVersion.versionNumber - versionCount - 1 && i > 0; i--) {
      const date = new Date(content.createdAt);
      date.setDate(date.getDate() - (currentVersion.versionNumber - i));
      
      versions.push({
        id: `${content.id}-v${i}`,
        versionNumber: i,
        createdAt: date.toISOString(),
        createdBy: content.owner || 'Admin User',
        changeDescription: getRandomChangeDescription(),
        previewUrl: i === currentVersion.versionNumber - 1 ? content.url : undefined
      });
    }
    
    return versions;
  };
  
  const getRandomChangeDescription = (): string => {
    const descriptions = [
      'Updated content metadata',
      'Modified image dimensions',
      'Changed content title',
      'Updated description',
      'Cropped image',
      'Adjusted brightness and contrast',
      'Added new text overlay',
      'Updated to higher resolution',
      'Compressed for better performance',
      'Initial upload'
    ];
    
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  };
  
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };
  
  const handleRevertToVersion = async (version: ContentVersion) => {
    if (!onRevertToVersion || version.versionNumber === content.version) {
      return;
    }
    
    setIsReverting(true);
    
    try {
      await onRevertToVersion(version.id);
      onClose();
    } catch (error) {
      console.error('Error reverting to version:', error);
    } finally {
      setIsReverting(false);
    }
  };
  
  const renderPreview = (version: ContentVersion) => {
    if (!version.previewUrl && content.type === 'image') {
      return (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-gray-100">
          <div className="text-center">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              Preview not available for this version
            </p>
          </div>
        </div>
      );
    }
    
    switch (content.type) {
      case 'image':
        return (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
            {version.previewUrl ? (
              <img
                src={version.previewUrl}
                alt={`Version ${version.versionNumber}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-gray-500">No preview available</p>
              </div>
            )}
          </div>
        );
      case 'video':
        return (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
            {version.previewUrl ? (
              <video
                src={version.previewUrl}
                controls
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-gray-500">No preview available</p>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-gray-100">
            <div className="text-center">
              <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">
                Preview not available for this content type
              </p>
            </div>
          </div>
        );
    }
  };
  
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <div className="fixed inset-0" />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col divide-y divide-gray-200 bg-white shadow-xl">
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-scroll py-6">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-between">
                          <Dialog.Title className="text-lg font-medium text-gray-900">
                            Content History
                          </Dialog.Title>
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={onClose}
                            >
                              <span className="sr-only">Close panel</span>
                              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="relative mt-6 flex-1 px-4 sm:px-6">
                        {isLoading ? (
                          <div className="flex h-full items-center justify-center">
                            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="ml-2 text-sm text-gray-500">Loading version history...</span>
                          </div>
                        ) : (
                          <div className="space-y-8">
                            {/* Version list */}
                            <div>
                              <h3 className="text-sm font-medium text-gray-500">Versions</h3>
                              <ul className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
                                {versions.map((version) => (
                                  <li key={version.id}>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedVersion(version)}
                                      className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${
                                        selectedVersion?.id === version.id ? 'bg-blue-50' : ''
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className={`text-sm font-medium ${
                                            version.versionNumber === content.version ? 'text-blue-600' : 'text-gray-900'
                                          }`}>
                                            Version {version.versionNumber}
                                            {version.versionNumber === content.version && ' (Current)'}
                                          </p>
                                          <p className="mt-1 text-xs text-gray-500">
                                            {formatDate(version.createdAt)} by {version.createdBy}
                                          </p>
                                        </div>
                                        {selectedVersion?.id === version.id && (
                                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                        )}
                                      </div>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            {/* Selected version details */}
                            {selectedVersion && (
                              <div>
                                <h3 className="text-sm font-medium text-gray-500">Version {selectedVersion.versionNumber} Details</h3>
                                <div className="mt-2 space-y-4">
                                  {/* Version preview */}
                                  <div>
                                    <h4 className="text-xs font-medium text-gray-500">Preview</h4>
                                    <div className="mt-1">
                                      {renderPreview(selectedVersion)}
                                    </div>
                                  </div>
                                  
                                  {/* Version details */}
                                  <div className="space-y-2">
                                    <div>
                                      <h4 className="text-xs text-gray-500">Created</h4>
                                      <p className="mt-1 text-sm text-gray-700">{formatDate(selectedVersion.createdAt)}</p>
                                    </div>
                                    
                                    <div>
                                      <h4 className="text-xs text-gray-500">By</h4>
                                      <p className="mt-1 text-sm text-gray-700">{selectedVersion.createdBy}</p>
                                    </div>
                                    
                                    {selectedVersion.changeDescription && (
                                      <div>
                                        <h4 className="text-xs text-gray-500">Changes</h4>
                                        <p className="mt-1 text-sm text-gray-700">{selectedVersion.changeDescription}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {selectedVersion && onRevertToVersion && selectedVersion.versionNumber !== content.version && (
                      <div className="flex flex-shrink-0 justify-end px-4 py-4">
                        <button
                          type="button"
                          onClick={() => handleRevertToVersion(selectedVersion)}
                          disabled={isReverting}
                          className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          {isReverting ? (
                            <>
                              <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                              Reverting...
                            </>
                          ) : (
                            <>
                              <ArrowUturnLeftIcon className="-ml-1 mr-2 h-4 w-4" />
                              Revert to This Version
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default ContentHistoryPanel; 