import { useState } from 'react';
import { 
  PhotoIcon, 
  FilmIcon, 
  DocumentTextIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

// Sample content data
const sampleContent = [
  { id: 1, name: 'Summer Promotion 2023', type: 'image', size: '2.4 MB', lastModified: '2 days ago' },
  { id: 2, name: 'Welcome Video', type: 'video', size: '24.8 MB', lastModified: '1 week ago' },
  { id: 3, name: 'Daily Menu Board', type: 'html', size: '156 KB', lastModified: '4 hours ago' },
  { id: 4, name: 'Corporate Presentation', type: 'video', size: '85.2 MB', lastModified: '3 days ago' },
  { id: 5, name: 'Store Hours', type: 'image', size: '1.8 MB', lastModified: 'Just now' },
  { id: 6, name: 'Product Catalog', type: 'html', size: '2.1 MB', lastModified: '1 day ago' },
  { id: 7, name: 'Holiday Special', type: 'image', size: '3.5 MB', lastModified: '2 weeks ago' },
  { id: 8, name: 'Employee Directory', type: 'html', size: '420 KB', lastModified: '5 days ago' },
];

// Content type icons mapping
const contentTypeIcons = {
  image: PhotoIcon,
  video: FilmIcon,
  html: DocumentTextIcon,
};

const Content = () => {
  const [content] = useState(sampleContent);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  
  // Filter content based on search query and type filter
  const filteredContent = content.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || item.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Content Library</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage all your digital content in one place
        </p>
      </div>
      
      {/* Search and filters */}
      <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Search content
          </label>
          <input
            type="text"
            name="search"
            id="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
            placeholder="Search content..."
          />
        </div>
        
        <div className="flex space-x-2">
          <select
            id="type-filter"
            name="type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="html">HTML</option>
          </select>
          
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Add Content
          </button>
        </div>
      </div>
      
      {/* Content grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredContent.map((item) => {
          const IconComponent = contentTypeIcons[item.type as keyof typeof contentTypeIcons];
          
          return (
            <div
              key={item.id}
              className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-lg bg-white shadow"
            >
              <div className="flex flex-1 flex-col p-8">
                <div className="flex items-center space-x-3">
                  <IconComponent className="h-10 w-10 text-gray-400" aria-hidden="true" />
                  <h3 className="truncate text-sm font-medium text-gray-900">{item.name}</h3>
                </div>
                <div className="mt-4 flex flex-1 flex-col justify-between">
                  <div className="mt-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="capitalize">{item.type}</span>
                      <span className="mx-1">•</span>
                      <span>{item.size}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Modified {item.lastModified}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="-mt-px flex divide-x divide-gray-200">
                  <div className="flex w-0 flex-1">
                    <a
                      href="#"
                      className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Edit
                    </a>
                  </div>
                  <div className="-ml-px flex w-0 flex-1">
                    <a
                      href="#"
                      className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Preview
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Content; 