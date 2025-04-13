import { useState } from 'react';
import { 
  DocumentIcon, 
  PhotoIcon, 
  FilmIcon, 
  GlobeAltIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  SparklesIcon,
  ChartBarIcon,
  ArrowPathIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { Content } from '@vizora/common';
import { Content } from '@/services/contentService';
import { formatDistanceToNow } from 'date-fns';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { aiTools } from '@vizora/common';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

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

interface AIContentCardProps {
  content: Content;
  onPreview: (content: Content) => void;
  onRename: (content: Content) => void;
  onDelete: (contentId: string) => void;
  onEnhance: (content: Content, enhancedData: any) => void;
  onSchedule: (content: Content) => void;
  onAnalyze: (content: Content) => void;
}

const AIContentCard: React.FC<AIContentCardProps> = ({ 
  content, 
  onPreview, 
  onRename, 
  onDelete,
  onEnhance,
  onSchedule,
  onAnalyze
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [showAIOptions, setShowAIOptions] = useState(false);
  
  // Determine the icon to use based on content type
  const IconComponent = content.type && CONTENT_TYPE_ICONS[content.type as keyof typeof CONTENT_TYPE_ICONS] 
    ? CONTENT_TYPE_ICONS[content.type as keyof typeof CONTENT_TYPE_ICONS] 
    : CONTENT_TYPE_ICONS.default;
  
  // Format the creation date
  const formattedDate = content.createdAt 
    ? formatDistanceToNow(new Date(content.createdAt), { addSuffix: true }) 
    : 'Unknown date';
  
  // Handle content enhancement with AI
  const handleEnhance = async () => {
    setEnhanceLoading(true);
    try {
      // Get AI-enhanced metadata
      const enhancedData = await aiTools.enhanceMetadata({
        id: content.id,
        title: content.title,
        description: content.description,
        tags: content.tags || [],
        mediaType: content.type,
        thumbnailUrl: content.thumbnail,
        duration: content.duration
      });
      
      // Call the parent handler with enhanced data
      if (enhancedData) {
        onEnhance(content, enhancedData);
      }
      
      // Set a mock score for demonstration
      setAiScore(Math.floor(60 + Math.random() * 40));
    } catch (error) {
      console.error('Error enhancing content:', error);
    } finally {
      setEnhanceLoading(false);
    }
  };
  
  // Handle content analysis with AI
  const handleAnalyze = async () => {
    setAnalyzeLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      onAnalyze(content);
    } catch (error) {
      console.error('Error analyzing content:', error);
    } finally {
      setAnalyzeLoading(false);
    }
  };
  
  // Handle content scheduling with AI
  const handleSchedule = async () => {
    setScheduleLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      onSchedule(content);
    } catch (error) {
      console.error('Error scheduling content:', error);
    } finally {
      setScheduleLoading(false);
    }
  };
  
  return (
    <div 
      className="group relative bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition-all duration-200 border border-gray-100"
      onMouseEnter={() => {
        setIsHovered(true);
        setShowAIOptions(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setTimeout(() => setShowAIOptions(false), 300);
      }}
    >
      {/* Thumbnail or placeholder */}
      <div className="aspect-square relative overflow-hidden bg-gray-100">
        {content.thumbnail ? (
          <img 
            src={content.thumbnail}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconComponent className="h-16 w-16 text-gray-300" />
          </div>
        )}
        
        {/* AI Score Badge (if available) */}
        {aiScore !== null && (
          <div className="absolute top-2 right-2 bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-full w-10 h-10 flex items-center justify-center text-xs font-bold shadow-sm">
            {aiScore}
          </div>
        )}
        
        {/* Preview overlay button */}
        <div className={`
          absolute inset-0 flex items-center justify-center bg-black bg-opacity-40
          transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          <button
            onClick={() => onPreview(content)}
            className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-md transition-transform duration-200 hover:scale-110"
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
              <Menu.Button className="-m-2 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
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
              <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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
                
                {/* AI enhance option */}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleEnhance}
                      disabled={enhanceLoading}
                      className={`
                        flex w-full items-center px-4 py-2 text-sm 
                        ${active ? 'bg-purple-50 text-purple-700' : 'text-purple-600'}
                        ${enhanceLoading ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {enhanceLoading ? (
                        <Spinner className="mr-3 h-5 w-5 text-purple-400" />
                      ) : (
                        <SparklesIcon className="mr-3 h-5 w-5 text-purple-400" aria-hidden="true" />
                      )}
                      AI Enhance
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
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            <IconComponent className="mr-1 h-3 w-3" />
            {content.type?.charAt(0).toUpperCase() + content.type?.slice(1)}
          </span>
        </div>
        
        {/* AI Actions Bar */}
        {showAIOptions && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAnalyze}
              disabled={analyzeLoading}
              className="text-xs flex items-center px-2 py-1 text-cyan-600 hover:bg-cyan-50 transition-colors"
            >
              {analyzeLoading ? <Spinner className="h-3 w-3 mr-1" /> : <ChartBarIcon className="h-3 w-3 mr-1" />}
              Analyze
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEnhance}
              disabled={enhanceLoading}
              className="text-xs flex items-center px-2 py-1 text-purple-600 hover:bg-purple-50 transition-colors"
            >
              {enhanceLoading ? <Spinner className="h-3 w-3 mr-1" /> : <SparklesIcon className="h-3 w-3 mr-1" />}
              Enhance
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSchedule}
              disabled={scheduleLoading}
              className="text-xs flex items-center px-2 py-1 text-blue-600 hover:bg-blue-50 transition-colors"
            >
              {scheduleLoading ? <Spinner className="h-3 w-3 mr-1" /> : <CalendarIcon className="h-3 w-3 mr-1" />}
              Schedule
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIContentCard; 