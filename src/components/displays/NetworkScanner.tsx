import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, AlertTriangle } from 'lucide-react';

interface NetworkScannerProps {
  onDevicesFound: (devices: any[]) => void;
  onScanComplete: () => void;
}

const NetworkScanner: React.FC<NetworkScannerProps> = ({ onDevicesFound, onScanComplete }) => {
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');

  const startScan = () => {
    setScanStatus('scanning');
    setTimeout(() => {
      setScanStatus('complete');
      onDevicesFound([{ id: 'dev-001', name: 'Samsung Display', ip: '192.168.1.101', type: 'Smart TV' }]);
      onScanComplete();
    }, 2000);
  };

  useEffect(() => {
    startScan();
  }, []);

  return (
    <div className="p-4 bg-white border border-secondary-200">
      <p>{scanStatus === 'scanning' ? 'Scanning...' : 'Scan Complete'}</p>
      <button onClick={startScan} className="btn btn-secondary">
        <RefreshCw className="h-4 w-4 mr-2" />
        Rescan
      </button>
    </div>
  );
};

export default NetworkScanner;
