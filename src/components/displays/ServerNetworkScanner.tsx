import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, AlertTriangle, WifiOff, Edit, Info } from 'lucide-react';
import deviceDiscoveryService from '../../services/deviceDiscovery';
import { Device } from '../../types/device';

interface ServerNetworkScannerProps {
  onDevicesFound: (devices: Device[]) => void;
  onScanComplete: () => void;
}

const ServerNetworkScanner: React.FC<ServerNetworkScannerProps> = ({ 
  onDevicesFound, 
  onScanComplete 
}) => {
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualIp, setManualIp] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Set up event listeners
    deviceDiscoveryService.on('connected', () => {
      setIsConnected(true);
    });

    deviceDiscoveryService.on('disconnected', () => {
      setIsConnected(false);
    });

    deviceDiscoveryService.on('scanStatus', (status: any) => {
      if (status.status === 'started') {
        setScanStatus('scanning');
        setScanProgress(0);
        setFoundDevices([]);
        setErrorMessage(null);
      } else if (status.status === 'already-scanning') {
        setErrorMessage('A scan is already in progress');
      }
    });

    deviceDiscoveryService.on('scanProgress', (progress: any) => {
      setScanProgress(progress.progress);
      setProgressMessage(progress.message);
    });

    deviceDiscoveryService.on('deviceFound', (device: Device) => {
      setFoundDevices(prev => {
        const newDevices = [...prev, device];
        onDevicesFound(newDevices);
        return newDevices;
      });
    });

    deviceDiscoveryService.on('scanComplete', () => {
      setScanStatus('complete');
      onScanComplete();
    });

    deviceDiscoveryService.on('scanError', (error: any) => {
      setScanStatus('error');
      setErrorMessage(error.message || 'Unknown error during scan');
    });

    // Start scan automatically when component mounts
    startScan();

    // Cleanup on unmount
    return () => {
      deviceDiscoveryService.off('connected', () => {});
      deviceDiscoveryService.off('disconnected', () => {});
      deviceDiscoveryService.off('scanStatus', () => {});
      deviceDiscoveryService.off('scanProgress', () => {});
      deviceDiscoveryService.off('deviceFound', () => {});
      deviceDiscoveryService.off('scanComplete', () => {});
      deviceDiscoveryService.off('scanError', () => {});
    };
  }, []);

  const startScan = () => {
    setScanStatus('scanning');
    setScanProgress(0);
    setFoundDevices([]);
    setErrorMessage(null);
    deviceDiscoveryService.startScan();
  };

  const handleRescan = () => {
    if (scanStatus === 'scanning') {
      // Currently no way to stop a scan from the client
      // We could add this feature to the server
      setScanStatus('idle');
    } else {
      startScan();
    }
  };

  const handleManualDeviceAdd = () => {
    if (!manualIp) return;

    const newDevice: Partial<Device> = {
      name: `Manual Device (${manualIp})`,
      ip: manualIp,
      type: 'Manual Entry',
      status: 'online'
    };

    deviceDiscoveryService.addManualDevice(newDevice);
    setManualIp('');
  };

  const toggleManualInput = () => {
    setShowManualInput(!showManualInput);
  };

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {!isConnected && <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />}
          {isConnected && scanStatus === 'scanning' && <Wifi className="h-5 w-5 text-primary-500 mr-2 animate-pulse" />}
          {isConnected && scanStatus === 'complete' && <Wifi className="h-5 w-5 text-green-500 mr-2" />}
          {isConnected && scanStatus === 'error' && <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />}
          {isConnected && scanStatus === 'idle' && <WifiOff className="h-5 w-5 text-secondary-400 mr-2" />}
          <span className="text-sm font-medium text-secondary-700">
            {!isConnected && 'Connecting to discovery service...'}
            {isConnected && scanStatus === 'idle' && 'Ready to scan'}
            {isConnected && scanStatus === 'scanning' && 'Scanning network...'}
            {isConnected && scanStatus === 'complete' && `Scan complete (${foundDevices.length} devices found)`}
            {isConnected && scanStatus === 'error' && 'Scan failed'}
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
            onClick={toggleManualInput} 
            className="inline-flex items-center px-3 py-1.5 border border-secondary-300 text-xs font-medium rounded-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Edit className="h-3.5 w-3.5 mr-1" />
            {showManualInput ? 'Auto' : 'Manual'}
          </button>
          <button 
            onClick={handleRescan} 
            disabled={!isConnected}
            className="inline-flex items-center px-3 py-1.5 border border-secondary-300 text-xs font-medium rounded-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {scanStatus === 'scanning' ? 'Stop' : 'Scan'}
          </button>
        </div>
      </div>
      
      {showHelp && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
          <h4 className="font-medium mb-1">About Server-Side Network Scanning</h4>
          <ul className="list-disc pl-4 space-y-1">
            <li>This scanner uses a Node.js server to detect devices on your network</li>
            <li>It can detect Samsung Smart TVs, Amazon Fire Sticks, and other compatible devices</li>
            <li>Make sure your device is on the same WiFi network as the displays you want to detect</li>
            <li>For Samsung Smart TVs, ensure they are powered on and connected to WiFi</li>
            <li>For Amazon Fire Sticks, make sure they're not in sleep mode</li>
            <li>If devices aren't detected automatically, you can add them manually</li>
          </ul>
        </div>
      )}
      
      {showManualInput && (
        <div className="mb-4">
          <label htmlFor="manualIp" className="block text-xs font-medium text-secondary-700 mb-1">
            Enter device IP address manually
          </label>
          <div className="flex">
            <input
              type="text"
              id="manualIp"
              className="flex-grow block border border-secondary-300 rounded-l-md shadow-sm py-1.5 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="192.168.1.100"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
            />
            <button
              onClick={handleManualDeviceAdd}
              disabled={!manualIp || !isConnected}
              className="inline-flex items-center px-3 py-1.5 border border-l-0 border-secondary-300 text-xs font-medium rounded-r-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <p className="mt-1 text-xs text-secondary-500">
            Enter the IP address of your display device
          </p>
        </div>
      )}
      
      {scanStatus === 'scanning' && (
        <div>
          <div className="w-full bg-secondary-200 rounded-full h-2.5 mb-1">
            <div 
              className="bg-primary-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: `${scanProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-secondary-500">{progressMessage}</p>
        </div>
      )}
      
      <p className="mt-2 text-xs text-secondary-500">
        {!isConnected && 'Waiting for connection to discovery service...'}
        {isConnected && scanStatus === 'scanning' && 'Searching for compatible display devices on your network...'}
        {isConnected && scanStatus === 'complete' && foundDevices.length > 0 && 
          `Found ${foundDevices.length} compatible devices on your network.`}
        {isConnected && scanStatus === 'complete' && foundDevices.length === 0 && 
          'No compatible devices found on your network. Try adding devices manually.'}
        {isConnected && scanStatus === 'error' && (errorMessage || 'There was an error scanning your network. Please try again.')}
      </p>
    </div>
  );
};

export default ServerNetworkScanner;
