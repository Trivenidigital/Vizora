import { useState, useEffect } from 'react';
import { Monitor, Plus, Search, Filter, MoreVertical, Wifi, WifiOff, Tag } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AddDisplayModal from '../components/displays/AddDisplayModal';

interface Display {
  id: number;
  name: string;
  location: string;
  status: string;
  lastSeen: string;
  resolution: string;
  currentContent: string;
  type: string;
  groups: string[];
}

interface DisplaysProps {
  initialAddModalOpen?: boolean;
}

const Displays: React.FC<DisplaysProps> = ({ initialAddModalOpen = false }) => {
  const [displays, setDisplays] = useState<Display[]>([
    {
      id: 1,
      name: 'Lobby Display',
      location: 'Main Entrance',
      status: 'online',
      lastSeen: 'Just now',
      resolution: '1920x1080',
      currentContent: 'Welcome Video',
      type: 'Smart TV',
      groups: ['Lobby', 'Public']
    },
    {
      id: 2,
      name: 'Conference Room A',
      location: '2nd Floor',
      status: 'online',
      lastSeen: '2 minutes ago',
      resolution: '3840x2160',
      currentContent: 'Meeting Schedule',
      type: 'Smart TV',
      groups: ['Meeting Rooms']
    },
    {
      id: 3,
      name: 'Cafeteria Display',
      location: '1st Floor',
      status: 'offline',
      lastSeen: '2 days ago',
      resolution: '1920x1080',
      currentContent: 'Menu Board',
      type: 'Media Player',
      groups: ['Food Service', 'Public']
    }
  ]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialAddModalOpen);
  
  const location = useLocation();
  
  useEffect(() => {
    // Check if we're on the /displays/add route
    if (location.pathname === '/displays/add') {
      setIsAddModalOpen(true);
    }
  }, [location]);
  
  const filteredDisplays = displays.filter(display => {
    const matchesSearch = display.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          display.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || display.status === filterStatus;
    return matchesSearch && matchesFilter;
  });
  
  const handleAddDisplay = (newDisplay: Display) => {
    setDisplays([...displays, newDisplay]);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Displays</h1>
          <p className="text-secondary-500">Manage your connected display devices</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Display
        </button>
      </div>
      
      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-secondary-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="Search displays..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-secondary-500">Status:</span>
          <select
            className="block w-full pl-3 pr-10 py-2 text-base border-secondary-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>
      
      {/* Displays list */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-secondary-200">
          {filteredDisplays.map((display) => (
            <li key={display.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-3 ${
                      display.status === 'online' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {display.status === 'online' ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-900">{display.name}</p>
                      <p className="text-xs text-secondary-500">{display.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="hidden md:flex items-center space-x-2">
                      {display.groups.map((group, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {group}
                        </span>
                      ))}
                    </div>
                    <div className="text-right text-xs text-secondary-500">
                      <p>Last seen: {display.lastSeen}</p>
                      <p>{display.resolution}</p>
                    </div>
                    <button className="text-secondary-400 hover:text-secondary-500">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-secondary-500">
                    Currently playing: <span className="font-medium">{display.currentContent}</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
          {filteredDisplays.length === 0 && (
            <li className="px-4 py-6 text-center text-secondary-500">
              No displays found. Try adjusting your search or filters.
            </li>
          )}
        </ul>
      </div>
      
      {/* Add Display Modal */}
      <AddDisplayModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onAddDisplay={handleAddDisplay}
      />
    </div>
  );
};

export default Displays;
