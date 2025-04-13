/**
 * Connectivity testing utilities
 */
import { apiClient } from '../lib/apiClient';
import { useConnectionState } from '@vizora/common';

interface ConnectivityTestResult {
  http: {
    success: boolean;
    message: string;
    details?: any;
    error?: string;
  };
  websocket: {
    success: boolean;
    message: string;
    details?: any;
    error?: string;
  };
}

/**
 * Tests both HTTP and WebSocket connectivity to the middleware server
 * @returns Promise resolving to test results
 */
export async function testConnectivity(): Promise<ConnectivityTestResult> {
  const result: ConnectivityTestResult = {
    http: {
      success: false,
      message: 'HTTP test not started'
    },
    websocket: {
      success: false,
      message: 'WebSocket test not started'
    }
  };

  // Test HTTP connectivity
  try {
    console.log('Testing HTTP connectivity...');
    const response = await apiClient.get('/connectivity-test');
    result.http = {
      success: true,
      message: 'HTTP connectivity test successful',
      details: response.data
    };
  } catch (error: any) {
    console.error('HTTP connectivity test failed:', error);
    result.http = {
      success: false,
      message: 'HTTP connectivity test failed',
      error: error.message || String(error)
    };
  }

  // Test WebSocket connectivity
  try {
    console.log('Testing WebSocket connectivity...');
    // Get auth token if available
    let token = null;
    try {
      token = localStorage.getItem('auth_token');
    } catch (e) {
      console.warn('Could not retrieve auth token from localStorage');
    }

    // Create options with authentication if token is available
    const options: any = {
      transports: ['websocket'],
      forceNew: true,
      timeout: 5000,
      auth: token ? { token } : undefined
    };

    // Get server URL from environment or use default
    const socketUrl = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3003`;
    
    // Wait for connection or timeout
    const wsResult = await new Promise<any>((resolve) => {
      // Set timeout for connection
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          message: 'WebSocket connection timed out after 5 seconds',
          error: 'Timeout'
        });
      }, 5000);
      
      // Listen for connection success
      useConnectionState(socketUrl, options, (connectedData) => {
        clearTimeout(timeout);
        
        resolve({
          success: true,
          message: 'WebSocket connection successful',
          details: connectedData
        });
      });
      
      // Listen for connection error
      useConnectionState(socketUrl, options, (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          message: 'WebSocket connection error',
          error: error
        });
      });
    });
    
    result.websocket = wsResult;
  } catch (error: any) {
    console.error('WebSocket connectivity test error:', error);
    result.websocket = {
      success: false,
      message: 'WebSocket connectivity test error',
      error: error.message || String(error)
    };
  }

  return result;
}

/**
 * Logs connectivity test results to console in an organized format
 */
export function logConnectivityResults(results: ConnectivityTestResult): void {
  console.group('🔌 Connectivity Test Results');
  
  // HTTP Results
  console.group('HTTP Connectivity');
  console.log(`Status: ${results.http.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Message: ${results.http.message}`);
  if (results.http.details) {
    console.log('Details:', results.http.details);
  }
  if (results.http.error) {
    console.error('Error:', results.http.error);
  }
  console.groupEnd();
  
  // WebSocket Results
  console.group('WebSocket Connectivity');
  console.log(`Status: ${results.websocket.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Message: ${results.websocket.message}`);
  if (results.websocket.details) {
    console.log('Details:', results.websocket.details);
  }
  if (results.websocket.error) {
    console.error('Error:', results.websocket.error);
  }
  console.groupEnd();
  
  console.groupEnd();
} 