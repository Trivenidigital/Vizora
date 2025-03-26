import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { websocketService, initializeSocket } from './services/websocketService';
import { ConnectionStatus, WebSocketMessage } from './types';
import './App.css';
import { useNavigate, useLocation } from 'react-router-dom';
import ContentDisplay from './components/ContentDisplay';
import { createDiagnosticReport, formatDiagnosticReport } from './utils/diagnostics';
import PairingScreen from './components/PairingScreen';
import QRCode from 'react-qr-code';
import MainContent from './components/MainContent';
import ErrorBoundary from './components/ErrorBoundary';

// Debugging component to show network status
const NetworkDebugger = ({ serverUrl }: { serverUrl: string }) => {
  const [status, setStatus] = useState<{ [key: string]: string }>({});
  
  useEffect(() => {
    // Log the server URL being tested
    console.log(`NetworkDebugger: Testing connection to ${serverUrl}`);
    
    // Check if fetch is available
    if (typeof fetch !== 'function') {
      setStatus(prev => ({ ...prev, fetch: 'Not available in this browser' }));
      return;
    }
    
    // Parse the server URL
    let parsedUrl;
    try {
      parsedUrl = new URL(serverUrl);
      setStatus(prev => ({ ...prev, urlParsing: 'Valid URL format' }));
    } catch (e) {
      setStatus(prev => ({ ...prev, urlParsing: `Invalid URL: ${e.message}` }));
      return;
    }
    
    // Test if we can reach the server
    const testConnection = async () => {
      try {
        // Test CORS endpoint
        const corsResponse = await fetch(`http://${parsedUrl.host}/cors-test`);
        const corsData = await corsResponse.json();
        setStatus(prev => ({ ...prev, corsTest: corsData.message || 'CORS test successful' }));
      } catch (error) {
        setStatus(prev => ({ ...prev, corsTest: 'CORS test failed: ' + error.message }));
      }

      try {
        // Test forced CORS endpoint
        const forcedCorsResponse = await fetch(`http://${parsedUrl.host}/forced-cors`);
        const forcedCorsData = await forcedCorsResponse.json();
        setStatus(prev => ({ ...prev, forcedCorsTest: forcedCorsData.message || 'Forced CORS test successful' }));
      } catch (error) {
        setStatus(prev => ({ ...prev, forcedCorsTest: 'Forced CORS test failed: ' + error.message }));
      }

      try {
        // Test Socket.IO connection using websocketService
        await websocketService.connect();
        setStatus(prev => ({ ...prev, socketIoHealth: 'Socket.IO connected successfully' }));
      } catch (error) {
        console.error('Socket.IO connection error:', error);
        setStatus(prev => ({ ...prev, socketIoHealth: 'Socket.IO connection error: ' + error.message }));
      }
    };
    
    testConnection();
    
    // Retry connection check every 10 seconds
    const interval = setInterval(testConnection, 10000);
    return () => clearInterval(interval);
  }, [serverUrl]);
  
  // Render the debug information
  return (
    <div className="network-debug">
      <h3>Network Debug Info</h3>
      <div>Current URL: {window.location.href}</div>
      <div>Server URL: {serverUrl}</div>
      <div>Time: {new Date().toLocaleTimeString()}</div>
      {Object.entries(status).map(([key, value]) => (
        <div key={key} className="debug-item">
          <strong>{key}: </strong>
          <pre>{value}</pre>
        </div>
      ))}
    </div>
  );
};

