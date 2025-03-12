import { useState, useEffect } from 'react';
import { X, Search, RefreshCw, Monitor, Wifi, Server } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import NetworkScanner from './NetworkScanner';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDisplay: (display: {
    id: number;
    name: string;
    location: string;
    status: string;
    lastSeen: string;
    resolution: string;
    currentContent: string;
    type: string;
    groups: string[];
  }) => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onAddDisplay }) => {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const handleDevicesFound = (devices: any[]) => {
    setDiscoveredDevices(devices);
  };

  const scanNetwork = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 2000);
  };

  const handleSubmit = () => {
    if (selectedDevice) {
      const device = discoveredDevices.find(d => d.id === selectedDevice);
      if (device) {
        onAddDisplay({
          id: Date.now(),
          name: device.name,
          location: 'New Location',
          status: 'offline',
          lastSeen: 'Never',
          resolution: '1920x1080',
          currentContent: 'None',
          type: device.type,
          groups: []
        });
        onClose();
      }
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <div className="fixed inset-0 bg-black bg-opacity-25" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Dialog.Panel className="w-full max-w-3xl bg-white p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title as="h3" className="text-lg font-medium text-secondary-900">
                  Add New Display
                </Dialog.Title>
                <button className="text-secondary-400 hover:text-secondary-500" onClick={onClose}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <NetworkScanner onDevicesFound={handleDevicesFound} onScanComplete={() => setIsScanning(false)} />

              <button className="btn btn-primary mt-4" onClick={handleSubmit} disabled={!selectedDevice}>
                Add Display
              </button>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AddDisplayModal;
