import { useState } from 'react';
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
  Share2
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// Mock data
const contentItems = [
  { 
    id: 1, 
    name: 'Summer Promotion', 
    type: 'image', 
    size: '2.4 MB', 
    dimensions: '1920x1080', 
    created: '2 days ago', 
    status: 'active',
    aiGenerated: true,
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['promotion', 'summer', 'sale']
  },
  { 
    id: 2, 
    name: 'Product Showcase', 
    type: 'video', 
    size: '24.8 MB', 
    dimensions: '1920x1080', 
    created: '1 week ago', 
    status: 'active',
    aiGenerated: false,
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['product', 'showcase']
  },
  { 
    id: 3, 
    name: 'Company News', 
    type: 'presentation', 
    size: '5.7 MB', 
    dimensions: '1920x1080', 
    created: '3 days ago', 
    status: 'scheduled',
    aiGenerated: true,
    thumbnail: 'https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['news', 'company', 'updates']
  },
  { 
    id: 4, 
    name: 'Holiday Special', 
    type: 'image', 
    size: '3.1 MB', 
    dimensions: '1920x1080', 
    created: '2 weeks ago', 
    status: 'inactive',
    aiGenerated: false,
    thumbnail: 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['holiday', 'special', 'promotion']
  },
  { 
    id: 5, 
    name: 'Welcome Message', 
    type: 'video', 
    size: '18.2 MB', 
    dimensions: '1920x1080', 
    created: '1 month ago', 
    status: 'active',
    aiGenerated: false,
    thumbnail: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['welcome', 'corporate']
  },
  { 
    id: 6, 
    name: 'Menu Board', 
    type: 'presentation', 
    size: '4.5 MB', 
    dimensions: '1080x1920', 
    created: '5 days ago', 
    status: 'active',
    aiGenerated: true,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['menu', 'food', 'cafeteria']
  },
  { 
    id: 7, 
    name: 'Employee Spotlight', 
    type: 'image', 
    size: '2.8 MB', 
    dimensions: '1920x1080', 
    created: '1 week ago', 
    status: 'scheduled',
    aiGenerated: true,
    thumbnail: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['employee', 'spotlight', 'team']
  },
  { 
    id: 8, 
    name: 'Safety Guidelines', 
    type: 'presentation', 
    size: '6.2 MB', 
    dimensions: '1920x1080', 
    created: '2 months ago', 
    status: 'active',
    aiGenerated: false,
    thumbnail: 'https://images.unsplash.com/photo-1581093458791-9d15482442f5?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
    tags: ['safety', 'guidelines', 'corporate']
  },
];

