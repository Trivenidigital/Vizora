import React, { useEffect, useState } from 'react';
import './App.css';
import { VizoraDisplay } from './components/VizoraDisplay';
import { LoadingScreen } from './components/LoadingScreen';
import { networkStatus } from './services/networkStatus';
import { cacheStorage } from './services/storage/CacheStorage';
import { SocketDebug } from './components/dev';

interface AppConfig {
  deviceId?: string;
  apiUrl: string;
  contentEndpoint: string;
  autoAdvance: boolean;
  transitionEffect: 'fade' | 'none' | 'crossfade';
  transitionDuration: number;
  offlineMode: boolean;
  retryInterval: number;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<AppConfig>({
    apiUrl: process.env.REACT_APP_API_URL || 'https://api.vizora.io',
    contentEndpoint: process.env.REACT_APP_CONTENT_ENDPOINT || '/api/display/content',
    autoAdvance: true,
    transitionEffect: 'fade',
    transitionDuration: 500,
    offlineMode: false,
    retryInterval: 30000, // 30 seconds
  });
  const [error, setError] = useState<string | null>(null);

  // Initialize the application
  useEffect(() => {
    async function initializeApp() {
      try {
        // Initialize cache storage
        await cacheStorage.initialize();
        
        // Load device ID from localStorage
        const storedDeviceId = localStorage.getItem('deviceId');
        
        // Load config from env or use defaults
        setConfig(prevConfig => ({
          ...prevConfig,
          deviceId: storedDeviceId || undefined,
        }));
        
        // Check network status
        const isOnline = networkStatus.isOnline();
        console.log('Network status:', isOnline ? 'Online' : 'Offline');
        
        // Set offline mode if network is unavailable
        if (!isOnline) {
          setConfig(prevConfig => ({
            ...prevConfig,
            offlineMode: true,
          }));
        }
        
        // Subscribe to network status changes
        const handleStatusChange = (info: any) => {
          console.log('Network status changed:', info);
          setConfig(prevConfig => ({
            ...prevConfig,
            offlineMode: !info.online,
          }));
        };
        networkStatus.on('statusChange', handleStatusChange);
        
        // Load settings from URL parameters if available
        const params = new URLSearchParams(window.location.search);
        if (params.has('deviceId')) {
          const deviceId = params.get('deviceId');
          if (deviceId) {
            console.log('Setting device ID from URL:', deviceId);
            localStorage.setItem('deviceId', deviceId);
            setConfig(prevConfig => ({
              ...prevConfig,
              deviceId,
            }));
          }
        }
        
        if (params.has('apiUrl')) {
          const apiUrl = params.get('apiUrl');
          if (apiUrl) {
            setConfig(prevConfig => ({
              ...prevConfig,
              apiUrl,
            }));
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize application:', err);
        setError('Failed to initialize application. Please refresh the page.');
        setIsLoading(false);
      }
    }
    
    initializeApp();
    
    // Cleanup on unmount
    return () => {
      networkStatus.removeAllListeners();
      // Ensure cacheStorage is properly cleaned up if it exists
      if (cacheStorage && typeof cacheStorage.close === 'function') {
        cacheStorage.close();
      }
    };
  }, []);

  // Handle device ID setup
  const handleDeviceIdSubmit = (deviceId: string) => {
    if (deviceId && deviceId.trim().length > 0) {
      localStorage.setItem('deviceId', deviceId);
      setConfig(prevConfig => ({
        ...prevConfig,
        deviceId,
      }));
    }
  };

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <>
        <LoadingScreen message="Initializing Display..." />
        <SocketDebug />
      </>
    );
  }

  // Show device registration screen if no device ID is set
  if (!config.deviceId) {
    return (
      <>
        <div className="device-registration">
          <h1>Vizora Display</h1>
          <p>Please enter a device ID to continue:</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('deviceId') as HTMLInputElement;
            handleDeviceIdSubmit(input.value);
          }}>
            <input
              type="text"
              name="deviceId"
              placeholder="Device ID"
              autoFocus
            />
            <button type="submit">Connect</button>
          </form>
          {error && <div className="error-message">{error}</div>}
        </div>
        <SocketDebug />
      </>
    );
  }

  // Render the main display component
  return (
    <div className="app">
      <VizoraDisplay 
        deviceId={config.deviceId}
        apiUrl={config.apiUrl}
        contentEndpoint={config.contentEndpoint}
        autoAdvance={config.autoAdvance}
        transitionEffect={config.transitionEffect}
        transitionDuration={config.transitionDuration}
        offlineMode={config.offlineMode}
        retryInterval={config.retryInterval}
      />
      {error && <div className="error-message">{error}</div>}
      <SocketDebug />
    </div>
  );
}

export default App; 