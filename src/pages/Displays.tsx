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

const initialDisplays: Display[] = [
  { id: 1, name: 'Lobby Display', location: 'Main Entrance', status: 'online', lastSeen: 'Just now', resolution: '1920x1080', currentContent: 'Welcome Slideshow', type: 'Samsung Smart TV', groups: ['Lobby', 'Public Areas'] },
];

const Displays = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [displays, setDisplays] = useState<Display[]>(initialDisplays);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredDisplays = displays.filter(display => 
    (display.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    display.location.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedStatus === 'all' || display.status === selectedStatus)
  );

  const handleAddDisplay = (newDisplay: Display) => {
    setDisplays(prevDisplays => [...prevDisplays, { ...newDisplay, id: prevDisplays.length + 1 }]);
    setIsAddModalOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-2xl font-bold text-secondary-900 mb-4 sm:mb-0">Displays</h1>
        <button 
          className="btn btn-primary flex items-center mt-4 sm:mt-0" 
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Display
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 border-b border-secondary-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-secondary-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-md text-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Search displays..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            <select
              className="block w-full sm:w-auto pl-3 pr-10 py-2 text-base border border-secondary-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <button className="btn btn-outline-secondary flex items-center">
              <Filter className="h-4 w-4 mr-2" /> More Filters
            </button>
          </div>
        </div>

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
                  Last Seen
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Resolution
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Current Content
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
                      <div className="flex-shrink-0 h-10 w-10 bg-secondary-100 rounded-full flex items-center justify-center">
                        <Monitor className="h-5 w-5 text-secondary-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-secondary-900">{display.name}</div>
                        <div className="text-sm text-secondary-500">{display.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {display.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      display.status === 'online' 
                        ? 'bg-green-100 text-green-800' 
                        : display.status === 'offline' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {display.status === 'online' && <Zap className="h-3 w-3 mr-1" />}
                      {display.status === 'offline' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {display.status === 'scheduled' && <Clock className="h-3 w-3 mr-1" />}
                      {display.status.charAt(0).toUpperCase() + display.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {display.lastSeen}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {display.resolution}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {display.currentContent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Menu as="div" className="relative inline-block text-left">
                      <div>
                        <Menu.Button className="bg-white rounded-full flex items-center text-secondary-400 hover:text-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                          <span className="sr-only">Open options</span>
                          <MoreVertical className="h-5 w-5" />
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
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex w-full items-center px-4 py-2 text-sm`}
                                >
                                  <Power className="mr-3 h-4 w-4" />
                                  {display.status === 'online' ? 'Turn Off' : 'Turn On'}
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex w-full items-center px-4 py-2 text-sm`}
                                >
                                  <RefreshCw className="mr-3 h-4 w-4" />
                                  Refresh
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex w-full items-center px-4 py-2 text-sm`}
                                >
                                  <Edit className="mr-3 h-4 w-4" />
                                  Edit
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex w-full items-center px-4 py-2 text-sm`}
                                >
                                  <Download className="mr-3 h-4 w-4" />
                                  Download Logs
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  className={`${
                                    active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                  } flex w-full items-center px-4 py-2 text-sm text-red-600`}
                                >
                                  <Trash2 className="mr-3 h-4 w-4" />
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
              ))}
              {filteredDisplays.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-secondary-500">
                    No displays found. Try adjusting your search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddDisplayModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAddDisplay={handleAddDisplay} 
      />
    </div>
  );
};

export default Displays;
