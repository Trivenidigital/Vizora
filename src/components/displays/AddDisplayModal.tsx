import { useState, useEffect } from 'react';
import { X, Monitor, Wifi, Plus, AlertCircle, Check, Loader2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'scan' | 'manual' | 'qr'>('scan');
  const [manualIp, setManualIp] = useState('');
  const [manualType, setManualType] = useState('Smart TV');
  const [isManualValid, setIsManualValid] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

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

  const validateManualIp = (ip: string) => {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const handleManualIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ip = e.target.value;
    setManualIp(ip);
    setIsManualValid(validateManualIp(ip));
  };

  const testConnection = async () => {
    if (!isManualValid) return;
    
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    
    // Simulate connection test
    setTimeout(() => {
      // 80% chance of success for demo purposes
      const success = Math.random() < 0.8;
      
      setConnectionStatus(success ? 'success' : 'error');
      setIsTestingConnection(false);
      
      if (success) {
        // Auto-select this device
        const manualDevice: Device = {
          id: `manual-${Date.now()}`,
          name: `${manualType} (${manualIp})`,
          ip: manualIp,
          type: manualType,
          status: 'online',
          lastSeen: new Date().toISOString(),
          resolution: manualType.includes('TV') ? '3840x2160' : '1920x1080'
        };
        
        setDiscoveredDevices(prev => [...prev, manualDevice]);
        setSelectedDevice(manualDevice.id);
        setDeviceName(manualDevice.name);
      }
    }, 1500);
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
        setManualIp('');
        setConnectionStatus('idle');
      }
    } else if (activeTab === 'manual' && isManualValid && connectionStatus === 'success') {
      // Create a device from manual entry
      onAddDisplay({
        id: Date.now(),
        name: deviceName || `${manualType} (${manualIp})`,
        location: deviceLocation || 'New Location',
        status: 'online',
        lastSeen: new Date().toLocaleString(),
        resolution: manualType.includes('TV') ? '3840x2160' : '1920x1080',
        currentContent: 'None',
        type: manualType,
        groups: []
      });
      onClose();
      // Reset form
      setSelectedDevice(null);
      setDeviceName('');
      setDeviceLocation('');
      setManualIp('');
      setConnectionStatus('idle');
    }
  };

  // Common device types for quick selection
  const deviceTypes = [
    { id: 'smart-tv', name: 'Smart TV', icon: '📺' },
    { id: 'fire-stick', name: 'Amazon Fire Stick', icon: '🔥' },
    { id: 'roku', name: 'Roku', icon: '📱' },
    { id: 'apple-tv', name: 'Apple TV', icon: '🍎' },
    { id: 'chromecast', name: 'Chromecast', icon: '📡' },
    { id: 'digital-signage', name: 'Digital Signage', icon: '🖥️' }
  ];

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

                {/* Tabs */}
                <div className="border-b border-secondary-200 mb-6">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                      onClick={() => setActiveTab('scan')}
                      className={`${
                        activeTab === 'scan'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      <Wifi className="inline-block h-4 w-4 mr-2" />
                      Network Scan
                    </button>
                    <button
                      onClick={() => setActiveTab('manual')}
                      className={`${
                        activeTab === 'manual'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      <Plus className="inline-block h-4 w-4 mr-2" />
                      Manual Entry
                    </button>
                    <button
                      onClick={() => setActiveTab('qr')}
                      className={`${
                        activeTab === 'qr'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      <svg className="inline-block h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      QR Code
                    </button>
                  </nav>
                </div>

                {/* Tab content */}
                <div className="mt-4">
                  {/* Network Scan Tab */}
                  {activeTab === 'scan' && (
                    <div>
                      <p className="text-sm text-secondary-500 mb-4">
                        Scan your network to find compatible display devices automatically.
                      </p>
                      
                      <NetworkScanner 
                        onDevicesFound={handleDevicesFound} 
                        onScanComplete={handleScanComplete} 
                      />

                      <div className="mt-6">
                        <h4 className="text-md font-medium text-secondary-900 mb-2">Available Devices</h4>
                        <div className="border border-secondary-200 rounded-md overflow-hidden">
                          <ul className="divide-y divide-secondary-200 max-h-60 overflow-y-auto">
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
                                No devices found. Try scanning again or use manual entry.
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual Entry Tab */}
                  {activeTab === 'manual' && (
                    <div>
                      <p className="text-sm text-secondary-500 mb-4">
                        Manually add a display by entering its IP address and selecting its type.
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="device-ip" className="block text-sm font-medium text-secondary-700 mb-1">
                            Display IP Address
                          </label>
                          <div className="flex">
                            <input
                              type="text"
                              id="device-ip"
                              className={`flex-grow block border rounded-l-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                                manualIp && !isManualValid ? 'border-red-300' : 'border-secondary-300'
                              }`}
                              placeholder="192.168.1.100"
                              value={manualIp}
                              onChange={handleManualIpChange}
                            />
                            <button
                              onClick={testConnection}
                              disabled={!isManualValid || connectionStatus === 'testing'}
                              className="inline-flex items-center px-3 py-2 border border-l-0 border-secondary-300 text-sm font-medium rounded-r-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                            >
                              {connectionStatus === 'testing' ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                'Test Connection'
                              )}
                            </button>
                          </div>
                          {manualIp && !isManualValid && (
                            <p className="mt-1 text-xs text-red-500">
                              Please enter a valid IP address (e.g., 192.168.1.100)
                            </p>
                          )}
                          {connectionStatus === 'success' && (
                            <p className="mt-1 text-xs text-green-500 flex items-center">
                              <Check className="h-3 w-3 mr-1" /> Connection successful! Device is reachable.
                            </p>
                          )}
                          {connectionStatus === 'error' && (
                            <p className="mt-1 text-xs text-red-500 flex items-center">
                              <AlertCircle className="h-3 w-3 mr-1" /> Could not connect to device. Please verify the IP address.
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Device Type
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {deviceTypes.map((type) => (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => setManualType(type.name)}
                                className={`flex items-center p-3 border rounded-md ${
                                  manualType === type.name
                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                    : 'border-secondary-200 hover:bg-secondary-50'
                                }`}
                              >
                                <span className="text-lg mr-2">{type.icon}</span>
                                <span className="text-sm">{type.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="display-name-manual" className="block text-sm font-medium text-secondary-700">
                            Display Name (Optional)
                          </label>
                          <input
                            type="text"
                            id="display-name-manual"
                            className="mt-1 block w-full border border-secondary-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            placeholder={`${manualType} (${manualIp || 'IP Address'})`}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="display-location-manual" className="block text-sm font-medium text-secondary-700">
                            Location (Optional)
                          </label>
                          <input
                            type="text"
                            id="display-location-manual"
                            className="mt-1 block w-full border border-secondary-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            value={deviceLocation}
                            onChange={(e) => setDeviceLocation(e.target.value)}
                            placeholder="Where is this display located?"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Code Tab */}
                  {activeTab === 'qr' && (
                    <div className="text-center py-8">
                      <div className="mx-auto w-48 h-48 bg-secondary-100 rounded-md flex items-center justify-center mb-4">
                        <svg className="h-24 w-24 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>
                      <h4 className="text-md font-medium text-secondary-900 mb-2">Scan QR Code with Your Display</h4>
                      <p className="text-sm text-secondary-500 max-w-md mx-auto">
                        Open the Vizora app on your display device and scan this QR code to connect automatically. 
                        The display will appear in your list once connected.
                      </p>
                      <div className="mt-4">
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          Generate New Code
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Display Details (shown when a device is selected or manual entry is valid) */}
                  {(selectedDevice || (activeTab === 'manual' && connectionStatus === 'success')) && (
                    <div className="mt-6 pt-4 border-t border-secondary-200">
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
                    disabled={!(selectedDevice || (activeTab === 'manual' && isManualValid && connectionStatus === 'success'))}
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