const ContentLibrary = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  
  // Filter content based on search and type
  const filteredContent = contentItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || item.type === selectedType;
    
    return matchesSearch && matchesType;
  });
  
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Content Library</h1>
          <p className="text-secondary-500">Manage and organize your digital signage content</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button className="btn btn-secondary flex items-center">
            <Zap className="h-4 w-4 mr-2" />
            AI Generate
          </button>
          <button className="btn btn-primary flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Upload Content
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="text"
            className="input pl-10"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <select
            className="input"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="presentation">Presentations</option>
          </select>
        </div>
        <button className="btn btn-secondary flex items-center justify-center sm:w-auto">
          <Filter className="h-4 w-4 mr-2" />
          More Filters
        </button>
        <div className="flex border border-secondary-200 rounded-md overflow-hidden">
          <button
            className={`px-3 py-2 flex items-center justify-center ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'bg-white text-secondary-500'}`}
            onClick={() => setViewMode('grid')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-<ez1Action type="file" filePath="src/pages/ContentLibrary.tsx">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            className={`px-3 py-2 flex items-center justify-center ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'bg-white text-secondary-500'}`}
            onClick={() => setViewMode('list')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Content stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-primary-100 text-primary-600 mr-3">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Total Content</p>
            <p className="text-xl font-bold text-secondary-900">{contentItems.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-green-100 text-green-600 mr-3">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Active</p>
            <p className="text-xl font-bold text-secondary-900">
              {contentItems.filter(item => item.status === 'active').length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-blue-100 text-blue-600 mr-3">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Scheduled</p>
            <p className="text-xl font-bold text-secondary-900">
              {contentItems.filter(item => item.status === 'scheduled').length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-purple-100 text-purple-600 mr-3">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">AI Generated</p>
            <p className="text-xl font-bold text-secondary-900">
              {contentItems.filter(item => item.aiGenerated).length}
            </p>
          </div>
        </div>
      </div>
      
      {/* Content grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredContent.map((item) => (
            <div key={item.id} className="bg-white rounded-lg border border-secondary-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-40 bg-secondary-100">
                <img 
                  src={item.thumbnail} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                {item.aiGenerated && (
                  <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-md flex items-center">
                    <Zap className="h-3 w-3 mr-1" />
                    AI Generated
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Menu as="div" className="relative inline-block text-left">
                    <div>
                      <Menu.Button className="bg-white rounded-full p-1 flex items-center text-secondary-400 hover:text-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                        <span className="sr-only">Open options</span>
                        <MoreVertical className="h-5 w-5" aria-hidden="true" />
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
                      <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                        <div className="py-1">
                          <Menu.Item>
                            {({ active }) => (
                              <a
                                href="#"
                                className={`${
                                  active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                } flex items-center px-4 py-2 text-sm`}
                              >
                                <Eye className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                Preview
                              </a>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <a
                                href="#"
                                className={`${
                                  active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                } flex items-center px-4 py-2 text-sm`}
                              >
                                <Edit className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                Edit
                              </a>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <a
                                href="#"
                                className={`${
                                  active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                } flex items-center px-4 py-2 text-sm`}
                              >
                                <Share2 className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                Share
                              </a>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <a
                                href="#"
                                className={`${
                                  active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                } flex items-center px-4 py-2 text-sm`}
                              >
                                <Download className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                Download
                              </a>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <a
                                href="#"
                                className={`${
                                  active ? 'bg-red-50 text-red-700' : 'text-red-600'
                                } flex items-center px-4 py-2 text-sm`}
                              >
                                <Trash2 className="mr-3 h-5 w-5 text-red-400" aria-hidden="true" />
                                Delete
                              </a>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center mb-2">
                  <div className="p-1 rounded-md bg-secondary-100 text-secondary-600 mr-2">
                    {item.type === 'image' && <Image className="h-4 w-4" />}
                    {item.type === 'video' && <Video className="h-4 w-4" />}
                    {item.type === 'presentation' && <FileText className="h-4 w-4" />}
                  </div>
                  <h3 className="text-sm font-medium text-secondary-900 truncate">{item.name}</h3>
                </div>
                <div className="flex items-center justify-between text-xs text-secondary-500">
                  <span>{item.dimensions}</span>
                  <span>{item.size}</span>
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    item.status === 'active' ? 'bg-green-100 text-green-800' :
                    item.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                    'bg-secondary-100 text-secondary-800'
                  }`}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.tags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary-100 text-secondary-800">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Content list view */}
      {viewMode === 'list' && (
        <div className="bg-white shadow-sm rounded-lg border border-secondary-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Content
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {filteredContent.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded overflow-hidden">
                          <img src={item.thumbnail} alt={item.name} className="h-10 w-10 object-cover" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-secondary-900">{item.name}</div>
                          <div className="text-sm text-secondary-500">{item.dimensions}</div>
                        </div>
                        {item.aiGenerated && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            <Zap className="h-3 w-3 mr-1" />
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="p-1 rounded-md bg-secondary-100 text-secondary-600 mr-2">
                          {item.type === 'image' && <Image className="h-4 w-4" />}
                          {item.type === 'video' && <Video className="h-4 w-4" />}
                          {item.type === 'presentation' && <FileText className="h-4 w-4" />}
                        </div>
                        <span className="text-sm text-secondary-900 capitalize">{item.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      {item.size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'active' ? 'bg-green-100 text-green-800' :
                        item.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-secondary-100 text-secondary-800'
                      }`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      {item.created}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Menu as="div" className="relative inline-block text-left">
                        <div>
                          <Menu.Button className="bg-white rounded-full flex items-center text-secondary-400 hover:text-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                            <span className="sr-only">Open options</span>
                            <MoreVertical className="h-5 w-5" aria-hidden="true" />
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
                          <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                            <div className="py-1">
                              <Menu.Item>
                                {({ active }) => (
                                  <a
                                    href="#"
                                    className={`${
                                      active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                    } flex items-center px-4 py-2 text-sm`}
                                  >
                                    <Eye className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                    Preview
                                  </a>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <a
                                    href="#"
                                    className={`${
                                      active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                    } flex items-center px-4 py-2 text-sm`}
                                  >
                                    <Edit className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                    Edit
                                  </a>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <a
                                    href="#"
                                    className={`${
                                      active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                    } flex items-center px-4 py-2 text-sm`}
                                  >
                                    <Share2 className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                    Share
                                  </a>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <a
                                    href="#"
                                    className={`${
                                      active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                    } flex items-center px-4 py-2 text-sm`}
                                  >
                                    <Download className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                    Download
                                  </a>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <a
                                    href="#"
                                    className={`${
                                      active ? 'bg-red-50 text-red-700' : 'text-red-600'
                                    } flex items-center px-4 py-2 text-sm`}
                                  >
                                    <Trash2 className="mr-3 h-5 w-5 text-red-400" aria-hidden="true" />
                                    Delete
                                  </a>
                                )}
                              </Menu.Item>
                            </div>
                          </Menu.Items>
                        </Transition>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredContent.length === 0 && (
            <div className="px-6 py-10 text-center">
              <FolderOpen className="mx-auto h-12 w-12 text-secondary-400" />
              <h3 className="mt-2 text-sm font-medium text-secondary-900">No content found</h3>
              <p className="mt-1 text-sm text-secondary-500">
                Try adjusting your search or filter to find what you're looking for.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedType('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button className="btn btn-secondary">Previous</button>
          <button className="btn btn-secondary">Next</button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-secondary-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredContent.length}</span> of{' '}
              <span className="font-medium">{filteredContent.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-secondary-300 bg-white text-sm font-medium text-secondary-500 hover:bg-secondary-50"
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                className="relative inline-flex items-center px-4 py-2 border border-secondary-300 bg-white text-sm font-medium text-secondary-900 hover:bg-secondary-50"
              >
                1
              </button>
              <button
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-secondary-300 bg-white text-sm font-medium text-secondary-500 hover:bg-secondary-50"
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentLibrary;
