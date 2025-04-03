import React from 'react';
import { FunnelIcon } from '@heroicons/react/24/outline';
import { ContentType } from './ContentPage';

interface ContentFilterBarProps {
  activeFilter: ContentType | 'all';
  onFilterChange: (filter: ContentType | 'all') => void;
}

export const ContentFilterBar: React.FC<ContentFilterBarProps> = ({ activeFilter, onFilterChange }) => {
  const filterOptions: { label: string; value: ContentType | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Images', value: 'image' },
    { label: 'Videos', value: 'video' },
    { label: 'Webpages', value: 'webpage' },
    { label: 'Documents', value: 'document' },
    { label: 'Apps', value: 'app' },
    { label: 'Playlists', value: 'playlist' },
    { label: 'Streams', value: 'stream' },
  ];

  return (
    <div className="flex flex-wrap items-center space-x-2 mb-4">
      <span className="text-sm font-medium text-gray-700 flex items-center">
        <FunnelIcon className="h-4 w-4 mr-1" /> Filter: 
      </span>
      <div className="flex flex-wrap gap-2">
        {filterOptions.map(option => (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={`px-3 py-1 text-sm rounded-full ${
              activeFilter === option.value
                ? 'bg-blue-100 text-blue-800 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}; 