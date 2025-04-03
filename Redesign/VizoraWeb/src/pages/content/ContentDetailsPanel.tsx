import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PencilIcon, TrashIcon, EyeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { ContentItem } from './ContentPage';
import contentService from '../../services/contentService';
import { toast } from 'react-hot-toast';

interface ContentDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentItem;
  onContentUpdated: (content: ContentItem) => void;
  onContentDeleted: (id: string) => void;
}

export const ContentDetailsPanel: React.FC<ContentDetailsPanelProps> = ({
  isOpen,
  onClose,
  content,
  onContentUpdated,
  onContentDeleted
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editedContent, setEditedContent] = useState<ContentItem>(content);
  
  // Reset edit state when content changes
  React.useEffect(() => {
    setEditedContent(content);
    setIsEditing(false);
  }, [content]);
  
  const handleSave = async () => {
    setIsLoading(true);
    
    try {
      // In a real app, this would call the API
      // const response = await contentService.updateContent(content.id, editedContent);
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update with the "response" data
      onContentUpdated({
        ...editedContent,
        updatedAt: new Date().toISOString()
      });
      
      setIsEditing(false);
      toast.success('Content updated successfully');
    } catch (error) {
      console.error('Error updating content:', error);
      toast.error('Failed to update content');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this content?')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real app, this would call the API
      // await contentService.deleteContent(content.id);
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onContentDeleted(content.id);
      toast.success('Content deleted successfully');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedContent(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };
  
  const renderPreview = () => {
    switch (content.type) {
      case 'image':
        return (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
            {content.url ? (
              <img
                src={content.url}
                alt={content.title}
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
            {content.url ? (
              <video
                src={content.url}
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
      case 'webpage':
        return (
          <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-gray-200">
            {content.url ? (
              <iframe
                src={content.url}
                title={content.title}
                className="h-full w-full"
                sandbox="allow-same-origin allow-scripts"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-100">
                <p className="text-sm text-gray-500">No preview available</p>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-gray-100">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <EyeIcon className="h-12 w-12" />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Preview not available for this content type
              </p>
              <a
                href={content.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Open in new tab
              </a>
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
                            {isEditing ? 'Edit Content' : 'Content Details'}
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
                        {!isEditing ? (
                          <div className="space-y-6">
                            {/* Preview */}
                            <div>
                              <h3 className="text-sm font-medium text-gray-500">Preview</h3>
                              <div className="mt-2">
                                {renderPreview()}
                              </div>
                            </div>
                            
                            {/* Basic details */}
                            <div>
                              <h3 className="text-sm font-medium text-gray-500">Details</h3>
                              <div className="mt-2 space-y-4">
                                <div>
                                  <h4 className="text-xs text-gray-500">Title</h4>
                                  <p className="mt-1 text-sm font-medium text-gray-900">{content.title}</p>
                                </div>
                                
                                {content.description && (
                                  <div>
                                    <h4 className="text-xs text-gray-500">Description</h4>
                                    <p className="mt-1 text-sm text-gray-700">{content.description}</p>
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="text-xs text-gray-500">Type</h4>
                                    <p className="mt-1 text-sm text-gray-700 capitalize">{content.type}</p>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-xs text-gray-500">Status</h4>
                                    <span className={`mt-1 inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                      content.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {content.status}
                                    </span>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-xs text-gray-500">Size</h4>
                                    <p className="mt-1 text-sm text-gray-700">{formatFileSize(content.size)}</p>
                                  </div>
                                  
                                  {content.duration && (
                                    <div>
                                      <h4 className="text-xs text-gray-500">Duration</h4>
                                      <p className="mt-1 text-sm text-gray-700">{content.duration}s</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Tags */}
                            {content.tags && content.tags.length > 0 && (
                              <div>
                                <h3 className="text-sm font-medium text-gray-500">Tags</h3>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {content.tags.map(tag => (
                                    <span 
                                      key={tag} 
                                      className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Metadata */}
                            <div>
                              <h3 className="text-sm font-medium text-gray-500">Metadata</h3>
                              <div className="mt-2 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="text-xs text-gray-500">Created</h4>
                                    <p className="mt-1 text-sm text-gray-700">{formatDate(content.createdAt)}</p>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-xs text-gray-500">Updated</h4>
                                    <p className="mt-1 text-sm text-gray-700">{formatDate(content.updatedAt)}</p>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-xs text-gray-500">Owner</h4>
                                    <p className="mt-1 text-sm text-gray-700">{content.owner}</p>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-xs text-gray-500">ID</h4>
                                    <p className="mt-1 text-sm text-gray-700 truncate">{content.id}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div>
                              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                                Title <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                id="title"
                                name="title"
                                value={editedContent.title}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                required
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
                                value={editedContent.description || ''}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                            
                            <div>
                              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                                Status
                              </label>
                              <select
                                id="status"
                                name="status"
                                value={editedContent.status}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              >
                                <option value="published">Published</option>
                                <option value="draft">Draft</option>
                                <option value="archived">Archived</option>
                              </select>
                            </div>
                            
                            <div>
                              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                                Type
                              </label>
                              <select
                                id="type"
                                name="type"
                                value={editedContent.type}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              >
                                <option value="image">Image</option>
                                <option value="video">Video</option>
                                <option value="document">Document</option>
                                <option value="webpage">Webpage</option>
                                <option value="playlist">Playlist</option>
                                <option value="stream">Stream</option>
                                <option value="app">App</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 justify-end px-4 py-4">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            disabled={isLoading}
                            className="mr-4 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={isLoading}
                            className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            {isLoading ? (
                              <>
                                <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                Saving...
                              </>
                            ) : 'Save'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="mr-4 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            <PencilIcon className="-ml-1 mr-2 h-4 w-4 text-gray-500" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isLoading}
                            className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          >
                            {isLoading ? (
                              <>
                                <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <TrashIcon className="-ml-1 mr-2 h-4 w-4" />
                                Delete
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
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