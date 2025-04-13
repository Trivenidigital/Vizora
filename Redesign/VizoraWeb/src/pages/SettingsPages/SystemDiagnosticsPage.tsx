import React, { useState, useEffect } from 'react';
import { ConnectivityTest } from '@/components/diagnostics/ConnectivityTest';
import { formatBytes, formatUptime } from '@/utils/formatters';

interface SystemInfo {
  version: string;
  uptime: number;
  environment: string;
  nodeVersion: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  platform: string;
  hostname: string;
}

/**
 * System Diagnostics page for administrators
 */
export function SystemDiagnosticsPage() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<any>(null);
  const [socketLoading, setSocketLoading] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  // Fetch system information
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/system/info');
        if (!response.ok) {
          throw new Error(`Failed to fetch system info: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setSystemInfo(data);
      } catch (err) {
        console.error('Error fetching system info:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch system information');
      } finally {
        setLoading(false);
      }
    };

    fetchSystemInfo();
  }, []);

  // Function to check socket status
  const checkSocketStatus = async () => {
    try {
      setSocketLoading(true);
      setSocketError(null);

      const response = await fetch('/api/socket-diagnostic');
      if (!response.ok) {
        throw new Error(`Failed to fetch socket status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setSocketStatus(data);
    } catch (err) {
      console.error('Error fetching socket status:', err);
      setSocketError(err instanceof Error ? err.message : 'Failed to fetch socket status');
    } finally {
      setSocketLoading(false);
    }
  };

  // Function to open socket diagnostic tool
  const openSocketDiagnostic = () => {
    window.open('/socket-diagnostic.html', '_blank');
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">System Diagnostics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ConnectivityTest />
          
          {/* Socket Diagnostics Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Socket Diagnostics</h2>
            
            <div className="space-y-4">
              <div className="flex space-x-4">
                <button
                  onClick={checkSocketStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
                  disabled={socketLoading}
                >
                  {socketLoading ? 'Checking...' : 'Check Socket Status'}
                </button>
                
                <button
                  onClick={openSocketDiagnostic}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition"
                >
                  Open Socket Diagnostic Tool
                </button>
              </div>
              
              {socketError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
                  <p>{socketError}</p>
                </div>
              )}
              
              {socketStatus && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Socket Server Status</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 w-40">Status:</span>
                      <span className={`text-sm font-medium ${socketStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                        {socketStatus.status || 'Unknown'}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 w-40">Active Connections:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {socketStatus.serverStats?.activeConnections || 0}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 w-40">Authenticated Clients:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {socketStatus.connections?.authenticated || 0}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 w-40">Anonymous Clients:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {socketStatus.connections?.anonymous || 0}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 w-40">User Connections:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {socketStatus.connections?.users || 0}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 w-40">Device Connections:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {socketStatus.connections?.devices || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">System Information</h2>
            
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
                <p>{error}</p>
                <p className="mt-2 text-sm">
                  <a href="https://docs.vizora.io/troubleshooting" className="text-red-600 hover:text-red-800 underline">
                    See troubleshooting documentation
                  </a>
                </p>
              </div>
            ) : systemInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500">Version</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{systemInfo.version}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500">Environment</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{systemInfo.environment}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500">Uptime</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatUptime(systemInfo.uptime)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500">Node Version</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{systemInfo.nodeVersion}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Memory Usage</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Heap Used</p>
                      <p className="text-base font-medium text-gray-900">{formatBytes(systemInfo.memoryUsage.heapUsed)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Heap Total</p>
                      <p className="text-base font-medium text-gray-900">{formatBytes(systemInfo.memoryUsage.heapTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">RSS</p>
                      <p className="text-base font-medium text-gray-900">{formatBytes(systemInfo.memoryUsage.rss)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">External</p>
                      <p className="text-base font-medium text-gray-900">{formatBytes(systemInfo.memoryUsage.external)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">CPU Usage</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">User</p>
                      <p className="text-base font-medium text-gray-900">{(systemInfo.cpuUsage.user / 1000).toFixed(2)}ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">System</p>
                      <p className="text-base font-medium text-gray-900">{(systemInfo.cpuUsage.system / 1000).toFixed(2)}ms</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500">Platform</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{systemInfo.platform}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500">Hostname</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{systemInfo.hostname}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
} 