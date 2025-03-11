import { useState, Fragment } from 'react';
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
import { Link } from 'react-router-dom';

// Mock Data
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
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?crop&w=300&q=80',
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
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?crop&w=300&q=80',
    tags: ['product', 'showcase']
  }
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
      {/* Page Header */}
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

      {/* Filters Section */}
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
      </div>

      {/* Content Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredContent.map((item) => (
            <div key={item.id} className="bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-40 bg-secondary-100">
                <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                {item.aiGenerated && (
                  <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-md flex items-center">
                    <Zap className="h-3 w-3 mr-1" />
                    AI Generated
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-secondary-900 truncate">{item.name}</h3>
                <div className="flex items-center justify-between text-xs text-secondary-500">
                  <span>{item.dimensions}</span>
                  <span>{item.size}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Content</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Size</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {filteredContent.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{item.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

			
      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <button className="btn btn-secondary">Previous</button>
        <p className="text-sm text-secondary-700">
          Showing {filteredContent.length} results
        </p>
        <button className="btn btn-secondary">Next</button>
      </div>
    </div>
  );
};

export default ContentLibrary;
