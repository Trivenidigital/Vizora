import { Toaster } from 'react-hot-toast';
import { router } from '@/config/routes';
import { RouterProvider } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { displayPollingService } from '@/services/displayPollingService';
import { toast } from 'react-hot-toast';

import TestCors from './pages/TestCors';
import SocketDebug from './components/dev/SocketDebug';

// Simple LoadingScreen component
const LoadingScreen = ({ message = 'Loading...' }) => (
  <div style={{ 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    width: '100%', 
    height: '100%', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#1a202c',
    flexDirection: 'column',
    color: 'white'
  }}>
    <div style={{
      width: '50px',
      height: '50px',
      border: '3px solid rgba(255,255,255,0.3)',
      borderRadius: '50%',
      borderTopColor: 'white',
      animation: 'spin 1s linear infinite',
      marginBottom: '20px'
    }}></div>
    <p>{message}</p>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// App component with routing
export function App() {
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Define socket event handlers as callbacks to maintain stable references
  const handleSocketConnect = useCallback(() => {
    setSocketConnected(true);
    console.log('Socket connected, will use WebSockets for display updates');
  }, []);

  const handleSocketDisconnect = useCallback(() => {
    setSocketConnected(false);
    console.log('Socket disconnected, will use polling fallback for display updates');
    // Show a toast notification only if it was previously connected
    if (socketConnected) {
      toast('Connection lost. Using polling fallback.', {
        icon: '🔄',
        duration: 3000,
      });
    }
  }, [socketConnected]);

  // Initialize and monitor socket connection
  useEffect(() => {
    const init = async () => {
      try {
        // Register socket event listeners
        displayPollingService.onSocketConnect(handleSocketConnect);
        displayPollingService.onSocketDisconnect(handleSocketDisconnect);

        // Initialize the connection
        await displayPollingService.init();
      } catch (error) {
        console.error('Failed to initialize:', error);
        toast.error('Failed to initialize application');
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Clean up listeners on unmount
    return () => {
      displayPollingService.offSocketConnect(handleSocketConnect);
      displayPollingService.offSocketDisconnect(handleSocketDisconnect);
    };
  }, [handleSocketConnect, handleSocketDisconnect]);

  if (isLoading) {
    return <LoadingScreen message="Initializing application..." />;
  }

  return (
    <>
      {/* Toast notification container */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: '#22c55e',
              color: '#fff',
            }
          },
          error: {
            duration: 5000,
            style: {
              background: '#ef4444',
              color: '#fff',
            }
          }
        }}
      />
      
      <RouterProvider router={router} />
      
      {/* Socket Debug overlay (dev-only) */}
      <SocketDebug />
    </>
  );
}

export default App; 