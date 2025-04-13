import { useState, useEffect } from 'react';
import { ConnectionManager } from '@vizora/common';
import { socketService } from '@/services/socketService';
import { displayPollingService } from '@/services/displayPollingService';
import { tokenManager } from '@/services/authService';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  latency?: number;
  details?: string;
}

/**
 * Component for testing connectivity to server
 */
export function ConnectivityTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  // Run tests when requested
  const runTests = async () => {
    setIsTesting(true);
    setResults([]);
    setExpanded([]);

    // Add initial test placeholders
    const initialTests: TestResult[] = [
      { name: 'API Connection', status: 'pending', message: 'Testing API connection...' },
      { name: 'Authentication', status: 'pending', message: 'Testing authentication...' },
      { name: 'Socket Connection', status: 'pending', message: 'Testing socket connection...' },
      { name: 'Display Service', status: 'pending', message: 'Testing display service...' },
    ];
    setResults(initialTests);

    // Test API connection
    await testApiConnection();

    // Test authentication
    await testAuthentication();

    // Test socket connection
    await testSocketConnection();

    // Test display service
    await testDisplayService();

    setIsTesting(false);
  };

  const testApiConnection = async () => {
    try {
      const startTime = performance.now();
      const response = await fetch('/api/health');
      const latency = Math.round(performance.now() - startTime);
      
      if (response.ok) {
        const data = await response.json();
        updateTestResult('API Connection', 'success', 'API connection successful', latency, JSON.stringify(data, null, 2));
      } else {
        updateTestResult('API Connection', 'error', `API request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      updateTestResult('API Connection', 'error', `API connection error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testAuthentication = async () => {
    try {
      // Check if we have a token
      const token = tokenManager.getToken();
      if (!token) {
        updateTestResult('Authentication', 'warning', 'No authentication token found');
        return;
      }

      // Validate token
      if (tokenManager.isExpired()) {
        updateTestResult('Authentication', 'warning', 'Authentication token is expired');
        return;
      }

      // Try to use token
      const startTime = performance.now();
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const latency = Math.round(performance.now() - startTime);

      if (response.ok) {
        const data = await response.json();
        updateTestResult('Authentication', 'success', 'Authentication token is valid', latency, JSON.stringify(data, null, 2));
      } else {
        updateTestResult('Authentication', 'error', `Authentication failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      updateTestResult('Authentication', 'error', `Authentication error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testSocketConnection = async () => {
    try {
      // Check if socket is connected
      if (socketService.isConnected()) {
        const socketId = socketService.getSocketId();
        const latency = await socketService.getLatency();
        updateTestResult('Socket Connection', 'success', `Socket already connected with ID: ${socketId}`, latency);
        return;
      }

      // Try to connect
      updateTestResult('Socket Connection', 'pending', 'Attempting to connect socket...');
      
      // Connect with timeout
      const connectPromise = new Promise<void>((resolve, reject) => {
        // Set up one-time connect listener
        const connectListener = () => {
          resolve();
        };

        // Set up one-time error listener
        const errorListener = (error: any) => {
          reject(new Error(`Socket connection error: ${error instanceof Error ? error.message : String(error)}`));
        };

        // Listen for connect and error events
        socketService.on('connect', connectListener);
        socketService.on('error', errorListener);

        // Connect socket
        socketService.connect().catch(reject);

        // Set timeout
        setTimeout(() => {
          // Clean up listeners
          socketService.off('connect', connectListener);
          socketService.off('error', errorListener);
          reject(new Error('Socket connection timed out after 5 seconds'));
        }, 5000);
      });

      await connectPromise;
      
      // Get socket ID and latency
      const socketId = socketService.getSocketId();
      const latency = await socketService.getLatency();
      
      updateTestResult('Socket Connection', 'success', `Socket connected with ID: ${socketId}`, latency);
    } catch (error) {
      updateTestResult('Socket Connection', 'error', `Socket connection error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testDisplayService = async () => {
    try {
      // Check if display service is initialized
      if (!displayPollingService.isActive()) {
        displayPollingService.init();
        updateTestResult('Display Service', 'pending', 'Initializing display service...');
        
        // Wait for display service to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Get latency
      const latency = await displayPollingService.getLatency();
      
      // Check if socket is connected
      if (displayPollingService.isSocketConnected()) {
        updateTestResult('Display Service', 'success', 'Display service connected via WebSocket', latency);
      } else {
        updateTestResult('Display Service', 'warning', 'Display service using polling fallback', latency);
      }
    } catch (error) {
      updateTestResult('Display Service', 'error', `Display service error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const updateTestResult = (name: string, status: TestResult['status'], message: string, latency?: number, details?: string) => {
    setResults(prevResults => 
      prevResults.map(result => 
        result.name === name 
          ? { ...result, status, message, latency, details } 
          : result
      )
    );
  };

  const toggleExpanded = (name: string) => {
    setExpanded(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: TestResult['status'] }) => {
    const colors = {
      pending: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
        {status === 'pending' && 'Pending'}
        {status === 'success' && 'Success'}
        {status === 'error' && 'Error'}
        {status === 'warning' && 'Warning'}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Connectivity Tests</h2>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={runTests}
          disabled={isTesting}
        >
          {isTesting ? 'Running Tests...' : 'Run Tests'}
        </button>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Click "Run Tests" to check connectivity
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.name} className="border rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => result.details && toggleExpanded(result.name)}
              >
                <div className="flex items-center space-x-3">
                  <StatusBadge status={result.status} />
                  <h3 className="font-medium text-gray-900">{result.name}</h3>
                  {result.latency !== undefined && (
                    <span className="text-sm text-gray-500">{result.latency}ms</span>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">{result.message}</span>
                  {result.details && (
                    <svg 
                      className={`w-5 h-5 transition-transform ${expanded.includes(result.name) ? 'transform rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>
              {result.details && expanded.includes(result.name) && (
                <div className="p-4 bg-gray-50 border-t">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{result.details}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 