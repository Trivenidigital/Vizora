import React from 'react';
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
import PlaceholderImage from '../components/ui/PlaceholderImage';

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
    aiGenerated: true
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
    aiGenerated: false
  }
];

const ContentLibrary: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('all');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  // Filter content based on search and type
  const filteredContent = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || item.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <div className="flex space-x-4">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContent.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">{item.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{item.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentLibrary;
