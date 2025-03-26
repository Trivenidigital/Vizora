import React from 'react';
import { useState, Fragment, useRef, useEffect } from 'react';
import { 
  FolderOpen, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Image, 
  Video, 
  FileText, 
  Zap, 
  Calendar,
  Eye,
  Edit,
  Trash2,
  Download,
  Share2,
  Upload,
  Send
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import PlaceholderImage from '../components/ui/PlaceholderImage';
import { useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, Radio, RadioGroup, Spinner, useToast, Box, Text } from '@chakra-ui/react';
import { authFetch, API_URL } from '../utils/auth';
import { getContentService, ContentUpdate } from '../services/contentService';

interface Display {
  _id: string;
  displayId: string;
  name: string;
  status: string;
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
  url?: string; // For images/videos
  content?: string; // For text/html
}

interface ContentLibraryProps {
  upload?: boolean;
}

// Mock Data
const contentItems: ContentItem[] = [
  {
    id: 1,
    title: 'Welcome Video',
    type: 'video',
    duration: '2:30',
    size: '45MB',
    thumbnail: <PlaceholderImage width={300} height={200} text="Welcome Video" />,
    lastModified: '2 days ago',
    tags: ['welcome', 'video'],
    aiGenerated: true,
    url: 'https://www.w3schools.com/html/mov_bbb.mp4'
  },
  {
    id: 2,
    title: 'Product Showcase',
    type: 'video',
    duration: '5:45',
    size: '120MB',
    thumbnail: <PlaceholderImage width={300} height={200} text="Product Showcase" />,
    lastModified: '1 week ago',
    tags: ['product', 'showcase'],
    aiGenerated: false,
    url: 'https://www.w3schools.com/html/mov_bbb.mp4'
  },
  {
    id: 3,
    title: 'Company Logo',
    type: 'image',
    duration: 'N/A',
    size: '250KB',
    thumbnail: <PlaceholderImage width={300} height={200} text="Company Logo" />,
    lastModified: '1 month ago',
    tags: ['logo', 'branding'],
    url: 'https://via.placeholder.com/800x600.png?text=Company+Logo'
  },
  {
    id: 4,
    title: 'Welcome Message',
    type: 'text',
    duration: 'N/A',
    size: '1KB',
    thumbnail: <PlaceholderImage width={300} height={200} text="Welcome Message" />,
    lastModified: '2 weeks ago',
    tags: ['welcome', 'message'],
    content: 'Welcome to our store! Please let us know if you need any assistance.'
  }
];

interface PushToDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentItem: ContentItem | null;
  onPush: (displayId: string) => Promise<void>;
  isPushing: boolean;
}