// Diagnostic component for advanced troubleshooting
const DiagnosticTool = ({ serverUrl }: { serverUrl: string }) => {
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  
  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const report = await createDiagnosticReport(serverUrl);
      setDiagnosticData(report);
      setDiagnosticReport(formatDiagnosticReport(report));
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setDiagnosticReport(`Error running diagnostics: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="diagnostic-tool">
      <h3>Connection Diagnostics</h3>
      <div>
        <button 
          onClick={runDiagnostics} 
          disabled={isLoading}
          className="diagnostic-button"
        >
          {isLoading ? 'Running Tests...' : 'Run Diagnostics'}
        </button>
        
        {diagnosticReport && (
          <div className="diagnostic-results">
            <div className="summary">
              {diagnosticData && (
                <div className="test-status">
                  <div className={`status-item ${diagnosticData.connectionTest?.socketIo?.success ? 'success' : 'error'}`}>
                    Socket.IO: {diagnosticData.connectionTest?.socketIo?.success ? '✓' : '✗'}
                  </div>
                  <div className={`status-item ${diagnosticData.connectionTest?.health?.success ? 'success' : 'error'}`}>
                    Health: {diagnosticData.connectionTest?.health?.success ? '✓' : '✗'}
                  </div>
                  <div className={`status-item ${diagnosticData.connectionTest?.cors?.success ? 'success' : 'error'}`}>
                    CORS: {diagnosticData.connectionTest?.cors?.success ? '✓' : '✗'}
                  </div>
                  <div className={`status-item ${diagnosticData.socketTest?.connected ? 'success' : 'error'}`}>
                    WebSocket: {diagnosticData.socketTest?.connected ? '✓' : '✗'}
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="toggle-details"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            
            {showDetails && (
              <pre className="diagnostic-report">{diagnosticReport}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [status, setStatus] = useState<string>('Initializing...');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);

  // Use ref to track component state
  const mountRef = useRef({
    isMounted: false,
    isInitialized: false,
    messageHandler: null as ((message: any) => void) | null,
    connectionHandler: null as ((status: ConnectionStatus) => void) | null,
  });

  // Store state in ref to access in callbacks
  const stateRef = useRef({
    isPaired: false,
    qrData: undefined as string | undefined,
  });
  stateRef.current = { isPaired: false, qrData: undefined };

  const navigate = useNavigate();
  const location = useLocation();

  // Get or create a device ID
  const getOrCreateDeviceId = useCallback(() => {
    // Try to get the ID from localStorage
    let deviceId = localStorage.getItem('vizora-device-id');
    
    // If no ID exists, create one with timestamp for better uniqueness
    if (!deviceId) {
      const timestamp = Date.now().toString();
      const randomStr = Math.random().toString(36).substring(2, 8);
      deviceId = `tv-${timestamp}-${randomStr}`;
      localStorage.setItem('vizora-device-id', deviceId);
      console.log('Created new device ID:', deviceId);
    } else {
      console.log('Using existing device ID:', deviceId);
    }
    
    return deviceId;
  }, []);

  // Connect to the WebSocket server and register the display
  const setupConnection = useCallback(async () => {
    try {
      setStatus('Connecting to server...');
      setConnectionStatus('connecting');
      setIsRefreshing(true);
      setErrorMessage(null);
      
      // Clear any existing retry timeout
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        setRetryTimeout(null);
      }
      
      // Get the device ID
      const deviceId = getOrCreateDeviceId();
      setDisplayId(deviceId);
      
      // Initialize the socket
      console.log('App: Initializing socket with deviceId:', deviceId);
      const socket = await initializeSocket(deviceId);
      
      if (!socket) {
        console.error('App: Failed to initialize socket');
        setConnectionStatus('error');
        setStatus('Connection failed. Please try again.');
        setIsRefreshing(false);
        setErrorMessage('Could not connect to server');
        return;
      }
      
      console.log('App: Socket initialized, waiting for connection...');
      
      // Registration will happen automatically through the socket's auto-registration
      // But we'll set a longer timeout to check if we received a pairing code
      const registrationTimeout = setTimeout(() => {
        // Only refresh if we don't have a pairing code yet
        if (connectionStatus === 'connecting' || !pairingCode) {
          console.warn('App: Registration timeout after 30s, attempting refresh...');
          refreshRegistration();
        }
      }, 30000); // 30 seconds timeout
      
      return () => {
        clearTimeout(registrationTimeout);
      };
    } catch (error) {
      console.error('App: Error in setupConnection:', error);
      setConnectionStatus('error');
      setStatus('Connection error. Please try again.');
      setIsRefreshing(false);
      setErrorMessage(error.message || 'Unknown connection error');
      
      // Set up retry if we haven't exceeded the limit
      if (retryCount < 3) {
        const timeout = setTimeout(() => {
          console.log(`App: Retrying connection (${retryCount + 1}/3)...`);
          setRetryCount(prevCount => prevCount + 1);
          setupConnection();
        }, 5000);
        setRetryTimeout(timeout);
      }
    }
  }, [getOrCreateDeviceId, connectionStatus, pairingCode, retryCount, retryTimeout]);

  // Handle incoming messages from the WebSocket
  const handleMessage = useCallback((message: any) => {
    try {
      console.log('App: Received websocket message:', message);
      
      if (!message || !message.type) {
        console.warn('App: Received invalid message:', message);
        return;
      }
      
      // Handle different message types
      switch (message.type) {
        case 'display_registered':
          if (message.data) {
            console.log('App: Handling display_registered event', message.data);
            
            // Check if there was an error but we still have a pairing code (synthetic response)
            if (message.data.error && message.data.pairingCode) {
              console.warn('App: Registration had error but we have a synthetic pairing code:', message.data.pairingCode);
              
              // We can still use the display with the synthetic code
              setDisplayId(message.data.displayId || displayId);
              setPairingCode(message.data.pairingCode);
              setConnectionStatus('connected');
              setStatus('Registration partially successful (fallback code)');
              setIsRefreshing(false);
              setRetryCount(0);
              setErrorMessage(null);
              
              // Store the synthetic pairing code
              if (message.data.pairingCode) {
                localStorage.setItem('vizora-last-pairing-code', message.data.pairingCode);
                localStorage.setItem('vizora-pairing-timestamp', Date.now().toString());
              }
              return;
            }
            
            // Check if this is a synthetic successful response
            if (message.data.synthetic && message.data.pairingCode) {
              console.log('App: Using synthetic pairing code:', message.data.pairingCode);
              
              setDisplayId(message.data.displayId || displayId);
              setPairingCode(message.data.pairingCode);
              setConnectionStatus('connected');
              setStatus('Connected with synthetic pairing code');
              setIsRefreshing(false);
              setRetryCount(0); 
              setErrorMessage(null);
              
              if (message.data.pairingCode) {
                localStorage.setItem('vizora-last-pairing-code', message.data.pairingCode);
                localStorage.setItem('vizora-pairing-timestamp', Date.now().toString());
              }
              return;
            }
            
            // Check if there was an error without a synthetic code
            if (message.data.error && !message.data.pairingCode) {
              console.error('App: Registration error:', message.data.error);
              setConnectionStatus('error');
              setStatus(`Registration failed: ${message.data.error}`);
              setIsRefreshing(false);
              setErrorMessage(message.data.error);
              
              // Set up auto-retry if we haven't exceeded the limit
              if (retryCount < 3) {
                const timeout = setTimeout(() => {
                  console.log(`App: Retrying registration (${retryCount + 1}/3)...`);
                  setRetryCount(prevCount => prevCount + 1);
                  refreshRegistration();
                }, 5000);
                setRetryTimeout(timeout);
              }
              return;
            }
            
            // Normal successful response
            setDisplayId(message.data.displayId || displayId);
            setPairingCode(message.data.pairingCode);
            setConnectionStatus('connected');
            setStatus(message.data.pairingCode ? 'Registered successfully' : 'Connected, but no pairing code received');
            setIsRefreshing(false);
            setRetryCount(0); // Reset retry count on success
            setErrorMessage(null); // Clear any previous error
            
            // Store the successful pairing code in localStorage with timestamp
            if (message.data.pairingCode) {
              localStorage.setItem('vizora-last-pairing-code', message.data.pairingCode);
              localStorage.setItem('vizora-pairing-timestamp', Date.now().toString());
              
              // Log successful pairing for debugging
              console.log(`App: Successfully received pairing code: ${message.data.pairingCode}`);
            } else {
              console.warn('App: Received display_registered event but no pairing code');
            }
          } else {
            console.warn('App: Received empty display_registered event');
          }
          break;
          
        case 'display_paired':
        case 'paired':
        case 'pair_success':
        case 'pairing_successful':
          console.log('App: Display paired event received:', message.data);
          setConnectionStatus('paired');
          setStatus('Display paired successfully');
          break;
          
        case 'content_updated':
          console.log('App: Content updated event received:', message.data);
          // Handle content update if needed
          break;
        
        case 'welcome':
          console.log('App: Welcome message received:', message.data);
          // Update status to show welcome message
          setStatus('Connected to server - requesting registration...');
          break;
      }
    } catch (error) {
      console.error('App: Error handling message:', error, message);
      setErrorMessage('Error processing server message');
    }
  }, [displayId, retryCount]);

  // Set up connection status listener
  useEffect(() => {
    const handleStatusChange = (status: ConnectionStatus) => {
      console.log('App: Connection status changed:', status);
      setConnectionStatus(status);
      
      if (status === 'connected') {
        setStatus('Connected to server');
      } else if (status === 'disconnected') {
        setStatus('Disconnected from server');
        setPairingCode(null);
      } else if (status === 'error') {
        setStatus('Connection error');
        setPairingCode(null);
      }
    };
    
    websocketService.onStatusChange(handleStatusChange);
    
    return () => {
      websocketService.offStatusChange(handleStatusChange);
    };
  }, []);
  
  // Set up WebSocket message listener
  useEffect(() => {
    const unsubscribe = websocketService.subscribeToMessage(handleMessage);
    
    // Force an initial check of the socket state
    const checkSocketState = () => {
      const socket = websocketService.getSocket();
      if (socket && socket.connected) {
        console.log('App: Socket is connected on initial check');
        setConnectionStatus('connected');
        
        // Check for any existing pairing code
        websocketService.registerDisplay(getOrCreateDeviceId())
          .then(result => {
            console.log('App: Initial registration check result:', result);
            if (result && result.pairingCode) {
              console.log('App: Using pairing code from initial check:', result.pairingCode);
              setPairingCode(result.pairingCode);
              setConnectionStatus('connected');
              setStatus('Registered successfully');
              setIsRefreshing(false);
            }
          })
          .catch(err => {
            console.warn('App: Initial registration check failed:', err);
          });
      }
    };
    
    // Check socket state after a small delay to allow connection
    setTimeout(checkSocketState, 2000);
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [handleMessage, getOrCreateDeviceId]);

  // Initial connection setup
  useEffect(() => {
    console.log('App: Setting up initial connection');
    
    // Clear any existing timeouts first
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      setRetryTimeout(null);
    }
    
    // Start the connection process
    setupConnection();
    
    // Cleanup on unmount
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [setupConnection]);

  // Function to refresh the registration
  const refreshRegistration = useCallback(() => {
    console.log('App: Refreshing registration');
    
    setStatus('Refreshing registration...');
    setIsRefreshing(true);
    setErrorMessage(null);
    
    // Clear any existing retry timeout
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      setRetryTimeout(null);
    }
    
    if (connectionStatus !== 'connected') {
      // If not connected, try to reconnect first
      setupConnection();
    } else if (displayId) {
      // If connected, just re-register with forced timeout
      try {
        console.log('App: Re-registering display with ID:', displayId);
        
        // Create a timer to handle registration timeout locally
        const registrationTimeoutId = setTimeout(() => {
          console.log('App: Local registration timeout reached, stopping refresh state');
          setIsRefreshing(false);
          
          // If we have a pairing code, just use it
          const currentPairingCode = websocketService.getLastPairingCode?.() || localStorage.getItem('vizora-last-pairing-code');
          if (currentPairingCode) {
            console.log('App: Using existing pairing code after timeout:', currentPairingCode);
            setPairingCode(currentPairingCode);
            setConnectionStatus('connected');
            setStatus('Using existing pairing code (timeout occurred)');
          } else {
            setConnectionStatus('error');
            setStatus('Registration timed out. Please try again.');
            setErrorMessage('Registration timed out');
          }
        }, 10000); // 10 second local timeout
        
        websocketService.registerDisplay(displayId)
          .then(result => {
            console.log('App: Registration completed with result:', result);
            clearTimeout(registrationTimeoutId);
            
            // Manually force an update if the pairing code is in the result
            if (result && result.pairingCode) {
              console.log('App: Using new pairing code from registration:', result.pairingCode);
              setPairingCode(result.pairingCode);
              setConnectionStatus('connected');
              setStatus('Registered successfully');
              setIsRefreshing(false);
              
              // Store the successful pairing code in localStorage
              localStorage.setItem('vizora-last-pairing-code', result.pairingCode);
              localStorage.setItem('vizora-pairing-timestamp', Date.now().toString());
            } else {
              console.warn('App: No pairing code in registration result');
              setIsRefreshing(false);
              setConnectionStatus('error');
              setStatus('Registration response missing pairing code');
            }
          })
          .catch(error => {
            console.error('App: Error re-registering display:', error);
            clearTimeout(registrationTimeoutId);
            setConnectionStatus('error');
            setStatus('Registration failed. Please try again.');
            setIsRefreshing(false);
            setErrorMessage(error.message || 'Unknown error during re-registration');
          });
      } catch (error) {
        console.error('App: Error calling registerDisplay:', error);
        setConnectionStatus('error');
        setStatus('Registration failed. Please try again.');
        setIsRefreshing(false);
        setErrorMessage(error.message || 'Error calling register function');
      }
    } else {
      console.error('App: Cannot refresh registration - no displayId');
      setStatus('Cannot refresh registration - no device ID');
      setIsRefreshing(false);
      setErrorMessage('No device ID available');
    }
  }, [connectionStatus, displayId, setupConnection, retryTimeout]);

  // Function to reset the device ID
  const resetDeviceId = useCallback(() => {
    console.log('App: Resetting device ID');
    localStorage.removeItem('vizora-device-id');
    localStorage.removeItem('vizora-last-pairing-code');
    setPairingCode(null);
    setDisplayId(null);
    setRetryCount(0);
    setErrorMessage(null);
    
    // Force a reload to get a new device ID
    window.location.reload();
  }, []);

  // Retry connection
  const retryConnection = useCallback(() => {
    console.log('App: Manually retrying connection');
    setRetryCount(0); // Reset retry count for manual retry
    setupConnection();
  }, [setupConnection]);

  // Generate diagnostic data
  const generateDiagnostics = useCallback(() => {
    return JSON.stringify({
      displayId,
      connectionStatus,
      pairingCode,
      status,
      errorMessage,
      retryCount,
      serverUrl: websocketService.serverUrl,
      timestamp: new Date().toISOString()
    }, null, 2);
  }, [displayId, connectionStatus, pairingCode, status, errorMessage, retryCount]);

  // Check if we should force redirect to home on initial load
  useEffect(() => {
    console.log('App: Current location path:', location.pathname);
    
    // If at root path, ensure localStorage is cleared but don't redirect
    if (location.pathname === '/') {
      console.log('App: At root path, clearing localStorage');
      localStorage.removeItem('isPaired');
      localStorage.removeItem('pairedDisplayId');
      
      // If we're at the root path with a displayId, we should handle pairing logic
      // not redirect or clear
      const params = new URLSearchParams(location.search);
      const urlDisplayId = params.get('displayId');
      if (urlDisplayId) {
        console.log('App: DisplayId in URL at root path:', urlDisplayId);
        // Don't clear localStorage in this case
      }
    }
    
    // Do not redirect from content-display to home here, this is handled in main.tsx
  }, [location.pathname, location.search]);

  // Add effect to handle navigation when pairing status changes
  useEffect(() => {
    // Only navigate to content-display after explicit pairing, not just connection
    if (connectionStatus === 'paired' && displayId && location.pathname !== '/content-display') {
      console.log('App: isPaired state changed to true, navigating to content display');
      // Use programmatic navigation instead of window.location to prevent full page reload
      navigate(`/content-display?displayId=${displayId}&t=${Date.now()}`);
    }
  }, [connectionStatus, displayId, location.pathname, navigate]);

  // Generate QR data for the pairing code
  const generateQRData = useCallback(() => {
    if (!pairingCode || !displayId) return undefined;
    
    // Format: vizora://pair?code={pairingCode}&displayId={displayId}
    const qrData = `vizora://pair?code=${pairingCode}&displayId=${displayId}`;
    console.log('App: Generated QR data:', qrData);
    return qrData;
  }, [pairingCode, displayId]);

  // Update QR data when pairing code changes
  useEffect(() => {
    if (pairingCode && displayId) {
      const qrData = generateQRData();
      console.log('App: Updated QR data:', qrData);
      stateRef.current.qrData = qrData;
    }
  }, [pairingCode, displayId, generateQRData]);

  // Check if we should show the content display
  const isContentRoute = location.pathname === '/content-display';
  
  // Directly calculate QR data to ensure it's always available
  const qrData = useMemo(() => {
    if (pairingCode && displayId) {
      return `vizora://pair?code=${pairingCode}&displayId=${displayId}`;
    }
    return undefined;
  }, [pairingCode, displayId]);

  console.log('App: Current state before render:', {
    pairingCode,
    displayId,
    connectionStatus,
    qrData,
    stateRefQrData: stateRef.current.qrData
  });

  return (
    <ErrorBoundary>
      <div className="App">
        {!isContentRoute && (
          <PairingScreen
            pairingCode={pairingCode}
            displayId={displayId}
            connectionStatus={connectionStatus}
            status={status}
            qrData={qrData || stateRef.current.qrData}
            isRefreshing={isRefreshing}
            errorMessage={errorMessage}
            onRefresh={refreshRegistration}
            onReset={resetDeviceId}
            onRetry={retryConnection}
            onGenerateDiagnostics={generateDiagnostics}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App; 