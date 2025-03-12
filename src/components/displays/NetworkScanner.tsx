import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, AlertTriangle } from 'lucide-react';

interface NetworkScannerProps {
  onDevicesFound: (devices: any[]) => void;
  onScanComplete: () => void;
}

const NetworkScanner: React.FC<NetworkScannerProps> = ({ onDevicesFound, onScanComplete }) => {
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState(0);

  const mockDevices = [
    { id: 'dev-001', name: 'Samsung Smart Display', ip: '192.168.1.101', type: 'Smart TV' },
    { id: 'dev-002', name: 'LG WebOS Display', ip: '192.168.1.102', type: 'Smart TV' },
    { id: 'dev-003', name: 'Raspberry Pi Media Player', ip: '192.168.1.103', type: 'Media Player' }
  ];

  const startScan = () => {
    setScanStatus('scanning');
    setScanProgress(0);
    
    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress(prev => {
        const newProgress = prev + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setScanStatus('complete');
          onDevicesFound(mockDevices);
          onScanComplete();
          return 100;
        }
        return newProgress;
      });
    }, 200);
  };

  useEffect(() => {
    startScan();
    // Cleanup interval on unmount
    return () => {
      // This would clear any intervals if component unmounts during scan
    };
  }, []);

  return (
    <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {scanStatus === 'scanning' && <Wifi className="h-5 w-5 text-primary-500 mr-2 animate-pulse" />}
          {scanStatus === 'complete' && <Wifi className="h-5 w-5 text-green-500 mr-2" />}
          {scanStatus === 'error' && <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />}
          <span className="text-sm font-medium text-secondary-700">
            {scanStatus === 'idle' && 'Ready to scan'}
            {scanStatus === 'scanning' && 'Scanning network...'}
            {scanStatus === 'complete' && 'Scan complete'}
            {scanStatus === 'error' && 'Scan failed'}
          </span>
        </div>
        <button 
          onClick={startScan} 
          className="inline-flex items-center px-3 py-1.5 border border-secondary-300 text-xs font-medium rounded-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          disabled={scanStatus === 'scanning'}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Rescan
        </button>
      </div>
      
      {scanStatus === 'scanning' && (
        <div className="w-full bg-secondary-200 rounded-full h-2.5">
          <div 
            className="bg-primary-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
            style={{ width: `${scanProgress}%` }}
          ></div>
        </div>
      )}
      
      <p className="mt-2 text-xs text-secondary-500">
        {scanStatus === 'scanning' && 'Searching for compatible display devices on your network...'}
        {scanStatus === 'complete' && `Found ${mockDevices.length} compatible devices on your network.`}
        {scanStatus === 'error' && 'There was an error scanning your network. Please try again.'}
      </p>
    </div>
  );
};

export default NetworkScanner;
