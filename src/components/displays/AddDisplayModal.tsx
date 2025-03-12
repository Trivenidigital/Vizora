import { useState, useEffect } from 'react';
import { X, Monitor, Wifi } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import NetworkScanner from './NetworkScanner';
import { Device } from '../../types/device';

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
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceLocation, setDeviceLocation] = useState('');

  const handleDevicesFound = (devices: Device[]) => {
    setDiscoveredDevices(devices);
  };

  const handleScanComplete = () => {
    setIsScanning(false);
  };

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(deviceId);
    const device = discoveredDevices.find(d => d.id === deviceId);
    if (device) {
      setDeviceName(device.name);
    }
  };

  const handleSubmit = () => {
    if (selectedDevice) {
      const device = discoveredDevices.find(d => d.id === selectedDevice);
      if (device) {
        onAddDisplay({
          id: Date.now(),
          name: deviceName || device.name,
          location: deviceLocation || 'New Location',
          status: device.status,
          lastSeen: new Date().toLocaleString(),
          resolution: device.resolution || '1920x1080',
          currentContent: device.currentContent || 'None',
          type: device.type,
          groups: []
        });
        onClose();
        // Reset form
        setSelectedDevice(null);
        setDeviceName('');
        setDeviceLocation('');
      }
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium text-secondary-900">
                    Add New Display
                  </Dialog.Title>
                  <button 
                    className="text-secondary-400 hover:text-secondary-500" 
                    onClick={onClose}
                    type="button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4">
                  <h4 className="text-md font-medium text-secondary-900 mb-2">Discover Devices</h4>
                  <p className="text-sm text-secondary-500 mb-4">
                    Scan your network to find compatible display devices.
                  </p>
                  
                  <NetworkScanner 
                    onDevicesFound={handleDevicesFound} 
                    onScanComplete={handleScanComplete} 
                  />

                  <div className="mt-6">
                    <h4 className="text-md font-medium text-secondary-900 mb-2">Available Devices</h4>
                    <div className="border border-secondary-200 rounded-md overflow-hidden">
                      <ul className="divide-y divide-secondary-200">
                        {discoveredDevices.map((device) => (
                          <li key={device.id}>
                            <button
                              type="button"
                              className={`w-full px-4 py-3 flex items-center hover:bg-secondary-50 ${
                                selectedDevice === device.id ? 'bg-secondary-50' : ''
                              }`}
                              onClick={() => handleDeviceSelect(device.id)}
                            >
                              <div className="flex-shrink-0 h-10 w-10 bg-secondary-100 rounded-full flex items-center justify-center">
                                <Monitor className="h-5 w-5 text-secondary-600" />
                              </div>
                              <div className="ml-4 text-left">
                                <div className="text-sm font-medium text-secondary-900">{device.name}</div>
                                <div className="text-xs text-secondary-500">{device.ip} • {device.type}</div>
                              </div>
                              {selectedDevice === device.id && (
                                <div className="ml-auto">
                                  <div className="h-5 w-5 bg-primary-500 rounded-full flex items-center justify-center">
                                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </button>
                          </li>
                        ))}
                        {discoveredDevices.length === 0 && (
                          <li className="px-4 py-3 text-sm text-secondary-500 text-center">
                            No devices found. Try scanning again.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {selectedDevice && (
                    <div className="mt-6">
                      <h4 className="text-md font-medium text-secondary-900 mb-2">Display Details</h4>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="display-name" className="block text-sm font-medium text-secondary-700">
                            Display Name
                          </label>
                          <input
                            type="text"
                            id="display-name"
                            className="mt-1 block w-full border border-secondary-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            placeholder="Enter display name"
                          />
                        </div>
                        <div>
                          <label htmlFor="display-location" className="block text-sm font-medium text-secondary-700">
                            Location
                          </label>
                          <input
                            type="text"
                            id="display-location"
                            className="mt-1 block w-full border border-secondary-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            value={deviceLocation}
                            onChange={(e) => setDeviceLocation(e.target.value)}
                            placeholder="Where is this display located?"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-secondary-700 bg-white border border-secondary-300 rounded-md hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={handleSubmit}
                    disabled={!selectedDevice}
                  >
                    Add Display
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AddDisplayModal;
