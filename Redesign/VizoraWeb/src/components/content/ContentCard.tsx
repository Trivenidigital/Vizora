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
import { Content, contentService } from '@vizora/common';
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
  content: Content;
  onSelect?: (content: Content) => void;
  onEdit?: (content: Content) => void;
  onDelete?: (contentId: string) => void;
  onMove?: () => void;
  onEnhance?: () => void;
  onSchedule?: () => void;
  onAnalytics?: () => void;
}

export const ContentCard: React.FC<ContentCardProps> = ({ 
  content, 
  onSelect,
  onEdit,
  onDelete,
  onMove,
  onEnhance,
  onSchedule,
  onAnalytics
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  
  // Determine the icon to use based on content type
  const IconComponent = content.type && CONTENT_TYPE_ICONS[content.type as keyof typeof CONTENT_TYPE_ICONS] 
    ? CONTENT_TYPE_ICONS[content.type as keyof typeof CONTENT_TYPE_ICONS] 
    : CONTENT_TYPE_ICONS.default;
  
  // Format the creation date
  const formattedDate = content.createdAt 
    ? formatDistanceToNow(new Date(content.createdAt), { addSuffix: true }) 
    : 'Unknown date';
  
  // Handle thumbnail load error
  const handleThumbnailError = () => {
    setThumbnailError(true);
  };
  
  // Preview handler (calls onSelect if available)
  const handlePreview = () => {
    if (onSelect) {
      onSelect(content);
    }
  };
  
  return (
    <div 
      className="group relative h-full flex flex-col bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail or placeholder */}
      <div className="aspect-square relative overflow-hidden bg-gray-50">
        {!thumbnailError && content.thumbnail ? (
          <img 
            src={content.thumbnail}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={handleThumbnailError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <IconComponent className="h-20 w-20 text-gray-300" />
          </div>
        )}
        
        {/* Preview overlay button */}
        <div className={`
          absolute inset-0 flex items-center justify-center bg-black bg-opacity-30
          transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          <button
            onClick={handlePreview}
            className="p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 transform transition-transform duration-300 hover:scale-110"
            aria-label="Preview content"
          >
            <EyeIcon className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>
      
      {/* Content details */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium text-gray-900 truncate" title={content.title}>
              {content.title}
            </h3>
            <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1.5">
              <span>{formattedDate}</span>
              {content.size && (
                <>
                  <span className="inline-block w-1 h-1 rounded-full bg-gray-300"></span>
                  <span>{formatFileSize(content.size)}</span>
                </>
              )}
            </p>
          </div>
          
          {/* Actions menu */}
          <Menu as="div" className="relative inline-block text-left ml-2">
            <div>
              <Menu.Button className="-m-1.5 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 focus:outline-none">
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
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-xl bg-white py-1.5 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handlePreview}
                      className={`
                        flex w-full items-center px-4 py-2 text-sm 
                        ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}
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
                      onClick={() => onEdit && onEdit(content)}
                      className={`
                        flex w-full items-center px-4 py-2 text-sm 
                        ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}
                      `}
                    >
                      <PencilIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                      Edit
                    </button>
                  )}
                </Menu.Item>
                {onMove && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={onMove}
                        className={`
                          flex w-full items-center px-4 py-2 text-sm 
                          ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}
                        `}
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                        Move
                      </button>
                    )}
                  </Menu.Item>
                )}
                {onEnhance && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={onEnhance}
                        className={`
                          flex w-full items-center px-4 py-2 text-sm 
                          ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}
                        `}
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l.707.707L15.414 4a1 1 0 11-1.414 1.414L14 5.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707 1.414-1.414A1 1 0 0112 2zm0 10a1 1 0 01.707.293l.707.707 1.414-1.414a1 1 0 111.414 1.414l-.707.707-.707.707a1 1 0 01-1.414-1.414l.707-.707-.707-.707A1 1 0 0112 12z" clipRule="evenodd" />
                        </svg>
                        Enhance
                      </button>
                    )}
                  </Menu.Item>
                )}
                {onSchedule && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={onSchedule}
                        className={`
                          flex w-full items-center px-4 py-2 text-sm 
                          ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}
                        `}
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        Schedule
                      </button>
                    )}
                  </Menu.Item>
                )}
                {onAnalytics && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={onAnalytics}
                        className={`
                          flex w-full items-center px-4 py-2 text-sm 
                          ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'}
                        `}
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                          <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                        </svg>
                        Analytics
                      </button>
                    )}
                  </Menu.Item>
                )}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => onDelete && onDelete(content.id)}
                      className={`
                        flex w-full items-center px-4 py-2 text-sm 
                        ${active ? 'bg-gray-50 text-gray-900' : 'text-red-600'}
                      `}
                    >
                      <TrashIcon className="mr-3 h-5 w-5 text-red-500" aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  );
};

export default ContentCard; 