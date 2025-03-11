import { useState, Fragment } from 'react';
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
import { Link } from 'react-router-dom';

// Mock Data
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
    thumbnail: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?crop&w=300&q=80',
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
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?crop&w=300&q=80',
  }
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
      {/* Page Header */}
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
      </div>

      {/* Playlists Grid View */}
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
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-secondary-900 truncate">{playlist.name}</h3>
                <div className="flex items-center justify-between text-xs text-secondary-500">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{playlist.duration}</span>
                  <span>{playlist.items} items</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Fix */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button className="btn btn-secondary">Previous</button>
          <button className="btn btn-secondary">Next</button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <p className="text-sm text-secondary-700">
            Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredPlaylists.length}</span> of{' '}
            <span className="font-medium">{filteredPlaylists.length}</span> results
          </p>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-secondary-300 bg-white text-sm font-medium text-secondary-500 hover:bg-secondary-50"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button className="relative inline-flex items-center px-4 py-2 border border-secondary-300 bg-white text-sm font-medium text-secondary-900 hover:bg-secondary-50">
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
  );
};

export default Playlists;
