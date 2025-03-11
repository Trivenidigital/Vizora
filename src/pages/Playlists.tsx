import { useState } from 'react';
import { 
  PlaySquare, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Clock, 
  Calendar,
  Eye,
  Edit,
  Trash2,
  Copy,
  Share2,
  Monitor
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// Mock data
const playlists = [
  { 
    id: 1, 
    name: 'Welcome Sequence', 
    items: 5, 
    duration: '2:30', 
    lastModified: '2 days ago', 
    status: 'active',
    displays: 3,
    schedule: 'Daily',
    thumbnail: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
  },
  { 
    id: 2, 
    name: 'Product Showcase', 
    items: 8, 
    duration: '5:45', 
    lastModified: '1 week ago', 
    status: 'active',
    displays: 2,
    schedule: 'Weekdays',
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
  },
  { 
    id: 3, 
    name: 'Company News', 
    items: 3, 
    duration: '3:15', 
    lastModified: '3 days ago', 
    status: 'scheduled',
    displays: 5,
    schedule: 'Monday, Wednesday, Friday',
    thumbnail: 'https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
  },
  { 
    id: 4, 
    name: 'Holiday Special', 
    items: 6, 
    duration: '4:20', 
    lastModified: '2 weeks ago', 
    status: 'inactive',
    displays: 0,
    schedule: 'Not scheduled',
    thumbnail: 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
  },
  { 
    id: 5, 
    name: 'Cafeteria Menu', 
    items: 4, 
    duration: '1:45', 
    lastModified: '1 day ago', 
    status: 'active',
    displays: 1,
    schedule: 'Daily',
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
  },
  { 
    id: 6, 
    name: 'Employee Spotlight', 
    items: 7, 
    duration: '3:50', 
    lastModified: '5 days ago', 
    status: 'scheduled',
    displays: 4,
    schedule: 'Weekdays',
    thumbnail: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80',
  },
];

const Playlists = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  
  // Filter playlists based on search and status
  const filteredPlaylists = playlists.filter(playlist => {
    const matchesSearch = playlist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || playlist.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });
  
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Playlists</h1>
          <p className="text-secondary-500">Create and manage content sequences for your displays</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="btn btn-primary flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Create Playlist
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
            placeholder="Search playlists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <select
            className="input"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="inactive">Inactive</option>
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
      
      {/* Playlist stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-primary-100 text-primary-600 mr-3">
            <PlaySquare className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Total Playlists</p>
            <p className="text-xl font-bold text-secondary-900">{playlists.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-green-100 text-green-600 mr-3">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Active on Displays</p>
            <p className="text-xl font-bold text-secondary-900">
              {playlists.filter(p => p.status === 'active').length}
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
              {playlists.filter(p => p.status === 'scheduled').length}
            </p>
          </div>
        </div>
      </div>
      
      {/* Playlists grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaylists.map((playlist) => (
            <div key={playlist.id} className="bg-white rounded-lg border border-secondary-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-40 bg-secondary-100">
                <img 
                  src={playlist.thumbnail} 
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
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
                                <Copy className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                Duplicate
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
                <h3 className="text-lg font-medium text-secondary-900 mb-1">{playlist.name}</h3>
                <div className="flex items-center justify-between text-sm text-secondary-500 mb-3">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{playlist.duration}</span>
                  </div>
                  <div>
                    <span>{playlist.items} items</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    playlist.status === 'active' ? 'bg-green-100 text-green-800' :
                    playlist.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                    'bg-secondary-100 text-secondary-800'
                  }`}>
                    {playlist.status.charAt(0).toUpperCase() + playlist.status.slice(1)}
                  </span>
                  <span className="text-xs text-secondary-500">
                    {playlist.displays} {playlist.displays === 1 ? 'display' : 'displays'}
                  </span>
                </div>
                <div className="text-xs text-secondary-500 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {playlist.schedule}
                </div>
              </div>
              <div className="bg-secondary-50 px-4 py-3 border-t border-secondary-200 flex justify-between">
                <button className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center">
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </button>
                <button className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Playlists list view */}
      {viewMode === 'list' && (
        <div className="bg-white shadow-sm rounded-lg border border-secondary-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Playlist
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Displays
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Last Modified
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {filteredPlaylists.map((playlist) => (
                  <tr key={playlist.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded overflow-hidden">
                          <img src={playlist.thumbnail} alt={playlist.name} className="h-10 w-10 object-cover" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-secondary-900">{playlist.name}</div>
                          <div className="text-xs text-secondary-500">{playlist.schedule}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-secondary-900">
                        <Clock className="h-4 w-4 text-secondary-500 mr-1" />
                        {playlist.duration}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      {playlist.items} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        playlist.status === 'active' ? 'bg-green-100 text-green-800' :
                        playlist.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-secondary-100 text-secondary-800'
                      }`}>
                        {playlist.status.charAt(0).toUpperCase() + playlist.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      {playlist.displays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      {playlist.lastModified}
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
                                    <Copy className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                    Duplicate
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
          
          {filteredPlaylists.length === 0 && (
            <div className="px-6 py-10 text-center">
              <PlaySquare className="mx-auto h-12 w-12 text-secondary-400" />
              <h3 className="mt-2 text-sm font-medium text-secondary-900">No playlists found</h3>
              <p className="mt-1 text-sm text-secondary-500">
                Try adjusting your search or filter to find what you're looking for.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedStatus('all');
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
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredPlaylists.length}</span> of{' '}
              <span className="font-medium">{filteredPlaylists.length}</span> results
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
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-secondary-300 bg-white text-sm font-medium text-secondary-<ez1Action type="file" filePath="src/pages/Playlists.tsx">
                500 hover:bg-secondary-50"
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

export default Playlists;
