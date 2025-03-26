import { io } from 'socket.io-client';

// Function to create a diagnostic report for the connection
export const createDiagnosticReport = async (serverUrl: string) => {
  const parsedUrl = new URL(serverUrl);
  const host = parsedUrl.host;
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      deviceMemory: (navigator as any).deviceMemory || 'unknown',
      connectionType: (navigator as any).connection?.type || 'unknown',
      connectionEffectiveType: (navigator as any).connection?.effectiveType || 'unknown',
    },
    targetServer: {
      url: serverUrl,
      host: host,
      protocol: parsedUrl.protocol,
      path: parsedUrl.pathname,
    },
    connectionTest: {
      health: await testEndpoint(`${serverUrl}/health`),
      socketIo: await testSocketIo(serverUrl),
      cors: await testCors(serverUrl),
    },
    networkInfo: {
      rtt: (navigator as any).connection?.rtt || 'unknown',
      downlink: (navigator as any).connection?.downlink || 'unknown',
      saveData: (navigator as any).connection?.saveData || 'unknown',
    },
    socketTest: await testSocket(serverUrl),
  };
  
  return report;
};

// Format the diagnostic report for display
export const formatDiagnosticReport = (report: any): string => {
  if (!report) return 'No diagnostic report available';
  
  try {
    return JSON.stringify(report, null, 2);
  } catch (e) {
    return `Error formatting report: ${e.message}`;
  }
};

// Helper function to test an endpoint
const testEndpoint = async (url: string) => {
  try {
    const startTime = performance.now();
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors',
    });
    const endTime = performance.now();
    
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { error: 'Failed to parse JSON response' };
    }
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseTime: Math.round(endTime - startTime),
      headers: Object.fromEntries([...response.headers.entries()]),
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Helper function to test Socket.IO connection
const testSocketIo = async (serverUrl: string) => {
  try {
    const socket = io(serverUrl, {
      transports: ['websocket'],
      timeout: 5000,
      reconnectionAttempts: 1,
    });
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        socket.disconnect();
        resolve({
          success: false,
          error: 'Connection timeout after 5000ms',
        });
      }, 5000);
      
      socket.on('connect', () => {
        clearTimeout(timeoutId);
        socket.disconnect();
        resolve({
          success: true,
          id: socket.id,
          connectedAt: new Date().toISOString(),
        });
      });
      
      socket.on('connect_error', (error) => {
        clearTimeout(timeoutId);
        socket.disconnect();
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Helper function to test CORS
const testCors = async (serverUrl: string) => {
  try {
    const response = await fetch(`${serverUrl}/cors-test`, {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'GET',
      },
    });
    
    return {
      success: response.ok,
      status: response.status,
      headers: Object.fromEntries([...response.headers.entries()]),
      hasAccessControlAllowOrigin: response.headers.has('Access-Control-Allow-Origin'),
      hasAccessControlAllowMethods: response.headers.has('Access-Control-Allow-Methods'),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Helper function to test socket connection and basic functionality
const testSocket = async (serverUrl: string) => {
  try {
    const socket = io(serverUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 1,
    });
    
    return new Promise((resolve) => {
      const result: any = {
        connected: false,
        events: [],
      };
      
      const timeoutId = setTimeout(() => {
        socket.disconnect();
        resolve(result);
      }, 5000);
      
      socket.on('connect', () => {
        result.connected = true;
        result.id = socket.id;
        result.events.push({
          type: 'connect',
          timestamp: new Date().toISOString(),
        });
        
        // Emit a ping to test round-trip
        const pingTimestamp = Date.now();
        socket.emit('ping', { timestamp: pingTimestamp });
      });
      
      socket.on('disconnect', () => {
        result.events.push({
          type: 'disconnect',
          timestamp: new Date().toISOString(),
        });
      });
      
      socket.on('pong', (data) => {
        result.events.push({
          type: 'pong',
          timestamp: new Date().toISOString(),
          roundTripTime: Date.now() - data.timestamp,
        });
        clearTimeout(timeoutId);
        socket.disconnect();
        resolve(result);
      });
      
      socket.on('connect_error', (error) => {
        result.events.push({
          type: 'connect_error',
          timestamp: new Date().toISOString(),
          message: error.message,
        });
      });
    });
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}; 