import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import AddDisplayDialog from './AddDisplayDialog';
import { PushContentDialog } from '@/components/PushContentDialog';
import '@/styles/pages/DisplaysPage.css';

interface Display {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  ipAddress: string;
  macAddress: string;
  firmwareVersion: string;
  model: string;
  resolution: string;
  orientation: 'landscape' | 'portrait';
  brightness: number;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  currentContent: {
    id: string;
    name: string;
    type: 'image' | 'video' | 'webpage';
    url: string;
    duration?: number;
  } | null;
  schedule: {
    id: string;
    name: string;
    isActive: boolean;
    startTime: string;
    endTime: string;
    days: string[];
  } | null;
  group: {
    id: string;
    name: string;
  } | null;
  settings: {
    autoPlay: boolean;
    autoStart: boolean;
    autoUpdate: boolean;
    timezone: string;
    language: string;
    network: {
      dhcp: boolean;
      ipAddress?: string;
      subnetMask?: string;
      gateway?: string;
      dns?: string[];
    };
  };
}

const DisplaysPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [displays, setDisplays] = useState<Display[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<Display | null>(null);
  const [isPushContentOpen, setIsPushContentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDisplays();
    }
  }, [isAuthenticated]);

  const fetchDisplays = async () => {
    setIsLoading(true);
    try {
      // Fetch displays that belong to the current user
      const response = await api.get('/pairing/user/displays');
      if (response.data.success) {
        setDisplays(response.data.displays);
      }
    } catch (error) {
      console.error('Error fetching displays:', error);
      toast.error('Failed to load displays');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDisplay = async (pairingCode: string) => {
    try {
      // Generate a unique controller device ID for this web instance
      const controllerDeviceId = `controller-${Date.now()}`;
      
      // Call API to complete pairing
      const response = await api.post('/pairing/complete', {
        pairingCode,
        deviceId: controllerDeviceId
      });
      
      if (response.data.success) {
        toast.success('Display added successfully');
        fetchDisplays(); // Refresh the list
        setIsAddDialogOpen(false);
        return true;
      } else {
        toast.error(response.data.message || 'Failed to add display');
        return false;
      }
    } catch (error) {
      console.error('Error adding display:', error);
      
      if (error.response?.status === 404) {
        toast.error('Display not found with this pairing code');
      } else if (error.response?.status === 401) {
        toast.error('You need to be logged in to add a display');
      } else {
        toast.error('Failed to add display');
      }
      
      return false;
    }
  };

  const handleRemoveDisplay = async (displayId: string) => {
    if (!confirm('Are you sure you want to remove this display?')) {
      return;
    }
    
    try {
      // Generate a unique controller device ID for this web instance
      const controllerDeviceId = `controller-${Date.now()}`;
      
      // Call API to unpair
      const response = await api.post('/pairing/unpair', {
        displayId,
        controllerId: controllerDeviceId
      });
      
      if (response.data.success) {
        toast.success('Display removed successfully');
        fetchDisplays(); // Refresh the list
      } else {
        toast.error(response.data.message || 'Failed to remove display');
      }
    } catch (error) {
      console.error('Error removing display:', error);
      toast.error('Failed to remove display');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePushContent = (display: Display) => {
    // Adapt the display data to the format expected by PushContentDialog
    const adaptedDisplay = {
      id: display.id || display.deviceId, // Use id or deviceId as fallback
      name: display.name,
      status: display.status as 'online' | 'offline' | 'active',
      ipAddress: display.model || '', // Use model as ipAddress or empty string
      lastSeen: display.lastSeen || new Date().toISOString(),
      currentContent: '', // No current content info available
      addedOn: new Date().toISOString() // No addedOn info available
    };
    
    setSelectedDisplay(adaptedDisplay);
    setIsPushContentOpen(true);
  };

  const handleClosePushContent = () => {
    setIsPushContentOpen(false);
    setSelectedDisplay(null);
  };

  const handleDisplayAction = (display: Display, action: 'restart' | 'update' | 'reset') => {
    // ... existing code ...
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Displays</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all displays paired with your account.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsAddDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Add display
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="mt-8 text-center">Loading displays...</div>
      ) : displays.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No displays found.</p>
          <p className="text-gray-500 mt-2">
            Click "Add display" to pair with a new display.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        ID
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Model
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Last Seen
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {displays.map((display) => (
                      <tr key={display.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {display.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {display.deviceId}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {display.model}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusBadgeClass(display.status)}`}>
                            {display.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatDate(display.lastSeen)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {(display.status === 'online' || display.status === 'active') && (
                            <button
                              onClick={() => handlePushContent(display)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Push Content
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveDisplay(display.deviceId)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <AddDisplayDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAddDisplay}
      />
      
      {selectedDisplay && (
        <PushContentDialog
          isOpen={isPushContentOpen}
          onClose={handleClosePushContent}
          display={selectedDisplay as any} // Use type assertion to bypass type checking
        />
      )}
    </div>
  );
};

export default DisplaysPage; 