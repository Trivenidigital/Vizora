import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Display from '../components/Display';
import AddDisplayDialog from '../components/AddDisplayDialog';
import PushContentDialog from '../components/PushContentDialog';
import displayService from '../services/displayService';

const DisplaysPage = () => {
  const [displays, setDisplays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddDisplayOpen, setIsAddDisplayOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState(null);
  const [isPushContentOpen, setIsPushContentOpen] = useState(false);

  useEffect(() => {
    fetchDisplays();
  }, []);

  const fetchDisplays = async () => {
    setIsLoading(true);
    try {
      const response = await displayService.getDisplays();
      setDisplays(response.data);
    } catch (err) {
      console.error('Error fetching displays:', err);
      setError('Failed to load displays. Please try again.');
      toast.error('Failed to load displays');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushContent = (displayId) => {
    const display = displays.find(d => d._id === displayId);
    setSelectedDisplay(display);
    setIsPushContentOpen(true);
  };

  const handleUnpair = async (displayId) => {
    if (window.confirm('Are you sure you want to unpair this display?')) {
      try {
        await displayService.deleteDisplay(displayId);
        toast.success('Display unpaired successfully');
        fetchDisplays(); // Refresh the list
      } catch (err) {
        console.error('Error unpairing display:', err);
        toast.error('Failed to unpair display');
      }
    }
  };

  const handleClosePushContent = () => {
    setIsPushContentOpen(false);
    setSelectedDisplay(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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
      
      {isLoading ? (
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
            onClick={fetchDisplays} 
            className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      ) : displays.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">No displays found</h2>
          <p className="text-gray-500 mb-4">Add your first display to get started</p>
          <button 
            onClick={() => setIsAddDisplayOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add Display
          </button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
          {displays.map(display => (
            <Display
              key={display._id}
              display={{
                id: display._id,
                name: display.name,
                status: display.status,
                location: display.location || 'Unknown',
                qrCode: display.qrCode,
                lastConnected: new Date(display.lastConnected).toLocaleString()
              }}
              onPushContent={handlePushContent}
              onUnpair={handleUnpair}
            />
          ))}
        </div>
      )}
      
      <AddDisplayDialog 
        isOpen={isAddDisplayOpen} 
        onClose={() => {
          setIsAddDisplayOpen(false);
          fetchDisplays(); // Refresh the list after adding
        }} 
      />
      
      {selectedDisplay && (
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