import React, { useEffect, useState } from 'react';
import { useDisplayMonitor } from '@/hooks/useDisplayMonitor';
import { displayPollingService } from '@/services/displayPollingService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Test page for demonstrating WebSocket to polling fallback
 */
const TestPolling: React.FC = () => {
  // For simplicity, we'll use a fixed display ID for testing
  // In a real app, you would get this from a route param or prop
  const testDisplayId = 'test-display-123';
  
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [logMessages, setLogMessages] = useState<string[]>([]);

  // Use our display monitor hook
  const { 
    display, 
    loading, 
    error, 
    isPolling,
    refreshDisplay 
  } = useDisplayMonitor({
    displayId: testDisplayId,
    showToasts: true,
    onUpdate: (updatedDisplay) => {
      addLogMessage(`Display updated: ${updatedDisplay.name || 'Unknown'}`);
    },
    onError: (err) => {
      addLogMessage(`Error: ${err.message}`);
    }
  });

  // Add a log message with timestamp
  const addLogMessage = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setLogMessages(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  // Monitor socket connection status
  useEffect(() => {
    const handleConnect = () => {
      setSocketStatus('connected');
      addLogMessage('Socket connected');
    };
    
    const handleDisconnect = () => {
      setSocketStatus('disconnected');
      addLogMessage('Socket disconnected');
    };
    
    // Register event listeners
    displayPollingService.onSocketConnect(handleConnect);
    displayPollingService.onSocketDisconnect(handleDisconnect);
    
    // Check initial status
    if (displayPollingService.isSocketConnected()) {
      setSocketStatus('connected');
    } else {
      setSocketStatus('disconnected');
    }
    
    // Clean up on unmount
    return () => {
      displayPollingService.offSocketConnect(handleConnect);
      displayPollingService.offSocketDisconnect(handleDisconnect);
    };
  }, []);

  // Simulate disconnect/reconnect
  const simulateDisconnect = () => {
    addLogMessage('Simulating socket disconnect...');
    // In a real app, this would be handled by the socket service
    // For this demo, we'll add a function to our polling service
    if (displayPollingService.simulateDisconnect) {
      displayPollingService.simulateDisconnect();
    } else {
      addLogMessage('Simulation not supported in the current implementation');
    }
  };

  // Force manual refresh
  const handleRefresh = () => {
    addLogMessage('Manually refreshing display data...');
    refreshDisplay();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="WebSocket/Polling Test"
        description="Test the fallback between WebSocket and polling"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Connection Status</h2>
          
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex items-center">
              <span className="mr-2">Socket:</span>
              <span 
                className={`inline-block w-3 h-3 rounded-full ${
                  socketStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="ml-2">{socketStatus}</span>
            </div>
            
            <div className="flex items-center">
              <span className="mr-2">Method:</span>
              <span 
                className={`px-2 py-1 rounded text-xs font-medium ${
                  isPolling 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {isPolling ? 'Polling' : 'WebSocket'}
              </span>
            </div>
          </div>
          
          <div className="flex space-x-4 mb-6">
            <Button 
              variant="secondary"
              onClick={simulateDisconnect}
            >
              Simulate Disconnect
            </Button>
            
            <Button
              variant="primary"
              onClick={handleRefresh}
            >
              Refresh Now
            </Button>
          </div>
          
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-2">Display Data</h3>
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <Spinner size="md" />
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
                Error: {error.message}
              </div>
            ) : display ? (
              <div className="bg-gray-50 rounded p-4 overflow-x-auto">
                <pre className="text-sm">{JSON.stringify(display, null, 2)}</pre>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded p-4 text-gray-500">
                No display data available
              </div>
            )}
          </div>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Activity Log</h2>
          <div className="bg-gray-900 text-gray-100 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
            {logMessages.length === 0 ? (
              <div className="text-gray-500 italic">No activity yet</div>
            ) : (
              logMessages.map((message, index) => (
                <div key={index} className="pb-1">{message}</div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TestPolling; 