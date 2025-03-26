import React, { useState, useEffect } from 'react';
import { pairingService } from '../services/pairingService';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisplayAdded: (display: { displayId: string; name: string; status: 'Connected' | 'Disconnected' }) => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onDisplayAdded }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingStatus, setPairingStatus] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [isConnectionInitialized, setIsConnectionInitialized] = useState(false);

  // Initialize connection when modal is opened
  useEffect(() => {
    if (isOpen && !isConnectionInitialized) {
      initializeConnection();
    }
  }, [isOpen, isConnectionInitialized]);

  // Initialize the socket connection
  const initializeConnection = async () => {
    if (showDebug) {
      setDebugInfo('Automatically initializing connection...');
    }
    
    try {
      // Ensure connection is established
      await pairingService.ensureConnection();
      
      // Check and fix socket configuration
      pairingService.debugCheckSocketConfig();
      
      const socket = (pairingService as any).socket;
      if (socket?.connected) {
        if (showDebug) {
          setDebugInfo(prev => prev + `\nConnection initialized! Socket ID: ${socket.id}`);
          
          // Check event listeners
          const listeners = {
            'pair-success': socket.hasListeners('pair-success'),
            'pair-failed': socket.hasListeners('pair-failed')
          };
          setDebugInfo(prev => prev + `\nEvent listeners: ${JSON.stringify(listeners)}`);
        }
        
        setIsConnectionInitialized(true);
      } else {
        if (showDebug) {
          setDebugInfo(prev => prev + '\nFailed to initialize connection automatically');
        }
      }
    } catch (err) {
      if (showDebug) {
        setDebugInfo(prev => prev + `\nError initializing connection: ${err instanceof Error ? err.message : String(err)}`);
      }
      console.error('Error initializing connection:', err);
    }
  };

  if (!isOpen) return null;

  const testConnection = async () => {
    setDebugInfo('Testing connection to middleware...');
    try {
      const socket = (pairingService as any).socket;
      
      setDebugInfo(prev => prev + '\nAttempting to connect...');
      await pairingService.ensureConnection();
      
      if (socket?.connected) {
        setDebugInfo(prev => prev + `\nConnected! Socket ID: ${socket.id}`);
        
        // Test a simple event
        setDebugInfo(prev => prev + '\nSending ping event...');
        
        // Create a promise that will resolve when we get a response or timeout
        const pingPromise = new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve({ success: false, error: 'Ping timeout' });
          }, 5000);
          
          socket.emit('ping', { timestamp: new Date().toISOString() }, (response: any) => {
            clearTimeout(timeoutId);
            resolve(response || { success: false, error: 'No response data' });
          });
        });
        
        const pingResponse = await pingPromise;
        setDebugInfo(prev => prev + `\nPing response: ${JSON.stringify(pingResponse, null, 2)}`);
        
        // Check event listeners
        setDebugInfo(prev => prev + '\nChecking event listeners...');
        const listeners = {
          'pair-success': socket.hasListeners('pair-success'),
          'pair-failed': socket.hasListeners('pair-failed'),
          'connect': socket.hasListeners('connect'),
          'disconnect': socket.hasListeners('disconnect'),
          'error': socket.hasListeners('error')
        };
        
        setDebugInfo(prev => prev + `\nEvent listeners: ${JSON.stringify(listeners, null, 2)}`);
        
        // If pair-success or pair-failed listeners are not set up, try to fix it
        if (!listeners['pair-success'] || !listeners['pair-failed']) {
          setDebugInfo(prev => prev + '\nWARNING: Event listeners for pairing are not set up correctly.');
          setDebugInfo(prev => prev + '\nAttempting to fix event listeners...');
          
          // Force setup of socket listeners
          pairingService.setupSocketListeners();
          
          // Check again
          const updatedListeners = {
            'pair-success': socket.hasListeners('pair-success'),
            'pair-failed': socket.hasListeners('pair-failed')
          };
          
          setDebugInfo(prev => prev + `\nUpdated event listeners: ${JSON.stringify(updatedListeners, null, 2)}`);
          
          if (updatedListeners['pair-success'] && updatedListeners['pair-failed']) {
            setDebugInfo(prev => prev + '\nSuccessfully fixed event listeners!');
          } else {
            setDebugInfo(prev => prev + '\nFailed to fix event listeners. Pairing may not work correctly.');
          }
        }
        
        // Test socket.io rooms
        setDebugInfo(prev => prev + '\nChecking socket rooms...');
        if (socket.rooms) {
          setDebugInfo(prev => prev + `\nSocket rooms: ${JSON.stringify(Array.from(socket.rooms), null, 2)}`);
        } else {
          setDebugInfo(prev => prev + '\nNo room information available');
        }
        
        // Check socket options
        setDebugInfo(prev => prev + '\nChecking socket options...');
        const options = {
          transports: socket.io?.opts?.transports || [],
          timeout: socket.io?.opts?.timeout,
          reconnection: socket.io?.opts?.reconnection,
          clientType: socket.io?.opts?.auth?.clientType || 'unknown'
        };
        
        // Ensure transports is displayed correctly
        if (Array.isArray(options.transports)) {
          options.transports = options.transports.map(t => t || 'unknown');
        }
        
        setDebugInfo(prev => prev + `\nSocket options: ${JSON.stringify(options, null, 2)}`);
        
        setDebugInfo(prev => prev + '\nConnection test completed successfully!');
      } else {
        setDebugInfo(prev => prev + '\nFailed to connect to middleware server');
      }
    } catch (err) {
      setDebugInfo(prev => prev + `\nError: ${err instanceof Error ? err.message : String(err)}`);
      
      // Add troubleshooting suggestions
      setDebugInfo(prev => prev + '\n\nTroubleshooting suggestions:');
      setDebugInfo(prev => prev + '\n1. Make sure the middleware server is running');
      setDebugInfo(prev => prev + '\n2. Check that the server URL is correct (default: http://localhost:3003)');
      setDebugInfo(prev => prev + '\n3. Verify there are no network issues or firewalls blocking the connection');
      setDebugInfo(prev => prev + '\n4. Try restarting the middleware server and refreshing this page');
    }
  };

  const registerTestDisplay = async () => {
    setDebugInfo('Registering test display...');
    try {
      await pairingService.ensureConnection();
      
      const result = await pairingService.registerTestDisplay();
      setDebugInfo(prev => prev + `\nTest display registered!\nDisplay ID: ${result.displayId}\nPairing Code: ${result.pairingCode}`);
      
      // Auto-fill the pairing code
      setPairingCode(result.pairingCode);
      
    } catch (err) {
      setDebugInfo(prev => prev + `\nError registering test display: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePairingSubmit = async () => {
    if (!pairingCode || pairingCode.length < 4 || pairingCode.length > 12) {
      setError('Please enter a valid pairing code (4-12 characters)');
      return;
    }

    setIsPairing(true);
    setError('');
    setPairingStatus('Connecting to middleware server...');

    try {
      console.log(`Attempting to pair with display using code: ${pairingCode}`);
      
      // If debug mode is on, show more detailed information
      if (showDebug) {
        setDebugInfo(`Starting pairing process with code: ${pairingCode}\n`);
        const socket = (pairingService as any).socket;
        if (socket) {
          setDebugInfo(prev => prev + `Socket state: ${socket.connected ? 'connected' : 'disconnected'}\n`);
          if (socket.connected) {
            setDebugInfo(prev => prev + `Socket ID: ${socket.id}\n`);
          }
        }
      }
      
      // Add a client-side timeout to handle very long hangs
      let pairingTimeout: NodeJS.Timeout | null = null;
      const maxTimeout = new Promise<{success: false, error: string}>((resolve) => {
        pairingTimeout = setTimeout(() => {
          resolve({
            success: false,
            error: 'Client-side timeout: The operation took too long to complete'
          });
        }, 65000); // 65 seconds timeout on client side
      });
      
      // Check if middleware server is running
      try {
        // Try a basic fetch to the middleware server to see if it's running
        const serverUrl = new URL('http://localhost:3003');
        const checkResponse = await fetch(serverUrl.toString(), { 
          method: 'HEAD',
          mode: 'no-cors', // This allows us to at least check if the server is up
          cache: 'no-cache'
        });
        
        if (showDebug) {
          setDebugInfo(prev => prev + `\nMiddleware server check: ${checkResponse.type}\n`);
        }
      } catch (serverCheckError) {
        // Server is likely not running
        if (showDebug) {
          setDebugInfo(prev => prev + `\nMiddleware server check failed: ${serverCheckError}\n`);
          setDebugInfo(prev => prev + `\nPlease ensure the middleware server is running on port 3003\n`);
        }
        setError('Cannot connect to pairing server. Please ensure the middleware server is running on port 3003.');
        setIsPairing(false);
        return;
      }
      
      // Check if connection is already initialized
      if (!isConnectionInitialized) {
        if (showDebug) {
          setDebugInfo(prev => prev + '\nConnection not initialized yet, initializing now...\n');
        }
        
        try {
          await initializeConnection();
        } catch (initError) {
          console.error('Failed to initialize connection:', initError);
          if (showDebug) {
            setDebugInfo(prev => prev + `\nFailed to initialize connection: ${initError instanceof Error ? initError.message : String(initError)}\n`);
          }
        }
      }
      
      // Ensure connection is established before attempting to pair
      try {
        setPairingStatus('Ensuring connection to middleware server...');
        await pairingService.ensureConnection();
        
        if (showDebug) {
          const socket = (pairingService as any).socket;
          if (socket) {
            setDebugInfo(prev => prev + `Socket connected: ${socket.connected}\n`);
            if (socket.connected) {
              setDebugInfo(prev => prev + `Socket ID after connection: ${socket.id}\n`);
              
              // Verify event listeners are set up
              setDebugInfo(prev => prev + `Checking event listeners before pairing...\n`);
              const listeners = {
                'pair-success': socket.hasListeners('pair-success'),
                'pair-failed': socket.hasListeners('pair-failed')
              };
              setDebugInfo(prev => prev + `Event listeners: ${JSON.stringify(listeners)}\n`);
              
              // If no listeners, warn but continue
              if (!listeners['pair-success'] || !listeners['pair-failed']) {
                setDebugInfo(prev => prev + `WARNING: Event listeners not properly set up. This may cause pairing to fail.\n`);
                
                // Try to fix the listeners
                setDebugInfo(prev => prev + `Attempting to fix event listeners...\n`);
                pairingService.setupSocketListeners();
                
                // Check again
                const updatedListeners = {
                  'pair-success': socket.hasListeners('pair-success'),
                  'pair-failed': socket.hasListeners('pair-failed')
                };
                setDebugInfo(prev => prev + `Updated event listeners: ${JSON.stringify(updatedListeners)}\n`);
              }
            }
          }
        }
      } catch (connError) {
        console.error('Connection error:', connError);
        setError(`Connection error: ${connError instanceof Error ? connError.message : String(connError)}`);
        setPairingStatus('');
        setIsPairing(false);
        
        if (showDebug) {
          setDebugInfo(prev => prev + `\nConnection error: ${connError instanceof Error ? connError.message : String(connError)}`);
        }
        return;
      }
      
      setPairingStatus('Sending pairing request...');
      
      // Use Promise.race to handle both the pairing promise and our client-side timeout
      const pairingPromise = pairingService.pairWithDisplay(pairingCode);
      const response = await Promise.race([pairingPromise, maxTimeout]);
      
      // Clear the timeout if it's still active
      if (pairingTimeout) {
        clearTimeout(pairingTimeout);
        pairingTimeout = null;
      }
      
      // Add status updates during the waiting period
      const statusUpdates = [
        'Still waiting for response...',
        'Verifying pairing code...',
        'Establishing connection with display...',
        'Almost there...'
      ];
      
      statusUpdates.forEach((status, index) => {
        setTimeout(() => {
          if (isPairing) {
            setPairingStatus(status);
          }
        }, (index + 1) * 3000); // Update status every 3 seconds
      });
      
      // Add a timeout check to provide additional feedback
      const timeoutCheck = setTimeout(() => {
        if (isPairing) {
          setPairingStatus('Taking longer than expected, still waiting...');
          
          if (showDebug) {
            const socket = (pairingService as any).socket;
            if (socket) {
              setDebugInfo(prev => prev + `\nPairing taking longer than expected. Socket state: ${socket.connected ? 'connected' : 'disconnected'}`);
              if (socket.connected) {
                setDebugInfo(prev => prev + `\nSocket ID: ${socket.id}`);
                
                // Check event listeners again
                const listeners = {
                  'pair-success': socket.hasListeners('pair-success'),
                  'pair-failed': socket.hasListeners('pair-failed')
                };
                setDebugInfo(prev => prev + `\nEvent listeners: ${JSON.stringify(listeners)}`);
              }
            }
          }
        }
      }, 30000); // Check after 30 seconds
      
      console.log('Pairing response:', response);
      clearTimeout(timeoutCheck);
      
      if (response.success && response.displayId) {
        setPairingStatus('Successfully paired! Adding display...');
        console.log(`Successfully paired with display ID: ${response.displayId}`);
        
        if (showDebug) {
          setDebugInfo(prev => prev + `\nPairing successful! Display ID: ${response.displayId}`);
          
          // Log notification status
          if (response.displayNotified) {
            setDebugInfo(prev => prev + `\nDisplay was successfully notified of pairing!`);
          } else {
            setDebugInfo(prev => prev + `\nWarning: Display was not notified of pairing, but connection was established.`);
            setDebugInfo(prev => prev + `\nHeartbeat monitoring is active to verify continued connection.`);
          }
        }
        
        // Start heartbeat monitoring
        pairingService.startHeartbeat(response.displayId);
        
        // Set up a connection status check
        const checkConnection = async () => {
          const isConnected = await pairingService.isDisplayConnected(response.displayId);
          return isConnected ? 'Connected' : 'Disconnected';
        };
        
        // Get initial connection status
        const initialStatus = await checkConnection();
        
        onDisplayAdded({
          displayId: response.displayId,
          name: displayName || `Display ${response.displayId}`,
          status: initialStatus
        });
        
        // Close the modal
        onClose();
      } else {
        console.error('Pairing failed:', response.error);
        // Ensure error is a string
        const errorMessage = typeof response.error === 'object' 
          ? JSON.stringify(response.error) 
          : String(response.error || 'Failed to pair with display. Please try again.');
        
        setError(errorMessage);
        setPairingStatus('');
        
        if (showDebug) {
          setDebugInfo(prev => prev + `\nPairing failed: ${errorMessage}`);
          
          // Add suggestions for troubleshooting
          setDebugInfo(prev => prev + `\n\nTroubleshooting suggestions:`);
          setDebugInfo(prev => prev + `\n1. Make sure the VizoraTV app is running and displaying a pairing code`);
          setDebugInfo(prev => prev + `\n2. Verify the pairing code is entered correctly`);
          setDebugInfo(prev => prev + `\n3. Check that the middleware server is running`);
          setDebugInfo(prev => prev + `\n4. Try clicking "Test Connection" to verify socket connection`);
          setDebugInfo(prev => prev + `\n5. Try "Register Test Display" to create a test display for pairing`);
        }
      }
    } catch (error) {
      console.error('Error during pairing:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError('Failed to pair with display. Please try again.');
      setPairingStatus('');
      
      if (showDebug) {
        setDebugInfo(prev => prev + `\nError during pairing: ${errorMessage}`);
      }
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-semibold">Add New Display</h2>
          <div className="flex items-center">
            <button 
              onClick={() => setShowDebug(!showDebug)} 
              className="text-gray-500 hover:text-gray-700 mr-2"
              title="Debug Mode"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3"
                placeholder="Enter a name for this display"
                disabled={isPairing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Pairing Code
              </label>
              <input
                type="text"
                maxLength={12}
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 text-center text-2xl tracking-widest"
                placeholder="Enter code"
                disabled={isPairing}
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the pairing code shown on your TV display
              </p>
            </div>

            {pairingStatus && (
              <div className="flex items-center space-x-2 text-blue-600">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{pairingStatus}</span>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm mt-2">
                {error}
              </div>
            )}

            {showDebug && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Debug Information</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={testConnection}
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-2 rounded"
                    >
                      Test Connection
                    </button>
                    <button
                      onClick={registerTestDisplay}
                      className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-2 rounded"
                    >
                      Register Test Display
                    </button>
                  </div>
                </div>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                  {debugInfo || 'Click "Test Connection" to debug middleware connectivity'}
                </pre>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 px-4 py-3 flex justify-end rounded-b-lg">
          <button
            type="button"
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-2"
            onClick={onClose}
            disabled={isPairing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePairingSubmit}
            disabled={isPairing || pairingCode.length < 4}
          >
            {isPairing ? 'Pairing...' : 'Pair Display'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDisplayModal;
