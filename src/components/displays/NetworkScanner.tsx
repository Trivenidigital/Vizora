import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Wifi, AlertTriangle, WifiOff, Edit, Info } from 'lucide-react';
import { NetworkScanner as NetworkScannerUtil } from '../../utils/networkScanner';
import { Device } from '../../types/device';

interface NetworkScannerProps {
  onDevicesFound: (devices: Device[]) => void;
  onScanComplete: () => void;
}

const NetworkScanner: React.FC<NetworkScannerProps> = ({ onDevicesFound, onScanComplete }) => {
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualSubnet, setManualSubnet] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const scannerRef = useRef<NetworkScannerUtil | null>(null);

  useEffect(() => {
    // Initialize scanner
    scannerRef.current = new NetworkScannerUtil();
    
    // Start scan automatically when component mounts
    startScan();
    
    // Cleanup on unmount
    return () => {
      if (scannerRef.current && scanStatus === 'scanning') {
        scannerRef.current.stopScan();
      }
    };
  }, []);

  const startScan = async (subnet?: string) => {
    if (!scannerRef.current) return;
    
    try {
      setScanStatus('scanning');
      setScanProgress(0);
      setFoundDevices([]);
      setErrorMessage(null);
      
      const devices = await scannerRef.current.scanNetwork(
        // Progress callback
        (progress) => {
          setScanProgress(progress);
        },
        // Device found callback
        (device) => {
          setFoundDevices(prev => {
            const newDevices = [...prev, device];
            onDevicesFound(newDevices);
            return newDevices;
          });
        },
        // Optional manual subnet
        subnet
      );
      
      setScanStatus('complete');
      onScanComplete();
    } catch (error) {
      console.error('Error during network scan:', error);
      setScanStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error during scan');
    }
  };

  const handleRescan = () => {
    if (scanStatus === 'scanning') {
      if (scannerRef.current) {
        scannerRef.current.stopScan();
        setScanStatus('idle');
      }
    } else {
      startScan(showManualInput ? manualSubnet : undefined);
    }
  };

  const handleManualSubnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualSubnet(e.target.value);
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
          {scanStatus === 'scanning' && <Wifi className="h-5 w-5 text-primary-500 mr-2 animate-pulse" />}
          {scanStatus === 'complete' && <Wifi className="h-5 w-5 text-green-500 mr-2" />}
          {scanStatus === 'error' && <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />}
          {scanStatus === 'idle' && <WifiOff className="h-5 w-5 text-secondary-400 mr-2" />}
          <span className="text-sm font-medium text-secondary-700">
            {scanStatus === 'idle' && 'Ready to scan'}
            {scanStatus === 'scanning' && 'Scanning network...'}
            {scanStatus === 'complete' && `Scan complete (${foundDevices.length} devices found)`}
            {scanStatus === 'error' && 'Scan failed'}
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
            className="inline-flex items-center px-3 py-1.5 border border-secondary-300 text-xs font-medium rounded-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {scanStatus === 'scanning' ? 'Stop' : 'Scan'}
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
            <li>Try using Manual mode and enter your network subnet (e.g., 192.168.1.0)</li>
            <li>Some common network subnets are: 192.168.1.0, 192.168.0.0, 10.0.0.0</li>
            <li>Browser security restrictions may limit network scanning capabilities</li>
            <li>If scanning fails, you can still add displays manually</li>
          </ul>
        </div>
      )}
      
      {showManualInput && (
        <div className="mb-4">
          <label htmlFor="subnet" className="block text-xs font-medium text-secondary-700 mb-1">
            Enter your network subnet (e.g., 192.168.1.0)
          </label>
          <div className="flex">
            <input
              type="text"
              id="subnet"
              className="flex-grow block border border-secondary-300 rounded-l-md shadow-sm py-1.5 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="192.168.1.0"
              value={manualSubnet}
              onChange={handleManualSubnetChange}
            />
            <button
              onClick={() => startScan(manualSubnet)}
              disabled={!manualSubnet || scanStatus === 'scanning'}
              className="inline-flex items-center px-3 py-1.5 border border-l-0 border-secondary-300 text-xs font-medium rounded-r-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <p className="mt-1 text-xs text-secondary-500">
            Enter the first three octets of your network IP address
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => setManualSubnet('192.168.1.0')}
              className="text-xs px-2 py-1 border border-secondary-200 rounded bg-white hover:bg-secondary-50"
            >
              192.168.1.0
            </button>
            <button
              onClick={() => setManualSubnet('192.168.0.0')}
              className="text-xs px-2 py-1 border border-secondary-200 rounded bg-white hover:bg-secondary-50"
            >
              192.168.0.0
            </button>
            <button
              onClick={() => setManualSubnet('10.0.0.0')}
              className="text-xs px-2 py-1 border border-secondary-200 rounded bg-white hover:bg-secondary-50"
            >
              10.0.0.0
            </button>
            <button
              onClick={() => setManualSubnet('172.16.0.0')}
              className="text-xs px-2 py-1 border border-secondary-200 rounded bg-white hover:bg-secondary-50"
            >
              172.16.0.0
            </button>
          </div>
        </div>
      )}
      
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
        {scanStatus === 'complete' && foundDevices.length > 0 && 
          `Found ${foundDevices.length} compatible devices on your network.`}
        {scanStatus === 'complete' && foundDevices.length === 0 && 
          'No compatible devices found on your network. Try using Manual mode with your specific subnet.'}
        {scanStatus === 'error' && (errorMessage || 'There was an error scanning your network. Please try again.')}
        {scanStatus === 'error' && errorMessage === 'Could not determine local IP address' && 
          ' Try using the Manual option to enter your network subnet.'}
      </p>
    </div>
  );
};

export default NetworkScanner;
