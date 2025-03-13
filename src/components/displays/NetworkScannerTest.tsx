import React, { useEffect, useState } from 'react';
import { deviceDiscoveryService, Device, ScanStatus } from '../../services/deviceDiscoveryService';

const NetworkScannerTest: React.FC = () => {
  const [scanStatus, setScanStatus] = useState<ScanStatus>({ status: 'idle' });
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setFoundDevices(prev => [...prev, device]);
      },
      onScanComplete: () => {
        console.log('Scan completed');
        setScanStatus({ status: 'completed' });
      },
      onScanError: (errorMessage: string) => {
        console.error('Scan error:', errorMessage);
        setError(errorMessage);
      }
    };

    deviceDiscoveryService.addListener(listener);

    return () => {
      deviceDiscoveryService.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (isConnected && scanStatus.status === 'idle') {
      console.log('Starting scan due to connection...');
      deviceDiscoveryService.startScan();
    }
  }, [isConnected, scanStatus.status]);

  const handleScan = () => {
    console.log('Manual scan requested');
    setFoundDevices([]);
    setError(null);
    deviceDiscoveryService.startScan();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Network Scanner Test</h2>
      
      <div className="mb-4">
        <p>Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        <p>Scan Status: {scanStatus.status}</p>
        {scanStatus.message && <p>Message: {scanStatus.message}</p>}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleScan}
        disabled={!isConnected || scanStatus.status === 'scanning'}
        className={`px-4 py-2 rounded ${
          !isConnected || scanStatus.status === 'scanning'
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {scanStatus.status === 'scanning' ? 'Scanning...' : 'Scan Network'}
      </button>

      {foundDevices.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xl font-semibold mb-2">Found Devices:</h3>
          <ul className="space-y-2">
            {foundDevices.map((device) => (
              <li key={device.id} className="border p-2 rounded">
                <p><strong>Name:</strong> {device.name}</p>
                <p><strong>Type:</strong> {device.type}</p>
                <p><strong>IP:</strong> {device.ip}</p>
                {device.port && <p><strong>Port:</strong> {device.port}</p>}
                {device.location && <p><strong>Location:</strong> {device.location}</p>}
                {device.manufacturer && <p><strong>Manufacturer:</strong> {device.manufacturer}</p>}
                {device.model && <p><strong>Model:</strong> {device.model}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NetworkScannerTest; 