import { useState, useCallback, Fragment } from 'react';
import { 
  Monitor, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Zap, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Power,
  Edit,
  Trash2,
  Download
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import AddDisplayModal from '../components/displays/AddDisplayModal';

// Define Display type
interface Display {
  id: number;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'scheduled';
  lastSeen: string;
  resolution: string;
  currentContent: string;
  type: string;
  groups: string[];
}

// Mock data
const initialDisplays: Display[] = [
  { id: 1, name: 'Lobby Display', location: 'Main Entrance', status: 'online', lastSeen: 'Just now', resolution: '1920x1080', currentContent: 'Welcome Slideshow', type: 'Samsung Smart TV', groups: ['Lobby', 'Public Areas'] },
  { id: 2, name: 'Conference Room A', location: '2nd Floor', status: 'online', lastSeen: '2 minutes ago', resolution: '3840x2160', currentContent: 'Meeting Schedule', type: 'LG WebOS Display', groups: ['Meeting Rooms', 'Executive'] },
  { id: 3, name: 'Cafeteria Menu Board', location: 'Cafeteria', status: 'online', lastSeen: '5 minutes ago', resolution: '1920x1080', currentContent: 'Daily Menu', type: 'Android Media Player', groups: ['Cafeteria', 'Public Areas'] },
  { id: 4, name: 'Sales Dashboard', location: 'Sales Department', status: 'offline', lastSeen: '2 hours ago', resolution: '1920x1080', currentContent: 'Sales Metrics', type: 'Chrome Device', groups: ['Sales', 'Dashboards'] },
  { id: 5, name: 'Reception Display', location: 'Front Desk', status: 'online', lastSeen: '1 minute ago', resolution: '1920x1080', currentContent: 'Company News', type: 'Samsung Smart TV', groups: ['Reception', 'Public Areas'] },
  { id: 6, name: 'Product Showcase', location: 'Showroom', status: 'scheduled', lastSeen: '30 minutes ago', resolution: '3840x2160', currentContent: 'Product Catalog', type: 'LG WebOS Display', groups: ['Marketing', 'Products'] },
];

const Displays = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [displays, setDisplays] = useState<Display[]>(initialDisplays);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter displays based on search and status
  const filteredDisplays = displays.filter(display => 
    (display.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    display.location.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedStatus === 'all' || display.status === selectedStatus)
  );

  // Handle adding a new display
  const handleAddDisplay = useCallback((newDisplay: Display) => {
    setDisplays(prev => [...prev, { ...newDisplay, id: prev.length + 1 }]);
  }, []);

  // Handle deleting a display
  const handleDeleteDisplay = useCallback((id: number) => {
    if (window.confirm('Are you sure you want to delete this display?')) {
      setDisplays(prev => prev.filter(display => display.id !== id));
    }
  }, []);

  // Handle toggling display power
  const handleTogglePower = useCallback((id: number) => {
    setDisplays(prev =>
      prev.map(display =>
        display.id === id
          ? {
              ...display,
              status: display.status === 'online' ? 'offline' : 'online',
              lastSeen: display.status === 'online' ? display.lastSeen : 'Just now',
            }
          : display
      )
    );
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Displays</h1>
          <p className="text-secondary-500">Manage and monitor all your connected displays</p>
        </div>
        <button className="btn btn-primary flex items-center mt-4 sm:mt-0" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Display
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <input 
          type="text" 
          className="input pl-10" 
          placeholder="Search displays..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
        <select className="input sm:w-48" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <button className="btn btn-secondary flex items-center sm:w-auto">
          <Filter className="h-4 w-4 mr-2" /> More Filters
        </button>
      </div>

      {/* Displays table */}
      <div className="bg-white shadow-sm rounded-lg border border-secondary-200 overflow-hidden">
        <table className="min-w-full divide-y divide-secondary-200">
          <thead className="bg-secondary-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Display</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Current Content</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Last Seen</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {filteredDisplays.map(display => (
              <tr key={display.id}>
                <td className="px-6 py-4 text-sm font-medium text-secondary-900">{display.name}</td>
                <td className="px-6 py-4 text-sm text-secondary-900">{display.location}</td>
                <td className="px-6 py-4 text-sm text-secondary-900">{display.status}</td>
                <td className="px-6 py-4 text-sm text-secondary-900">{display.currentContent}</td>
                <td className="px-6 py-4 text-sm text-secondary-500">{display.lastSeen}</td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  <button onClick={() => handleDeleteDisplay(display.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddDisplayModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddDisplay={handleAddDisplay} />
    </div>
  );
};

export default Displays;
