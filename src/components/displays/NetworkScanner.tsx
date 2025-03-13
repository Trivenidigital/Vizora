import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, AlertTriangle, WifiOff, Edit, Info } from 'lucide-react';
import { deviceDiscoveryService, Device, ScanStatus } from '../../services/deviceDiscoveryService';

interface NetworkScannerProps {
  onDevicesFound: (devices: Device[]) => void;
  onScanComplete: () => void;
}

const NetworkScanner: React.FC<NetworkScannerProps> = ({ onDevicesFound, onScanComplete }) => {
  const [scanStatus, setScanStatus] = useState<ScanStatus>({ status: 'idle' });
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  useEffect(() => {
    const listener = {
      onConnectionStatusChange: (connected: boolean) => {
        console.log('Connection status changed:', connected);
        setIsConnected(connected);
      },
      onScanStatusChange: (status: ScanStatus) => {
        console.log('Scan status changed:', status);
        setScanStatus(status);
      },
      onDeviceFound: (device: Device) => {
        console.log('Device found:', device);
        setFoundDevices(prev => {
          const newDevices = [...prev, device];
          onDevicesFound(newDevices);
          return newDevices;
        });
      },
      onScanComplete: () => {
        console.log('Scan completed');
        onScanComplete();
      },
      onScanError: (error: string) => {
        console.error('Scan error:', error);
        setErrorMessage(error);
      }
    };

    deviceDiscoveryService.addListener(listener);

    return () => {
      deviceDiscoveryService.removeListener(listener);
    };
  }, [onDevicesFound, onScanComplete]);

  useEffect(() => {
    if (isConnected && scanStatus.status === 'idle') {
      console.log('Starting scan due to connection...');
      deviceDiscoveryService.startScan();
    }
  }, [isConnected, scanStatus.status]);

  const handleRescan = () => {
    if (scanStatus.status === 'scanning') {
      deviceDiscoveryService.stopScan();
      setScanStatus({ status: 'idle' });
    } else {
      setFoundDevices([]);
      setErrorMessage(null);
      deviceDiscoveryService.startScan();
    }
  };

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {scanStatus.status === 'scanning' && <Wifi className="h-5 w-5 text-primary-500 mr-2 animate-pulse" />}
          {scanStatus.status === 'completed' && <Wifi className="h-5 w-5 text-green-500 mr-2" />}
          {scanStatus.status === 'error' && <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />}
          {scanStatus.status === 'idle' && <WifiOff className="h-5 w-5 text-secondary-400 mr-2" />}
          <span className="text-sm font-medium text-secondary-700">
            {scanStatus.status === 'idle' && 'Ready to scan'}
            {scanStatus.status === 'scanning' && 'Scanning network...'}
            {scanStatus.status === 'completed' && `Scan complete (${foundDevices.length} devices found)`}
            {scanStatus.status === 'error' && 'Scan failed'}
          </span>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={toggleHelp}
            className="inline-flex items-center px-3 py-1.5 border border-secondary-300 text-xs font-medium rounded-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Info className="h-3.5 w-3.5 mr-1" />
            Help
          </button>
          <button 
            onClick={handleRescan} 
            disabled={!isConnected}
            className={`inline-flex items-center px-3 py-1.5 border border-secondary-300 text-xs font-medium rounded-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
              !isConnected ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {scanStatus.status === 'scanning' ? 'Stop' : 'Scan'}
          </button>
        </div>
      </div>
      
      {showHelp && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
          <h4 className="font-medium mb-1">Troubleshooting Network Scanning</h4>
          <ul className="list-disc pl-4 space-y-1">
            <li>Make sure your device is on the same WiFi network as the displays you want to detect</li>
            <li>For Samsung Smart TVs, ensure they are powered on and connected to WiFi</li>
            <li>For Amazon Fire Sticks, make sure they're not in sleep mode</li>
            <li>Browser security restrictions may limit network scanning capabilities</li>
            <li>If scanning fails, you can still add displays manually</li>
          </ul>
        </div>
      )}
      
      <p className="mt-2 text-xs text-secondary-500">
        {scanStatus.status === 'scanning' && 'Searching for compatible display devices on your network...'}
        {scanStatus.status === 'completed' && foundDevices.length > 0 && 
          `Found ${foundDevices.length} compatible devices on your network.`}
        {scanStatus.status === 'completed' && foundDevices.length === 0 && 
          'No compatible devices found on your network.'}
        {scanStatus.status === 'error' && (errorMessage || 'There was an error scanning your network. Please try again.')}
      </p>
    </div>
  );
};

export default NetworkScanner;