const PushToDisplayModal: React.FC<PushToDisplayModalProps> = ({ 
  isOpen, 
  onClose, 
  contentItem, 
  onPush,
  isPushing
}) => {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      fetchDisplays();
    }
  }, [isOpen]);
  
  const fetchDisplays = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authFetch(`${API_URL}/displays`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch displays');
      }
      
      const data = await response.json();
      const availableDisplays = (data.data.displays || []).filter(
        (d: Display) => d.status === 'connected' || d.status === 'paired'
      );
      
      setDisplays(availableDisplays);
      
      if (availableDisplays.length > 0) {
        setSelectedDisplayId(availableDisplays[0].displayId);
      }
    } catch (error) {
      console.error('Error fetching displays:', error);
      setError('Failed to load displays. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePush = async () => {
    if (!selectedDisplayId) {
      setError('Please select a display');
      return;
    }
    
    await onPush(selectedDisplayId);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Push Content to Display
          {contentItem && (
            <Text fontSize="sm" color="gray.600" fontWeight="normal" mt={1}>
              {contentItem.title}
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isLoading ? (
            <Box textAlign="center" py={6}>
              <Spinner size="lg" />
              <Text mt={2}>Loading displays...</Text>
            </Box>
          ) : error ? (
            <Box textAlign="center" py={6} color="red.500">
              <Text>{error}</Text>
              <Button mt={4} size="sm" onClick={fetchDisplays}>Try Again</Button>
            </Box>
          ) : displays.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Text>No available displays found.</Text>
              <Text mt={2} fontSize="sm" color="gray.500">
                Please make sure you have connected displays in your account.
              </Text>
            </Box>
          ) : (
            <>
              <Text mb={4}>Select a display to push this content to:</Text>
              <RadioGroup value={selectedDisplayId} onChange={setSelectedDisplayId}>
                <VStack align="start" spacing={3}>
                  {displays.map(display => (
                    <Radio key={display.displayId} value={display.displayId}>
                      {display.name || display.displayId} 
                      <Text as="span" fontSize="sm" color="gray.500" ml={1}>
                        ({display.status})
                      </Text>
                    </Radio>
                  ))}
                </VStack>
              </RadioGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handlePush}
            isDisabled={displays.length === 0 || !selectedDisplayId || isPushing}
            isLoading={isPushing}
            leftIcon={<Send size={16} />}
          >
            Push Content
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const ContentLibrary: React.FC<ContentLibraryProps> = ({ upload = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Filter content based on search and type
  const filteredContent = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || item.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handlePushContent = (content: ContentItem) => {
    setSelectedContent(content);
    onOpen();
  };

  const pushContentToDisplay = async (displayId: string) => {
    if (!selectedContent) return;
    
    setIsPushing(true);
    
    try {
      const contentService = getContentService();
      let contentUpdate: ContentUpdate;
      
      switch (selectedContent.type) {
        case 'image':
          contentUpdate = {
            type: 'image',
            content: {
              url: selectedContent.url
            }
          };
          break;
          
        case 'video':
          contentUpdate = {
            type: 'video',
            content: {
              url: selectedContent.url
            }
          };
          break;
          
        case 'text':
          contentUpdate = {
            type: 'text',
            content: {
              text: selectedContent.content,
              fontSize: '24px',
              bgColor: '#ffffff',
              textColor: '#000000'
            }
          };
          break;
          
        case 'html':
          contentUpdate = {
            type: 'html',
            content: {
              html: selectedContent.content
            }
          };
          break;
          
        default:
          throw new Error(`Unsupported content type: ${selectedContent.type}`);
      }
      
      // Try to push content with retry
      let retryCount = 0;
      const maxRetries = 2;
      let success = false;
      let lastError: Error | null = null;
      
      while (!success && retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`Retrying content push (attempt ${retryCount} of ${maxRetries})...`);
          }
          
          success = await contentService.pushContent(displayId, contentUpdate);
          
          if (!success) {
            throw new Error('Server returned failure response');
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error during push');
          console.error(`Push attempt ${retryCount + 1} failed:`, error);
          retryCount++;
          
          if (retryCount <= maxRetries) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!success) {
        throw lastError || new Error('Failed to push content to display');
      }
      
      toast({
        title: 'Content Pushed',
        description: `Successfully pushed "${selectedContent.title}" to display`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      onClose();
    } catch (error) {
      console.error('Error pushing content to display:', error);
      
      toast({
        title: 'Push Failed',
        description: error instanceof Error ? error.message : 'An error occurred while pushing content',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsPushing(false);
    }
  };

  if (upload) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Upload Content</h1>
              <Link 
                to="/content" 
                className="px-4 py-2 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 transition-colors flex items-center"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Back to Library
              </Link>
            </div>
            
            <form>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type
                </label>
                <div className="flex space-x-4">
                  <button 
                    type="button" 
                    className="flex items-center px-4 py-2 border border-blue-500 rounded-md text-blue-500 hover:bg-blue-50"
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Image
                  </button>
                  <button 
                    type="button" 
                    className="flex items-center px-4 py-2 border border-blue-500 rounded-md text-blue-500 hover:bg-blue-50"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Video
                  </button>
                  <button 
                    type="button" 
                    className="flex items-center px-4 py-2 border border-blue-500 rounded-md text-blue-500 hover:bg-blue-50"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    HTML/Text
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter content title"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (separated by commas)
                </label>
                <input
                  type="text"
                  id="tags"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. welcome, promotional, seasonal"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                      </svg>
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        SVG, PNG, JPG, GIF, MP4, WEBM, HTML (MAX. 100MB)
                      </p>
                    </div>
                    <input type="file" className="hidden" />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Upload Content
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <div className="flex space-x-4">
            <Link
              to="/content/upload"
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Content
            </Link>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md ${
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex space-x-4">
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="video">Videos</option>
            <option value="image">Images</option>
            <option value="text">Text</option>
            <option value="html">HTML</option>
          </select>
        </div>

        {/* Content Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((item) => (
              <div key={item.id} className="bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="relative h-40 bg-secondary-100">
                  {item.thumbnail}
                  {item.aiGenerated && (
                    <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-md flex items-center">
                      <span className="mr-1">AI</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-secondary-900 truncate">{item.title}</h3>
                  <div className="flex items-center justify-between text-xs text-secondary-500">
                    <span>{item.duration}</span>
                    <span>{item.size}</span>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                      onClick={() => handlePushContent(item)}
                    >
                      <Send size={14} className="mr-1" />
                      Push to Display
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContent.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">{item.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{item.size}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        onClick={() => handlePushContent(item)}
                      >
                        <Send size={14} className="mr-1" />
                        Push
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PushToDisplayModal
        isOpen={isOpen}
        onClose={onClose}
        contentItem={selectedContent}
        onPush={pushContentToDisplay}
        isPushing={isPushing}
      />
    </div>
  );
};

export default ContentLibrary;
