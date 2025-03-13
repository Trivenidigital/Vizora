import React, { useState, useEffect } from 'react';
import { Plus, Image as ImageIcon } from 'lucide-react';
import AddDisplayModal from '../components/displays/AddDisplayModal';
import { contentService, ContentUpdate } from "../services/contentService";

interface Display {
  displayId: string;
  name: string;
  status: 'Connected' | 'Disconnected';
}

interface ContentItem {
  id: number;
  title: string;
  type: string;
  duration: string;
  size: string;
  thumbnail: React.ReactNode;
  lastModified: string;
  tags: string[];
  aiGenerated?: boolean;
  url?: string;
}

interface DisplaysProps {
  initialAddModalOpen?: boolean;
}

// Mock content items - in a real app, this would come from an API
const contentItems: ContentItem[] = [
  {
    id: 1,
    title: 'Welcome Image',
    type: 'image',
    duration: 'N/A',
    size: '2.5MB',
    thumbnail: <ImageIcon className="h-8 w-8 text-gray-400" />,
    lastModified: '2 days ago',
    tags: ['welcome', 'image'],
    aiGenerated: true,
    url: 'https://example.com/welcome.jpg'
  },
  {
    id: 2,
    title: 'Product Image',
    type: 'image',
    duration: 'N/A',
    size: '1.8MB',
    thumbnail: <ImageIcon className="h-8 w-8 text-gray-400" />,
    lastModified: '1 week ago',
    tags: ['product', 'image'],
    aiGenerated: false,
    url: 'https://example.com/product.jpg'
  }
];

const Displays: React.FC<DisplaysProps> = ({ initialAddModalOpen = false }) => {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialAddModalOpen);
  const [selectedDisplay, setSelectedDisplay] = useState<Display | null>(null);
  const [contentType, setContentType] = useState<'image' | 'video' | 'text' | 'html'>('text');
  const [content, setContent] = useState('');
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [availableImages, setAvailableImages] = useState<ContentItem[]>([]);

  useEffect(() => {
    // Filter content items to only show images
    const images = contentItems.filter(item => item.type === 'image');
    setAvailableImages(images);
  }, []);

  const handleDisplayAdded = (display: Display) => {
    setDisplays(prev => [...prev, display]);
    setIsAddModalOpen(false);
  };

  const handlePushContent = async () => {
    if (!selectedDisplay) return;

    setPushError(null);
    setIsPushing(true);

    try {
      const contentUpdate: ContentUpdate = {
        type: contentType,
        content: {}
      };

      switch (contentType) {
        case 'image':
          if (!content) {
            throw new Error('Please select an image from the library');
          }
          contentUpdate.content.url = content;
          break;
        case 'video':
          if (!content) {
            throw new Error('Please enter a URL for the video');
          }
          contentUpdate.content.url = content;
          break;
        case 'text':
          if (!content) {
            throw new Error('Please enter some text content');
          }
          contentUpdate.content.text = content;
          contentUpdate.content.fontSize = '24px';
          break;
        case 'html':
          if (!content) {
            throw new Error('Please enter some HTML content');
          }
          contentUpdate.content.html = content;
          break;
      }

      console.log('Pushing content to display:', selectedDisplay.displayId);
      const success = await contentService.pushContent(selectedDisplay.displayId, contentUpdate);
      
      if (success) {
        setIsContentModalOpen(false);
        setContent('');
        alert('Content pushed successfully!');
      } else {
        throw new Error('Failed to push content');
      }
    } catch (error) {
      console.error('Error pushing content:', error);
      setPushError(error instanceof Error ? error.message : 'Failed to push content');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Displays</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Display
        </button>
      </div>

      {/* Display List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displays.map((display) => (
          <div key={display.displayId} className="card p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">{display.name}</h3>
              <span className={`px-2 py-1 rounded text-sm ${
                display.status === 'Connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {display.status}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedDisplay(display);
                setIsContentModalOpen(true);
              }}
              className="btn btn-secondary w-full"
            >
              Push Content
            </button>
          </div>
        ))}
      </div>

      {/* Add Display Modal */}
      {isAddModalOpen && (
        <AddDisplayModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onDisplayAdded={handleDisplayAdded}
        />
      )}

      {/* Content Push Modal */}
      {isContentModalOpen && selectedDisplay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Push Content to {selectedDisplay.name}</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentUpdate['type'])}
                className="w-full p-2 border rounded"
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="html">HTML</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              {contentType === 'image' ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-2">Select an image from the library:</p>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {availableImages.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => setContent(image.url || '')}
                        className={`p-2 border rounded cursor-pointer ${
                          content === image.url ? 'border-primary-500 bg-primary-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <ImageIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm truncate">{image.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : contentType === 'text' ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={4}
                  placeholder="Enter text content..."
                />
              ) : contentType === 'video' ? (
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Enter video URL..."
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={4}
                  placeholder="Enter HTML content..."
                />
              )}
            </div>

            {pushError && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                {pushError}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsContentModalOpen(false);
                  setPushError(null);
                }}
                className="btn btn-secondary"
                disabled={isPushing}
              >
                Cancel
              </button>
              <button
                onClick={handlePushContent}
                className="btn btn-primary"
                disabled={isPushing || !content}
              >
                {isPushing ? 'Pushing...' : 'Push Content'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Displays;
