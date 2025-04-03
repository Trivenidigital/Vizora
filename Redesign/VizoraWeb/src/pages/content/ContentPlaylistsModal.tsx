import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PlusIcon, CheckIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { ContentItem } from './ContentPage';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  items: string[]; // Content IDs
  createdAt: string;
  updatedAt: string;
}

interface ContentPlaylistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContent: ContentItem[];
  existingPlaylists?: Playlist[];
  onPlaylistsUpdated?: (playlists: Playlist[]) => void;
}

const ContentPlaylistsModal: React.FC<ContentPlaylistsModalProps> = ({
  isOpen,
  onClose,
  selectedContent,
  existingPlaylists = [],
  onPlaylistsUpdated
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>(existingPlaylists);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [addToPlaylistIds, setAddToPlaylistIds] = useState<string[]>([]);
  
  useEffect(() => {
    setPlaylists(existingPlaylists);
  }, [existingPlaylists]);
  
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create a new playlist
      const newPlaylist: Playlist = {
        id: `playlist-${Date.now()}`,
        name: newPlaylistName.trim(),
        items: selectedContent.map(item => item.id),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Update the list of playlists
      const updatedPlaylists = [...playlists, newPlaylist];
      setPlaylists(updatedPlaylists);
      
      // Reset form
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
      
      // Notify parent component
      onPlaylistsUpdated?.(updatedPlaylists);
    } catch (error) {
      console.error('Error creating playlist:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddToExistingPlaylists = async () => {
    if (addToPlaylistIds.length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Update playlists
      const updatedPlaylists = playlists.map(playlist => {
        if (addToPlaylistIds.includes(playlist.id)) {
          // Add selected content to this playlist if not already there
          const newItems = [...playlist.items];
          selectedContent.forEach(content => {
            if (!newItems.includes(content.id)) {
              newItems.push(content.id);
            }
          });
          
          return {
            ...playlist,
            items: newItems,
            updatedAt: new Date().toISOString()
          };
        }
        return playlist;
      });
      
      setPlaylists(updatedPlaylists);
      setAddToPlaylistIds([]);
      
      // Notify parent component
      onPlaylistsUpdated?.(updatedPlaylists);
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Error updating playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove the playlist
      const updatedPlaylists = playlists.filter(p => p.id !== playlistId);
      setPlaylists(updatedPlaylists);
      
      // Update add to playlist selection
      setAddToPlaylistIds(prevIds => prevIds.filter(id => id !== playlistId));
      
      // Notify parent component
      onPlaylistsUpdated?.(updatedPlaylists);
    } catch (error) {
      console.error('Error deleting playlist:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const togglePlaylistSelection = (playlistId: string) => {
    setAddToPlaylistIds(prevIds => {
      if (prevIds.includes(playlistId)) {
        return prevIds.filter(id => id !== playlistId);
      } else {
        return [...prevIds, playlistId];
      }
    });
  };
  
  const isPlaylistSelected = (playlistId: string) => {
    return addToPlaylistIds.includes(playlistId);
  };
  
  const getContentPreviewText = () => {
    if (selectedContent.length === 0) return 'No content selected';
    if (selectedContent.length === 1) return `"${selectedContent[0].title}"`;
    return `${selectedContent.length} items selected`;
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Add to Playlist
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Add {getContentPreviewText()} to an existing playlist or create a new one.
                      </p>
                    </div>
                    
                    <div className="mt-4">
                      <div className="space-y-4">
                        {/* Create new playlist section */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)}
                            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" />
                            Create new playlist
                          </button>
                          
                          {isCreatingPlaylist && (
                            <div className="mt-3 space-y-3">
                              <input
                                type="text"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="Playlist name"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                              
                              <div className="flex space-x-3">
                                <button
                                  type="button"
                                  onClick={handleCreatePlaylist}
                                  disabled={isLoading || !newPlaylistName.trim()}
                                  className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                                >
                                  {isLoading ? (
                                    <>
                                      <ArrowPathIcon className="animate-spin -ml-0.5 mr-2 h-4 w-4" />
                                      Creating...
                                    </>
                                  ) : 'Create'}
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCreatingPlaylist(false);
                                    setNewPlaylistName('');
                                  }}
                                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Existing playlists section */}
                        {playlists.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Existing playlists</h4>
                            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                              {playlists.map((playlist) => (
                                <div 
                                  key={playlist.id} 
                                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                                >
                                  <div className="flex-1">
                                    <button
                                      type="button"
                                      onClick={() => togglePlaylistSelection(playlist.id)}
                                      className="flex items-center w-full text-left"
                                    >
                                      <div 
                                        className={`w-5 h-5 mr-3 rounded border ${
                                          isPlaylistSelected(playlist.id) 
                                            ? 'bg-blue-600 border-blue-600' 
                                            : 'border-gray-300'
                                        } flex items-center justify-center`}
                                      >
                                        {isPlaylistSelected(playlist.id) && (
                                          <CheckIcon className="h-3 w-3 text-white" aria-hidden="true" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{playlist.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {playlist.items.length} {playlist.items.length === 1 ? 'item' : 'items'}
                                        </p>
                                      </div>
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePlaylist(playlist.id)}
                                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleAddToExistingPlaylists}
                    disabled={isLoading || addToPlaylistIds.length === 0}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                        Saving...
                      </>
                    ) : 'Add to selected playlists'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default ContentPlaylistsModal; 