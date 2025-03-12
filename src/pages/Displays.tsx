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
        <button 
          className="btn btn-primary flex items-center mt-4 sm:mt-0" 
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Display
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1 max-w-md">
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
        <select 
          className="input sm:w-48" 
          value={selectedStatus} 
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
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
            {filteredDisplays.length > 0 ? (
              filteredDisplays.map(display => (
                <tr key={display.id}>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">{display.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      display.status === 'online' ? 'bg-green-100 text-green-800' : 
                      display.status === 'offline' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {display.status === 'online' ? (
                        <>
                          <span className="h-2 w-2 mr-1.5 rounded-full bg-green-400"></span>
                          Online
                        </>
                      ) : display.status === 'offline' ? (
                        <>
                          <span className="h-2 w-2 mr-1.5 rounded-full bg-red-400"></span>
                          Offline
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 mr-1.5 rounded-full bg-yellow-400"></span>
                          Scheduled
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">{display.currentContent}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{display.lastSeen}</td>
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
                                  <RefreshCw className="mr-3 h-5 w-5 text-secondary-400" aria-hidden="true" />
                                  Refresh
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
                                    active ? 'bg-secondary-100 text-red-600' : 'text-red-500'
                                  } flex items-center px-4 py-2 text-sm w-full text-left`}
                                >
                                  <Trash2 className="mr-3 h-5 w-5 text-red-400" aria-hidden="true" />
                                  Delete
                                </button>
                              )}
                            </Menu.Item>
                          </div>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-secondary-500">
                  <div className="flex flex-col items-center">
                    <Monitor className="h-12 w-12 text-secondary-400 mb-4" />
                    <p className="text-secondary-900 font-medium mb-1">No displays found</p>
                    <p className="text-secondary-500 max-w-sm">
                      {searchTerm || selectedStatus !== 'all' 
                        ? 'Try adjusting your search or filter criteria.' 
                        : 'Get started by adding your first display.'}
                    </p>
                    {!searchTerm && selectedStatus === 'all' && (
                      <button 
                        className="mt-4 btn btn-primary"
                        onClick={() => setIsAddModalOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Display
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Display Modal */}
      {isAddModalOpen && (
        <AddDisplayModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
          onAddDisplay={handleAddDisplay} 
        />
      )}
    </div>
  );
};

export default Displays;
