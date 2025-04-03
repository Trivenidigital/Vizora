import { useState } from 'react';
import { ComputerDesktopIcon, CheckCircleIcon, XCircleIcon, PlusIcon, XMarkIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

// TypeScript declaration for import.meta.env
interface ImportMetaEnv {
  VITE_API_URL?: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

// Modal component for adding a new display
interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (display: { name: string; location: string }, displayCode: string) => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [displayCode, setDisplayCode] = useState('');
  const [pairingMethod, setPairingMethod] = useState<'manual' | 'qr'>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Display name is required');
      return;
    }
    
    if (!displayCode.trim()) {
      setError('Display code is required to pair with a device');
      return;
    }
    
    setIsSubmitting(true);
    onAdd({ name, location }, displayCode);
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white px-6 pt-5 pb-6">
            <div className="flex justify-between items-center pb-4 mb-4 border-b">
              <h3 className="text-xl font-medium leading-6 text-gray-900">Add New Display</h3>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded border border-red-200">
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="display-name" className="block text-sm font-medium text-gray-700">
                  Display Name*
                </label>
                <input
                  type="text"
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                  placeholder="Enter display name"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="display-location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  type="text"
                  id="display-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                  placeholder="Enter location (optional)"
                />
              </div>
              
              <div className="mb-4">
                <div className="flex items-center space-x-2">
                  <label htmlFor="display-code" className="block text-sm font-medium text-gray-700">
                    Display Code*
                  </label>
                  <span className="text-xs text-gray-500">(from the screen you want to connect)</span>
                </div>
                <div className="mt-1 flex">
                  <input
                    type="text"
                    id="display-code"
                    value={displayCode}
                    onChange={(e) => setDisplayCode(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                    placeholder="Enter 6-digit code"
                    required
                  />
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    title="Scan QR Code"
                  >
                    <QrCodeIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="flex mt-8 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-md border border-transparent bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Pairing...' : 'Add Display'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const Displays = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displays, setDisplays] = useState<Array<{
    id: number | string;
    name: string;
    status: string;
    lastSeen: string;
    location: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter displays based on search query
  const filteredDisplays = displays.filter(display => 
    display.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    display.location.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Count online and offline displays
  const onlineCount = displays.filter(d => d.status === 'online').length;
  const offlineCount = displays.filter(d => d.status === 'offline').length;

  // Handle adding a new display
  const handleAddDisplay = async (displayData: { name: string; location: string }, displayCode: string) => {
    try {
      setIsLoading(true);
      setError('');
      
      console.log(`Attempting to pair display with code: ${displayCode}`);
      
      // Get the device ID from the browser or generate a unique ID for this controller
      const controllerDeviceId = localStorage.getItem('controller_id') || `controller-${Date.now()}`;
      
      // Store the controller ID if it's new
      if (!localStorage.getItem('controller_id')) {
        localStorage.setItem('controller_id', controllerDeviceId);
      }
      
      // Log the request details
      console.log(`Sending pairing request:`, {
        pairingCode: displayCode,
        deviceId: controllerDeviceId
      });
      
      // Send pairing request to the middleware
      const response = await axios.post(`${API_BASE_URL}/pairing/complete`, {
        pairingCode: displayCode,
        deviceId: controllerDeviceId
      });
      
      console.log('Pairing response:', response.data);
      
      if (response.data.success) {
        // Create the new display object with data from both the form and response
        const newDisplay = {
          id: response.data.display._id || Date.now().toString(),
          name: displayData.name,
          location: displayData.location || 'Not specified',
          status: 'online', // Display is online since we just connected to it
          lastSeen: 'Just now'
        };
        
        setDisplays(prevDisplays => [...prevDisplays, newDisplay]);
        setIsModalOpen(false);
        
        // Optionally, you could connect to the socket here to receive live updates
        console.log('Display paired successfully:', response.data);
      } else {
        console.error('Pairing failed with error:', response.data);
        setError(`Failed to pair: ${response.data.message || 'Unknown error'}`);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const errorMessage = err.response?.data?.message || err.message || 'Failed to connect to server';
        console.error('Error pairing display:', err.response?.data);
        setError(`Pairing failed: ${errorMessage}`);
      } else {
        console.error('Error pairing display:', err);
        setError('An unexpected error occurred while pairing the display.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Displays</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage all your connected displays from a single dashboard
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Displays</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">{displays.length}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Online</dt>
          <dd className="mt-1 text-3xl font-semibold text-green-600">{onlineCount}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Offline</dt>
          <dd className="mt-1 text-3xl font-semibold text-red-600">{offlineCount}</dd>
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="flex space-x-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Search displays
          </label>
          <input
            type="text"
            name="search"
            id="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
            placeholder="Search displays by name or location..."
          />
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Display
        </button>
      </div>
      
      {/* Displays list */}
      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        {displays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <ComputerDesktopIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No displays found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first display or connecting to a device.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 inline-flex items-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Display
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredDisplays.map((display) => (
              <li key={display.id}>
                <a href="#" className="block hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <ComputerDesktopIcon 
                          className="h-10 w-10 text-gray-400" 
                          aria-hidden="true" 
                        />
                        <div className="ml-4">
                          <p className="font-medium text-purple-600 truncate">{display.name}</p>
                          <p className="text-sm text-gray-500 truncate">{display.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {display.status === 'online' ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircleIcon className="mr-1.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                            <p className="text-sm">Online</p>
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <XCircleIcon className="mr-1.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                            <p className="text-sm">Offline</p>
                          </div>
                        )}
                        <p className="ml-4 text-sm text-gray-500">Last seen: {display.lastSeen}</p>
                      </div>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Add Display Modal */}
      <AddDisplayModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handleAddDisplay} 
      />
    </div>
  );
};

export default Displays; 