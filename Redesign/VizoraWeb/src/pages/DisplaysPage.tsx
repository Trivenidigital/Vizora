import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import Display from '../components/Display';
import AddDisplayDialog from '../components/AddDisplayDialog';
import { PushContentDialog } from '../components/PushContentDialog';
import { useDisplays } from '../hooks/useDisplays';
import { useConnectionState } from '@vizora/common/hooks/useConnectionStatus';

interface DisplayItem {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  location: string;
  qrCode?: string;
  lastConnected: string;
}

/**
 * Helper function to safely extract location as a string
 * Handles both string locations and object locations with name/address properties
 */
const getLocationString = (location: any): string => {
  if (!location) return 'Unknown';
  
  // If location is a string, return it directly
  if (typeof location === 'string') return location;
  
  // If location is an object with a name property, use that
  if (typeof location === 'object' && location !== null) {
    if (location.name) {
      return location.address 
        ? `${location.name}, ${location.address}` 
        : location.name;
    }
    
    // If we have a flat object with simple properties, create a readable string
    try {
      // Limit to a few relevant keys to prevent overly long strings
      const relevantKeys = ['name', 'address', 'city', 'street', 'building', 'room', 'floor'];
      const values = relevantKeys
        .filter(key => location[key])
        .map(key => location[key]);
      
      if (values.length > 0) {
        return values.join(', ');
      }
      
      // Last resort: stringify the object but limit length
      const str = JSON.stringify(location);
      return str.length > 30 ? str.substring(0, 27) + '...' : str;
    } catch (e) {
      // In case of any serialization errors
      return 'Complex Location';
    }
  }
  
  // Fallback
  return 'Unknown';
};

const DisplaysPage = () => {
  const { displays, loading, error, fetchDisplays, pairDisplay, unpairDisplay } = useDisplays();
  const [isAddDisplayOpen, setIsAddDisplayOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<DisplayItem | null>(null);
  const [isPushContentOpen, setIsPushContentOpen] = useState(false);
  const { isConnected } = useConnectionState();

  // Fetch displays when connection status changes
  useEffect(() => {
    if (isConnected) {
      fetchDisplays();
    }
  }, [isConnected, fetchDisplays]);

  const handleRefresh = () => {
    fetchDisplays();
    toast.success('Refreshing displays...');
  };

  const handlePushContent = (displayId: string) => {
    const display = displays.find(d => d.id === displayId);
    if (display) {
      const displayItem: DisplayItem = {
        id: display.id,
        name: display.name,
        status: display.status,
        location: getLocationString(display.location),
        qrCode: display.qrCode,
        lastConnected: display.lastPing || display.updatedAt || 'Unknown'
      };
      setSelectedDisplay(displayItem);
      setIsPushContentOpen(true);
    }
  };

  const handleUnpair = async (displayId: string) => {
    if (window.confirm('Are you sure you want to unpair this display?')) {
      const success = await unpairDisplay(displayId);
      if (success) {
        toast.success('Display unpaired successfully');
      } else {
        toast.error('Failed to unpair display');
      }
    }
  };

  const handleClosePushContent = () => {
    setIsPushContentOpen(false);
    setSelectedDisplay(null);
  };

  const handleAddDisplay = async (pairingCode: string, name?: string, location?: string): Promise<boolean> => {
    try {
      const displayName = name || `Display-${pairingCode}`;
      const displayLocation = location || 'Default Location';
      
      const success = await pairDisplay(pairingCode, displayName, displayLocation);
      
      if (success) {
        toast.success('Display paired successfully');
        setIsAddDisplayOpen(false);
        return true;
      } else {
        toast.error('Failed to pair display. Please check the pairing code and try again.');
        return false;
      }
    } catch (err) {
      toast.error('Failed to pair display. Please check the pairing code and try again.');
      return false;
    }
  };

  // Renders the empty state with optional message
  const renderEmptyState = () => (
    <div className="bg-white shadow rounded-lg p-8 text-center">
      <h2 className="text-lg font-medium text-gray-900 mb-2">No displays found</h2>
      <p className="text-gray-500 mb-4">
        Your display list is empty. Add your first display to get started.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-2">
        <button 
          onClick={() => setIsAddDisplayOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Add Display
        </button>
        <button 
          onClick={handleRefresh}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Refresh
        </button>
      </div>
    </div>
  );

  const getConnectionStatusMessage = () => {
    if (!isConnected) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You are currently offline. Display status may not be up to date.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Displays</h1>
        <button 
          onClick={() => setIsAddDisplayOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Add Display
        </button>
      </div>
      
      <p className="text-gray-600 mb-6">Manage your paired TV displays</p>
      
      {getConnectionStatusMessage()}
      
      {loading ? (
        <div className="flex justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={handleRefresh} 
            className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      ) : displays.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displays.map(display => (
            <div key={display.id} className={`bg-white shadow rounded-lg overflow-hidden ${display.status === 'offline' ? 'opacity-75' : ''}`}>
              <Display
                display={{
                  id: display.id,
                  name: display.name,
                  status: display.status || 'offline',
                  location: typeof display.location === 'string' 
                    ? display.location 
                    : getLocationString(display.location),
                  qrCode: display.qrCode || 'N/A',
                  lastConnected: display.lastPing 
                    ? new Date(display.lastPing).toLocaleString() 
                    : (display.updatedAt ? new Date(display.updatedAt).toLocaleString() : 'Never')
                }}
                onPushContent={handlePushContent}
                onUnpair={handleUnpair}
              />
            </div>
          ))}
        </div>
      )}
      
      {isAddDisplayOpen && (
        <AddDisplayDialog
          isOpen={isAddDisplayOpen}
          onClose={() => setIsAddDisplayOpen(false)}
          onAddDisplay={handleAddDisplay}
        />
      )}
      
      {isPushContentOpen && selectedDisplay && (
        <PushContentDialog
          isOpen={isPushContentOpen}
          onClose={handleClosePushContent}
          display={selectedDisplay}
        />
      )}
    </div>
  );
};

export default DisplaysPage; 