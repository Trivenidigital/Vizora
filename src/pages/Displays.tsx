import { useState } from 'react';
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
import { Fragment } from 'react';
import AddDisplayModal from '../components/displays/AddDisplayModal';

// Mock data
const initialDisplays = [
  { 
    id: 1, 
    name: 'Lobby Display', 
    location: 'Main Entrance', 
    status: 'online', 
    lastSeen: 'Just now', 
    resolution: '1920x1080', 
    currentContent: 'Welcome Slideshow',
    type: 'Samsung Smart TV',
    groups: ['Lobby', 'Public Areas']
  },
  { 
    id: 2, 
    name: 'Conference Room A', 
    location: '2nd Floor', 
    status: 'online', 
    lastSeen: '2 minutes ago', 
    resolution: '3840x2160', 
    currentContent: 'Meeting Schedule',
    type: 'LG WebOS Display',
    groups: ['Meeting Rooms', 'Executive']
  },
  { 
    id: 3, 
    name: 'Cafeteria Menu Board', 
    location: 'Cafeteria', 
    status: 'online', 
    lastSeen: '5 minutes ago', 
    resolution: '1920x1080', 
    currentContent: 'Daily Menu',
    type: 'Android Media Player',
    groups: ['Cafeteria', 'Public Areas']
  },
  { 
    id: 4, 
    name: 'Sales Dashboard', 
    location: 'Sales Department', 
    status: 'offline', 
    lastSeen: '2 hours ago', 
    resolution: '1920x1080', 
    currentContent: 'Sales Metrics',
    type: 'Chrome Device',
    groups: ['Sales', 'Dashboards']
  },
  { 
    id: 5, 
    name: 'Reception Display', 
    location: 'Front Desk', 
    status: 'online', 
    lastSeen: '1 minute ago', 
    resolution: '1920x1080', 
    currentContent: 'Company News',
    type: 'Samsung Smart TV',
    groups: ['Reception', 'Public Areas']
  },
  { 
    id: 6, 
    name: 'Product Showcase', 
    location: 'Showroom', 
    status: 'scheduled', 
    lastSeen: '30 minutes ago', 
    resolution: '3840x2160', 
    currentContent: 'Product Catalog',
    type: 'LG WebOS Display',
    groups: ['Marketing', 'Products']
  },
];

const Displays = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [displays, setDisplays] = useState(initialDisplays);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Filter displays based on search and status
  const filteredDisplays = displays.filter(display => {
    const matchesSearch = display.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          display.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || display.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Handle adding a new display
  const handleAddDisplay = (newDisplay: any) => {
    setDisplays([...displays, { ...newDisplay, id: displays.length + 1 }]);
  };

  // Handle deleting a display
  const handleDeleteDisplay = (id: number) => {
    if (window.confirm('Are you sure you want to delete this display?')) {
      setDisplays(displays.filter(display => display.id !== id));
    }
  };

  // Handle toggling display power
  const handleTogglePower = (id: number) => {
    setDisplays(displays.map(display => {
      if (display.id === id) {
        const newStatus = display.status === 'online' ? 'offline' : 'online';
        return { 
          ...display, 
          status: newStatus,
          lastSeen: newStatus === 'online' ? 'Just now' : display.lastSeen
        };
      }
      return display;
    }));
  };
  
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Displays</h1>
          <p className="text-secondary-500">Manage and monitor all your connected displays</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button 
            className="btn btn-primary flex items-center"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Display
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
            placeholder="Search displays..."
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
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        <button className="btn btn-secondary flex items-center justify-center sm:w-auto">
          <Filter className="h-4 w-4 mr-2" />
          More Filters
        </button>
      </div>
      
      {/* Display stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-primary-100 text-primary-600 mr-3">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Total Displays</p>
            <p className="text-xl font-bold text-secondary-900">{displays.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-green-100 text-green-600 mr-3">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Online</p>
            <p className="text-xl font-bold text-secondary-900">
              {displays.filter(d => d.status === 'online').length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-secondary-200 p-4 flex items-center">
          <div className="p-2 rounded-full bg-red-100 text-red-600 mr-3">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Offline</p>
            <p className="text-xl font-bold text-secondary-900">
              {displays.filter(d => d.status === 'offline').length}
            </p>
          </div>
        </div>
      </div>
      
      {/* Displays table */}
      <div className="bg-white shadow-sm rounded-lg border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Display
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Current Content
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Last Seen
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-secondary-200">
              {filteredDisplays.map((display) => (
                <tr key={display.id} className="hover:bg-secondary-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-primary-50 text-primary-600">
                        <Monitor className="h-6 w-6" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-secondary-900">{display.name}</div>
                        <div className="text-sm text-secondary-500">{display.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-secondary-900">{display.location}</div>
                    <div className="text-xs text-secondary-500">{display.resolution}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      display.status === 'online' ? 'bg-green-100 text-green-800' :
                      display.status === 'offline' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {display.status === 'online' && <Zap className="h-3 w-3 mr-1" />}
                      {display.status === 'offline' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {display.status === 'scheduled' && <Clock className="h-3 w-3 mr-1" />}
                      {display.status.charAt(0).toUpperCase() + display.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                    {display.currentContent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {display.lastSeen}
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
                <ez1Action type="file" filePath="src/pages/Displays.tsx">
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
                                <button
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex items-center px-4 py-2 text-sm w-full text-left`}
                                >
                                  <RefreshCw className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                  Refresh
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleTogglePower(display.id)}
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex items-center px-4 py-2 text-sm w-full text-left`}
                                >
                                  <Power className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                  {display.status === 'online' ? 'Turn Off' : 'Turn On'}
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex items-center px-4 py-2 text-sm w-full text-left`}
                                >
                                  <Edit className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                  Edit
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleDeleteDisplay(display.id)}
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex items-center px-4 py-2 text-sm w-full text-left`}
                                >
                                  <Trash2 className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                  Delete
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex items-center px-4 py-2 text-sm w-full text-left`}
                                >
                                  <Download className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                  Download Logs
                                </button>
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
