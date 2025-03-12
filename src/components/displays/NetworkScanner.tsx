import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, AlertTriangle } from 'lucide-react';

interface NetworkScannerProps {
  onDevicesFound: (devices: any[]) => void;
  onScanComplete: () => void;
}

// This component simulates network scanning functionality
// In a real implementation, this would use browser APIs or a backend service
const NetworkScanner: React.FC<NetworkScannerProps> = ({ onDevicesFound, onScanComplete }) => {
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to scan');

  // Mock discovered devices
  const mockDevices = [
    {
      id: 'dev-001',
      name: 'Samsung Smart Display',
      ip: '192.168.1.101',
      mac: '00:1A:2B:3C:4D:5E',
      type: 'Smart TV',
      model: 'Samsung Tizen 4.0',
      status: 'available'
    },
    {
      id: 'dev-002',
      name: 'LG WebOS Display',
      ip: '192.168.1.102',
      mac: '00:1A:2B:3C:4D:5F',
      type: 'Smart TV',
      model: 'LG WebOS 6.0',
      status: 'available'
    },
    {
      id: 'dev-003',
      name: 'Android Media Player',
      ip: '192.168.1.103',
      mac: '00:1A:2B:3C:4D:60',
      type: 'Media Player',
      model: 'Android 10.0',
      status: 'available'
    }
  ];

  // Simulate network scanning process
  const startScan = () => {
    setScanStatus('scanning');
    setStatusMessage('Initializing scan...');
    setProgress(0);
    
    // Simulate scanning progress
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 5;
        
        // Update status messages based on progress
        if (newProgress === 20) {
          setStatusMessage('Discovering devices on network...');
        } else if (newProgress === 50) {
          setStatusMessage('Identifying display devices...');
        } else if (newProgress === 80) {
          setStatusMessage('Gathering device information...');
        }
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setScanStatus('complete');
          setStatusMessage('Scan complete');
          onDevicesFound(mockDevices);
          onScanComplete();
          return 100;
        }
        return newProgress;
      });
    }, 200);
    
    // Simulate potential errors (randomly)
    if (Math.random() < 0.1) { // 10% chance of error
      clearInterval(interval);
      setScanStatus('error');
      setStatusMessage('Error: Could not complete network scan');
    }
    
    return () => clearInterval(interval);
  };

  // Start scanning automatically when component mounts
  useEffect(() => {
    startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 bg-white rounded-lg border border-secondary-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {scanStatus === 'scanning' && (
            <RefreshCw className="h-5 w-5 text-primary-500 animate-spin mr-2" />
          )}
          {scanStatus === 'complete' && (
            <Wifi className="h-5 w-5 text-green-500 mr-2" />
          )}
          {scanStatus === 'error' && (
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          )}
          <span className="font-medium text-secondary-900">
            {scanStatus === 'scanning' ? 'Scanning Network' : 
             scanStatus === 'complete' ? 'Scan Complete' : 
             scanStatus === 'error' ? 'Scan Failed' : 'Network Scanner'}
          </span>
        </div>
        
        <button 
          className="btn btn-sm btn-secondary flex items-center"
          onClick={startScan}
          disabled={scanStatus === 'scanning'}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Rescan
        </button>
      </div>
      
      <div className="w-full bg-secondary-100 rounded-full h-2.5 mb-2">
        <div 
          className={`h-2.5 rounded-full ${
            scanStatus === 'error' ? 'bg-red-500' : 'bg-primary-500'
          }`} 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <p className="text-xs text-secondary-500">{statusMessage}</p>
      
      {scanStatus === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          <p className="font-medium">Scan failed</p>
          <p className="mt-1">There was an error scanning your network. This could be due to browser security restrictions or network configuration.</p>
          <button 
            className="mt-2 text-red-700 font-medium hover:text-red-800"
            onClick={startScan}
          >
            Try Again
          </button>
        </div>
      )}
      
      {scanStatus === 'complete' && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
          <p>Found {mockDevices.length} compatible display devices on your network</p>
        </div>
      )}
    </div>
  );
};

export default NetworkScanner;
