import { useState, useEffect } from 'react';
import { 
  DocumentIcon, 
  PhotoIcon, 
  FilmIcon, 
  GlobeAltIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { Content as ContentType, contentService } from '@vizora/common';
import { formatDistanceToNow } from 'date-fns';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';

// Helper function to format file size
const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Maps content types to their respective icons
const CONTENT_TYPE_ICONS = {
  'image': PhotoIcon,
  'video': FilmIcon,
  'document': DocumentIcon,
  'webpage': GlobeAltIcon,
  'default': DocumentIcon,
} as const;

interface ContentCardProps {
  content: ContentType;
  onPreview: (content: ContentType) => void;
  onRename: (content: ContentType) => void;
  onDelete: (contentId: string) => void;
}

const ContentCard: React.FC<ContentCardProps> = ({ 
  content, 
  onPreview, 
  onRename, 
  onDelete 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(content.thumbnail);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  
  // Determine the icon to use based on content type
  const IconComponent = content.type && CONTENT_TYPE_ICONS[content.type as keyof typeof CONTENT_TYPE_ICONS] 
    ? CONTENT_TYPE_ICONS[content.type as keyof typeof CONTENT_TYPE_ICONS] 
    : CONTENT_TYPE_ICONS.default;
  
  // Format the creation date
  const formattedDate = content.createdAt 
    ? formatDistanceToNow(new Date(content.createdAt), { addSuffix: true }) 
    : 'Unknown date';
  
  // Load cached thumbnail if available
  useEffect(() => {
    const loadCachedThumbnail = async () => {
      if (!content.id || !content.thumbnail) return;
      
      try {
        setIsLoadingThumbnail(true);
        const cachedUrl = await contentService.getThumbnailUrl(content.id, content.thumbnail);
        if (cachedUrl) {
          setThumbnailUrl(cachedUrl);
          setThumbnailError(false);
        }
      } catch (error) {
        console.error('Error loading cached thumbnail:', error);
        setThumbnailError(true);
      } finally {
        setIsLoadingThumbnail(false);
      }
    };
    
    loadCachedThumbnail();
  }, [content.id, content.thumbnail]);
  
  // Handle thumbnail load error
  const handleThumbnailError = () => {
    setThumbnailError(true);
    setThumbnailUrl(undefined);
  };
  
  return (
    <div 
      className="group relative bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail or placeholder */}
      <div className="aspect-square relative overflow-hidden bg-gray-100">
        {!thumbnailError && thumbnailUrl ? (
          <img 
            src={thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover"
            onError={handleThumbnailError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconComponent className="h-16 w-16 text-gray-400" />
          </div>
        )}
        
        {/* Loading indicator for thumbnail */}
        {isLoadingThumbnail && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70">
            <div className="h-8 w-8 border-4 border-gray-300 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Preview overlay button */}
        <div className={`
          absolute inset-0 flex items-center justify-center bg-black bg-opacity-40
          transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          <button
            onClick={() => onPreview(content)}
            className="p-2 bg-white rounded-full hover:bg-gray-100"
            aria-label="Preview content"
          >
            <EyeIcon className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>
      
      {/* Content details */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate" title={content.title}>
              {content.title}
            </h3>
            <p className="mt-1 text-xs text-gray-500 truncate">
              {formattedDate}
              {content.size && ` • ${formatFileSize(content.size)}`}
            </p>
          </div>
          
          {/* Actions menu */}
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="-m-2 p-2 rounded-full text-gray-400 hover:text-gray-600 focus:outline-none">
                <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
              </Menu.Button>
            </div>
            
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => onPreview(content)}
                      className={`
                        flex w-full items-center px-4 py-2 text-sm 
                        ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}
                      `}
                    >
                      <EyeIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                      Preview
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => onRename(content)}
                      className={`
                        flex w-full items-center px-4 py-2 text-sm 
                        ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}
                      `}
                    >
                      <PencilIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                      Rename
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => onDelete(content.id)}
                      className={`
                        flex w-full items-center px-4 py-2 text-sm 
                        ${active ? 'bg-red-50 text-red-700' : 'text-red-600'}
                      `}
                    >
                      <TrashIcon className="mr-3 h-5 w-5 text-red-400" aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
        
        {/* Content type badge */}
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            <IconComponent className="mr-1 h-3 w-3" />
            {content.type?.charAt(0).toUpperCase() + content.type?.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ContentCard; 